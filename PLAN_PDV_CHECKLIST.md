# Plano de Implementação - PDV Quermesse (NativeScript + Vue 3 + TypeScript)

Objetivo: evoluir o app para fluxo PDV com identificação de operador, menu lateral, tela inicial de quermesse, tela separada de impressora Bluetooth e visual Material + liquid glass.

## Checklist de execução

### 1) Estrutura e navegação
- [x] Criar shell principal com menu lateral e navegação entre páginas
- [x] Definir páginas: PDV, Impressora e Configurações
- [x] Manter Home legado apenas temporariamente
- [ ] Validar navegação com Frame

### 2) Operador do caixa (primeiro requisito)
- [x] Criar modal de identificação na primeira execução
- [x] Criar serviço de sessão com ApplicationSettings
- [x] Salvar nome, data/hora e último operador
- [x] Exibir operador atual no topo do PDV e em Configurações

### 3) Primeira tela PDV (quermesse mock)
- [x] Implementar catálogo fixo (coxinha, pastel, caldo, refrigerante, milho, doce)
- [x] Criar estado de carrinho com quantidade por item
- [x] Adicionar controles + / -, subtotal e total geral
- [x] Criar ações de limpar pedido e finalizar (mock)

### 4) Tela separada da impressora Bluetooth
- [x] Migrar fluxo Bluetooth para nova página
- [x] Reaproveitar BluetoothService e ESC/POS
- [x] Exibir status conectada/desconectada
- [x] Manter ações: buscar, conectar, reconectar, desconectar, teste de impressão

### 5) Branding e ícones
- [x] Usar public/logo.png como referência visual
- [x] Aplicar tokens de tema no app.css
- [x] Integrar assets de public para uso na UI nativa

### 6) Estilo Material + liquid glass
- [x] Cards com bordas arredondadas, sombras suaves e transparência
- [x] Gradientes leves e contraste adequado
- [x] Manter performance em Android de entrada

### 7) Qualidade e validação
- [x] Rodar lint
- [ ] Rodar app Android
- [ ] Validar fluxo completo operador -> PDV -> impressora
- [ ] Validar persistência local do operador

### 8) Operações avançadas de PDV (Quermesse)
- [x] Controlar estoque por item (saldo em tempo real no caixa)
- [x] Finalizar venda abatendo estoque automaticamente
- [x] Cancelar venda e retornar itens ao estoque
- [x] Registrar operação de troca de item (ex.: coxinha -> pastel)
- [x] Registrar retorno manual ao estoque (balcão/cozinha)
- [x] Manter histórico recente de vendas com status
- [x] Gerar relatório de vendas do dia (vendas, canceladas, ticket, retornos)
- [x] Gerar relatório de vendas da semana

### 9) Operações relevantes para fase seguinte
- [x] Sangria e suprimento de caixa (base de serviço implementada)
- [x] Fechamento por turno (abertura, fechamento, diferença) - base de serviço
- [ ] Múltiplas formas de pagamento (dinheiro, PIX, cartão)
- [ ] Desconto/acréscimo autorizado com trilha de auditoria
- [ ] Estorno parcial por item
- [ ] Separação por ponto de produção (cozinha/bebidas/doces)
- [ ] Relatório por operador e por item mais vendido
- [ ] Exportação de relatório (CSV/PDF)
