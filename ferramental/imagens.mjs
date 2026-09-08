/**
 * As imagens do site — og.png e os dois ícones —, GERADAS DA PRÓPRIA MARCA.
 *
 * Por que existe. As três imagens vieram prontas do gerador do rebar, na cor
 * dele e com uma letra "A" no lugar do desenho. Quando a paleta do assay foi
 * decidida, elas continuaram laranja: o `og.png` é o que aparece quando alguém
 * manda o link no WhatsApp ou no LinkedIn, e era a única peça do site ainda na
 * cor de outro projeto. Sem um gerador aqui dentro, "atualizar a marca" seria
 * abrir um editor de imagem — e o que exige abrir editor não é atualizado.
 *
 * O DESENHO NÃO É REESCRITO AQUI. Este arquivo LÊ `public/marca.svg` e
 * rasteriza o que está lá: o retângulo do corpo, o polígono da fenda que é
 * subtraído dele, e os traços das camadas com seus pesos e opacidades. Redigitar
 * os caminhos em JavaScript seria a marca em dois lugares — e o dia em que um
 * dos dois mudasse, o favicon e o ícone do celular mostrariam desenhos
 * diferentes sem nada reprovar.
 *
 * O que ele NÃO faz: não é um renderizador de SVG. Entende o subconjunto exato
 * que a marca usa e ESTOURA em qualquer outra coisa — um `<circle>`, uma curva,
 * um segundo `<g>`. Estourar é o comportamento certo: a alternativa é desenhar
 * pela metade e gravar um PNG que ninguém conferiu.
 *
 *   node ferramental/imagens.mjs            grava as três imagens
 *   node ferramental/imagens.mjs --provar   confere o que foi lido do SVG
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

// ── PNG, só com o que vem no Node ─────────────────────────────────────────
// A mesma mecânica do gerador: assinatura, IHDR, IDAT e IEND com CRC32. Não há
// codificador de JPEG escrito à mão nem arquivo com extensão mentindo sobre o
// conteúdo — alguns leitores de preview farejam os bytes, não o nome.

const TABELA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pedaco(tipo, dados) {
  const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados])
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo), 0)
  return Buffer.concat([tamanho, corpo, crc])
}

function png(largura, altura, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8
  ihdr[9] = 2 // truecolor RGB
  const linhas = Buffer.alloc(altura * (1 + largura * 3))
  for (let y = 0; y < altura; y++) {
    const destino = y * (1 + largura * 3)
    linhas[destino] = 0
    rgb.copy(linhas, destino + 1, y * largura * 3, (y + 1) * largura * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', deflateSync(linhas, { level: 9 })),
    pedaco('IEND', Buffer.alloc(0)),
  ])
}

// ── o SVG lido, não redigitado ────────────────────────────────────────────

const exigir = (condicao, mensagem) => {
  if (!condicao) throw new Error(`marca.svg: ${mensagem}`)
}

const atributo = (tag, nome) => {
  const casou = tag.match(new RegExp(`\\b${nome}="([^"]*)"`))
  return casou ? casou[1] : null
}

/** Os pontos de um `d` feito só de M, L e Z — que é tudo que a marca usa. */
function pontos(d) {
  exigir(/^[ MLZ0-9.-]+$/i.test(d), `caminho fora do subconjunto M/L/Z: ${d}`)
  const numeros = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  exigir(numeros.length % 2 === 0 && numeros.length >= 4, `caminho com coordenada ímpar: ${d}`)
  const saida = []
  for (let i = 0; i < numeros.length; i += 2) saida.push([numeros[i], numeros[i + 1]])
  return saida
}

