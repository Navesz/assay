import Image from 'next/image'

import { procedencia } from '@/conteudo/indicadores'
import { naPasta, site } from '@/conteudo/carregar'

/**
 * A BARRA DE CIMA, e ela gruda (`.cabecalho-fixo`, em `globals.css`).
 *
 * Não é enfeite: a tabela tem 272 linhas e ocupa a tela inteira depois do
 * primeiro rolar. Sem uma barra fixa, três telas abaixo não há nada dizendo que
 * site é este nem de que exercício são os números — e um número sem exercício
 * é um número sem significado.
 *
 * A MARCA É ARQUIVO, NÃO É CÓPIA. Vem de `public/marca.svg`, o mesmo arquivo
 * que o `<link rel="icon">` do `layout.tsx` aponta. Desenhar o mesmo caminho
 * SVG outra vez aqui dentro, em JSX, seria a marca em dois lugares para
 * divergir no dia em que um dos dois for ajustado.
 *
 * O `src` PASSA POR `naPasta`, e isso foi medido, não suposto: com
 * `images.unoptimized` — obrigatório em `output: "export"` — o `next/image`
 * escreve o `src` cru, sem o `basePath`. O HTML construído saía com
 * `src="/marca.svg"`, que em `navesz.github.io/assay` é 404 com o build verde.
 * `testes/publicado.mjs` reprova a reincidência.
 */
export function Cabecalho() {
  return (
    <header className="cabecalho-fixo">
      {/* `h-full`, e não um `py-`: a altura vem de `--altura-cabecalho`, que é
          a mesma medida com que a cabeça da tabela se cola aqui embaixo. */}
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
