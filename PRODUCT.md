# Produto

## Visao geral

O PDV Quermesse e um aplicativo Android nativo para operacao de caixa em festas, quermesses e eventos paroquiais. O app precisa continuar operando mesmo com internet instavel, integrar-se com impressoras Bluetooth ESC/POS e manter o fluxo de venda simples para operadores nao tecnicos.

## Objetivos do produto

- Registrar vendas com rapidez e baixo risco operacional.
- Gerar ticket impresso como ordem oficial de retirada.
- Manter estoque, historico e relatorios consistentes.
- Continuar funcionando offline com sincronizacao posterior.
- Minimizar passos manuais em momentos de pico.

## Fluxo principal

1. Operador se identifica ao abrir o app.
2. Operador monta o carrinho com itens do catalogo.
3. Sistema valida estoque e forma de pagamento.
4. Venda e registrada localmente e sincronizada com Directus quando possivel.
5. Ticket Bluetooth e impresso para retirada.
6. Se a impressao falhar, a venda continua registrada e fica pendente de impressao.

## Regras operacionais criticas

- Sem ticket impresso, a venda esta operacionalmente incompleta.
- A impressora deve ser tratada como parte do fluxo de venda, nao como detalhe opcional.
- Devolucoes e trocas por item so sao permitidas para vendas pagas em dinheiro.
- Estoque precisa refletir venda, cancelamento, devolucao e troca.
- O aplicativo deve degradar para cache local quando o backend estiver indisponivel.

## Capacidades atuais

- Catalogo sincronizado com Directus, com fallback offline.
- Identificacao e persistencia de operador.
- Carrinho com validacao de estoque.
- Vendas com pagamento em dinheiro, PIX e cartao.
- Historico de vendas com cancelamento, devolucao e troca.
- Relatorios de vendas e itens.
- Impressao Bluetooth ESC/POS com reimpressao.
- Fila de sincronizacao para operacoes offline.

## Restricoes do dominio

- Plataforma alvo: Android.
- Runtime: NativeScript, sem DOM de navegador.
- Bluetooth classico SPP pode falhar ou desconectar; isso deve ser considerado normal.
- Internet e backend podem ficar indisponiveis durante a operacao.
- UX precisa priorizar clareza e velocidade em telas pequenas.

## Qualidade esperada

- Mudancas em fluxo de venda, estoque, impressao e sincronizacao exigem validacao automatizada e manual.
- Segredos nao devem ficar hardcoded no codigo-fonte.
- O projeto deve manter contexto consistente para IA e para contribuidores humanos.