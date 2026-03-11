---
applyTo: "app/**/*.{ts,vue}"
description: "Use when changing sale flow, stock, printing or reports. Prioritize correctness, testability and validation for critical PDV logic."
---

- Fluxos de venda, estoque, impressao e sincronizacao sao criticos e exigem maior rigor.
- Prefira funcoes puras para regras de negocio sempre que possivel.
- Antes de concluir, verifique lint, typecheck, testes e build Android quando a mudanca afetar runtime.
- Trate edge cases explicitamente: estoque insuficiente, venda vazia, impressao pendente, cache vazio, backend indisponivel e dados corrompidos.