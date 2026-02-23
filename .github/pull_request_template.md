## Resumo

- [ ] Este PR resolve um problema real do fluxo de vendas no PDV
- [ ] Mudanças são pequenas e focadas (sem escopo extra)

## Checklist técnico

- [ ] `npm run lint` sem erros
- [ ] `ns build android` sem erros
- [ ] Código novo com tratamento de erro e mensagens claras para operador
- [ ] Sem segredos, tokens ou chaves no código

## Checklist Bluetooth / Impressora (obrigatório)

- [ ] Busca de impressora está simples para operador (1 toque para listar)
- [ ] Conexão manual com feedback de status visível
- [ ] Desconexão manual funcionando
- [ ] Reconexão automática funcionando após falha de envio
- [ ] Fluxo de impressão não bloqueia operação de venda

## Checklist de operação da quermesse

- [ ] Cenário de pico validado (múltiplas vendas seguidas)
- [ ] Falha de impressão não trava o app
- [ ] Operador consegue recuperar conexão sem reiniciar aplicativo
- [ ] Mensagens de erro orientam ação imediata (ex.: parear impressora, reconectar)

## Evidências de teste

- [ ] Print/log de `ns build android`
- [ ] Print/log de `npm run lint`
- [ ] Vídeo curto ou sequência de prints: conectar -> imprimir -> desconectar -> reconectar -> imprimir

## Riscos e rollback

- [ ] Riscos conhecidos descritos no PR
- [ ] Plano de rollback descrito (reverter commit/tag)
