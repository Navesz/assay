#!/usr/bin/env node
// COLETA AS DEMONSTRAÇÕES FINANCEIRAS DA CVM E DERIVA OS INDICADORES.
//
// A fonte é dados.cvm.gov.br: demonstração entregue por companhia aberta é
// informação PÚBLICA por lei, publicada sob ODbL. Não há preço aqui, e a
// ausência é deliberada — todo indicador que depende de cotação (P/L, P/VP,
// dividend yield) exige uma API paga cujo carimbo de data, medido em 07/09/2026,
// é o relógio do cache e não a hora do negócio. O que fica é a empresa pelos
// números que ela mesma declarou.
//
//   node ferramental/coletar.mjs           coleta e escreve conteudo/empresas.json
//   node ferramental/coletar.mjs --conferir  não escreve; sai 1 se o arquivo divergir
//
// ── AS TRÊS ARMADILHAS DESTE DADO, todas medidas antes de virar código ────────
//
// 1. `ORDEM_EXERC`. A mesma `DT_REFER` traz DUAS linhas por conta: ÚLTIMO e
//    PENÚLTIMO. Na Petrobras de 2025, conta 3.11, são 110.605.000 e 37.009.000 —
//    quem não filtra erra por 3×. O filtro aqui é `DT_FIM_EXERC === DT_REFER` e
//    não a string "ÚLTIMO": o arquivo é latin-1 e a palavra vem acentuada, então
//    comparar texto acentuado é frágil onde comparar datas é exato.
//
// 2. PLANOS DE CONTAS DIFERENTES. Medido na DFP de 2025: 426 companhias usam o
//    plano padrão e 15 não — 13 bancos e 2 seguradoras, onde `1.01` é "Caixa e
//    Equivalentes" e não "Ativo Circulante", e `2.01` é "Passivos Financeiros ao
//    Valor Justo" e não "Passivo Circulante". Calcular liquidez corrente com
//    esses códigos num banco produz um número errado com aparência de certo.
//    Elas saem do conjunto COM O MOTIVO REGISTRADO, nunca em silêncio.
//
// 3. `ESCALA_MOEDA`. O valor vem em unidades ou em MIL, por linha. Somar sem
//    normalizar mistura reais com milhares de reais.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { lerZip } from './zip.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')
const CACHE = join(RAIZ, '.cache-cvm')
const DESTINO = join(RAIZ, 'conteudo', 'empresas.json')

const BASE = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC'
// Cinco anos: é a janela que a própria CVM mantém no dataset, e é o que basta
// para uma taxa de crescimento de receita ter significado.
const ANOS = [2021, 2022, 2023, 2024, 2025]
const ANO_BASE = 2025 // o exercício completo mais recente, medido: 438 companhias

// ── busca, com cache em disco ────────────────────────────────────────────────
//
// O cache não é conforto: sem ele cada execução puxa ~60 MB da CVM, e um
// coletor que castiga o servidor de dados abertos a cada tentativa é um coletor
// que merece ser bloqueado.
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

/** CSV da CVM: `;` como separador, latin-1, e cabeçalho na primeira linha. */
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

/** MIL vira unidade. Ver a armadilha 3 no cabeçalho. */
const valorNormalizado = (r) =>
  Number(r.VL_CONTA) * (/\bMIL\b/i.test(r.ESCALA_MOEDA ?? '') ? 1000 : 1)

/**
 * As contas do exercício de referência, pela versão mais recente.
 *
 * Duas filtragens, e as duas são a armadilha 1: `DT_FIM_EXERC === DT_REFER` tira
 * o PENÚLTIMO, e a maior `VERSAO` tira a demonstração que foi retificada depois.
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
    // Fica a referência MAIS RECENTE quando a companhia tem mais de uma no ano.
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

/** CNPJ → códigos de negociação, pelo FCA. `cad_cia_aberta` não traz ticker. */
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

  // A série de receita, para a taxa de crescimento. Só a DRE dos anos anteriores.
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

    // A ARMADILHA 2, resolvida pelo RÓTULO e não pelo código: o código `1.01`
    // existe nos dois planos e significa coisas diferentes em cada um.
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
      // Só faz sentido com base positiva: de prejuízo para lucro não há taxa.
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
    // A licença é obrigação, não enfeite: o dado da CVM é ODbL, e a base
    // derivada que este arquivo É tem de sair sob a mesma licença, com
    // atribuição. Ver a nota no README.
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
    // A data de coleta muda todo dia e não é divergência de CONTEÚDO.
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
