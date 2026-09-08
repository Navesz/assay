/**
 * The single point where `site.json` becomes typed data — and the point where
 * the build dies if it diverges from the schema.
 *
 * The validation runs at MODULE SCOPE on purpose. `app/layout.tsx` imports from
 * here, `next build` evaluates this module to pre-render the route, and a missing
 * field throws before any HTML comes out. That is what separates a schema from
 * decoration: decoration is what only runs when somebody remembers to call it.
 */
import bruto from './site.json'
import { esquemaSite, type Site } from './esquema'

export const site: Site = esquemaSite(bruto, 'site')
export type { Site }
// `Contato` and `Whatsapp` go out through here because whoever renders imports
// from THIS file, never from the schema: there is one door only. `Contato` is
// what makes the home's map charged as total; `Whatsapp` is the already-narrowed
// block `linkWhatsapp` demands — without it the button does not compile without
// handling the `null`.
export type { Contato, Whatsapp } from './esquema'
export { linkWhatsapp } from './esquema'

/**
 * O CAMINHO DE UM ARQUIVO DE `public/`, com a pasta do site na frente.
 *
 * Este site mora em `navesz.github.io/assay`, e `next.config.ts` deriva o
 * `basePath` desta mesma `urlBase`. O que se descobre lendo o HTML construído
 * é que o `basePath` NÃO chega sozinho a todo lugar:
 *
 *   · `og:image`, `canonical` e `link rel=manifest` — o Next resolve, saem com
 *     `/assay`.
 *   · `next/image` com `images.unoptimized` — NÃO resolve. Sai `/marca.svg`
 *     cru, porque o prefixo é aplicado na URL do otimizador (`/_next/image`),
 *     e `output: "export"` não tem otimizador nenhum.
 *   · o JSON do `manifest.ts` — NÃO resolve. `start_url` e ícones saem crus.
 *
 * Os dois últimos são 404 no site publicado com o build passando — a mesma
 * classe de defeito dos badges do rebar, que ficaram semanas como texto
 * literal porque a prova conferia o número e ninguém abriu a página. Daí esta
 * função, e daí `testes/publicado.mjs`, que reprova qualquer caminho absoluto
 * no `out/` que não comece pela pasta.
 */
export const naPasta = (caminho: string) =>
  `${new URL(site.meta.urlBase).pathname.replace(/\/$/, '')}${caminho}`
