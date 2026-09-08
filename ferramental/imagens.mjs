/**
 * The site's images — og.png and the two icons — GENERATED FROM THE MARK ITSELF.
 *
 * Why it exists. The three images came ready-made out of rebar's generator, in
 * rebar's color and with a letter "A" where the drawing should be. When assay's
 * palette was settled they stayed orange: `og.png` is what shows up when someone
 * drops the link into WhatsApp or LinkedIn, and it was the last piece of the site
 * still in another project's color. Without a generator in here, "update the
 * mark" would mean opening an image editor — and what takes an editor to open
 * does not get updated.
 *
 * THE DRAWING IS NOT REWRITTEN HERE. This file READS `public/marca.svg` and
 * rasterizes what is there: the body rectangle, the slit polygon that is
 * subtracted from it, and the layer strokes with their weights and opacities.
 * Retyping the paths in JavaScript would put the mark in two places — and the day
 * one of the two changed, the favicon and the phone icon would show different
 * drawings with nothing failing.
 *
 * What it does NOT do: it is not an SVG renderer. It understands the exact subset
 * the mark uses and BLOWS UP on anything else — a `<circle>`, a curve, a second
 * `<g>`. Blowing up is the right behavior: the alternative is drawing half of it
 * and writing a PNG nobody checked.
 *
 *   node ferramental/imagens.mjs            writes the three images
 *   node ferramental/imagens.mjs --provar   shows what was read from the SVG
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

// ── PNG, with nothing but what ships in Node ──────────────────────────────
// The generator's own mechanics: signature, IHDR, IDAT and IEND with CRC32. There
// is no hand-written JPEG encoder and no file whose extension lies about its
// content — some preview readers sniff the bytes, not the name.

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

// ── the SVG read, not retyped ─────────────────────────────────────────────

const exigir = (condicao, mensagem) => {
  if (!condicao) throw new Error(`marca.svg: ${mensagem}`)
}

const atributo = (tag, nome) => {
  const casou = tag.match(new RegExp(`\\b${nome}="([^"]*)"`))
  return casou ? casou[1] : null
}

/** The points of a `d` made only of M, L and Z — all the mark ever uses. */
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

// ── geometry ──────────────────────────────────────────────────────────────

function dentroDoRetangulo(px, py, r) {
  const x1 = r.x + r.raio
  const x2 = r.x + r.largura - r.raio
  const y1 = r.y + r.raio
  const y2 = r.y + r.altura - r.raio
  if (px < r.x || px > r.x + r.largura || py < r.y || py > r.y + r.altura) return false
  // Outside the four corners it is a plain rectangle; inside them the circle rules.
  const cx = px < x1 ? x1 : px > x2 ? x2 : px
  const cy = py < y1 ? y1 : py > y2 ? y2 : py
  if (cx === px || cy === py) return true
  return (px - cx) ** 2 + (py - cy) ** 2 <= r.raio ** 2
}

