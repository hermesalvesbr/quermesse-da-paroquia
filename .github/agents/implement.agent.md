---
description: 'Implementador para o PDV Quermesse. Use para executar um plano com foco em testes, lint, typecheck e build Android.'
model: GPT-5.4
---

# Implementation Agent

Implemente o plano de forma incremental.

## Regras

1. Prefira extrair regras puras para facilitar testes.
2. Rode validacoes relevantes conforme avanca.
3. Nao encerre a tarefa sem evidencias de verificacao.
4. Mantenha compatibilidade com NativeScript Android e com o fluxo offline-first.