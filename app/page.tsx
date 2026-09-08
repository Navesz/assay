import type { ReactNode } from 'react'

import { Cabecalho } from '@/components/cabecalho'
import { Companhias, Glossario } from '@/components/companhias'
import { linkWhatsapp, site, type Contato } from '@/conteudo/carregar'

/**
 * NO CONTENT LITERAL INSIDE. Every visible text is an `{expression}` read from
 * `conteudo/site.json`; what is left in the `.tsx` is structure and Tailwind
 * classes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A ORDEM DA PÁGINA É A DECISÃO DE DESENHO, e ela mudou em 08/09.
 *
 * Antes: título, subtítulo, três destaques, e só então a tabela — que começava
 * abaixo da dobra em qualquer tela de notebook. Quem chegava a um site de
 * indicadores lia três parágrafos sobre o site antes de ver um único indicador.
 *
 * Agora a tabela é o segundo bloco da página, depois de duas linhas de
 * apresentação. O glossário vem DEPOIS dela, que é a ordem em que a pessoa
 * precisa: primeiro o número, depois onde ele engana. E os destaques — que são
 * a promessa do site, não o produto dele — foram para o fim.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * THIS FILE RENDERS WHAT WAS DECLARED, AND DOES NOT BREAK ON WHAT IS MISSING.
 *
 * THE `CONTATOS` MAP IS THE TOOTH, and it closes both directions of the defect
 * at once, with no new rule, no heuristic and no file scanning:
 *
 *   · block DECLARED and not rendered — somebody writes the WhatsApp, the home
 *     has no button, and the person thinks they published the contact. Deleting
 *     the entry here leaves the map incomplete before the `satisfies` below: IT
 *     DOES NOT COMPILE.
 *   · block RENDERED and empty — the Galegos disaster, a `wa.me` link with no
 *     recipient. The value is `T | null` and `linkWhatsapp` takes the block, not
 *     the site: without narrowing the `null`, IT DOES NOT COMPILE.
 *   · NEW block in the schema — an Instagram, a set of opening hours — with no
 *     place on the home: the key is missing from the map and the `satisfies`
 *     fails. IT DOES NOT COMPILE.
 *
 * The limit, said to your face: deleting the whole JSX section below, map
 * included, is caught by no type at all. That is the owner removing the home,
 * not a silent drift — and the project's `npm run lint` reports whatever is
 * left unused.
 */
const CONTATOS = {
  whatsapp: ({ whatsapp }: Contato) =>
    whatsapp && (
      <a href={linkWhatsapp(whatsapp)} rel="noopener noreferrer" target="_blank">
        {whatsapp.exibicao}
      </a>
    ),

  email: ({ email }: Contato) => email && <a href={`mailto:${email}`}>{email}</a>,

  endereco: ({ endereco }: Contato) =>
    endereco && (
      <address className="not-italic">
        {endereco.logradouro}
        {', '}
        {endereco.bairro}
        {' — '}
        {endereco.cidade}
        {'/'}
        {endereco.uf}
        {' · '}
        {endereco.cep}
      </address>
    ),
  // `satisfies`, and not a type annotation: an annotation would accept the map
  // SHORT (the object would be just an incomplete `Renderizadores` at writing
  // time) and would erase each entry's return type. `satisfies` charges for the
  // key that is missing AND the key that is extra — a block deleted from the
  // schema with a renderer forgotten here does not compile either.
  //
  // No `-?`, on purpose: the keys of `Contato` are MANDATORY with value
  // `T | null`, never `?`, because the schema's `objeto()` always writes all of
  // them. The `-?` was here and was measured on 02/09: with it gone, deleting a
  // renderer still gives TS1360. A modifier that changes nothing is a comment
  // lying that it is code.
} satisfies { [Bloco in keyof Contato]: (contato: Contato) => ReactNode }

export default function Pagina() {
  return (
    <>
      <Cabecalho />

      <main className="mx-auto flex min-h-svh max-w-[92rem] flex-col gap-14 px-6 pt-6 pb-24">
        {/* A APRESENTAÇÃO E A TABELA SÃO UM BLOCO SÓ, com o espaçamento curto
            entre elas — o espaçamento largo separa seções, e aqui não há duas
            seções: há uma frase dizendo o que se vai ver, e o que se vai ver.
            Cada parágrafo a mais aqui em cima é uma linha da tabela empurrada
            para fora da primeira tela. */}
        <div className="flex min-h-0 flex-col gap-6 sm:h-[calc(100svh-var(--altura-cabecalho)-3rem)]">
          <section className="flex flex-col gap-3">
            <h1 className="max-w-3xl text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
              {site.home.titulo}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-[var(--tinta-suave)]">
              {site.home.subtitulo}
            </p>
          </section>

          <Companhias />
        </div>

        <Glossario />

        <ul className="grid gap-6 border-t border-[var(--linha)] pt-10 sm:grid-cols-3">
          {site.home.destaques.map((destaque) => (
            <li className="flex flex-col gap-2" key={destaque.titulo}>
              <h2 className="text-sm font-semibold">{destaque.titulo}</h2>
              <p className="text-sm leading-relaxed text-[var(--tinta-suave)]">{destaque.texto}</p>
            </li>
          ))}
        </ul>

        <footer className="mt-auto flex flex-col gap-1 border-t border-[var(--linha)] pt-8 text-sm text-[var(--tinta-fraca)]">
          <p>{site.identidade.nome}</p>
          {Object.entries(CONTATOS).map(([bloco, montar]) => {
            const linha = montar(site.identidade)
            // An absent block returns `null` and does not become an empty
            // paragraph: the footer of a site with only an e-mail has one line,
            // not three with two holes.
            return linha ? <p key={bloco}>{linha}</p> : null
          })}
        </footer>
      </main>
    </>
  )
}