export function lerMarca(svg) {
  const caixa = atributo(svg, 'viewBox')
  exigir(caixa === '0 0 100 100', `viewBox inesperada: ${caixa}`)

  const bloco = svg.match(/<mask[^>]*>([\s\S]*?)<\/mask>/)
  exigir(bloco, 'não achei o <mask> da fenda')
  const fenda = bloco[1].match(/<path[^>]*\/>/g) ?? []
  exigir(fenda.length === 1, `esperava 1 caminho dentro do <mask>, achei ${fenda.length}`)

  const corpo = (svg.match(/<rect[^>]*mask="[^"]*"[^>]*\/>/g) ?? [])[0]
  exigir(corpo, 'não achei o <rect> do corpo (o que usa a máscara)')

  const grupo = svg.match(/<g[^>]*stroke=[\s\S]*?<\/g>/)
  exigir(grupo, 'não achei o <g> das camadas')
  const tracos = (grupo[0].match(/<path[^>]*\/>/g) ?? []).map((tag) => ({
    pontos: pontos(atributo(tag, 'd')),
    largura: Number(atributo(tag, 'stroke-width')),
    opacidade: Number(atributo(tag, 'opacity') ?? '1'),
  }))
  exigir(tracos.length >= 1, 'nenhuma camada dentro do <g>')
  for (const t of tracos) {
    exigir(t.pontos.length === 2, 'camada que não é um segmento de dois pontos')
    exigir(t.largura > 0, 'camada sem stroke-width')
  }

  return {
    corpo: {
      x: Number(atributo(corpo, 'x')),
      y: Number(atributo(corpo, 'y')),
      largura: Number(atributo(corpo, 'width')),
      altura: Number(atributo(corpo, 'height')),
      raio: Number(atributo(corpo, 'rx')),
    },
    fenda: pontos(atributo(fenda[0], 'd')),
    tracos,
  }
}

// ── geometria ─────────────────────────────────────────────────────────────

function dentroDoRetangulo(px, py, r) {
  const x1 = r.x + r.raio
  const x2 = r.x + r.largura - r.raio
  const y1 = r.y + r.raio
  const y2 = r.y + r.altura - r.raio
  if (px < r.x || px > r.x + r.largura || py < r.y || py > r.y + r.altura) return false
  // Fora dos quatro cantos, é retângulo puro; dentro deles, vale o círculo.
  const cx = px < x1 ? x1 : px > x2 ? x2 : px
  const cy = py < y1 ? y1 : py > y2 ? y2 : py
  if (cx === px || cy === py) return true
  return (px - cx) ** 2 + (py - cy) ** 2 <= r.raio ** 2
}

/** Raio para a direita, contando cruzamentos. */
function dentroDoPoligono(px, py, vertices) {
  let dentro = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [xi, yi] = vertices[i]
    const [xj, yj] = vertices[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

/** Segmento com ponta redonda: distância do ponto ao segmento ≤ metade da largura. */
function dentroDaCapsula(px, py, [[ax, ay], [bx, by]], largura) {
  const dx = bx - ax
  const dy = by - ay
  const comprimento = dx * dx + dy * dy
  let t = comprimento === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / comprimento
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const qx = ax + t * dx
  const qy = ay + t * dy
  return (px - qx) ** 2 + (py - qy) ** 2 <= (largura / 2) ** 2
}

const AMOSTRAS = 4 // 4×4 por pixel: a fenda é diagonal, e diagonal sem suavizar vira serra

/**
 * Pinta a marca num buffer RGB já existente, em `tamanho` pixels de lado.
 * `mistura` é a composição do traço sobre o que já está embaixo — é o que
 * reproduz as opacidades 0.9 / 0.5 / 0.28 do SVG.
 */
export function pintarMarca(rgb, larguraDaTela, marca, { x0, y0, tamanho, tinta }) {
  const escala = tamanho / 100
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      let r = 0
      let g = 0
      let b = 0
      let cobriu = 0
      for (let sy = 0; sy < AMOSTRAS; sy++) {
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const ux = (x + (sx + 0.5) / AMOSTRAS) / escala
          const uy = (y + (sy + 0.5) / AMOSTRAS) / escala
          let alfa = 0
          if (dentroDoRetangulo(ux, uy, marca.corpo) && !dentroDoPoligono(ux, uy, marca.fenda))
            alfa = 1
          for (const t of marca.tracos)
            if (dentroDaCapsula(ux, uy, t.pontos, t.largura))
              alfa = alfa + t.opacidade * (1 - alfa)
          if (alfa > 0) {
            r += tinta[0] * alfa
            g += tinta[1] * alfa
            b += tinta[2] * alfa
            cobriu += alfa
          }
        }
      }
      const total = AMOSTRAS * AMOSTRAS
      if (cobriu === 0) continue
      const i = ((y0 + y) * larguraDaTela + (x0 + x)) * 3
      const peso = cobriu / total
      const mediaR = r / cobriu
      const mediaG = g / cobriu
      const mediaB = b / cobriu
      rgb[i] = Math.round(rgb[i] * (1 - peso) + mediaR * peso)
      rgb[i + 1] = Math.round(rgb[i + 1] * (1 - peso) + mediaG * peso)
      rgb[i + 2] = Math.round(rgb[i + 2] * (1 - peso) + mediaB * peso)
    }
  }
}

// ── a fonte 5×7, para o cartão ────────────────────────────────────────────
// Vinda do gerador. Não é tipografia: é o que impede o preview de sair vazio.

