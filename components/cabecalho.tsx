import Image from 'next/image'

import { procedencia } from '@/conteudo/indicadores'
import { naPasta, site } from '@/conteudo/carregar'

/**
 * THE TOP BAR, and it sticks (`.cabecalho-fixo`, in `globals.css`).
 *
 * It is not decoration: the table has 272 rows and takes up the whole screen
 * after the first scroll. Without a fixed bar, three screens down there is
 * nothing saying which site this is nor which fiscal year the numbers are from
 * — and a number without a fiscal year is a number without meaning.
 *
 * THE BRAND MARK IS A FILE, IT IS NOT A COPY. It comes from `public/marca.svg`,
 * the same file the `<link rel="icon">` in `layout.tsx` points at. Drawing the
 * same SVG path over again in here, in JSX, would be the mark in two places, to
 * diverge on the day one of the two gets adjusted.
 *
 * The `src` GOES THROUGH `naPasta`, and that was measured, not assumed: with
 * `images.unoptimized` — mandatory under `output: "export"` — `next/image`
 * writes the `src` raw, without the `basePath`. The built HTML was coming out
 * with `src="/marca.svg"`, which at `navesz.github.io/assay` is a 404 with the
 * build green. `testes/publicado.mjs` fails the recurrence.
 */
export function Cabecalho() {
  return (
    <header className="cabecalho-fixo">
      {/* `h-full`, and not a `py-`: the height comes from `--altura-cabecalho`,
          the same measure by which the table head sticks itself right below
          here. */}
      <div className="mx-auto flex h-full max-w-[92rem] items-center gap-3 px-6">
        <Image
          src={naPasta('/marca.svg')}
          alt=""
          width={28}
          height={28}
          priority
          className="shrink-0"
        />
        <span className="text-base font-semibold tracking-tight">{site.identidade.nome}</span>
        <span className="ml-auto hidden font-mono text-[11px] text-[var(--tinta-fraca)] sm:block">
          {procedencia.fonte} · {procedencia.exercicio}
        </span>
      </div>
    </header>
  )
}
