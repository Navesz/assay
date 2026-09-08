// O GLOSSÁRIO E O CONJUNTO DE COMPANHIAS, validados na carga.
//
// Segue o mesmo desenho de `carregar.ts`: o JSON entra por um validador que
// LANÇA, e o `next.config.ts` importa esse caminho — então conteúdo inválido
// derruba o BUILD, não a página em produção. Um campo faltando aqui é um erro
// que aparece no `npm run verificar`, não um `undefined` renderizado para o
// visitante.
//
// A LISTA DE COMPANHIAS NÃO É VALIDADA CAMPO A CAMPO, e a razão é a assimetria
// entre as duas fontes: o glossário é ESCRITO à mão e erra por descuido humano,
// enquanto `empresas.json` é DERIVADO por `ferramental/coletar.mjs` a partir da
// CVM e já passou pelos filtros de lá. O que se confere aqui é a forma do
// artefato e o par glossário↔indicador, que é onde as duas partes podem
// divergir sem ninguém ver: um indicador com texto e sem número, ou um número
// sem explicação.

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
    semValor: linha,
  }),
  semPreco: objeto({ titulo: linha, texto: linha }),
  foraDoConjunto: objeto({ titulo: linha, texto: linha }),
  lista: lista(
    objeto({
      chave: texto(1, 40),
      nome: linha,
      unidade: linha,
      oQueMede: linha,
      // OBRIGATÓRIOS os dois, e é a decisão que define este site. Um indicador
      // sem "onde engana" é um número apresentado como se fosse verdade
      // suficiente — que é exatamente o que os outros lugares fazem e o que este
      // existe para não fazer. Se não há limite que se possa escrever, o
      // indicador não foi entendido.
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

// O PAR GLOSSÁRIO ↔ INDICADOR, nas duas direções.
//
// Explicação sem número é uma coluna que nunca aparece; número sem explicação é
// justamente o que este site promete não publicar. Conferir na carga faz das
// duas um erro de BUILD em vez de uma lacuna que só o leitor descobre.
const primeira = artefato.empresas.find((e) => e.indicadores)
if (primeira) {
  const calculados = new Set(
    Object.keys(primeira.indicadores).filter((k) => k !== 'anosDeReceita'),
  )
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

/** Só as que têm código de negociação: é o que o leitor procura pelo nome. */
export const companhias = artefato.empresas.filter((e) => e.tickers.length > 0)
export const procedencia = {
  licenca: artefato.licenca,
  fonte: artefato.fonte,
  fonteUrl: artefato.fonteUrl,
  exercicio: artefato.exercicio,
  coletadoEm: artefato.coletadoEm,
  foraDoConjunto: artefato.foraDoConjunto.length,
}
