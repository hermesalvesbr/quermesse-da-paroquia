# Lições Aprendidas

## 2026-03-02 — `ios.position` crashava o app no Android

**Contexto**: O app crashava ao iniciar com erro `Module evaluation promise rejected` (wrapper Java) que mascarava o erro real: `TypeError: Cannot set property ios of [object Object] which has only a getter`.

**Causa raiz**: No `AppShell.vue`, o `ActionItem` usava `ios.position="left"` como atributo. No NativeScript-Vue 3, atributos com ponto são interpretados como setters de propriedade. A propriedade `ios` do `ActionItem` é getter-only no Android, causando crash durante chamada de `patchAttr` no Vue.

**Fix**: Removido `ios.position="left"` do `ActionItem` (desnecessário em app Android-only).

**Regra**: Em projetos Android-only, nunca usar atributos `ios.*` nos templates Vue. Se necessário targetar ambas as plataformas, usar `v-bind` dinâmico com guard `isIOS`.

**Diagnóstico**: O erro `Module evaluation promise rejected` do NativeScript runtime é um wrapper genérico. Para encontrar o erro JS real, usar try-catch no entry point (`app.ts`) e logar `error.message` + `error.stack`.
