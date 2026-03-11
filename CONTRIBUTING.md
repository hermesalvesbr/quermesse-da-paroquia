# Contribuindo

## Ambiente

- Use Bun para dependencias e scripts.
- Use Node.js 20+ e JDK 17.
- O projeto e Android-only.

## Comandos principais

```bash
bun install
bun run lint
bun run typecheck
bun run test
ns build android
```

## Regras de engenharia

- Nao use `npm`, `npx`, `yarn` ou `pnpm`.
- Nao introduza segredos no codigo-fonte.
- Prefira mudancas pequenas, focadas e testaveis.
- Procure a causa raiz antes de aplicar correcoes superficiais.
- Reuse helpers existentes antes de duplicar logica.
- Em codigo NativeScript Android, evite APIs de browser e regex nao suportadas pelo runtime.
- Bluetooth e rede devem ser tratados como ambientes falhos por padrao.

## Validacao minima antes de abrir PR

1. Rode `bun run lint`.
2. Rode `bun run typecheck`.
3. Rode `bun run test`.
4. Rode `ns build android` para mudancas que afetem runtime, UI, plugins ou integracoes Android.
5. Descreva riscos e testes manuais executados.

## Configuracao do Directus

As credenciais do Directus devem vir do ambiente de build:

```powershell
$env:DIRECTUS_URL="https://seu-directus"
$env:DIRECTUS_TOKEN="seu-token"
ns run android --no-hmr
```

Sem essas variaveis, o app entra em modo nao configurado para backend e deve operar apenas com dados locais em cache quando possivel.

## Context engineering

- [PRODUCT.md](PRODUCT.md) descreve objetivos e regras operacionais.
- [ARCHITECTURE.md](ARCHITECTURE.md) descreve limites arquiteturais e fluxos principais.
- [.github/copilot-instructions.md](.github/copilot-instructions.md) fornece contexto global para o Copilot.
- Instrucoes modulares em `.github/instructions/` devem ser curtas e especificas.

## Quando atualizar documentacao

Atualize a documentacao sempre que houver mudanca em:

- fluxo de venda ou impressao;
- regras de estoque, troca ou devolucao;
- integracao com Directus;
- scripts de qualidade, CI ou release;
- convencoes relevantes para IA ou contribuidores.