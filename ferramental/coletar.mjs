#!/usr/bin/env node
// COLLECTS THE CVM FINANCIAL STATEMENTS AND DERIVES THE INDICATORS.
//
// The source is dados.cvm.gov.br: a statement filed by a listed company is
// PUBLIC information by law, published under ODbL. There is no price here, and
// the absence is deliberate — every indicator that depends on a quote (P/E,
// P/B, dividend yield) needs a paid API whose date stamp, measured on
// 2026-09-07, is the cache's clock and not the time of the trade. What is left
// is the company by the numbers it declared itself.
//
//   node ferramental/coletar.mjs           collects and writes conteudo/empresas.json
//   node ferramental/coletar.mjs --conferir  does not write; exits 1 if the file diverges
//
// ── THE THREE TRAPS IN THIS DATA, all measured before they became code ───────
//
// 1. `ORDEM_EXERC`. The same `DT_REFER` carries TWO rows per account: ÚLTIMO and
//    PENÚLTIMO. In Petrobras' 2025, account 3.11, they are 110,605,000 and
//    37,009,000 — whoever does not filter is off by 3×. The filter here is
//    `DT_FIM_EXERC === DT_REFER` and not the string "ÚLTIMO": the file is
//    latin-1 and the word comes accented, so comparing accented text is fragile
//    where comparing dates is exact.
//
// 2. DIFFERENT CHARTS OF ACCOUNTS. Measured on the 2025 DFP: 426 companies use
//    the standard chart and 15 do not — 13 banks and 2 insurers, where `1.01` is
//    "Caixa e Equivalentes" and not "Ativo Circulante", and `2.01` is "Passivos
//    Financeiros ao Valor Justo" and not "Passivo Circulante". Computing the
//    current ratio with those codes on a bank produces a wrong number that looks
//    right. They leave the set WITH THE REASON RECORDED, never in silence.
//
// 3. `ESCALA_MOEDA`. The value comes in units or in MIL, row by row. Summing
//    without normalising mixes reais with thousands of reais.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { lerZip } from './zip.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')
const CACHE = join(RAIZ, '.cache-cvm')
const DESTINO = join(RAIZ, 'conteudo', 'empresas.json')

const BASE = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC'
// Five years: it is the window the CVM itself keeps in the dataset, and it is
// what a revenue growth rate needs in order to mean anything.
const ANOS = [2021, 2022, 2023, 2024, 2025]
const ANO_BASE = 2025 // the most recent complete fiscal year, measured: 438 companies