/** A ray to the right, counting crossings. */
function dentroDoPoligono(px, py, vertices) {
  let dentro = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const [xi, yi] = vertices[i]
    const [xj, yj] = vertices[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

/** Round-capped segment: distance from the point to the segment ≤ half the width. */
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

const AMOSTRAS = 4 // 4×4 per pixel: the slit is diagonal, and an unsmoothed diagonal is a sawblade

/**
 * Paints the mark into an already existing RGB buffer, `tamanho` pixels a side.
 *
 * The strokes are composited over whatever is already underneath them —
 * `alfa + t.opacidade * (1 - alfa)` in the sampling loop — and that is what
 * reproduces the layer opacities the SVG declares. It is done inline, on
 * purpose: there is one blend in this file and giving it a name would be a name
 * to keep in step with nothing.
 *
 * The numbers are NOT repeated here any more. This block used to quote them, and
 * they went stale the day `public/marca.svg` was adjusted — the comment said
 * 0.9 / 0.5 / 0.28 while the file it reads said 0.95 / 0.62 / 0.4. A measurement
 * copied out of the source it describes is a measurement that will disagree with
 * it; `--provar` prints the live ones.
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
            if (dentroDaCapsula(ux, uy, t.pontos, t.largura)) alfa = alfa + t.opacidade * (1 - alfa)
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

// ── the 5×7 font, for the card ────────────────────────────────────────────
// Straight from the generator. Not typography: it is what keeps the preview from
// coming out empty.

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

// ── the three images ──────────────────────────────────────────────────────

const LARGURA_OG = 1200
const ALTURA_OG = 630

export function cartaoOg(marca, { nome, dominio, tinta, fundo, suave }) {
  const rgb = tela(LARGURA_OG, ALTURA_OG, fundo)
  // THE MARK BIG ON THE LEFT, with the name beside it: one second of reading is
  // all a link preview ever gets. A card with text alone does not say whose it
  // is; a card with the symbol alone does not say what it is.
  pintarMarca(rgb, LARGURA_OG, marca, { x0: 96, y0: 195, tamanho: 240, tinta })
  escrever(rgb, LARGURA_OG, ALTURA_OG, normalizar(nome), 392, 250, 18, tinta)
  escrever(rgb, LARGURA_OG, ALTURA_OG, normalizar(dominio).slice(0, 40), 392, 400, 5, suave)
  // A thread along the bottom, in the mark's color, to give the card an axis.
  retangulo(rgb, LARGURA_OG, ALTURA_OG, 96, 534, LARGURA_OG - 192, 6, tinta)
  return png(LARGURA_OG, ALTURA_OG, rgb)
}

export function icone(marca, tamanho, { tinta, fundo }) {
  const rgb = tela(tamanho, tamanho, fundo)
  pintarMarca(rgb, tamanho, marca, { x0: 0, y0: 0, tamanho, tinta })
  return png(tamanho, tamanho, rgb)
}

// ── the two README SVGs ───────────────────────────────────────────────────

/**
 * THE DECLARATION OF PROVENANCE that every generated artifact carries.
 *
 * It is not a courtesy to whoever opens the file — it is what lets a `regua`
 * tell a DERIVED value apart from a RETYPED one. rebar's `raw-hex` rule flags a
 * hand-written color that already exists as a token in the CSS, and it is right:
 * that color is going to drift. In a file generated FROM the token it cannot
 * drift, because regenerating re-derives it — and the only way for the `regua`
 * to know the difference is for the file to say where it came from and by whom.
 *
 * The marker names the generator. Naming is what makes it checkable instead of a
 * magic word: you can demand that the file it cites exist.
 */
const MARCA_DE_GERACAO =
  '  <!-- GENERATED by ferramental/imagens.mjs from public/marca.svg and app/globals.css. Do not edit by hand: run the generator. -->'

// THE MARK BECOMES TWO PIECES OF SVG, not one, because in SVG ORDER IS THE
// PAINTING: the mask has to go into the `<defs>` up at the top and the body has
// to come out AFTER the card and the tile, or the card paints over the mark. The
// first version returned the two together and the banner came out with no mark at
// all — visible only by opening the file, which is what almost nobody does with a
// generated SVG.

/** The slit's mask, for the `<defs>`. */
const mascaraDaMarca = (marca, id) =>
  `    <mask id="${id}">
      <rect width="100" height="100" fill="#fff" />
      <path d="${marca.fenda.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')} Z" fill="#000" />
    </mask>`

/** The mark's body, with the same geometry read from `public/marca.svg`. */
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
 * THE README BANNER, generated and not drawn by hand.
 *
 * The mark inside it is the SAME one in `public/marca.svg` — the paths are
 * interpolated from what `lerMarca` read, not retyped. Retyping them would make
 * the README's mark drift from the site's the day either of the two changed, and
 * nobody looks twice at a banner.
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
const VEZES_SVG = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const BI_SVG = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * THE SAMPLE OF THE TABLE, WITH REAL NUMBERS.
 *
 * It is not a screenshot and not a made-up example: the rows come out of
 * `conteudo/empresas.json`, the same artifact the page renders, ordered by
 * revenue the way the table opens. A README that shows plausible numbers instead
 * of the published ones is the first lie told by a site that promises to say
 * where every number came from.
 */
export function amostra(dados, { fundo, tinta, suave, fraca, linha, tema, baixa }, quantas = 8) {
  // ONLY THE ONES WITH A TRADING CODE, which is the same cut as
  // `conteudo/indicadores.ts` and the same count the page publishes. Counting the
  // whole set here and a different one there would have the README announce a
  // total the table does not show — on a site whose promise is to say where every
  // number comes from.
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
      // 26 and not 34: at 13px monospaced, 34 characters touch the revenue
      // column. Measured by opening the SVG, which is the only way to know.
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

const escaparXml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function main() {
  const svg = readFileSync(join(RAIZ, 'public', 'marca.svg'), 'utf8')
  const marca = lerMarca(svg)
  const { meta, identidade } = JSON.parse(readFileSync(join(RAIZ, 'conteudo', 'site.json'), 'utf8'))

  if (process.argv.includes('--provar')) {
    console.log('lido de public/marca.svg:')
    console.log(`  corpo   ${JSON.stringify(marca.corpo)}`)
    console.log(`  fenda   ${marca.fenda.length} vértices`)
    console.log(`  camadas ${marca.tracos.map((t) => `${t.largura}@${t.opacidade}`).join(' ')}`)
    return
  }

  // THE PALETTE COMES FROM `app/globals.css`, READ AND NOT RETYPED — and that is
  // not taste, it is rebar's `raw-hex` rule, which failed this file the moment it
  // gained a hand-written `#9aa3ad` next to the same value already declared as
  // `--tinta-suave`. A color in two places is a color that will drift, and the
  // piece that drifts is the one nobody opens: the card that shows up in WhatsApp.
  const paleta = lerPaleta(readFileSync(join(RAIZ, 'app', 'globals.css'), 'utf8'))
  const tinta = hexParaRgb(meta.cores.tema)
  const fundo = hexParaRgb(meta.cores.fundo)
  const suave = hexParaRgb(paleta['tinta-suave'])
  const url = new URL(meta.urlBase)

  const imagens = [
    [
      'og.png',
      cartaoOg(marca, {
        nome: identidade.nome,
        dominio: `${url.host}${url.pathname}`,
        tinta,
        fundo,
        suave,
      }),
    ],
    ['icone-192.png', icone(marca, 192, { tinta, fundo })],
    ['icone-512.png', icone(marca, 512, { tinta, fundo })],
  ]
  for (const [nome, bytes] of imagens) {
    writeFileSync(join(RAIZ, 'public', nome), bytes)
    console.log(`public/${nome} · ${(bytes.length / 1024).toFixed(1)} KB`)
  }

  // THE TWO README SVGS, in the same palette as the page, for the same reason.
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
      amostra(dados, {
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
 * The color tokens of `app/globals.css`. Read instead of repeat: the palette
 * changed once this week, and a banner in the old color is the piece nobody
 * checks, because nobody opens the README after writing it.
 */
export function lerPaleta(css) {
  const paleta = {}
  for (const [, nome, valor] of css.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    paleta[nome] = valor
  }
  for (const exigido of [
    'fundo',
    'tinta',
    'tinta-suave',
    'tinta-fraca',
    'linha',
    'superficie',
    'baixa',
  ]) {
    if (!paleta[exigido]) throw new Error(`globals.css: token --${exigido} não encontrado`)
  }
  return paleta
}

main()
