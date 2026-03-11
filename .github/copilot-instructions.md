# PDV Quermesse Guidelines

- Leia primeiro [PRODUCT.md](../PRODUCT.md), [ARCHITECTURE.md](../ARCHITECTURE.md) e [CONTRIBUTING.md](../CONTRIBUTING.md) antes de propor mudancas significativas.
- Este projeto usa Bun para dependencias e scripts. Nunca use npm, npx, yarn ou pnpm.
- O app e Android-only com NativeScript 9 + Vue 3 + TypeScript. Evite qualquer orientacao baseada em navegador ou iOS.
- Priorize regras de negocio corretas para venda, estoque, devolucao, troca, impressao e sincronizacao offline.
- Considere Bluetooth e rede como dependencias falhas por natureza. Sempre trate timeouts, desconexoes e modo offline.
- Nao introduza segredos hardcoded. Configure Directus por variaveis de ambiente no build.
- Antes de concluir mudancas de codigo, prefira validar com `bun run lint`, `bun run typecheck`, `bun run test` e `ns build android` quando aplicavel.
- Mantenha as instrucoes e documentos vivos: se encontrar divergencia entre codigo e docs, proponha atualizar ambos.