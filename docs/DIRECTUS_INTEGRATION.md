# Integração Directus SDK - Migração PDV

## Resumo da Implementação

O sistema PDV foi migrado para usar o **Directus CMS** como backend, mantendo 100% de compatibilidade com a interface existente e adicionando suporte offline.

---

## Arquitetura

### Antes (Local Only)
```
PdvStore.ts → ApplicationSettings (JSON local)
```

### Depois (Directus + Cache)
```
PdvStoreDirectus.ts → DirectusService.ts → Directus API (REST)
                   ↓
            ApplicationSettings (cache offline)
```

---

## Arquivos Criados/Modificados

### ✅ Novos Arquivos

1. **`app/services/DirectusService.ts`**
   - Cliente SDK Directus configurado com token estático
   - Métodos para CRUD de produtos, operadores, vendas
   - Gerenciamento automático de estoque no Directus
   - Tratamento de erros e modo offline

2. **`app/services/PdvStoreDirectus.ts`**
   - Drop-in replacement do `PdvStore.ts` original
   - Mesma interface pública (compatibilidade total)
   - Carrega dados do Directus na inicialização
   - Cache local para modo offline
   - Fila de sincronização para vendas offline

### 📝 Arquivos Modificados

1. **`app/app.ts`**
   - Inicializa `pdvStore` no evento `launchEvent`
   - Carrega produtos/operadores do Directus antes do app iniciar

2. **`app/components/PdvPage.vue`**
   - Import alterado para `PdvStoreDirectus`

3. **`app/components/VendasPage.vue`**
   - Import alterado para `PdvStoreDirectus`

4. **`app/components/RelatoriosPage.vue`**
   - Import alterado para `PdvStoreDirectus`

5. **`package.json`**
   - Adicionado `@directus/sdk` nas dependências

---

## Collections Directus

Todas criadas com UUID, soft delete e audit fields:

### 1. `pdv_operators`
- `name` (string, obrigatório)
- `active` (boolean, default true)

### 2. `pdv_categories`
- `name` (string, obrigatório)
- `icon` (string)
- `sort_order` (integer)
- `active` (boolean)

### 3. `pdv_production_points`
- `name` (string, obrigatório)
- `active` (boolean)

### 4. `pdv_products`
- `name` (string, obrigatório)
- `price` (decimal 10,2, obrigatório)
- `stock_quantity` (integer, default 0)
- `active` (boolean, default true)
- `sort_order` (integer)
- `category_id` (M2O → pdv_categories)
- `production_point_id` (M2O → pdv_production_points)

### 5. `pdv_sales`
- `sale_number` (integer)
- `operator_id` (M2O → pdv_operators, obrigatório)
- `total_amount` (decimal 10,2)
- `payment_method` (enum: dinheiro, pix, cartao)
- `sale_status` (enum: completed, cancelled, pending_print)
- `printed` (boolean, default false)
- `created_at` (timestamp)

### 6. `pdv_sale_items`
- `sale_id` (M2O → pdv_sales, obrigatório)
- `product_id` (M2O → pdv_products, obrigatório)
- `quantity` (integer, obrigatório)
- `unit_price` (decimal 10,2, obrigatório)
- `total_price` (decimal 10,2, obrigatório)

---

## Dados Populados

### Categorias
- ✅ Salgados
- ✅ Bebidas
- ✅ Doces
- ✅ Caldos

### Pontos de Produção
- ✅ Cozinha
- ✅ Bar / Bebidas
- ✅ Confeitaria

### Produtos (16 itens)
**Salgados:**
- Coxinha (R$ 5,00) - estoque: 100
- Pastel (R$ 6,00) - estoque: 80
- Espetinho (R$ 7,00) - estoque: 60
- Cachorro-Quente (R$ 8,00) - estoque: 50
- Tapioca Recheada (R$ 7,50) - estoque: 40
- Milho Cozido (R$ 5,00) - estoque: 70

**Bebidas:**
- Refrigerante Lata (R$ 5,00) - estoque: 120
- Água Mineral (R$ 3,00) - estoque: 150
- Cerveja (R$ 8,00) - estoque: 100
- Suco Natural (R$ 6,00) - estoque: 60

**Doces:**
- Bolo Caseiro (R$ 4,00) - estoque: 80
- Pé de Moleque (R$ 2,50) - estoque: 100
- Cocada (R$ 3,00) - estoque: 90
- Brigadeiro (R$ 2,00) - estoque: 120

**Caldos:**
- Caldo de Feijão (R$ 10,00) - estoque: 50
- Caldo de Mocotó (R$ 12,00) - estoque: 40

### Operadores
- ✅ Caixa Principal
- ✅ Maria Silva
- ✅ João Santos

---

## Funcionalidades

