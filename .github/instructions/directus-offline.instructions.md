---
applyTo: "app/services/{DirectusService,PdvStoreDirectus,OperatorSessionService}.ts"
description: "Use when editing Directus integration, offline sync or operator/session flows. Preserve offline-first behavior, queue integrity and safe backend configuration."
---

- Preserve o comportamento offline-first: falha de rede nao pode inutilizar o caixa.
- Nunca hardcode URL, token ou segredo do backend.
- Em falha de backend, prefira degradar com cache local e fila de sincronizacao.
- Mudancas em estoque, cancelamento, devolucao, troca e impressao devem considerar sincronizacao posterior.