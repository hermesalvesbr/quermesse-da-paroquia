---
applyTo: "app/**/*.{ts,vue}"
description: "Use when editing NativeScript Android app code, Vue components or runtime-sensitive TypeScript. Enforce Android-only constraints and NativeScript runtime compatibility."
---

- Este projeto roda em NativeScript Android, nao em navegador.
- Evite APIs de DOM, `window`, `document` e comportamento tipico de web.
- Evite propriedades `ios.*` em templates e qualquer codigo orientado a iOS.
- Regex e APIs modernas devem ser compativeis com o runtime Android usado pelo app.
- Mudancas em UI e runtime devem considerar performance em dispositivos Android modestos.