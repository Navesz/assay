'use client'

import { useMemo, useState } from 'react'

import { companhias, glossario, procedencia } from '@/conteudo/indicadores'

/**
 * THE TABLE. It comes FIRST on the page, before the glossary and before any
 * presentation text, and that order is the most important design decision here:
 * whoever arrives wants to see the companies, not to read about them. The
 * explanation of each indicator sits below, for whoever has already seen the
 * number and wants to know where it misleads.
 *
 * No visible text is written in this file: everything comes from
 * `conteudo/indicadores.json`, validated on load, and the numbers from
 * `conteudo/empresas.json`, derived from the CVM by `ferramental/coletar.mjs`.
 *
 * `'use client'` for two reasons and only two: the filter and the sorting. The
 * HTML comes out complete, with every row — this site is `output: "export"`,
 * and the table has to exist for whoever arrives from a search engine or with
 * no JavaScript.
 */

const PORCENTO = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const VEZES = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const BILHOES = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const formatar = (valor: number | null, unidade: string, vazio: string) =>
  valor === null || !Number.isFinite(valor)
    ? vazio
    : unidade === 'porcento'
      ? PORCENTO.format(valor)
      : VEZES.format(valor)

/** Negative in red: a loss and negative equity do not slip by unnoticed. */
const tom = (v: number | null) => (v !== null && v < 0 ? 'text-[var(--baixa)]' : '')

type Coluna = 'receita' | string

