# PDV Quermesse — Android Nativo (NativeScript + Vue 3)

Ponto de venda mobile para quermesses e festas, com impressão térmica Bluetooth ESC/POS, gestão de estoque e sincronização com Directus.

Tudo roda nativamente no Android — sem browser, sem serviços externos obrigatórios.

---

## Funcionalidades

### PDV e Vendas
- Catálogo de produtos carregado do Directus (com fallback offline via cache local)
- Carrinho com controle de quantidade e validação de estoque em tempo real
- Finalização de venda com escolha de forma de pagamento: **Dinheiro**, **PIX** ou **Cartão**
- Numeração sequencial de pedidos (reset diário)
- Identificação de operador por modal na abertura

### Impressão Bluetooth ESC/POS
- Conexão via Bluetooth clássico SPP (RFCOMM) com impressoras térmicas POS
- Tickets individuais por item (cada unidade gera 1 ticket com corte)
- Reconexão automática em falha de envio (até 5 tentativas)
- Reimprimir tickets de vendas anteriores

### Gestão de Itens (Devolução e Troca)
- **Devolução por item** — devolver unidades específicas de uma venda concluída
- **Troca por item** — trocar um item por outro produto do catálogo
- Cálculo automático de diferença de preço na troca
- Histórico de devoluções e trocas registrado na venda
- Itens devolvidos aparecem riscados com badge visual

> **Regra de negócio:** Devoluções e trocas só são permitidas em vendas pagas em **Dinheiro**. Vendas em PIX ou Cartão não permitem devolução/troca.

### Cancelamento de Venda
- Cancelamento individual com motivo obrigatório
- Itens retornados automaticamente ao estoque

### Sincronização com Directus
- Produtos, operadores e categorias sincronizados do backend Directus
- Vendas criadas offline são enfileiradas e sincronizadas automaticamente
- Campo `returned_qty` no Directus rastreia devoluções por item de venda
- Fallback offline completo com cache local em `ApplicationSettings`

### Relatórios
- Resumo por dia e semana (vendas, ticket médio, top itens)
- Contagem de cancelamentos

---

## Arquitetura

```
app/
├── components/
│   ├── AppShell.vue         # Shell com drawer lateral
│   ├── PdvPage.vue          # Tela principal do PDV (carrinho)
│   ├── VendasPage.vue       # Histórico de vendas + gestão de itens
│   ├── PrinterPage.vue      # Conexão Bluetooth
│   ├── RelatoriosPage.vue   # Relatórios
│   └── SettingsPage.vue     # Configurações
├── services/
│   ├── BluetoothService.ts  # Conexão SPP + reconexão automática
│   ├── DirectusService.ts   # Client Directus (CRUD produtos/vendas)
│   ├── PdvStoreDirectus.ts  # Estado reativo (inventário, carrinho, vendas)
│   └── OperatorSessionService.ts
└── utils/
    ├── EscPosBuilder.ts     # Builder fluente de comandos ESC/POS
    └── BluetoothPermissions.ts
```

### Stack
| Componente | Tecnologia |
|---|---|
| Framework | NativeScript 9 + nativescript-vue 3 |
| Linguagem | TypeScript 5.8 |
| Estilo | TailwindCSS 4 |
| Backend | Directus (opcional, funciona offline) |
| Impressão | Bluetooth SPP + ESC/POS |
| Plataforma | Android |
| Package Manager | **Bun** (obrigatório) |

---

## Requisitos

- Node.js 20+
- Bun (latest)
- NativeScript CLI 9+
- Android SDK + JDK 17
- Device Android ou emulador

---

## Instalação

```bash
bun install
```

### Configuração do Directus

As credenciais do backend devem ser fornecidas no ambiente de build:

```powershell
$env:DIRECTUS_URL="https://seu-directus"
$env:DIRECTUS_TOKEN="seu-token"
ns run android --no-hmr
```

