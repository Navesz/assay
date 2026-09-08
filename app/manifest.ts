import type { MetadataRoute } from 'next'

import { naPasta, site } from '@/conteudo/carregar'

// Ver a nota de `sitemap.ts`.
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.identidade.nome,
    short_name: site.meta.nomeCurto,
    description: site.meta.descricao,
    // TUDO PASSA POR `naPasta`, E ISSO FOI LIDO NO ARQUIVO CONSTRUÍDO. O Next
    // resolve o `basePath` no `<link rel="manifest">`, mas NÃO dentro do JSON
    // que ele gera: o manifesto saía com `"start_url": "/"` e ícones em
    // `/icone-192.png` — ou seja, apontando para a raiz de `navesz.github.io`,
    // fora deste site. Instalar o app abriria a página errada e os dois ícones
    // seriam 404, com o build verde o tempo todo.
    start_url: naPasta('/'),
    scope: naPasta('/'),
    display: 'standalone',
    lang: site.meta.idioma,
    background_color: site.meta.cores.fundo,
    theme_color: site.meta.cores.tema,
    // Both icons are GENERATED alongside the og image — real PNGs, written with
    // `zlib`, which is built in. Declaring an icon that does not exist is worse
    // than declaring none: the browser asks, takes a 404, and the manifest ends
    // up half valid.
    icons: [
      { src: naPasta('/icone-192.png'), sizes: '192x192', type: 'image/png' },
      { src: naPasta('/icone-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
