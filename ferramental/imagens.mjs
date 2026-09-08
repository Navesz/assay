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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

// ── os dois SVG do README ─────────────────────────────────────────────────

/**
 * A DECLARAÇÃO DE PROCEDÊNCIA que todo artefato gerado carrega.
 *
 * Não é cortesia com quem abre o arquivo — é o que permite a uma régua
 * distinguir um valor DERIVADO de um valor REDIGITADO. A regra `raw-hex` do
 * rebar acusa uma cor escrita à mão que já existe como token no CSS, e ela está
 * certa: essa cor vai divergir. Num arquivo gerado A PARTIR do token ela não
 * pode divergir, porque regerar a re-deriva — e a única forma de a régua saber
 * a diferença é o arquivo dizer de onde veio e por quem.
 *
 * A marca nomeia o gerador. Nomear é o que a torna conferível em vez de
 * palavra mágica: dá para exigir que o arquivo citado exista.
 */
const MARCA_DE_GERACAO =
  '  <!-- GENERATED by ferramental/imagens.mjs from public/marca.svg and app/globals.css. Do not edit by hand: run the generator. -->'


// A MARCA VIRA DOIS PEDAÇOS DE SVG, e não um só, porque em SVG a ORDEM É A
// PINTURA: a máscara tem que entrar no `<defs>` lá em cima e o corpo tem que
// sair DEPOIS do cartão e do ladrilho, ou o cartão pinta por cima da marca. A
// primeira versão devolvia os dois juntos e o estandarte saiu sem marca
// nenhuma — visível só abrindo o arquivo, que é o que quase ninguém faz com um
// SVG gerado.

/** A máscara da fenda, para o `<defs>`. */
const mascaraDaMarca = (marca, id) =>
  `    <mask id="${id}">
      <rect width="100" height="100" fill="#fff" />
      <path d="${marca.fenda.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')} Z" fill="#000" />
    </mask>`

/** O corpo da marca, com a mesma geometria lida de `public/marca.svg`. */
function corpoDaMarca(marca, id, cor, transformacao) {
  const c = marca.corpo
  const camadas = marca.tracos
    .map(
      (t) =>
        `      <path d="M${t.pontos[0][0]} ${t.pontos[0][1]} L${t.pontos[1][0]} ${t.pontos[1][1]}" stroke-width="${t.largura}" opacity="${t.opacidade}" />`,
    )
    .join('\n')
  return `  <g transform="${transformacao}">
    <rect x="${c.x}" y="${c.y}" width="${c.largura}" height="${c.altura}" rx="${c.raio}" fill="${cor}" mask="url(#${id})" />
    <g stroke="${cor}" stroke-linecap="round" fill="none">
${camadas}
    </g>
  </g>`
}

/**
 * O ESTANDARTE DO README, gerado e não desenhado à mão.
 *
 * A marca aqui dentro é a MESMA de `public/marca.svg` — os caminhos são
 * interpolados do que `lerMarca` leu, não redigitados. Redigitá-los faria a
 * marca do README divergir da do site no dia em que uma das duas mudasse, e
 * ninguém repara num estandarte.
 */