Sem essas variáveis, o app não usa backend remoto e tenta operar com cache local quando disponível.
Em instalação limpa (sem cache), o catálogo ficará vazio.

Para qualquer build APK, exporte as variáveis no mesmo terminal antes do comando:

```powershell
$env:DIRECTUS_URL="https://seu-directus"
$env:DIRECTUS_TOKEN="seu-token"
ns build android
```

---

## Comandos

```bash
# Build Android
ns build android

# Rodar no device conectado via USB
ns run android --no-hmr

# Rodar em device específico
ns run android --no-hmr --device <DEVICE_ID>

# Lint
bun run lint
bun run lint:fix

# Typecheck
bun run typecheck

# Testes
bun run test

# Gerar APK organizado
bun run apk:build

# Publicar release no GitHub (com tag)
bun run release:github
```

---

## CI/CD — Release Automática

### Workflow: Release APK (`release-apk-pages.yml`)

Disparado automaticamente ao fazer push de uma tag `v*`:

```bash
git tag v1.1.0
git push origin v1.1.0
```

O workflow:
1. Instala Java 17, Android SDK, Node.js e Bun
2. Roda `bun install`, `bun run lint`, `bun run typecheck`, `bun run test` e `ns build android`
3. Copia o APK para `artifacts/apk/`
4. Publica GitHub Release com os APKs anexados
5. Gera release notes automáticas

### Workflow: Deploy Pages (`deploy-pages.yml`)

Disparado ao fazer push na branch `main` com mudanças em `public/releases/index.html`.

Portal público de downloads: [hermesalvesbr.github.io/quermesse-da-paroquia](https://hermesalvesbr.github.io/quermesse-da-paroquia/)

---

## Gestão de Itens — Devolução e Troca

### Fluxo de Devolução
1. Acesse **Vendas** no menu lateral
2. Localize a venda (deve ser paga em **Dinheiro**)
3. Ao lado de cada item, toque **↩** (devolver)
4. Selecione a quantidade a devolver
5. Confirme — o valor a reembolsar é exibido
6. Item devolvido aparece riscado, estoque atualizado

### Fluxo de Troca
1. Localize a venda em **Vendas** (pagamento em **Dinheiro**)
2. Toque **🔄** (trocar) ao lado do item
3. Selecione o produto destino da lista
4. Selecione a quantidade
5. Diferença de preço é calculada automaticamente:
   - Produto mais caro → cobrar a diferença do cliente
   - Produto mais barato → devolver a diferença
6. Confirme — estoque de ambos os produtos é atualizado

### Restrição por Forma de Pagamento
| Pagamento | Devolver | Trocar |
|---|---|---|
| Dinheiro | ✅ | ✅ |
| PIX | ❌ | ❌ |
| Cartão | ❌ | ❌ |

Vendas em PIX ou Cartão não exibem os botões de ação por item.

---

## Impressão ESC/POS

### Tickets Individuais
Cada unidade vendida gera um ticket separado com corte entre eles:
- **Header:** nome do evento + data/hora
- **Item:** nome em tamanho duplo + preço
- **Footer:** forma de pagamento, operador, mensagem "Apresente este ticket"

### Compatibilidade
- Impressoras térmicas POS 58mm / 80mm
- Bluetooth clássico SPP (UUID `00001101-0000-1000-8000-00805F9B34FB`)
- Caracteres acentuados convertidos automaticamente para ASCII

---

## Permissões Android

Definidas em `App_Resources/Android/src/main/AndroidManifest.xml`:
- `BLUETOOTH`, `BLUETOOTH_ADMIN` (Android < 12)
- `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` (Android 12+)
- `ACCESS_FINE_LOCATION` (necessário para scan Bluetooth)

---

## Qualidade de Código

```bash
# ESLint com @antfu/eslint-config
bun run lint
bun run lint:fix

# TypeScript
bun run typecheck

# Testes unitários
bun run test
```
