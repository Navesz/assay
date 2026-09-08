'use client'

import { useMemo, useState } from 'react'

import { companhias, glossario, procedencia } from '@/conteudo/indicadores'

/**
 * A TABELA E O GLOSSÁRIO. Nenhum texto visível está escrito aqui: tudo vem de
 * `conteudo/indicadores.json`, validado na carga, e os números vêm de
 * `conteudo/empresas.json`, derivado da CVM por `ferramental/coletar.mjs`.
 *
 * `'use client'` por um motivo só, o filtro. O resto é estático e sai pronto no
 * HTML — o que importa porque este site é `output: "export"` e a tabela precisa
 * existir para quem chega pelo buscador, sem esperar JavaScript.
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

function formatar(valor: number | null, unidade: string, vazio: string) {
  if (valor === null || !Number.isFinite(valor)) return vazio
  return unidade === 'porcento' ? PORCENTO.format(valor) : VEZES.format(valor)
}

/** Negativo em vermelho: prejuízo e patrimônio a descoberto não passam batido. */
const tom = (valor: number | null) =>
  valor !== null && valor < 0 ? 'text-rose-400' : 'text-zinc-200'

export function Companhias() {
  const [filtro, setFiltro] = useState('')
  const r = glossario.rotulos

  const visiveis = useMemo(() => {
    const q = filtro.trim().toUpperCase()
    if (!q) return companhias
    return companhias.filter(
      (c) => c.nome.toUpperCase().includes(q) || c.tickers.some((t) => t.includes(q)),
    )
  }, [filtro])

  return (
    <div className="space-y-16">
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">{glossario.titulo}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">{glossario.intro}</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {glossario.lista.map((i) => (
            <article
              key={i.chave}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <h3 className="text-base font-semibold text-zinc-100">{i.nome}</h3>
              <dl className="mt-3 space-y-3 text-sm leading-relaxed">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    {r.oQueMede}
                  </dt>
                  <dd className="mt-1 text-zinc-300">{i.oQueMede}</dd>
                </div>
                <div className="border-l-2 border-amber-700/60 pl-3">
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-amber-600/90">
                    {r.ondeEngana}
                  </dt>
                  <dd className="mt-1 text-zinc-400">{i.ondeEngana}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    {r.oQueNaoDiz}
                  </dt>
                  <dd className="mt-1 text-zinc-500">{i.oQueNaoDiz}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {[glossario.semPreco, glossario.foraDoConjunto].map((nota) => (
          <article key={nota.titulo} className="rounded-lg border border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-200">{nota.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{nota.texto}</p>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <label className="flex-1 min-w-[16rem]">
            <span className="sr-only">{r.busca}</span>
            <input
              type="search"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder={r.busca}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-700 focus:outline-none"
            />
          </label>
          <p className="font-mono text-xs text-zinc-500">
            {visiveis.length} {r.contagem}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="p-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {r.ticker}
                </th>
                <th className="p-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {r.empresa}
                </th>
                <th className="p-3 text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {r.receita}
                </th>
                {glossario.lista.map((i) => (
                  <th
                    key={i.chave}
                    className="p-3 text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500"
                  >
                    {i.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.cnpj} className="border-b border-zinc-900 last:border-0">
                  <td className="whitespace-nowrap p-3 font-mono text-xs text-amber-500">
                    {c.tickers.join(' ')}
                  </td>
                  <td className="p-3 text-zinc-300">{c.nome}</td>
                  <td className="whitespace-nowrap p-3 text-right font-mono text-xs text-zinc-400">
                    {c.receita === null
                      ? r.semValor
                      : `${BILHOES.format(c.receita / 1e9)} bi`}
                  </td>
                  {glossario.lista.map((i) => {
                    const v = c.indicadores[i.chave] ?? null
                    return (
                      <td
                        key={i.chave}
                        className={`whitespace-nowrap p-3 text-right font-mono text-xs ${tom(v)}`}
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
            <p className="p-6 text-center text-sm text-zinc-500">{r.vazio}</p>
          )}
        </div>

        {/* A procedência fica COLADA na tabela, e não num rodapé distante: é a
            promessa do site, e promessa que exige rolar até o fim não é
            cumprida. */}
        <p className="font-mono text-[11px] leading-relaxed text-zinc-600">
          {procedencia.fonte} · exercício {procedencia.exercicio} · coletado em{' '}
          {procedencia.coletadoEm} · {procedencia.foraDoConjunto} companhias fora do conjunto ·{' '}
          <a href={procedencia.fonteUrl} className="underline hover:text-zinc-400">
            fonte
          </a>{' '}
          · dados sob {procedencia.licenca}
        </p>
      </section>
    </div>
  )
}