export function estandarte(marca, { nome, tema, fundo, tinta, suave, linha, superficie }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="220" viewBox="0 0 920 220" role="img" aria-label="${nome} — B3 fundamentals with provenance">
${MARCA_DE_GERACAO}
  <title>${nome} — B3 fundamentals with provenance</title>
  <defs>
${mascaraDaMarca(marca, 'fenda-estandarte')}
  </defs>

  <rect x="0.75" y="0.75" width="918.5" height="218.5" rx="18" fill="${fundo}" stroke="${linha}" stroke-width="1.5" />
  <rect x="44" y="52" width="116" height="116" rx="26" fill="${superficie}" stroke="${linha}" stroke-width="1.5" />
${corpoDaMarca(marca, 'fenda-estandarte', tema, 'translate(66 74) scale(0.72)')}

  <text x="200" y="121" font-family="'Segoe UI', ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif" font-size="76" font-weight="700" letter-spacing="-2.5" fill="${tinta}">${nome}</text>
  <text x="204" y="156" font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace" font-size="16" font-weight="500" letter-spacing="5.5" fill="${tema}">B3 · CVM · NO PRICE</text>

  <g font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace" font-size="15">
    <text x="672" y="86" fill="${tinta}">what it measures</text>
    <text x="672" y="115" fill="${tema}">where it misleads</text>
    <text x="672" y="144" fill="${suave}">what it does not say</text>
  </g>
  <line x1="640" y1="62" x2="640" y2="158" stroke="${linha}" stroke-width="1.5" />
</svg>
`
}

const PORCENTO_SVG = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const VEZES_SVG = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const BI_SVG = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/**
 * A AMOSTRA DA TABELA, COM NÚMEROS DE VERDADE.
 *
 * Não é uma captura de tela nem um exemplo inventado: as linhas saem de
 * `conteudo/empresas.json`, o mesmo artefato que a página renderiza, ordenadas
 * pela receita como a tabela abre. Um README que mostra números plausíveis em
 * vez dos números publicados é a primeira mentira de um site que promete dizer
 * de onde vem cada número.
 */
export function amostra(dados, colunas, { fundo, tinta, suave, fraca, linha, tema, baixa }, quantas = 8) {
  // SÓ AS QUE TÊM CÓDIGO DE NEGOCIAÇÃO, que é o mesmo recorte de
  // `conteudo/indicadores.ts` e o mesmo número que a página publica. Contar o
  // conjunto inteiro aqui e outro lá faria o README anunciar um total que a
  // tabela não mostra — num site cuja promessa é dizer de onde vem cada número.
  const publicadas = dados.empresas.filter((e) => e.tickers.length > 0)
  const empresas = publicadas
    .filter((e) => e.receita !== null)
    .sort((a, b) => b.receita - a.receita)
    .slice(0, quantas)

  const MONO = `font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"`
  const X = [28, 128, 430, 540, 650, 760, 870]
  const ALTURA_LINHA = 30
  const TOPO = 74
  const altura = TOPO + empresas.length * ALTURA_LINHA + 44
  const largura = 920

  const cabeca = ['code', 'company', 'revenue', 'net mrg', 'roe', 'curr', 'lev']
    .map(
      (t, i) =>
        `    <text x="${X[i]}" y="58" ${MONO} font-size="11" letter-spacing="1.6" fill="${fraca}"${i >= 2 ? ' text-anchor="end"' : ''}>${t.toUpperCase()}</text>`,
    )
    .join('\n')

  const corpo = empresas
    .map((e, n) => {
      const y = TOPO + n * ALTURA_LINHA + 14
      const num = (v, fmt) =>
        v === null || !Number.isFinite(v) ? ['—', suave] : [fmt(v), v < 0 ? baixa : tinta]
      const celulas = [
        [X[2], ...num(e.receita, (v) => `${BI_SVG.format(v / 1e9)} bi`)],
        [X[3], ...num(e.indicadores.margemLiquida ?? null, (v) => PORCENTO_SVG.format(v))],
        [X[4], ...num(e.indicadores.retornoSobrePatrimonio ?? null, (v) => PORCENTO_SVG.format(v))],
        [X[5], ...num(e.indicadores.liquidezCorrente ?? null, (v) => VEZES_SVG.format(v))],
        [X[6], ...num(e.indicadores.alavancagem ?? null, (v) => VEZES_SVG.format(v))],
      ]
        .map(
          ([x, texto, cor]) =>
            `    <text x="${x}" y="${y}" ${MONO} font-size="13" text-anchor="end" fill="${cor}">${texto}</text>`,
        )
        .join('\n')
      // 26 e nao 34: em 13px monoespacado, 34 caracteres encostam na coluna da
      // receita. Medido abrindo o SVG, que e a unica forma de saber.
      const nome = e.nome.length > 26 ? `${e.nome.slice(0, 25)}…` : e.nome
      return `    <text x="${X[0]}" y="${y}" ${MONO} font-size="13" fill="${tema}">${e.tickers.slice(0, 2).join(' ')}</text>
    <text x="${X[1]}" y="${y}" ${MONO} font-size="13" fill="${suave}">${escaparXml(nome)}</text>
${celulas}`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="the first rows of the published table, by revenue">
${MARCA_DE_GERACAO}
  <title>the first rows of the published table, by revenue</title>
  <rect x="0.75" y="0.75" width="${largura - 1.5}" height="${altura - 1.5}" rx="12" fill="${fundo}" stroke="${linha}" stroke-width="1.5" />
  <text x="28" y="30" ${MONO} font-size="13" fill="${suave}">${dados.fonte} · ${dados.exercicio} · ${publicadas.length} companies</text>
  <line x1="14" y1="66" x2="${largura - 14}" y2="66" stroke="${linha}" stroke-width="1" />
${cabeca}
${corpo}
  <text x="28" y="${altura - 16}" ${MONO} font-size="11" fill="${fraca}">generated from conteudo/empresas.json · data under ${dados.licenca}</text>
</svg>
`
}

const escaparXml = (t) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

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

  // A PALETA VEM DE `app/globals.css`, LIDA E NÃO REDIGITADA — e isso não é
  // gosto, é a regra `raw-hex` do rebar, que reprovou este arquivo assim que ele
  // ganhou `#9aa3ad` escrito à mão ao lado do mesmo valor declarado como
  // `--tinta-suave`. Uma cor em dois lugares é uma cor que vai divergir, e a
  // peça que diverge é a que ninguém abre: o cartão que aparece no WhatsApp.
  const paleta = lerPaleta(readFileSync(join(RAIZ, 'app', 'globals.css'), 'utf8'))
  const tinta = hexParaRgb(meta.cores.tema)
  const fundo = hexParaRgb(meta.cores.fundo)
  const suave = hexParaRgb(paleta['tinta-suave'])
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

  // OS DOIS SVG DO README, na mesma paleta da página pelo mesmo motivo.
  const dados = JSON.parse(readFileSync(join(RAIZ, 'conteudo', 'empresas.json'), 'utf8'))

  mkdirSync(join(RAIZ, 'docs', 'assets'), { recursive: true })
  const svgs = [
    [
      'assay-banner.svg',
      estandarte(marca, {
        nome: identidade.nome,
        tema: meta.cores.tema,
        fundo: paleta.fundo,
        tinta: paleta.tinta,
        suave: paleta['tinta-suave'],
        linha: paleta.linha,
        superficie: paleta.superficie,
      }),
    ],
    [
      'assay-sample.svg',
      amostra(dados, null, {
        fundo: paleta.fundo,
        tinta: paleta.tinta,
        suave: paleta['tinta-suave'],
        fraca: paleta['tinta-fraca'],
        linha: paleta.linha,
        tema: meta.cores.tema,
        baixa: paleta.baixa,
      }),
    ],
  ]
  for (const [nome, texto] of svgs) {
    writeFileSync(join(RAIZ, 'docs', 'assets', nome), texto, 'utf8')
    console.log(`docs/assets/${nome} · ${(texto.length / 1024).toFixed(1)} KB`)
  }
}

/**
 * Os tokens de cor de `app/globals.css`. Ler em vez de repetir: a paleta mudou
 * uma vez nesta semana, e um estandarte com a cor antiga é a peça que ninguém
 * confere porque ninguém abre o README depois de escrevê-lo.
 */
export function lerPaleta(css) {
  const paleta = {}
  for (const [, nome, valor] of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    paleta[nome] = valor
  }
  for (const exigido of ['fundo', 'tinta', 'tinta-suave', 'tinta-fraca', 'linha', 'superficie', 'baixa']) {
    if (!paleta[exigido]) throw new Error(`globals.css: token --${exigido} não encontrado`)
  }
  return paleta
}

main()
