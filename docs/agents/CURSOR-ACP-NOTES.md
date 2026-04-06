# Cursor ACP notes for CRJM

_Data: 2026-03-24_

## Estado validado

O uso de Cursor / Composer 2 com OpenClaw ficou funcional **via adapter third-party**, não via ACP nativo actual do Cursor.

## Routing recomendado

No `~/.acpx/config.json`, o agente `cursor` deve apontar para um adapter ACP compatível, por exemplo:

```json
{
  "agents": {
    "cursor": {
      "command": "node /tmp/cursor-acp-adapter-run/node_modules/cursor-acp/dist/index.js"
    }
  }
}
```

## O que foi confirmado

- `acpx cursor exec ...` → funciona
- `acpx cursor sessions new ...` + prompt persistente → funciona
- `sessions_spawn(runtime:"acp", agentId:"cursor")` via OpenClaw gateway → funciona

## O que falhava antes

O ACP nativo actual do Cursor mostrava incompatibilidade com o caminho persistente / queue-owner do acpx/OpenClaw runtime. O sintoma era falha no runtime ACP com `acpx exited with code 1`, apesar de alguns testes one-shot funcionarem fora do gateway.

## Recomendação para CRJM

Quando fizer sentido usar Cursor / Composer 2 em tarefas de implementação suficientemente baratas ou mecânicas:

- usar `agentId: "cursor"`
- assumir que esse `cursor` está roteado para o adapter ACP third-party
- evitar depender do ACP nativo do Cursor até haver evidência clara de estabilidade no caminho persistente

## Nota operacional

Se o adapter estiver instalado apenas num path temporário (`/tmp/...`), isso deve ser tornado mais permanente antes de depender dele em automações contínuas.
