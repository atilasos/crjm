# Deployment no servidor de casa — crjmai.infantinho.xyz

Estado a 2026-07-17. O site passa a ser servido a partir do servidor de casa (`ubuntusala`), em vez do GitHub Pages, o que permite backend completo (API learner-core, torneios e IA server-side com GPU).

## Topologia

| Serviço | Processo | Porta | Exposição |
|---|---|---|---|
| App principal (SPA + `/api/*` learner-core + proxy IA) | `bun src/index.ts` | 3100 | `crjmai.infantinho.xyz` |
| Servidor de torneios (WS + admin) | `bun src/server/tournament-server.ts` | 4000 | `crjmai-torneio.infantinho.xyz` |
| Inferência IA Atari Go (FastAPI + PyTorch, GPU) | Docker `crjm-az-serve` | 127.0.0.1:8100 | interno (via proxy `/api/ai/atari-go/*` da app) |

Notas:
- A porta 3000 local está ocupada pelo container `clubes-cidh-app-1` — por isso a app usa a **3100**.
- O túnel cloudflared desta máquina é o `crjm-macbookpro` (apesar do nome histórico, corre aqui via systemd `cloudflared.service`, remotely-managed). Os hostnames novos são acrescentados a este túnel com a skill `cloudflare-publish`:
  `cf-tunnel.sh expose crjm-macbookpro crjmai 3100` e `cf-tunnel.sh expose crjm-macbookpro crjmai-torneio 4000`.
- O túnel antigo `crjm` (MacBook, down) e o CNAME `crjm.infantinho.xyz` ficam intocados; opcionalmente podem ser reapontados mais tarde.
- Proteção do N6: proxy limitado a `/health` e `/move`, corpo ≤8 KiB, 30 pedidos/minuto por sessão; uma inferência GPU concorrente e budget máximo de 2,2 s. Em 429/503 o browser usa N5 local.

## Segredos e persistência

- `/home/proteu/crjm/.env.main` — PORT, `CRJM_SESSION_SECRET` (gerado novo nesta máquina), `CRJM_LEARNER_DB_PATH=.data/learner-core-v1.sqlite`, `CRJM_COOKIE_SECURE=1`.
- `/home/proteu/crjm/.env.tournament` — PORT, `ADMIN_KEY` (gerada nova — a antiga do MacBook não foi migrada), `CLASS_STORE_PATH=data/classes.json`.
- Ambos gitignored. As turmas/códigos de alunos começam vazios nesta máquina: reimportar via painel `/admin` do servidor de torneios se necessário (export do MacBook, ver `migracao-servidor-casa.md`).
- Torneios são em memória (perdem-se em restart) — usar export/import do painel admin em dia de prova.

## Build de produção

```bash
export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"
cd /home/proteu/crjm
VITE_TOURNAMENT_SERVER_URL=wss://crjmai-torneio.infantinho.xyz bun run build
```

O `VITE_TOURNAMENT_SERVER_URL` fica embutido no bundle (preset «Servidor configurado da escola» no modo campeonato). O toolchain Rust + wasm-bindgen está instalado nesta máquina, portanto o build inclui os motores WASM reais.

## Serviços persistentes (systemd --user, linger ativo)

Unidades em `~/.config/systemd/user/`: `crjm-main.service` e `crjm-tournament.service` (ambas com `EnvironmentFile` e `Restart=on-failure`).

```bash
systemctl --user daemon-reload
systemctl --user enable --now crjm-main crjm-tournament
systemctl --user status crjm-main crjm-tournament
```

O serviço de inferência corre em Docker com `--restart unless-stopped` (ver `training/README.md`). O treino AlphaZero (`crjm-az-train`) é pontual e pode partilhar a GPU com a inferência.

## Verificação pós-deploy

```bash
curl -s http://127.0.0.1:3100/api/health
curl -s http://127.0.0.1:4000/health
curl -s http://127.0.0.1:8100/health          # inferência IA
curl -s https://crjmai.infantinho.xyz/api/health
curl -s https://crjmai-torneio.infantinho.xyz/health
```

## GitHub Pages

O workflow `.github/workflows/deploy.yml` continua a publicar o site estático no GitHub Pages como espelho de segurança (sem backend: sem login de alunos, sem campeonato ligado por defeito, sem N6). O deploy «a sério» é o desta máquina.
