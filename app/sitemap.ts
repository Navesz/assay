import type { MetadataRoute } from 'next'

import { site } from '@/conteudo/carregar'

/**
 * `force-static` is WHAT MAKES THIS FILE EXIST under `output: "export"`. A
 * metadata route is treated as dynamic by default, and export has no server to
 * answer a dynamic route: without this line `sitemap.xml` is not emitted, the
 * build does not complain, and the absence only shows up in Search Console
 * weeks later. The same holds for `robots.ts` and `manifest.ts`.
 */
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      // COM A BARRA NO FIM, porque `trailingSlash: true` faz de `/assay/` a
      // forma canônica e é ela que sai no `<link rel="canonical">` e no
      // `og:url`. Um sitemap anunciando `/assay` e um canonical dizendo
      // `/assay/` são duas respostas para a mesma pergunta, e quem decide qual
      // indexar passa a ser o buscador.
      url: `${site.meta.urlBase.replace(/\/$/, '')}/`,
      // CONTENT date, not `new Date()`. With `new Date()` the same commit
      // generates different bytes on every build, and a build that is not
      // reproducible cannot be compared between two runs.
      lastModified: site.meta.atualizadoEm,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
