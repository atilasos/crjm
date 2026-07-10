# Túnel Cloudflare — crjm.infantinho.xyz

Documenta a criação e operação do túnel permanente que expõe o servidor de torneios
(`bun run tournament`, porta 4000) em **https://crjm.infantinho.xyz**.

Criado a 2026-07-10 no MacBook do Igor. Estado: ativo e verificado.

## Arquitetura

```
alunos/professor ──https──> Cloudflare (proxy + TLS)
                                 │  CNAME crjm.infantinho.xyz → fcb1352b-….cfargotunnel.com
                                 ▼
                    cloudflared (conector local, QUIC de saída)
                                 │  ingress: crjm.infantinho.xyz → http://127.0.0.1:4000
                                 ▼
                    servidor de torneios (Bun, HTTP + WebSocket na mesma porta)
```

Não há portas abertas no router: o `cloudflared` estabelece ligações de saída para a
edge da Cloudflare. HTTP, WebSocket (`/ws`) e os ficheiros estáticos passam todos pelo
mesmo hostname.

## Identificadores

| Item | Valor |
| --- | --- |
| Tunnel | `crjm` — UUID `fcb1352b-898e-4f0e-b96d-967e9a7e74e9` |
| Hostname | `crjm.infantinho.xyz` (CNAME proxied para `<UUID>.cfargotunnel.com`) |
| Config do conector | `~/.cloudflared/config-crjm.yml` |
| Credenciais do tunnel | `~/.cloudflared/fcb1352b-898e-4f0e-b96d-967e9a7e74e9.json` (secreto) |
| Serviço de origem | `http://127.0.0.1:4000` |
| `ADMIN_KEY` | `.env.local` na raiz do repo (gitignored, chmod 600) |

Na mesma máquina corre um segundo túnel independente (`crjm-macbookpro`, config
`~/.cloudflared/config.yml`) que serve `wiki.infantinho.xyz` — **não partilham config
nem processo**; alterações a um não afetam o outro.

## Como foi criado

Pré-requisitos: `cloudflared` instalado e `~/.cloudflared/cert.pem` (obtido uma vez com
`cloudflared tunnel login`, autorizado para a zona `infantinho.xyz`).

```bash
# 1. Criar o tunnel (gera o UUID e o JSON de credenciais em ~/.cloudflared/)
cloudflared tunnel create crjm

# 2. Config dedicada — nunca editar o config.yml default (é do túnel do wiki)
cat > ~/.cloudflared/config-crjm.yml <<'EOF'
tunnel: fcb1352b-898e-4f0e-b96d-967e9a7e74e9
credentials-file: /Users/igor/.cloudflared/fcb1352b-898e-4f0e-b96d-967e9a7e74e9.json

ingress:
  - hostname: crjm.infantinho.xyz
    service: http://127.0.0.1:4000
  - service: http_status:404
EOF

# 3. DNS — usar o UUID, NUNCA o nome (ver armadilha abaixo).
#    --overwrite-dns porque já existia um CNAME órfão de um túnel antigo (devolvia 530).
cloudflared tunnel route dns --overwrite-dns fcb1352b-898e-4f0e-b96d-967e9a7e74e9 crjm.infantinho.xyz
```

**⚠️ Armadilha confirmada:** `cloudflared tunnel route dns crjm …` resolveu o nome para
o túnel errado (`crjm-macbookpro`, prefixo semelhante). Confirmar sempre no output
`tunnelID=fcb1352b-…`; se apontar para outro, repetir o comando com o UUID.

Nota: a criação via API REST não foi possível — o token em `~/.cloudflared/claude-token`
é de curta duração e quase só de leitura. O fluxo API alternativo (requer token com
`Cloudflare Tunnel:Edit` + `Zone:DNS:Edit`) está documentado na skill
`~/.claude/skills/cloudflare-tunnel/SKILL.md`.

## Operação

Arranque (duas janelas de terminal, ou dois processos em background):

```bash
# 1. Servidor de torneios (lê ADMIN_KEY de .env.local automaticamente — Bun carrega .env.local)
cd ~/dev/crjm && bun run tournament

# 2. Conector do túnel
cloudflared tunnel --config ~/.cloudflared/config-crjm.yml run
```

O conector está pronto quando o log mostra ≥2 linhas `Registered tunnel connection`.

**Nenhum dos processos persiste a reboots** — não foi instalado LaunchAgent. Depois de
reiniciar a máquina é preciso arrancar os dois de novo.

Verificação rápida:

```bash
curl -s https://crjm.infantinho.xyz/health         # → {"status":"ok",...}
curl -sI https://crjm.infantinho.xyz/admin         # → 401 (auth exigida, bom sinal)
```

Acesso ao painel de admin: `https://crjm.infantinho.xyz/admin`, utilizador `admin`,
palavra-passe = valor de `ADMIN_KEY` em `.env.local` (ou header
`Authorization: Bearer <ADMIN_KEY>`). Alunos e espectadores não precisam de credenciais.

## Diagnóstico

| Sintoma | Causa | Ação |
| --- | --- | --- |
| `530` no browser | Conector `cloudflared` em baixo | Arrancar o passo 2 da operação |
| `502` | Conector ok, servidor de torneios em baixo | Arrancar `bun run tournament` |
| `404` | Conector ok mas hostname não bate no ingress | Verificar `config-crjm.yml` |
| `401` no admin | `ADMIN_KEY` errada | Confirmar valor em `.env.local` |

`pgrep -fl cloudflared` distingue os dois conectores pelos argumentos (`--config …crjm…`
vs. o do wiki, sem `--config`).

## Remover o túnel

```bash
pkill -f 'config-crjm.yml'                                        # parar o conector
cloudflared tunnel delete fcb1352b-898e-4f0e-b96d-967e9a7e74e9    # apaga tunnel + credenciais
# O CNAME crjm.infantinho.xyz fica órfão — apagar no dashboard da Cloudflare.
```
