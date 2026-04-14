# Publicar o CRJM num VPS com Cloudflare

Este guia descreve a forma mais simples de publicar uma versão funcional do site para os alunos, mantendo:

- app principal em **Bun**
- progresso persistido em **SQLite**
- painel do professor para campeonatos
- Cloudflare à frente do VPS

> Esta é a topologia recomendada para uso real com alunos. O workflow de GitHub Pages deste repositório continua útil como preview estático, mas não substitui o Bun + SQLite em produção.

## 1. Topologia recomendada

Usa **um VPS Linux** com dois processos Bun:

- **app principal** em `localhost:3000`
- **servidor de torneios** em `localhost:4000`

À frente desses processos, usa **Caddy** ou **Nginx** com HTTPS. No Cloudflare, cria dois hostnames, por exemplo:

- `jogos.escola.pt` → app principal
- `torneios.escola.pt` → servidor de torneios + `/admin`

Assim:

- os alunos entram em `https://jogos.escola.pt`
- o modo campeonato liga ao servidor `wss://torneios.escola.pt`
- o professor usa `https://torneios.escola.pt/admin`
- o modo espectador fica em `https://torneios.escola.pt/admin/spectator`

## 2. Preparar o VPS

Exemplo base: Ubuntu 24.04.

Instala dependências:

```bash
sudo apt update
sudo apt install -y curl unzip sqlite3 git
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

Clona o repositório e instala dependências:

```bash
git clone https://github.com/atilasos/crjm.git
cd crjm
bun install
```

Cria uma pasta persistente para a base de dados:

```bash
sudo mkdir -p /var/lib/crjm
sudo chown "$USER":"$USER" /var/lib/crjm
```

## 3. Variáveis de ambiente

### App principal (`jogos.escola.pt`)

Cria um ficheiro `.env.main`:

```bash
PORT=3000
CRJM_LEARNER_DB_PATH=/var/lib/crjm/learner-core-v1.sqlite
CRJM_SESSION_SECRET=MUDA_PARA_UM_SEGREDO_LONGO_E_ALEATORIO
CRJM_SESSION_COOKIE_NAME=crjm_session
CRJM_SESSION_COOKIE_MAX_AGE=2592000
VITE_TOURNAMENT_SERVER_URL=wss://torneios.escola.pt
```

> Em produção, trata `CRJM_SESSION_SECRET` como obrigatório. Não confies no fallback em memória do código.

### Servidor de torneios (`torneios.escola.pt`)

Cria `.env.tournament`:

```bash
PORT=4000
ADMIN_KEY=MUDA_PARA_UMA_CHAVE_FORTE
```

> Esta chave protege o painel `/admin` e os endpoints de administração. O browser vai pedir autenticação quando o professor abrir o painel com:
>
> - **utilizador**: `admin`
> - **palavra-passe**: valor de `ADMIN_KEY`

## 4. Arranque manual inicial

Testa primeiro manualmente.

### App principal

```bash
set -a
source ./.env.main
set +a
bun run start
```

### Servidor de torneios

Noutro terminal:

```bash
set -a
source ./.env.tournament
set +a
bun run tournament
```

Confirma:

- `http://127.0.0.1:3000/`
- `http://127.0.0.1:3000/api/health`
- `http://127.0.0.1:4000/health`
- `http://127.0.0.1:4000/admin`

## 5. Tornar isto persistente com systemd

### Serviço da app principal

Cria `/etc/systemd/system/crjm-main.service`:

```ini
[Unit]
Description=CRJM main app
After=network.target

[Service]
Type=simple
User=SEU_UTILIZADOR
WorkingDirectory=/home/SEU_UTILIZADOR/crjm
EnvironmentFile=/home/SEU_UTILIZADOR/crjm/.env.main
ExecStart=/home/SEU_UTILIZADOR/.bun/bin/bun run start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### Serviço do torneio

Cria `/etc/systemd/system/crjm-tournament.service`:

```ini
[Unit]
Description=CRJM tournament server
After=network.target

