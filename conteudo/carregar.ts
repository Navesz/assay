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
 * THE PATH OF A FILE FROM `public/`, with the site's folder in front of it.
 *
 * This site lives at `navesz.github.io/assay`, and `next.config.ts` derives
 * `basePath` from this same `urlBase`. What reading the built HTML shows is
 * that `basePath` does NOT reach everywhere on its own:
 *
 *   · `og:image`, `canonical` and `link rel=manifest` — Next resolves them,
 *     they come out with `/assay`.
 *   · `next/image` with `images.unoptimized` — does NOT resolve. `/marca.svg`
 *     comes out raw, because the prefix is applied to the optimizer's URL
 *     (`/_next/image`), and `output: "export"` has no optimizer at all.
 *   · the JSON of `manifest.ts` — does NOT resolve. `start_url` and the icons
 *     come out raw.
 *
 * The last two are 404s on the published site with the build passing — the same
 * class of defect as rebar's badges, which spent weeks as literal text because
 * the proof checked the number and nobody opened the page. Hence this function,
 * and hence `testes/publicado.mjs`, which fails any absolute path in `out/`
 * that does not start with the folder.
 */
export const naPasta = (caminho: string) =>
  `${new URL(site.meta.urlBase).pathname.replace(/\/$/, '')}${caminho}`
