# Lições Aprendidas

## 2026-03-11 — ANR no emulador: conflito HMR entre NS CLI e Vite

**Contexto**: Após migração de webpack para Vite (`@nativescript/vite`), o app fechava logo após o splash screen com ANR (`failed to complete startup`). O log mostrava `@nativescript/vite HMR client loaded` antes do travamento.

**Causa raiz**: O script `android` usava `ns debug android` (sem `--no-hmr`). O NS CLI ativava uma segunda camada de HMR nativa que entrava em conflito com o sistema de HMR HTTP do Vite, bloqueando o thread principal do Android sem completar o startup.

**Fix**: Alterar script `"android"` para `"ns debug android --no-hmr"`. Com Vite como bundler, o HMR é gerido pelo servidor Vite; o CLI não deve sobrepor isso com HMR nativo.

**Regra**: Com `@nativescript/vite`, **sempre** usar `--no-hmr` no CLI do NativeScript. O fluxo correto é:
1. `vite serve -- --env.android --env.hmr` (HMR via HTTP/WS)
2. `ns debug android --no-hmr` (instala APK sem HMR nativo)

---

## 2026-03-11 — App sem produtos: variáveis de build obrigatórias

**Contexto**: App abria mas mostrava "SEM PRODUTOS" e "CACHE VAZIO" mesmo com Directus online. Log mostrava `DirectusService: DIRECTUS_URL/DIRECTUS_TOKEN ausentes. Backend desabilitado`.

**Causa raiz**: O build foi executado sem `DIRECTUS_URL` e `DIRECTUS_TOKEN` no ambiente. O Vite injeta essas variáveis em tempo de build via `define` — se não estiverem presentes, o bundle resultante tem strings vazias e o `DirectusService` desabilita o backend silenciosamente.

**Fix**: Sempre definir as variáveis antes de qualquer comando de build ou dev:
```powershell
$env:DIRECTUS_URL="https://seu-directus"
$env:DIRECTUS_TOKEN="seu-token"
bun run dev:android   # ou ns build android
```

**Regra**: Nunca assumir que o build está configurado. Verificar o log de startup: se aparecer `DIRECTUS_URL/DIRECTUS_TOKEN ausentes`, o APK foi gerado sem credenciais e precisa ser reconstruído com as variáveis presentes.

---

## 2026-03-03 — Emojis no código: UTF-8 safe mas cuidado com template literals

**Contexto**: Ao adicionar logs com emojis para melhorar diagnóstico de conectividade (✅ online, ❌ erro, 📦 cache, ⚠️ warning), uma edição corrompeu o código: `const mapped = products.map(p =📦 Cache LOCAL - ${mapped.length}...` causou 132+ erros TypeScript.

**Causa raiz**: Replace incorreto removeu acidentalmente a arrow function completa `=> {` e colou emoji diretamente no código fora de string, gerando syntax error.

**Fix**:
1. Lida com PdvStoreDirectus.ts L200-220 para identificar estrutura corrompida
2. Descoberta função `mapProductToInventory(product, categories)` existente que já fazia conversão Directus→InventoryItem corretamente
3. Substituída lógica inline quebrada por chamada à função helper: `.map(p => mapProductToInventory(p, cats))`

**Prevenção**:
- **Sempre ler código adjacente antes de editar** — a função helper `mapProductToInventory` estava 80 linhas acima, evitava duplicação
- **Testar TypeScript imediatamente** após edits complexos (`get_errors` tool)
- **Emojis são UTF-8 safe em template literals** desde que dentro de strings (backticks, quotes)
- **Não usar emojis como identificadores** ou fora de strings literais

**Regra DRY violada**: Reescrevi lógica que já existia em `mapProductToInventory`. Antes de criar mapping inline, procurar por funções helper existentes.

**Workflow correto**:
1. Buscar por patterns similares no arquivo atual (`grep_search` por `map(p =>`)
2. Se encontrar função helper, reusar (✅)
3. Se não, criar nova função helper nomeada (não inline anônima)
4. Rodar `get_errors` após save

---

## 2026-03-03 — **SEMPRE use BUN, nunca NPM**

