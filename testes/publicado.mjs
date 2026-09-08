/**
 * O PORTÃO QUE OLHA O QUE FOI PUBLICADO, e não o que foi escrito.
 *
 * Este site mora numa PASTA — `navesz.github.io/assay` —, e um caminho absoluto
 * sem essa pasta na frente aponta para fora dele. O que se descobriu lendo o
 * `out/` de 08/09, com o build verde nos quatro passos do `verificar`:
 *
 *   · `next/image` com `images.unoptimized` escreve o `src` CRU. A marca do
 *     cabeçalho saía em `/marca.svg`.
 *   · o manifesto saía com `"start_url": "/"` e ícones em `/icone-192.png`.
 *
 * Nenhum dos dois é erro de compilação, de tipo ou de lint: são 404 no site
 * publicado, e só quem abre a página vê. É a mesma classe dos badges do rebar,
 * que ficaram semanas renderizando como texto literal porque a prova conferia o
 * NÚMERO e nunca a PÁGINA.
 *
 * Daí a regra deste arquivo, que roda DEPOIS do `next build`:
 *
 *   todo caminho absoluto emitido no `out/` começa pela pasta do site.
 *
 * Duas provas, como toda regra da casa: `--provar` planta um documento com o
 * defeito e exige reprovação, e planta o documento certo e exige aprovação.
 * Sem o caso que aprova, uma regra que reprovasse tudo passaria por correta.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const SAIDA = join(RAIZ, 'out')

/** A pasta vem da MESMA `urlBase` de que `next.config.ts` deriva o `basePath`. */
export function pastaDoSite(urlBase) {
  return new URL(urlBase).pathname.replace(/\/$/, '')
}

const ABSOLUTO = (valor) => valor.startsWith('/') && !valor.startsWith('//')

/**
 * Os caminhos absolutos de um documento que NÃO começam pela pasta.
 *
 * Vale para HTML — atributos `src`, `href` e `srcset` — e para JSON, onde
 * qualquer string que pareça caminho conta: é assim que o `start_url` e os
 * ícones do manifesto entram.
 */
export function caminhosForaDaPasta(texto, pasta, tipo) {
  const dentro = (v) => v === pasta || v.startsWith(`${pasta}/`)
  const candidatos = []

  if (tipo === 'json') {
    const recolher = (v) => {
      if (typeof v === 'string') candidatos.push(v)
      else if (Array.isArray(v)) v.forEach(recolher)
      else if (v && typeof v === 'object') Object.values(v).forEach(recolher)
    }
    recolher(JSON.parse(texto))
  } else {
    for (const [, valor] of texto.matchAll(/\b(?:src|href)="([^"]*)"/g)) candidatos.push(valor)
    // `srcset` é uma lista de "caminho descritor", separada por vírgula.
    for (const [, lista] of texto.matchAll(/\bsrcset="([^"]*)"/g))
      for (const item of lista.split(','))
        candidatos.push(item.trim().split(/\s+/)[0] ?? '')
  }

  return [...new Set(candidatos.filter((v) => ABSOLUTO(v) && !dentro(v)))]
}

function documentos(pasta) {
  const achados = []
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome)
    if (statSync(caminho).isDirectory()) achados.push(...documentos(caminho))
    else if (/\.html$/.test(nome)) achados.push([caminho, 'html'])
    else if (/\.webmanifest$/.test(nome)) achados.push([caminho, 'json'])
  }
  return achados
}

// ── as duas provas ────────────────────────────────────────────────────────

const HTML_ERRADO = '<img src="/marca.svg"/><link rel="icon" href="/assay/marca.svg"/>'
const HTML_CERTO = '<img src="/assay/marca.svg"/><a href="https://cvm.gov.br">fonte</a>'
const JSON_ERRADO = '{"start_url":"/","icons":[{"src":"/icone-192.png"}]}'
const JSON_CERTO = '{"start_url":"/assay/","icons":[{"src":"/assay/icone-192.png"}]}'

function provar() {
  const casos = [
    ['html que reprova', HTML_ERRADO, 'html', ['/marca.svg']],
    ['html que aprova', HTML_CERTO, 'html', []],
    ['json que reprova', JSON_ERRADO, 'json', ['/', '/icone-192.png']],
    ['json que aprova', JSON_CERTO, 'json', []],
  ]
  let quebrou = false
  for (const [nome, texto, tipo, esperado] of casos) {
    const obtido = caminhosForaDaPasta(texto, '/assay', tipo)
    const bate = JSON.stringify(obtido) === JSON.stringify(esperado)
    console.log(`  ${bate ? '✓' : '✗'} ${nome}${bate ? '' : ` — esperava ${esperado}, veio ${obtido}`}`)
    if (!bate) quebrou = true
  }
  return quebrou ? 1 : 0
}

// ── o portão ──────────────────────────────────────────────────────────────

function verificar() {
  const { meta } = JSON.parse(readFileSync(join(RAIZ, 'conteudo', 'site.json'), 'utf8'))
  const pasta = pastaDoSite(meta.urlBase)

  // Site na raiz de um domínio: não há pasta, e a regra não se aplica. Isto é
  // `na()` do rebar — sai do denominador em vez de virar um verde de graça.
  if (!pasta) {
    console.log('publicado · n/a — o site mora na raiz do domínio')
    return 0
  }

  const achados = []
  for (const [caminho, tipo] of documentos(SAIDA)) {
    const fora = caminhosForaDaPasta(readFileSync(caminho, 'utf8'), pasta, tipo)
    if (fora.length) achados.push([relative(RAIZ, caminho), fora])
  }

  if (achados.length) {
    console.error(`publicado · ✗ caminho absoluto fora de ${pasta}:`)
    for (const [arquivo, fora] of achados) console.error(`  ${arquivo}: ${fora.join(', ')}`)
    console.error(
      '\nO build passa e a página publicada dá 404. Passe o caminho por `naPasta`\n' +
        'em `conteudo/carregar.ts`.',
    )
    return 1
  }

  console.log(`publicado · ✓ todo caminho absoluto começa em ${pasta}`)
  return 0
}

process.exit(process.argv.includes('--provar') ? provar() : verificar())
