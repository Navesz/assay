# assay

Site estático em Next.js com App Router, gerado pelo `rebar new` e nascido com
o portão ligado.

## A pilha, e por que ela

| peça | escolha | motivo |
| --- | --- | --- |
| framework | Next 16, App Router, `output: "export"` | publica no GitHub Pages sem servidor |
| UI | shadcn no estilo `base-nova`, sobre `@base-ui/react` | zero Radix, decisão da §12.2 |
| estilo | Tailwind 4 | vem com o preset |
| conteúdo | `conteudo/*.json`, validado no build | §12.3 — ver abaixo |

## Conteúdo não mora no código

Telefone, CNPJ, endereço e preço são **conteúdo validado**, em `conteudo/*.json`,
e não literal em `.tsx` nem variável de ambiente. A decisão tem custo medido:
mover o número de WhatsApp para variável de ambiente faz o build passar, o link
de WhatsApp subir sem destinatário e o cardápio parar de entregar pedido **em
silêncio**. A régua do rebar cobra isso pelas regras `telefone` e
`conteudo-fora-do-codigo`.

## Comandos

```sh
npm run dev         # desenvolvimento
npm run verificar   # o portão inteiro: lint, typecheck, teste e build
npm run build       # gera out/ , estático
npx --yes github:Navesz/rebar .   # a régua do rebar, o placar
```

## Hooks

```sh
node .githooks/install.mjs
```

Configura `core.hooksPath`, então o hook é versionado e atualiza junto com o
repositório. O `pre-commit` varre segredo no que está em stage; o `commit-msg`
barra trailer de coautoria de IA antes de o commit existir. Pular uma vez:
`git commit --no-verify`.

## Licença

Apache-2.0. Ver `LICENSE` e `NOTICE`.

Copyright 2026 Naves.