const FONTE = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '11111 00100 00100 00100 00100 00100 11111',
  J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 11011 10001',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110',
  1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111',
  3: '11111 00010 00100 00010 00001 10001 01110',
  4: '00010 00110 01010 10010 11111 00010 00010',
  5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110',
  7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110',
  9: '01110 10001 10001 01111 00001 00010 01100',
  '.': '00000 00000 00000 00000 00000 01100 01100',
  '/': '00001 00010 00010 00100 01000 01000 10000',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
}

const normalizar = (texto) =>
  [...texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()]
    .map((c) => (c in FONTE ? c : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

const hexParaRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function tela(largura, altura, cor) {
  const rgb = Buffer.alloc(largura * altura * 3)
  for (let i = 0; i < largura * altura; i++) {
    rgb[i * 3] = cor[0]
    rgb[i * 3 + 1] = cor[1]
    rgb[i * 3 + 2] = cor[2]
  }
  return rgb
}

function retangulo(rgb, largura, altura, x0, y0, w, h, cor) {
  for (let y = Math.max(0, y0); y < Math.min(altura, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(largura, x0 + w); x++) {
      const i = (y * largura + x) * 3
      rgb[i] = cor[0]
      rgb[i + 1] = cor[1]
      rgb[i + 2] = cor[2]
    }
}

const larguraDoTexto = (texto, escala) => (texto.length ? texto.length * 6 * escala - escala : 0)

function escrever(rgb, largura, altura, texto, x0, y0, escala, cor) {
  let x = x0
  for (const caractere of texto) {
    const linhas = FONTE[caractere].split(' ')
    for (let ly = 0; ly < 7; ly++)
      for (let lx = 0; lx < 5; lx++)
        if (linhas[ly][lx] === '1')
          retangulo(rgb, largura, altura, x + lx * escala, y0 + ly * escala, escala, escala, cor)
    x += 6 * escala
  }
}

// ── as três imagens ───────────────────────────────────────────────────────

const LARGURA_OG = 1200
const ALTURA_OG = 630

export function cartaoOg(marca, { nome, dominio, tinta, fundo, suave }) {
  const rgb = tela(LARGURA_OG, ALTURA_OG, fundo)
  // A MARCA GRANDE À ESQUERDA, e o nome ao lado dela: é a leitura de um
  // segundo que um preview de link tem. Um cartão só com texto não diz de quem
  // é; um cartão só com o símbolo não diz o que é.
  pintarMarca(rgb, LARGURA_OG, marca, { x0: 96, y0: 195, tamanho: 240, tinta })
  escrever(rgb, LARGURA_OG, ALTURA_OG, normalizar(nome), 392, 250, 18, tinta)
  escrever(rgb, LARGURA_OG, ALTURA_OG, normalizar(dominio).slice(0, 40), 392, 400, 5, suave)
  // Um fio embaixo, na cor da marca, para o cartão ter eixo.
  retangulo(rgb, LARGURA_OG, ALTURA_OG, 96, 534, LARGURA_OG - 192, 6, tinta)
  return png(LARGURA_OG, ALTURA_OG, rgb)
}

export function icone(marca, tamanho, { tinta, fundo }) {
  const rgb = tela(tamanho, tamanho, fundo)
  pintarMarca(rgb, tamanho, marca, { x0: 0, y0: 0, tamanho, tinta })
  return png(tamanho, tamanho, rgb)
}

function main() {
  const svg = readFileSync(join(RAIZ, 'public', 'marca.svg'), 'utf8')
  const marca = lerMarca(svg)
  const { meta, identidade } = JSON.parse(
    readFileSync(join(RAIZ, 'conteudo', 'site.json'), 'utf8'),
  )

  if (process.argv.includes('--provar')) {
    console.log('lido de public/marca.svg:')
    console.log(`  corpo   ${JSON.stringify(marca.corpo)}`)
    console.log(`  fenda   ${marca.fenda.length} vértices`)
    console.log(`  camadas ${marca.tracos.map((t) => `${t.largura}@${t.opacidade}`).join(' ')}`)
    return
  }

  const tinta = hexParaRgb(meta.cores.tema)
  const fundo = hexParaRgb(meta.cores.fundo)
  const suave = hexParaRgb('#9aa3ad')
  const url = new URL(meta.urlBase)

  const imagens = [
    ['og.png', cartaoOg(marca, { nome: identidade.nome, dominio: `${url.host}${url.pathname}`, tinta, fundo, suave })],
    ['icone-192.png', icone(marca, 192, { tinta, fundo })],
    ['icone-512.png', icone(marca, 512, { tinta, fundo })],
  ]
  for (const [nome, bytes] of imagens) {
    writeFileSync(join(RAIZ, 'public', nome), bytes)
    console.log(`public/${nome} · ${(bytes.length / 1024).toFixed(1)} KB`)
  }
}

main()