[Service]
Type=simple
User=SEU_UTILIZADOR
WorkingDirectory=/home/SEU_UTILIZADOR/crjm
EnvironmentFile=/home/SEU_UTILIZADOR/crjm/.env.tournament
ExecStart=/home/SEU_UTILIZADOR/.bun/bin/bun run tournament
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Ativa ambos:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now crjm-main.service
sudo systemctl enable --now crjm-tournament.service
sudo systemctl status crjm-main.service
sudo systemctl status crjm-tournament.service
```

## 6. Reverse proxy com Caddy

Se quiseres a opção mais simples com HTTPS automático, usa **Caddy**.

Instala:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Exemplo `/etc/caddy/Caddyfile`:

```caddy
jogos.escola.pt {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}

torneios.escola.pt {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4000
}
```

Depois:

```bash
sudo systemctl reload caddy
```

## 7. Configurar Cloudflare

No Cloudflare:

1. adiciona o domínio
2. cria registos DNS `A` ou `AAAA` para o IP do VPS:
   - `jogos` → IP do VPS
   - `torneios` → IP do VPS
3. ativa o proxy (nuvem laranja) se quiseres esconder o IP
4. em **SSL/TLS**, usa **Full (strict)**
5. mantém WebSockets ativos

Se usares proxy Cloudflare, confirma que ambos os subdomínios abrem corretamente em HTTPS.

## 8. Cookies e HTTPS

O learner-core usa cookies assinados. Em produção:

- só expor o site com **HTTPS**
- manter o Bun atrás do proxy
- tratar os cookies de sessão como cookies de produção (`HttpOnly`, `SameSite=Lax`, `Secure`)

## 9. Backup da base de dados SQLite

A base de dados principal do progresso fica em:

```bash
/var/lib/crjm/learner-core-v1.sqlite
```

### Backup manual seguro

```bash
mkdir -p /home/SEU_UTILIZADOR/backups/crjm
sqlite3 /var/lib/crjm/learner-core-v1.sqlite ".backup '/home/SEU_UTILIZADOR/backups/crjm/learner-core-$(date +%F-%H%M%S).sqlite'"
```

### Script simples

Cria `~/bin/backup-crjm.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

DEST_DIR="/home/SEU_UTILIZADOR/backups/crjm"
DB_PATH="/var/lib/crjm/learner-core-v1.sqlite"

mkdir -p "$DEST_DIR"
sqlite3 "$DB_PATH" ".backup '$DEST_DIR/learner-core-$(date +%F-%H%M%S).sqlite'"
find "$DEST_DIR" -type f -name 'learner-core-*.sqlite' -mtime +21 -delete
```

Dar permissões:

```bash
chmod +x ~/bin/backup-crjm.sh
```

Agendar com cron:

```bash
crontab -e
```

Adicionar:

```cron
0 3 * * * /home/SEU_UTILIZADOR/bin/backup-crjm.sh
```

### Restore

```bash
sudo systemctl stop crjm-main.service
cp /home/SEU_UTILIZADOR/backups/crjm/learner-core-AAAA-MM-DD-HHMMSS.sqlite /var/lib/crjm/learner-core-v1.sqlite
sudo systemctl start crjm-main.service
```

## 10. Fluxo real para a escola

### Para os alunos

- abrem `https://jogos.escola.pt`
- treinam nos jogos
- quando for campeonato, entram em “Modo Campeonato”
- o cliente liga a `wss://torneios.escola.pt`

### Para o professor

- abre `https://torneios.escola.pt/admin`
- introduz o utilizador `admin`
- introduz a palavra-passe de administração do servidor (`ADMIN_KEY`)
- cria o torneio
- inicia as rondas
- pode abrir `https://torneios.escola.pt/admin/spectator` para projeção

## 11. Atualizar o site

Quando fizeres pull de alterações:

```bash
cd ~/crjm
git pull
bun install
sudo systemctl restart crjm-main.service
sudo systemctl restart crjm-tournament.service
```

Se as alterações incluírem o learner-core, faz backup da SQLite antes do restart.

## 12. Checklist final

- [ ] `jogos.escola.pt` abre em HTTPS
- [ ] `torneios.escola.pt/admin` abre em HTTPS
- [ ] `torneios.escola.pt/admin/spectator` abre
- [ ] alunos conseguem entrar no modo campeonato
- [ ] WebSocket do torneio liga sem erros
- [ ] progresso do learner-core persiste após restart
- [ ] backups automáticos estão a ser criados
- [ ] `CRJM_SESSION_SECRET` e `ADMIN_KEY` foram mudados

Quando estes pontos estiverem verdes, tens uma versão funcional para usar com os teus alunos.
