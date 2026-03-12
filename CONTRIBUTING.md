# Contribuindo

## Ambiente

- Use Bun para dependencias e scripts.
- Use Node.js 20+ e JDK 17+.
- O projeto e Android-only.
- Bundler padrao: Vite (`@nativescript/vite`).

## Comandos principais

```bash
bun install
bun run dev:android
bun run lint
bun run typecheck
bun run test
ns build android
```

## Fluxo HMR no emulador

O bundler e o Vite (`@nativescript/vite`). O HMR funciona via servidor HTTP do Vite separado do CLI do NativeScript. Por isso o script `android` usa `--no-hmr` para evitar conflito entre as duas camadas de HMR.

Use o fluxo abaixo para desenvolvimento com hot reload no Android Emulator:

```powershell
$env:DIRECTUS_URL="https://seu-directus"
$env:DIRECTUS_TOKEN="seu-token"
bun run dev:android
```

Este comando e equivalente a:
1. `vite serve -- --env.android --env.hmr` (servidor Vite na porta 5173)
2. `wait-on tcp:5173 && ns debug android --no-hmr` (CLI instala o APK sem HMR nativo)

Pre-condicoes obrigatorias:

1. `DIRECTUS_URL` e `DIRECTUS_TOKEN` definidos no ambiente — sem eles o app opera apenas com cache local vazio.
2. Emulador iniciado e listado em `adb devices`.
3. Porta `5173` livre antes de subir o Vite.
4. App limpo/reinstalado se houver erro de runtime com bundle antigo.

> **Importante**: Nunca rode `ns debug android` (sem `--no-hmr`) quando o servidor Vite estiver ativo. O conflito entre os dois sistemas de HMR causa ANR e o app fecha logo apos o splash screen.

## Regras de engenharia

- Nao use `npm`, `npx`, `yarn` ou `pnpm`.
- Nao introduza segredos no codigo-fonte.
- Prefira mudancas pequenas, focadas e testaveis.
- Procure a causa raiz antes de aplicar correcoes superficiais.
- Reuse helpers existentes antes de duplicar logica.
- Em codigo NativeScript Android, evite APIs de browser e regex nao suportadas pelo runtime.
- Bluetooth e rede devem ser tratados como ambientes falhos por padrao.
- **Nunca altere `windowSoftInputMode`** no AndroidManifest. O valor correto e `adjustNothing|stateHidden`. Modos `adjustPan` e `adjustResize` causam tela branca no NativeScript+Vite quando o teclado abre.

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
Em instalacao limpa (cache vazio), o catalogo ficara vazio.

Para gerar APK com catalogo remoto, exporte as variaveis no mesmo terminal antes de `ns build android`.

## Context engineering

- [PRODUCT.md](PRODUCT.md) descreve objetivos e regras operacionais.
- [ARCHITECTURE.md](ARCHITECTURE.md) descreve limites arquiteturais e fluxos principais.
- [.github/copilot-instructions.md](.github/copilot-instructions.md) fornece contexto global para o Copilot.
- Instrucoes modulares em `.github/instructions/` devem ser curtas e especificas.
- Guia oficial recomendado: [Context engineering with GitHub Copilot](https://code.visualstudio.com/docs/copilot/guides/context-engineering-guide).

## Quando atualizar documentacao

Atualize a documentacao sempre que houver mudanca em:

- fluxo de venda ou impressao;
- regras de estoque, troca ou devolucao;
- integracao com Directus;
- scripts de qualidade, CI ou release;
- convencoes relevantes para IA ou contribuidores.