export function Companhias() {
  const [filtro, setFiltro] = useState('')
  const [coluna, setColuna] = useState<Coluna>('receita')
  const [desc, setDesc] = useState(true)
  const r = glossario.rotulos
  // `rp` e nao `r.procedencia`: os rotulos da procedencia sao irmaos de
  // `rotulos` no conteudo, e `procedencia` sozinho ja e o DADO importado.
  // Dois nomes parecidos para coisas diferentes na mesma funcao e como se
  // acha um numero no lugar de um rotulo sem ninguem ver.
  const rp = glossario.procedencia

  const visiveis = useMemo(() => {
    const q = filtro.trim().toUpperCase()
    const filtradas = q
      ? companhias.filter(
          (c) => c.nome.toUpperCase().includes(q) || c.tickers.some((t) => t.includes(q)),
        )
      : companhias

    const valorDe = (c: (typeof companhias)[number]) =>
      coluna === 'receita' ? c.receita : (c.indicadores[coluna] ?? null)

    // NO VALUE ALWAYS GOES TO THE END, in both directions of the sort. Treating
    // absence as zero would put the companies missing the datum at the top of
    // "smallest first", as if they were the best at that indicator — the worst
    // possible outcome for a table that promises to say where every number
    // comes from.
    return [...filtradas].sort((a, b) => {
      const x = valorDe(a)
      const y = valorDe(b)
      if (x === null && y === null) return 0
      if (x === null) return 1
      if (y === null) return -1
      return desc ? y - x : x - y
    })
  }, [filtro, coluna, desc])

  const ordenarPor = (c: Coluna) => {
    if (c === coluna) setDesc(!desc)
    else {
      setColuna(c)
      setDesc(true)
    }
  }

  const seta = (c: Coluna) => (c === coluna ? (desc ? ' ↓' : ' ↑') : '')
  const classeCabeca = (c: Coluna) =>
    `ordenavel p-3 text-right font-mono text-[10px] uppercase tracking-widest ${
      c === coluna ? 'text-[var(--ensaio)]' : 'text-[var(--tinta-fraca)]'
    }`

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="min-w-[15rem] flex-1">
          <span className="sr-only">{r.busca}</span>
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder={r.busca}
            className="w-full rounded-md border border-[var(--linha)] bg-[var(--superficie)] px-3 py-2 text-sm text-[var(--tinta)] outline-none placeholder:text-[var(--tinta-fraca)] focus:border-[var(--ensaio)]"
          />
        </label>
        <p className="font-mono text-xs text-[var(--tinta-fraca)]">
          {visiveis.length} {visiveis.length === 1 ? r.contagemUma : r.contagem}
        </p>
      </div>

      <div className="painel-tabela rounded-lg border border-[var(--linha)]">
        <table className="w-full min-w-[58rem] border-collapse text-sm">
          <thead className="tabela-cabeca">
            <tr className="border-b border-[var(--linha)] text-left">
              <th className="p-3 font-mono text-[10px] tracking-widest text-[var(--tinta-fraca)] uppercase">
                {r.ticker}
              </th>
              <th className="p-3 font-mono text-[10px] tracking-widest text-[var(--tinta-fraca)] uppercase">
                {r.empresa}
              </th>
              <th
                className={classeCabeca('receita')}
                onClick={() => ordenarPor('receita')}
                aria-sort={coluna === 'receita' ? (desc ? 'descending' : 'ascending') : 'none'}
              >
                {r.receita}
                {seta('receita')}
              </th>
              {glossario.lista.map((i) => (
                <th
                  key={i.chave}
                  className={classeCabeca(i.chave)}
                  onClick={() => ordenarPor(i.chave)}
                  title={i.oQueMede}
                  aria-sort={coluna === i.chave ? (desc ? 'descending' : 'ascending') : 'none'}
                >
                  {i.nome}
                  {seta(i.chave)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((c) => (
              <tr
                key={c.cnpj}
                className="linha-companhia border-b border-[var(--linha)]/60 last:border-0"
              >
                <td className="p-3 font-mono text-xs whitespace-nowrap text-[var(--ensaio)]">
                  {c.tickers.join(' ')}
                </td>
                <td className="p-3 text-[var(--tinta-suave)]">{c.nome}</td>
                <td className="p-3 text-right font-mono text-xs whitespace-nowrap text-[var(--tinta-suave)]">
                  {c.receita === null ? r.semValor : `${BILHOES.format(c.receita / 1e9)} bi`}
                </td>
                {glossario.lista.map((i) => {
                  const v = c.indicadores[i.chave] ?? null
                  return (
                    <td
                      key={i.chave}
                      className={`p-3 text-right font-mono text-xs whitespace-nowrap ${tom(v) || 'text-[var(--tinta)]'}`}
                    >
                      {formatar(v, i.unidade, r.semValor)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {visiveis.length === 0 && (
          <p className="p-6 text-center text-sm text-[var(--tinta-fraca)]">{r.vazio}</p>
        )}
      </div>

      {/* THE PROVENANCE STAYS GLUED TO THE TABLE, and not in some distant
          footer: it is the site's promise, and a promise that demands scrolling
          to the very end is a promise not kept. */}
      <p className="font-mono text-[11px] leading-relaxed text-[var(--tinta-fraca)]">
        {procedencia.fonte} · {rp.exercicio} {procedencia.exercicio} · {rp.coletadoEm}{' '}
        {procedencia.coletadoEm} · {procedencia.foraDoConjunto} {rp.foraDoConjunto} ·{' '}
        <a
          href={procedencia.fonteUrl}
          className="underline decoration-dotted hover:text-[var(--ensaio)]"
        >
          {rp.fonte}
        </a>{' '}
        · {rp.licenca} {procedencia.licenca}
      </p>
    </section>
  )
}

/** The glossary, AFTER the table: whoever arrives wants to see, and only then to understand. */
export function Glossario() {
  const r = glossario.rotulos
  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">{glossario.titulo}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--tinta-suave)]">
          {glossario.intro}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {glossario.lista.map((i) => (
            <article
              key={i.chave}
              className="rounded-lg border border-[var(--linha)] bg-[var(--superficie)] p-5"
            >
              <h3 className="text-base font-semibold">{i.nome}</h3>
              <dl className="mt-3 space-y-3 text-sm leading-relaxed">
                <div>
                  <dt className="font-mono text-[10px] tracking-widest text-[var(--tinta-fraca)] uppercase">
                    {r.oQueMede}
                  </dt>
                  <dd className="mt-1 text-[var(--tinta-suave)]">{i.oQueMede}</dd>
                </div>
                <div className="border-l-2 border-[var(--ensaio)] pl-3">
                  <dt className="font-mono text-[10px] tracking-widest text-[var(--ensaio)] uppercase">
                    {r.ondeEngana}
                  </dt>
                  <dd className="mt-1 text-[var(--tinta-suave)]">{i.ondeEngana}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-widest text-[var(--tinta-fraca)] uppercase">
                    {r.oQueNaoDiz}
                  </dt>
                  <dd className="mt-1 text-[var(--tinta-fraca)]">{i.oQueNaoDiz}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {[glossario.semPreco, glossario.foraDoConjunto].map((nota) => (
          <article key={nota.titulo} className="rounded-lg border border-[var(--linha)] p-5">
            <h3 className="text-sm font-semibold">{nota.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--tinta-suave)]">{nota.texto}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
