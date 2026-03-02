# Screenshots do PDV Quermesse

Esta pasta contém screenshots do aplicativo para documentação e testes.

## Uso

- Salve capturas de tela do app (Android/emulador) nesta pasta
- Os arquivos **não serão versionados no Git** (configurado no `.gitignore`)
- Use nomes descritivos: `tela-pdv-carrinho.png`, `modal-operador.png`, etc.

## Ferramentas Úteis

### Capturar screenshot via ADB:
```bash
# Tirar screenshot
adb shell screencap -p /sdcard/screenshot.png

# Baixar para esta pasta
adb pull /sdcard/screenshot.png docs/screenshots/nome-descritivo.png

# Limpar do device
adb shell rm /sdcard/screenshot.png
```

### Ou via PowerShell (Windows):
```powershell
adb shell screencap -p /sdcard/screen.png; adb pull /sdcard/screen.png docs/screenshots/nome.png; adb shell rm /sdcard/screen.png
```