**Regra absoluta**: Este projeto usa **BUN** como gerenciador de pacotes e runtime.

**Comandos corretos**:
- ✅ `bun install` — para instalar dependências
- ✅ `bun run <script>` — para rodar scripts do package.json
- ✅ `bun add <package>` — para adicionar dependências
- ✅ `bun remove <package>` — para remover dependências

**Comandos PROIBIDOS**:
- ❌ `npm install` — NUNCA usar
- ❌ `npm run` — NUNCA usar
- ❌ `yarn` — NUNCA usar
- ❌ `pnpm` — NUNCA usar

**Por quê BUN?**
- **10-25x mais rápido** que npm/yarn/pnpm (instalou 597 pacotes em 54s vs ~3-5min no npm)
- 100% compatível com package.json e node_modules
- Runtime JavaScript otimizado
- Lockfile nativo (`bun.lockb`) mais eficiente

**Evidência**: Após correções de espaçamento, `@nativescript/core` sumiu de `node_modules` (provavelmente limpeza manual ou cache corrompido). BUN reinstalou tudo em <1min e resolveu todos os erros TypeScript.

**Meta**: Se você (agente) ou usuário mencionar npm, CORRIJA imediatamente para BUN.

---

## 2026-03-03 — Revisão sistemática de espaçamento e UX design

**Contexto**: Screenshots do app mostravam elementos visuais sem separação adequada (botões, inputs, cards colados), causando dificuldade de tap preciso e fadiga visual.

**Problemas identificados (Rodada 1)**:
1. Botões de ação sem margin-bottom em VendasPage
2. Seção de formas de pagamento muito próxima de botões de ação no PDV
3. Cards de menu (catálogo) com margin-bottom insuficiente (8px → 12px)
4. Blocos de permissão Bluetooth em SettingsPage visualmente fundidos
5. `.soft-panel` com padding inconsistente (sobrescritas inline com `p-3`)
6. Botões de reimpressão em sale-card com margin-top insuficiente
7. Bottom-bar do PDV sem espaçamento declarativo entre seções
8. GridLayouts de métricas em RelatoriosPage sem rowGap
9. Lista de impressoras em PrinterPage sem margin entre items

**Problemas identificados (Rodada 2 - 2026-03-03 tarde)**:
1. **VendasPage botões de ação**: GridLayout com `columnGap="10"` (deveria ser 12), margins inline redundantes (`m-b-3`), sem rowGap entre linhas de botões
2. **PdvPage cards de produtos**: `columnGap="10"` nos GridLayouts de comidas e bebidas (deveria ser 12)
3. **PdvPage botões finais**: `columnGap="10"` em LIMPAR/FINALIZAR (deveria ser 12)
4. **PrinterPage botões**: `columnGap="10"` em RECONECTAR/DESCONECTAR (deveria ser 12)
5. **sale-card**: `margin-bottom: 8px` (deveria ser 12 para consistência)
9. Lista de impressoras em PrinterPage sem margin entre items

**Soluções aplicadas (Rodada 1)**:
- **Design system**: Padronizei `.soft-panel` com `padding: 14` e removi todas as sobrescritas inline
- **Espaçamento vertical**: Aumentei margins de 8px → 12px em cards e botões críticos
- **StackLayout spacing**: Usei `rowGap="12"` onde disponível (bottom-bar, relatórios)
- **Consistência**: Apliquei classes utilitárias (`m-b-3`, `m-t-4`) de forma consistente

**Soluções aplicadas (Rodada 2)**:
- **VendasPage**: Substituído GridLayout+margins inline por `StackLayout rowGap="12"` contendo GridLayout `columnGap="12"` + Button
- **PdvPage**: Aumentado `columnGap` de 10→12 em cards de produtos (comidas/bebidas) e botões de ação (LIMPAR/FINALIZAR)
- **PrinterPage**: Aumentado `columnGap` de 10→12 em botões RECONECTAR/DESCONECTAR
- **sale-card**: `margin-bottom` aumentado de 8→12 para consistência com `.menu-item-card`
- **Padrão estabelecido**: columnGap/rowGap padrão = **12px** para elementos interativos, 6-8px para elementos decorativos