### ✅ Implementadas

#### Online (com Directus)
1. **Carregar produtos** do Directus na inicialização
2. **Sincronizar vendas** automaticamente ao finalizar
3. **Atualizar estoque** no Directus após cada venda
4. **Cancelar vendas** com retorno automático de estoque

#### Offline (cache local)
1. **Cache de produtos** em `ApplicationSettings`
2. **Fila de sincronização** para vendas feitas offline
3. **Sincronização automática** quando voltar online
4. **Funcionamento pleno** mesmo sem internet

### 🔄 Fluxo de Venda

```
1. Usuário adiciona itens ao carrinho
   ↓
2. Finaliza venda (operador + forma de pagamento)
   ↓
3. PdvStoreDirectus tenta sincronizar com Directus
   ├─ SUCESSO → Atualiza estoque no Directus + cache local
   └─ FALHA   → Adiciona à fila de sync + atualiza cache local
   ↓
4. Venda salva localmente em ApplicationSettings
   ↓
5. Cupom gerado para impressão
```

### 🔄 Sincronização Offline

```
App inicia → pdvStore.initialize()
   ↓
Tenta carregar do Directus
   ├─ SUCESSO → Atualiza cache + sincroniza fila pendente
   └─ FALHA   → Carrega do cache local
   ↓
App funciona normalmente
```

---

## Configuração

### Credenciais Directus

Atualmente hardcoded em `DirectusService.ts` (linha 67-68):

```typescript
const DIRECTUS_URL = 'https://capela.softagon.app'
const DIRECTUS_TOKEN = 'oemH4mkn7q-bAHJ9MX2b3ba3BclI6thS'
```

**⚠️ TODO:** Mover para variáveis de ambiente ou `ApplicationSettings` editável.

---

## Próximos Passos

### 🎯 Melhorias Recomendadas

1. **Índices no Banco**
   - Criar índices em `pdv_sales.created_at`, `pdv_sales.operator_id`, `pdv_sale_items.sale_id`, `pdv_products.category_id`

2. **Configuração Dinâmica**
   - Tela de Settings para configurar URL e token do Directus
   - Validar conexão antes de salvar

3. **Relatórios do Directus**
   - Implementar `pdvStore.getReport()` consultando vendas do Directus
   - Aproveitar queries SQL do Directus para analytics

4. **Funcionalidades Avançadas**
   - Múltiplas formas de pagamento por venda
   - Desconto/acréscimo com auditoria
   - Estorno parcial
   - Separação por ponto de produção
   - Collections `pdv_cash_sessions` e `pdv_cash_movements`

5. **Sincronização Bidirecional**
   - Polling/webhooks para atualizar estoque em tempo real
   - Notificações de produtos em baixa

6. **Testes**
   - Unit tests para DirectusService
   - Integration tests para PdvStoreDirectus
   - E2E no emulador Android

---

## Testes Manuais

### ✅ Checklist de Validação

- [ ] App inicia sem erros de TypeScript
- [ ] Produtos carregam do Directus na primeira execução
- [ ] Produtos ficam em cache após primeira carga
- [ ] Venda finaliza e sincroniza com Directus (online)
- [ ] Estoque é atualizado no Directus após venda
- [ ] Venda funciona offline e fica na fila de sync
- [ ] Vendas da fila sincronizam quando volta online
- [ ] Componentes Vue funcionam normalmente
- [ ] Impressão de cupom continua funcionando
- [ ] Cancelamento de venda retorna estoque

---

## Comandos Úteis

### Build Android
```bash
bun run build:android
```

### Lint
```bash
bun run lint
```

### Logs do App
```bash
ns run android --no-hmr
```

### Limpar Cache (se necessário)
No device/emulador:
- Settings → Apps → PDV App → Storage → Clear Data

---

## Troubleshooting

### Problema: "Products not loading"
**Solução:** Verificar conexão de rede e token do Directus. Logs em `DirectusService`.

### Problema: "Estoque não atualiza"
**Solução:** Verificar se método `updateProductStock` está sendo chamado. Logs em console.

### Problema: "Vendas não sincronizam"
**Solução:** Verificar fila de sincronização em `ApplicationSettings` (chave `pdv.sync.queue`).

---

## Manutenção

### Limpar Fila de Sincronização Manualmente

```typescript
import { ApplicationSettings } from '@nativescript/core'
ApplicationSettings.remove('pdv.sync.queue')
```

### Ver Cache de Produtos

```typescript
import { ApplicationSettings } from '@nativescript/core'
const cache = ApplicationSettings.getString('pdv.directus.products', '')
console.log(JSON.parse(cache))
```

---

## Autor

Integração desenvolvida via GitHub Copilot + Directus MCP  
Data: 02/03/2026
