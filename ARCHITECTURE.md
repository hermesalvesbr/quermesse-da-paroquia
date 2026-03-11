# Arquitetura

## Visao de alto nivel

O aplicativo e um PDV Android nativo construido com NativeScript 9, Vue 3 e TypeScript. A UI vive em componentes Vue, enquanto a logica de negocio e integracoes ficam em servicos TypeScript. O backend principal e o Directus, mas o app precisa continuar operando com cache local e fila de sincronizacao quando estiver offline.

## Build e bundling

- Bundler oficial: Vite (`@nativescript/vite`) configurado em [nativescript.config.ts](nativescript.config.ts) e [vite.config.ts](vite.config.ts).
- Build Android usa `ns build android` com saida intermediaria em `.ns-vite-build`.
- Hook [hooks/after-prepare/copy-vite-output.js](hooks/after-prepare/copy-vite-output.js) copia os artefatos do Vite para `platforms/android/app/src/main/assets/app` antes do Gradle/SBG.
- O projeto usa patch automatizado em [scripts/postinstall-patches.mjs](scripts/postinstall-patches.mjs) para compatibilidade Windows em `@nativescript/vite`.

## Camadas

### UI

- [app/components/AppShell.vue](app/components/AppShell.vue): shell principal e navegacao.
- [app/components/PdvPage.vue](app/components/PdvPage.vue): operacao de venda.
- [app/components/VendasPage.vue](app/components/VendasPage.vue): historico, cancelamentos, trocas e devolucoes.
- [app/components/PrinterPage.vue](app/components/PrinterPage.vue): conexao e testes da impressora.
- [app/components/RelatoriosPage.vue](app/components/RelatoriosPage.vue): indicadores e agregados.
- [app/components/SettingsPage.vue](app/components/SettingsPage.vue): configuracoes e acoes auxiliares.

### Estado e regras de negocio

- [app/services/PdvStoreDirectus.ts](app/services/PdvStoreDirectus.ts): estado reativo do PDV, fluxo de venda e sincronizacao.
- [app/services/PdvStore.ts](app/services/PdvStore.ts): store local legado; nao deve receber novas regras sem decisao explicita.
- [app/services/OperatorSessionService.ts](app/services/OperatorSessionService.ts): sessao do operador.
- [app/services/PdvSaleRules.ts](app/services/PdvSaleRules.ts): regras puras de validacao e montagem de venda.

### Integracoes

- [app/services/DirectusService.ts](app/services/DirectusService.ts): acesso ao Directus.
- [app/services/BluetoothService.ts](app/services/BluetoothService.ts): conexao Bluetooth classico SPP.
- [app/utils/EscPosBuilder.ts](app/utils/EscPosBuilder.ts): geracao de comandos ESC/POS.
- [app/utils/BluetoothPermissions.ts](app/utils/BluetoothPermissions.ts): permissao Android.

### Persistencia local

- `ApplicationSettings` guarda cache de produtos, operadores, vendas e fila de sincronizacao.
- Persistencia e sincrona; serializacao excessiva deve ser evitada.

## Fluxos chave

### Venda

1. O operador monta o carrinho.
2. O store valida itens e estoque.
3. A venda e salva localmente.
4. O app tenta sincronizar com Directus.
5. Se falhar, adiciona a operacao na fila de sincronizacao.
6. O ticket e enviado para impressao; a venda pode permanecer pendente de impressao.

### Modo offline

1. O app tenta carregar dados do Directus na inicializacao.
2. Se nao conseguir, usa cache local.
3. Novas operacoes criticas continuam locais.
4. Quando o backend volta, a fila pendente e reenviada.

## Decisoes arquiteturais

- Offline-first: o app precisa continuar funcional sem rede.
- Separacao entre UI, servicos e utilitarios: componentes nao devem concentrar regra de negocio.
- Explicitacao sobre cleverness: regras de estoque, impressao e sincronizacao devem ser legiveis.
- Android-only: evitar codigo `ios.*` e APIs nao suportadas pelo runtime Android.

## Riscos conhecidos

- Segredos e configuracoes do backend precisam vir de ambiente de build ou configuracao explicita, nunca de valores hardcoded.
- A ausencia de testes em regras de negocio aumenta o risco em um sistema financeiro-operacional.
- Contexto de IA desatualizado gera sugestoes inconsistentes e pode degradar manutencao.

## Regras para contribuicao tecnica

- Toda mudanca em regras criticas deve preferir extracao para funcoes puras testaveis.
- Novas instrucoes do Copilot devem ser concisas e evitar conflito com outras fontes de contexto.
- Mudancas de fluxo devem atualizar tambem a documentacao de produto/arquitetura quando necessario.