// ── fetching, with an on-disk cache ──────────────────────────────────────────
//
// The cache is not a comfort: without it every run pulls ~60 MB from the CVM,
// and a collector that punishes the open-data server on every attempt is a
// collector that deserves to be blocked.
async function baixar(url, nomeLocal) {
  const caminho = join(CACHE, nomeLocal)
  if (existsSync(caminho)) return readFileSync(caminho)
  mkdirSync(CACHE, { recursive: true })
  process.stderr.write(`  baixando ${nomeLocal} …\n`)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} respondeu ${r.status}`)
  const bytes = Buffer.from(await r.arrayBuffer())
  writeFileSync(caminho, bytes)
  return bytes
}

/** The CVM's CSV: `;` as the separator, latin-1, and the header on the first line. */
function lerCsv(buffer) {
  const linhas = buffer.toString('latin1').split(/\r?\n/)
  const cabecalho = linhas[0].split(';')
  const registros = []
  for (let i = 1; i < linhas.length; i++) {
    if (!linhas[i]) continue
    const campos = linhas[i].split(';')
    const r = {}
    for (let c = 0; c < cabecalho.length; c++) r[cabecalho[c]] = campos[c]
    registros.push(r)
  }
  return registros
}

/** MIL becomes units. See trap 3 in the header. */
const valorNormalizado = (r) =>
  Number(r.VL_CONTA) * (/\bMIL\b/i.test(r.ESCALA_MOEDA ?? '') ? 1000 : 1)

/**
 * The accounts of the reference fiscal year, by the most recent version.
 *
 * Two filters, and both of them are trap 1: `DT_FIM_EXERC === DT_REFER` drops
 * the PENÚLTIMO, and the highest `VERSAO` drops the statement that was refiled
 * afterwards.
 */
function contasDoExercicio(registros) {
  const versaoMaxima = new Map()
  for (const r of registros) {
    if (r.DT_FIM_EXERC !== r.DT_REFER) continue
    const chave = `${r.CNPJ_CIA}|${r.DT_REFER}`
    const v = Number(r.VERSAO)
    if (!versaoMaxima.has(chave) || v > versaoMaxima.get(chave)) versaoMaxima.set(chave, v)
  }
  const porEmpresa = new Map()
  for (const r of registros) {
    if (r.DT_FIM_EXERC !== r.DT_REFER) continue
    const chave = `${r.CNPJ_CIA}|${r.DT_REFER}`
    if (Number(r.VERSAO) !== versaoMaxima.get(chave)) continue
    if (!porEmpresa.has(r.CNPJ_CIA)) {
      porEmpresa.set(r.CNPJ_CIA, { nome: r.DENOM_CIA, refer: r.DT_REFER, contas: new Map() })
    }
    const e = porEmpresa.get(r.CNPJ_CIA)
    // The MOST RECENT reference is the one that stays when a company has more
    // than one in the year.
    if (r.DT_REFER > e.refer) {
      e.refer = r.DT_REFER
      e.contas = new Map()
    }
    if (r.DT_REFER === e.refer) {
      e.contas.set(r.CD_CONTA, { valor: valorNormalizado(r), rotulo: (r.DS_CONTA ?? '').trim() })
    }
  }
  return porEmpresa
}

const numero = (contas, codigo) => contas.get(codigo)?.valor ?? null
const razao = (a, b) => (a === null || b === null || b === 0 ? null : a / b)

async function anoDe(ano, quais) {
  const zip = lerZip(await baixar(`${BASE}/DFP/DADOS/dfp_cia_aberta_${ano}.zip`, `dfp_${ano}.zip`))
  const saida = {}
  for (const q of quais) {
    saida[q] = contasDoExercicio(lerCsv(zip.ler(`dfp_cia_aberta_${q}_con_${ano}.csv`)))
  }
  return saida
}

/** CNPJ → trading codes, from the FCA. `cad_cia_aberta` carries no ticker. */
async function tickers() {
  const zip = lerZip(
    await baixar(`${BASE}/FCA/DADOS/fca_cia_aberta_${ANO_BASE + 1}.zip`, `fca_${ANO_BASE + 1}.zip`),
  )
  const nome = `fca_cia_aberta_valor_mobiliario_${ANO_BASE + 1}.csv`
  const porCnpj = new Map()
  for (const r of lerCsv(zip.ler(nome))) {
    const codigo = (r.Codigo_Negociacao ?? '').trim().toUpperCase()
    if (!/^[A-Z]{4}\d{1,2}$/.test(codigo)) continue
    if (!porCnpj.has(r.CNPJ_Companhia)) porCnpj.set(r.CNPJ_Companhia, new Set())
    porCnpj.get(r.CNPJ_Companhia).add(codigo)
  }
  return porCnpj
}

async function principal() {
  const conferir = process.argv.includes('--conferir')
  process.stderr.write('assay · coletando as demonstrações da CVM\n')

  const base = await anoDe(ANO_BASE, ['DRE', 'BPA', 'BPP'])
  const mapaTicker = await tickers()

  // The revenue series, for the growth rate. Only the DRE of the earlier years.
  const receitaPorAno = new Map()
  for (const ano of ANOS) {
    const { DRE } = await anoDe(ano, ['DRE'])
    for (const [cnpj, e] of DRE) {
      const r = numero(e.contas, '3.01')
      if (r === null) continue
      if (!receitaPorAno.has(cnpj)) receitaPorAno.set(cnpj, new Map())
      receitaPorAno.get(cnpj).set(e.refer.slice(0, 4), r)
    }
  }

  const empresas = []
  const foraDoConjunto = []

  for (const [cnpj, dre] of base.DRE) {
    const bpa = base.BPA.get(cnpj)
    const bpp = base.BPP.get(cnpj)
    if (!bpa || !bpp) {
      foraDoConjunto.push({ cnpj, nome: dre.nome, motivo: 'sem balanço consolidado no exercício' })
      continue
    }

    // TRAP 2, settled by the LABEL and not by the code: the code `1.01` exists
    // in both charts and means different things in each.
    const rotuloAtivo = bpa.contas.get('1.01')?.rotulo ?? ''
    if (!/^Ativo Circulante$/i.test(rotuloAtivo)) {
      foraDoConjunto.push({
        cnpj,
        nome: dre.nome,
        motivo: `plano de contas de instituição financeira (1.01 = "${rotuloAtivo}")`,
      })
      continue
    }

    const receita = numero(dre.contas, '3.01')
    const operacional = numero(dre.contas, '3.05')
    const lucro = numero(dre.contas, '3.11')
    const ativoCirculante = numero(bpa.contas, '1.01')
    const ativoTotal = numero(bpa.contas, '1')
    const passivoCirculante = numero(bpp.contas, '2.01')
    const passivoNaoCirculante = numero(bpp.contas, '2.02')
    const patrimonio = numero(bpp.contas, '2.03')

    const serie = receitaPorAno.get(cnpj) ?? new Map()
    const anos = [...serie.keys()].sort()
    let crescimento = null
    if (anos.length >= 2) {
      const primeiro = serie.get(anos[0])
      const ultimo = serie.get(anos[anos.length - 1])
      const periodos = Number(anos[anos.length - 1]) - Number(anos[0])
      // It only makes sense on a positive base: from loss to profit there is no rate.
      if (primeiro > 0 && ultimo > 0 && periodos > 0) {
        crescimento = (ultimo / primeiro) ** (1 / periodos) - 1
      }
    }

    const codigos = [...(mapaTicker.get(cnpj) ?? [])].sort()
    empresas.push({
      cnpj,
      nome: dre.nome,
      tickers: codigos,
      exercicio: dre.refer,
      receita,
      lucro,
      patrimonio,
      ativoTotal,
      indicadores: {
        margemLiquida: razao(lucro, receita),
        margemOperacional: razao(operacional, receita),
        retornoSobrePatrimonio: razao(lucro, patrimonio),
        liquidezCorrente: razao(ativoCirculante, passivoCirculante),
        alavancagem: razao(
          passivoCirculante === null || passivoNaoCirculante === null
            ? null
            : passivoCirculante + passivoNaoCirculante,
          patrimonio,
        ),
        crescimentoDeReceita: crescimento,
        anosDeReceita: anos.length,
      },
    })
  }

  empresas.sort((a, b) => (b.receita ?? 0) - (a.receita ?? 0))

  const artefato = {
    // The licence is an obligation, not decoration: the CVM's data is ODbL, and
    // the derived database this file IS has to go out under the same licence,
    // with attribution. See the note in the README.
    licenca: 'ODbL-1.0',
    fonte: 'Comissão de Valores Mobiliários — dados.cvm.gov.br',
    fonteUrl: `${BASE}/DFP/DADOS/`,
    exercicio: `${ANO_BASE}-12-31`,
    coletadoEm: new Date().toISOString().slice(0, 10),
    naoContemPreco:
      'Nenhum indicador aqui depende de cotação. Ver a nota "por que não há preço" no site.',
    empresas,
    foraDoConjunto,
  }

  const texto = `${JSON.stringify(artefato, null, 2)}\n`

  if (conferir) {
    const atual = existsSync(DESTINO) ? readFileSync(DESTINO, 'utf8') : ''
    // The collection date changes every day and is not a divergence of CONTENT.
    const semData = (s) => s.replace(/"coletadoEm": "[^"]*"/, '"coletadoEm": ""')
    if (semData(atual) !== semData(texto)) {
      process.stderr.write('coletar --conferir: conteudo/empresas.json divergiu da CVM.\n')
      process.stderr.write('  Regenere com: node ferramental/coletar.mjs\n')
      return 1
    }
    process.stderr.write(`coletar --conferir: em dia · ${empresas.length} companhias\n`)
    return 0
  }

  writeFileSync(DESTINO, texto, 'utf8')
  process.stderr.write(
    `coletar: ${empresas.length} companhias · ${foraDoConjunto.length} fora do conjunto · ` +
      `exercício ${ANO_BASE}\n`,
  )
  return 0
}

process.exitCode = await principal()
