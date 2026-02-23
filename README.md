# PDV Android Native (Vue + NativeScript) com Impressão ESC/POS via Bluetooth SPP

Aplicativo Android nativo para PDV usando **NativeScript + Vue**, com fluxo completo:

1. UI do PDV coleta os dados da venda
2. Módulo Bluetooth clássico (SPP/RFCOMM) conecta na impressora térmica
3. App converte os dados para bytes ESC/POS
4. Bytes são enviados pelo socket Bluetooth para impressão

Tudo roda nativamente no Android, sem browser e sem serviços externos.

---

## Arquitetura

- **UI (Vue NativeScript):** tela de venda e interação do operador
- **BluetoothService (Android SPP):**
  - Lista impressoras pareadas
  - Conecta por RFCOMM UUID SPP (`00001101-0000-1000-8000-00805F9B34FB`)
  - Mantém socket de saída
  - Faz reconexão automática em falha de envio
  - Publica status para a UI
- **EscPosBuilder:** constrói payload ESC/POS (init, alinhamento, negrito, linhas, corte)

---

## Requisitos

- Node.js 20+
- NativeScript CLI 9+
- Android SDK + AVD configurados
- Java/JDK compatível com ambiente Android local

---

## Instalação

```bash
npm install
```

---

## Qualidade de código

Este projeto usa **ESLint com `@antfu/eslint-config`** para manter padrão consistente e facilitar manutenção no time.

```bash
# Verificar padrões
npm run lint

# Corrigir automaticamente o que for possível
npm run lint:fix
```

Template de PR com checklist operacional disponível em `.github/pull_request_template.md`.

---

## Rodando no Android

### 1) Build local

```bash
ns build android
```

### 2) Rodar no emulador

```bash
ns run android --no-hmr --device emulator-5554
```

> Se necessário, liste dispositivos:

```bash
adb devices
ns device android --available-devices
```

---

## Permissões Android

As permissões de Bluetooth estão definidas no `AndroidManifest.xml` em `App_Resources/Android/src/main/AndroidManifest.xml`, incluindo suporte para Android 12+ (`BLUETOOTH_CONNECT` e `BLUETOOTH_SCAN`).

---

## Como usar o app

1. Ative Bluetooth no Android
2. Faça pareamento da impressora térmica nas configurações do Android
3. Abra o app
4. Toque em **Buscar Impressoras Bluetooth**
5. Selecione a impressora da lista
6. Preencha valor e observação
7. Toque em **IMPRIMIR RECIBO**

A parte inferior da tela mostra o status de conexão/impressão em tempo real.

---

## Reconexão automática

Quando ocorre falha de envio:

- o app marca a conexão como instável
- agenda reconexão automática
- tenta reconectar até 5 vezes (intervalo de 2.5s)
- atualiza status para o operador

---

## Validação executada

Validação feita neste projeto:

- `ns build android` compilando com sucesso
- instalação/sync no emulador (`emulator-5554`) com sucesso
- app iniciando e fluxo de tela funcionando

### Observação importante sobre impressora Bluetooth em emulador

Emuladores Android podem não reproduzir fielmente o Bluetooth clássico SPP com hardware físico de impressora. Para homologação final de impressão, valide em **dispositivo Android real** com impressora térmica pareada.

---

## Estrutura principal

- `app/components/Home.vue`: tela principal do PDV
- `app/services/BluetoothService.ts`: conexão Bluetooth clássico SPP + reconexão
- `app/utils/EscPosBuilder.ts`: montagem dos bytes ESC/POS

---

## Comandos úteis

```bash
# Build
ns build android

# Lint
npm run lint

# Rodar no Android
ns run android --no-hmr

# Rodar em device específico
ns run android --no-hmr --device emulator-5554
```
