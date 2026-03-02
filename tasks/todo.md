# TODO - Harmonização Visual da Marca

## Plano
- [x] Mapear cores atuais no app e recursos Android
- [x] Aplicar paleta da marca no tema global (`app/app.css`)
- [x] Ajustar componentes para contraste e consistência visual
- [x] Atualizar tema nativo Android e splash screen
- [x] Validar lint + build Android
- [x] Validar execução Android (emulador/dispositivo) e capturar erros

## Review
- Lint: `npm run lint` executado sem erros.
- Build Android: `ns build android` executado com sucesso.
- Crash pré-existente encontrado e corrigido: `ios.position="left"` no `ActionItem` crashava no Android (getter-only). Removido.
- App rodando com sucesso no emulador Pixel (Android 11).
- Screenshot capturada em `screenshot.png`.
- Lição registrada em `tasks/lessons.md`.

---

# TODO - Refatoração PDV: Drawer + UX + Impressão Obrigatória

## Plano
- [x] BluetoothService singleton global (`getBluetoothService()`)
- [x] PdvStore: `printStatus` (printed/pending), `orderNumber` sequencial diário
- [x] PdvStore: `category` nos itens (comida/bebida), novos itens (suco, água)
- [x] PdvStore: `markAsPrinted()`, `getPendingPrintSales()`, `getCartItemsByCategory()`, `getPaymentLabel()`
- [x] EscPosBuilder: `doubleSize()`, `separator()`, `columns()`, `buildSaleTicket()` template
- [x] Criar VendasPage.vue: histórico com reimpressão, alerta de pendências
- [x] Criar RelatoriosPage.vue: relatórios dia/semana com top itens
- [x] Refatorar PdvPage: tabs Comidas/Bebidas, seletor pagamento inline, FINALIZAR com impressão
- [x] PdvPage: bloqueio se impressora desconectada, banner de warning, fluxo de erro de impressão
- [x] AppShell: drawer com PDV/Vendas/Relatórios/Impressora/Config/Mudar Operador
- [x] PrinterPage: usar singleton BluetoothService
- [x] CSS: finalize-btn verde grande, pay-btn-active, printer-warning-banner, sale-card, reprint-btn
- [x] Lint sem erros
- [x] Build Android OK
- [x] Deploy e execução no emulador sem crash

## Review
- Lint: `npx eslint app/` sem erros.
- Build: `ns build android` compilou em 7.8s com sucesso.
- APK instalado no emulador Pixel, app aberto sem crash.
- Logcat: zero erros JS.
- Screenshots capturadas em `docs/screenshots/`.
