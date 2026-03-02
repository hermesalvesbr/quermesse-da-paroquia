# 🔥 Atualização Crítica – Impressão como Parte Obrigatória do Fluxo

## 🎯 Novo Fluxo Oficial do PDV (Operacional)

1. Operador se identifica.
2. Cliente faz o pedido.
3. Operador adiciona itens ao carrinho.
4. Sistema calcula total automaticamente.
5. Operador seleciona forma de pagamento.
6. Operador confirma venda.
7. Sistema:

   * Valida impressora conectada ✅
   * Abate estoque
   * Registra operador
   * Gera número do pedido
   * Envia impressão Bluetooth
8. Cliente recebe o ticket impresso.
9. Cliente leva o ticket até a barraca correspondente para retirada.

⚠️ **Sem impressão = venda incompleta operacionalmente.**

---

# 🖨️ Impressora Bluetooth – Agora Etapa Obrigatória

## 📌 Regras Críticas

* [ ] Não permitir finalizar venda se:

  * Impressora não estiver conectada
* [ ] Exibir alerta visual persistente quando:

  * Impressora estiver desconectada
* [ ] Validar conexão antes de confirmar venda
* [ ] Se falhar impressão:

  * Exibir erro claro
  * Permitir reimpressão imediata
  * Não perder a venda

---

## 📄 Estrutura do Ticket de Retirada

O ticket deve conter:

* Nome do evento (ex: Quermesse São José)
* Número do pedido (sequencial do dia)
* Itens e quantidades
* Total pago
* Forma de pagamento
* Nome do operador
* Data e hora
* Identificação da barraca (ex: Cozinha, Bebidas, Doces)

---

# 🧠 Ajuste Arquitetural Necessário

## Nova Dependência de Fluxo

A tela de PDV precisa:

* Conhecer o status da impressora em tempo real
* Ter acesso ao BluetoothService global
* Bloquear botão “Finalizar Venda” se:

  * `printer.status !== CONNECTED`

---

# 🔁 Fluxo de Erro de Impressão

Se a impressão falhar após confirmar venda:

1. Venda permanece registrada
2. Status da venda = “Aguardando impressão”
3. Botão “Reimprimir” disponível no histórico
4. Aviso visual destacado

---

# 🧾 Impressão como Logística de Produção

Como o cliente retira em outra barraca, o ticket passa a ser:

* Ordem de produção
* Controle de fila
* Validação de retirada

Então podemos evoluir para:

* [ ] Separação por ponto de produção
* [ ] Impressão duplicada (uma via cliente / uma via cozinha)
* [ ] Ticket com destaque grande do item principal
* [ ] Layout otimizado para leitura rápida

---

# 📊 Novo Status das Vendas

* Concluída e Impressa ✅
* Concluída e Pendente de Impressão ⚠️
* Cancelada ❌

---

# 🛑 Regra Operacional Fundamental

> O PDV não é apenas financeiro.
> Ele é o gerador oficial da ordem de retirada.

Sem ticket impresso, o cliente não consegue retirar o produto.