**Regras para manter**:
1. **Nunca sobrescrever padding de componentes base** (`.soft-panel`, `.glass-card`) com classes inline — se preciso variante, criar classe específica
2. **Mínimo 12px de spacing** entre elementos interativos (botões, cards) — usar `columnGap="12"` e `rowGap="12"` ou `margin-bottom: 12`
3. **SEMPRE usar `rowGap`/`columnGap`** em StackLayout/GridLayout ao invés de margins inline — evitar classes `m-b-X` dentro de containers com gap
4. **Espaçamento entre seções deve ser maior** (16px) que dentro de seções (12px) para hierarquia visual clara
5. **Buscar agressivamente por DRY violations** em estilos — se ajustando margin em 3+ lugares, criar classe reutilizável
6. **Padrão de columnGap/rowGap**: 12px para interativos, 8px para informacionais (labels+icons), 6px para controles compostos (botões +/− de quantidade)

**Workflow de validação**:
- Lint OK (ESLint passou sem warnings)
- Build OK (Android compilou sem erros TypeScript)
- Impacto: 5 arquivos editados (app.css + 4 .vue), 11 replacements aplicados

**Meta**: Zero elementos visualmente colados. Sempre priorizar UX sobre densidade de informação.

## 2026-03-02 — `ios.position` crashava o app no Android

**Contexto**: O app crashava ao iniciar com erro `Module evaluation promise rejected` (wrapper Java) que mascarava o erro real: `TypeError: Cannot set property ios of [object Object] which has only a getter`.

**Causa raiz**: No `AppShell.vue`, o `ActionItem` usava `ios.position="left"` como atributo. No NativeScript-Vue 3, atributos com ponto são interpretados como setters de propriedade. A propriedade `ios` do `ActionItem` é getter-only no Android, causando crash durante chamada de `patchAttr` no Vue.

**Fix**: Removido `ios.position="left"` do `ActionItem` (desnecessário em app Android-only).

**Regra**: Em projetos Android-only, nunca usar atributos `ios.*` nos templates Vue. Se necessário targetar ambas as plataformas, usar `v-bind` dinâmico com guard `isIOS`.

**Diagnóstico**: O erro `Module evaluation promise rejected` do NativeScript runtime é um wrapper genérico. Para encontrar o erro JS real, usar try-catch no entry point (`app.ts`) e logar `error.message` + `error.stack`.

---

## 2026-03-03 — Evitar `\p{...}` em regex no runtime Android

**Contexto**: App crashou ao abrir com `SyntaxError: Invalid regular expression: /\p{Diacritic}/: Invalid property name` no `bundle.mjs`.

**Causa raiz**: O engine JS do runtime Android em uso não suporta Unicode property escapes (`\p{...}`), mesmo com flag `u`.

**Fix**: Em [app/utils/EscPosBuilder.ts](app/utils/EscPosBuilder.ts), trocado:
- de: `/\p{Diacritic}/gu`
- para: `/[\u0300-\u036f]/g`

**Regra**:
1. Em código que roda no runtime do NativeScript Android, **não usar** `\p{...}` em regex.
2. Preferir classes explícitas por faixa Unicode quando necessário.
3. Sempre validar no dispositivo físico após introduzir regex nova em código de runtime.

---

## 2026-03-03 — Regra de release após grande mudança

**Decisão operacional**: Sempre que houver grande mudança de códigobase (feature relevante, fluxo crítico, integração, UX de impressão, ajustes de CI/CD), sugerir e perguntar explicitamente sobre publicar nova release.

**Protocolo padrão após mudanças grandes**:
1. Confirmar build local (`ns build android`) sem erro.
2. Confirmar comportamento principal em device USB (quando aplicável).
3. Perguntar ao usuário: “Deseja soltar nova release agora?”.
4. Se aprovado, criar nova tag semântica (ex.: `v1.0.3`) e acompanhar pipeline até release publicada.
5. Confirmar links finais: release + APK + página pública.

**Regra de interação**:
- Não publicar tag/release automaticamente sem confirmação explícita do usuário.
- Sempre oferecer esse próximo passo ao concluir mudanças grandes.
