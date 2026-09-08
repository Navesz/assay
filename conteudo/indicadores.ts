// THE GLOSSARY AND THE SET OF COMPANIES, validated at load time.
//
// It follows the same design as `carregar.ts`: the JSON comes in through a
// validator that THROWS, and `next.config.ts` imports that path — so invalid
// content brings down the BUILD, not the page in production. A field missing
// here is an error that shows up in `npm run verificar`, not an `undefined`
// rendered for the visitor.
//
// THE LIST OF COMPANIES IS NOT VALIDATED FIELD BY FIELD, and the reason is the
// asymmetry between the two sources: the glossary is WRITTEN by hand and goes
// wrong through human carelessness, while `empresas.json` is DERIVED by
// `ferramental/coletar.mjs` out of the CVM and has already been through the
// filters over there. What is checked here is the shape of the artifact and the
// glossary↔indicator pair, which is where the two halves can diverge without
// anybody seeing: an indicator with text and no number, or a number with no
// explanation.

import bruto from './indicadores.json'
import dados from './empresas.json'
import { ErroDeConteudo, lista, objeto, texto } from './esquema'

const linha = texto(1, 700)

const forma = objeto({
  titulo: linha,
  intro: linha,
  rotulos: objeto({
    oQueMede: linha,
    ondeEngana: linha,
    oQueNaoDiz: linha,
    empresa: linha,
    ticker: linha,
    receita: linha,
    exercicio: linha,
    busca: linha,
    vazio: linha,
    contagem: linha,
    // THE SINGULAR IS CONTENT TOO. Filtering by "VALE" showed "1 companhias",
    // which is the kind of detail that tells the reader nobody looked at the
    // page — and this site asks to be trusted on its numbers.
    contagemUma: linha,
    semValor: linha,
  }),
  // THE PROVENANCE LINE IS CONTENT, and it was written in the `.tsx` -- five
  // visible strings in a file whose own header states there are none. The claim
  // was the thing that was wrong, not the header: a label the reader sees is
  // content by the same argument that put every other label here.
  procedencia: objeto({
    exercicio: linha,
    coletadoEm: linha,
    foraDoConjunto: linha,
    fonte: linha,
    licenca: linha,
  }),
  semPreco: objeto({ titulo: linha, texto: linha }),
  foraDoConjunto: objeto({ titulo: linha, texto: linha }),
  lista: lista(
    objeto({
      chave: texto(1, 40),
      nome: linha,
      unidade: linha,
      oQueMede: linha,
      // BOTH MANDATORY, and it is the decision that defines this site. An
      // indicator with no `ondeEngana` is a number presented as though it were
      // truth enough — which is exactly what the other places do and what this
      // one exists in order not to do. If there is no limit that can be written
      // down, the indicator was not understood.
      ondeEngana: linha,
      oQueNaoDiz: linha,
    }),
    1,
    20,
  ),
})

export const glossario = forma(bruto, 'indicadores')

export type Companhia = {
  cnpj: string
  nome: string
  tickers: string[]
  exercicio: string
  receita: number | null
  lucro: number | null
  patrimonio: number | null
  ativoTotal: number | null
  indicadores: Record<string, number | null>
}

const artefato = dados as {
  licenca: string
  fonte: string
  fonteUrl: string
  exercicio: string
  coletadoEm: string
  empresas: Companhia[]
  foraDoConjunto: { cnpj: string; nome: string; motivo: string }[]
}

// THE GLOSSARY ↔ INDICATOR PAIR, in both directions.
//
// An explanation with no number is a column that never appears; a number with no
// explanation is precisely what this site promises not to publish. Checking at
// load time makes both of them a BUILD error instead of a gap only the reader
// finds out about.
const primeira = artefato.empresas.find((e) => e.indicadores)
if (primeira) {
  const calculados = new Set(Object.keys(primeira.indicadores).filter((k) => k !== 'anosDeReceita'))
  const explicados = new Set(glossario.lista.map((i) => i.chave))

  const semTexto = [...calculados].filter((k) => !explicados.has(k))
  if (semTexto.length) {
    throw new ErroDeConteudo(
      `indicador calculado e não explicado: ${semTexto.join(', ')}. ` +
        'Todo número publicado aqui carrega onde ele engana — acrescente em conteudo/indicadores.json.',
    )
  }
  const semNumero = [...explicados].filter((k) => !calculados.has(k))
  if (semNumero.length) {
    throw new ErroDeConteudo(
      `indicador explicado e não calculado: ${semNumero.join(', ')}. ` +
        'O texto está no glossário e a coluna nunca vai aparecer — acrescente em ferramental/coletar.mjs.',
    )
  }
}

/** Only the ones with a trading code: it is what the reader searches for by name. */
export const companhias = artefato.empresas.filter((e) => e.tickers.length > 0)
export const procedencia = {
  licenca: artefato.licenca,
  fonte: artefato.fonte,
  fonteUrl: artefato.fonteUrl,
  exercicio: artefato.exercicio,
  coletadoEm: artefato.coletadoEm,
  foraDoConjunto: artefato.foraDoConjunto.length,
}
