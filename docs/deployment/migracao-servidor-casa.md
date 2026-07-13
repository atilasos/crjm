# Migrar o CRJM para o servidor Ubuntu de casa

Brief para o agente que vai fazer a migração. Objetivo: o servidor de torneios
(e opcionalmente a app principal) passa a correr no servidor Ubuntu de casa em vez
do MacBook, mantendo o hostname público **https://crjm.infantinho.xyz**.

## Contexto

- Código completo em <https://github.com/atilasos/crjm> (branch `main`).
- Guias já existentes no repo — lê-os primeiro:
  - `docs/deployment/vps-cloudflare-bun.md` — topologia, systemd, Caddy/Nginx (a base a seguir).
  - `docs/deployment/tunnel-crjm-infantinho.md` — como o túnel Cloudflare atual foi criado no MacBook (UUID, config, ingress).
- Runtime: **Bun**. Servidor de torneios em `src/server/tournament-server.ts` (porta 4000, HTTP + WebSocket na mesma porta); app principal em `src/index.ts` (porta 3000).

## O que NÃO está no GitHub (transferir à mão, canal seguro)

| Item | Onde está hoje (MacBook) | Para onde vai |
| --- | --- | --- |
| `ADMIN_KEY` | `.env.local` na raiz do repo (chmod 600) | `.env.local` no servidor |
| Turmas e códigos de alunos | `data/classes.json` (se existir) | `data/classes.json` no servidor |
| Credenciais do túnel | `~/.cloudflared/config-crjm.yml` + `~/.cloudflared/fcb1352b-898e-4f0e-b96d-967e9a7e74e9.json` | `/etc/cloudflared/` no servidor (ou criar túnel novo) |

Nunca commitar nenhum destes ficheiros.

## Passos

1. **Preparar a máquina** (Ubuntu): `git`, `curl`, `unzip`; instalar Bun (`curl -fsSL https://bun.sh/install | bash`).
   Opcional mas recomendado: toolchain Rust + target `wasm32-unknown-unknown` — sem isto o build usa `--skip-wasm` e as IAs WASM ficam de fora (há fallback JS).
2. **Clonar e instalar**: `git clone https://github.com/atilasos/crjm.git && cd crjm && bun install`.
3. **Segredos**: criar `.env.local` com `ADMIN_KEY=<a mesma do MacBook>`; copiar `data/classes.json` se existir.
4. **Build + arranque**:
   - `bun run build` (ou `bun run build.ts --skip-wasm` sem Rust);
   - servidor de torneios: `NODE_ENV=production PORT=4000 bun src/server/tournament-server.ts` — o `dist/` tem de existir antes (o endpoint `/admin/spectator` falha sem ele);
   - criar unidades systemd como no guia do VPS (secção correspondente em `vps-cloudflare-bun.md`), com `WorkingDirectory` na raiz do repo e `EnvironmentFile=.env.local`.
5. **Túnel Cloudflare** — duas opções:
   - **Mover o túnel existente**: instalar `cloudflared`, copiar `config-crjm.yml` + o JSON de credenciais para `/etc/cloudflared/`, ajustar caminhos dentro do YAML, `cloudflared service install` / unidade systemd. O DNS (`crjm.infantinho.xyz` → CNAME do túnel) não muda. Depois **desligar o conector no MacBook** para não haver dois conectores com estados diferentes.
   - **Criar túnel novo no servidor** (mais limpo): `cloudflared tunnel create crjm-casa`, ingress `crjm.infantinho.xyz → http://127.0.0.1:4000`, atualizar o CNAME para o novo UUID, apagar o túnel antigo. O procedimento detalhado está em `tunnel-crjm-infantinho.md`.
6. **(Opcional) app principal no mesmo servidor**: `NODE_ENV=production PORT=3000 bun src/index.ts` + segundo hostname (ex.: `jogos.infantinho.xyz`) no mesmo túnel. Hoje a app é servida pelo GitHub Pages; isto só é necessário se quiseres tudo em casa.

## Verificação (Done when)

- `curl -s https://crjm.infantinho.xyz/api/tournaments -o /dev/null -w '%{http_code}'` → `401` (auth exigida = servidor no ar atrás do túnel).
- `curl -s -X POST https://crjm.infantinho.xyz/api/login -H 'Content-Type: application/json' -d '{"code":"XXXXXX"}'` → `404 {"error":"codigo_invalido"}`.
- `https://crjm.infantinho.xyz/admin` abre e aceita a `ADMIN_KEY` (Basic Auth, utilizador `admin`).
- Se `data/classes.json` foi migrado: `GET /api/classes` com `Authorization: Bearer <ADMIN_KEY>` devolve as turmas existentes.
- Reiniciar o serviço → turmas mantêm-se (persistência em ficheiro).
- No site dos alunos, o Modo Campeonato liga a `wss://crjm.infantinho.xyz` e a página `#entrar` valida um código real.

## Notas

- As turmas/códigos vivem em `data/classes.json` (configurável via `CLASS_STORE_PATH`); incluir este ficheiro nos backups do servidor.
- O estado dos torneios em curso é em memória — perde-se em cada restart; usar o export/import do painel `/admin` se for preciso preservar um torneio.
- CORS do servidor de torneios está aberto (`*`); a única proteção dos endpoints de gestão é a `ADMIN_KEY` — mantém-na forte.
