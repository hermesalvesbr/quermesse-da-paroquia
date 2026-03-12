---
applyTo: "app/**/*.{ts,vue}"
description: "Use when editing NativeScript Android app code, Vue components or runtime-sensitive TypeScript. Enforce Android-only constraints and NativeScript runtime compatibility."
---

- Este projeto roda em NativeScript Android, nao em navegador.
- Evite APIs de DOM, `window`, `document` e comportamento tipico de web.
- Evite propriedades `ios.*` em templates e qualquer codigo orientado a iOS.
- Regex e APIs modernas devem ser compativeis com o runtime Android usado pelo app.
- Mudancas em UI e runtime devem considerar performance em dispositivos Android modestos.
- **windowSoftInputMode**: usar `adjustNothing|stateHidden` no AndroidManifest. Modos `adjustPan` e `adjustResize` causam tela branca no NativeScript+Vite quando o teclado virtual abre. Nao alterar sem testar.
- `v-show` em componentes Vue funciona corretamente para mostrar/ocultar paginas. Nao usar `:visibility` como fallthrough prop nem adicionar GridLayout wrappers em torno de componentes de pagina.