# Guia do Torneio - Jogos Matemáticos CRJM

Este guia explica como organizar um torneio de dupla eliminação para os teus alunos usando o servidor de torneios local.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Pages                              │
│                (Site de treino online)                       │
│                                                              │
│  Os alunos acedem ao site normal para treinar em casa        │
│  ou durante o torneio, e ligam-se ao teu servidor local     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (wss://)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Túnel Seguro                                │
│          (ngrok / Cloudflare Tunnel)                         │
│                                                              │
│  Expõe o servidor local como HTTPS público                   │
│  Ex: https://abc123.ngrok.io ou https://torneio.exemplo.com  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ http://localhost:4000
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Servidor de Torneios (Bun)                      │
│                  (no teu computador)                         │
│                                                              │
│  - Gere inscrições e emparelhamentos                         │
│  - Valida jogadas e determina vencedores                     │
│  - Mantém o bracket de dupla eliminação                      │
│  - Painel de administração em http://localhost:4000/admin    │
└─────────────────────────────────────────────────────────────┘
```

## Pré-requisitos

1. **Bun** instalado no teu computador
   ```bash
   # macOS/Linux
   curl -fsSL https://bun.sh/install | bash
   
   # Windows (PowerShell)
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```

2. **ngrok** ou **Cloudflare Tunnel** para expor o servidor
   ```bash
   # ngrok (mais simples, grátis para uso básico)
   # Instalar em: https://ngrok.com/download
   
   # ou Cloudflare Tunnel (grátis, mais estável)
   # macOS
   brew install cloudflare/cloudflare/cloudflared
   # Outros: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   ```

## Passo a Passo - Dia do Torneio

### 1. Preparação (10 minutos antes)

```bash
# Na pasta do projeto
cd /caminho/para/jogosmatematicos

# Instalar dependências (se ainda não feito)
bun install

# Iniciar o servidor de torneios
bun run tournament
```

Deves ver algo como:
```
╔══════════════════════════════════════════════════════════════╗
║           Servidor de Torneios - Jogos Matemáticos           ║
╠══════════════════════════════════════════════════════════════╣
║  WebSocket: ws://localhost:4000/ws                           ║
║  API HTTP:  http://localhost:4000                            ║
║  Admin Key: admi...                                          ║
...
```

### 2. Expor o servidor (noutra janela de terminal)

#### Opção A: ngrok (mais simples)
```bash
ngrok http 4000
```

Resultado:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:4000
```

Anota o URL `https://abc123.ngrok.io` - este é o URL que os alunos vão usar!

#### Opção B: Cloudflare Tunnel (mais estável)
```bash
cloudflared tunnel --url http://localhost:4000
```

Resultado similar, com um URL como `https://random-words.trycloudflare.com`

### 3. Testar a ligação

1. Abre o painel de administração:
   - Local: http://localhost:4000/admin
   - Ou pelo túnel: https://abc123.ngrok.io/admin

2. Verifica que aparece "Servidor ativo" no topo

### 4. Instruir os alunos

Diz aos alunos para:

1. Aceder ao site de treino (GitHub Pages ou local)
2. Clicar em "Modo Campeonato"
3. Preencher:
   - Nome
   - Turma
   - Jogo (ex: Gatos & Cães)
4. **Desligar** o toggle "Modo de teste"
5. Introduzir o endereço do servidor:
   - Se usas ngrok: `wss://abc123.ngrok.io` (nota o `wss://` no início!)
   - Se usas Cloudflare: `wss://random-words.trycloudflare.com`
6. Clicar em "Entrar no Campeonato"

### 5. Iniciar o torneio

Quando todos os alunos estiverem inscritos:

#### Opção A: Inscrição Manual (Alunos)
1. Vai ao painel de administração: http://localhost:4000/admin
2. Verifica que todos os jogadores aparecem na lista
3. Clica no botão "▶️ Iniciar"

#### Opção B: Pré-registo (Admin)
Se tiveres a lista de alunos (ex: Excel), podes criá-lo logo:
1. No painel admin, clica em "➕ Criar Torneio"
2. Seleciona o jogo
3. Cola a lista de nomes (um por linha)
   - Formato opcional: `Nome;Turma`
4. Clica em "Criar Torneio"
5. **Importante**: Usa o botão "🗂️ Cartões" para gerar um PDF com os códigos de reconexão para cada aluno.

O servidor emparelha automaticamente os jogadores e notifica cada um.

### 6. Durante o torneio

- Acompanha o progresso no painel de administração (Vista Visual ou Lista)
- O bracket atualiza automaticamente em tempo real
- Os logs mostram todas as jogadas e resultados

#### Manter a Sessão (Reconexão)
Se um aluno fechar o browser ou perder a net:
1. Ele volta a entrar no site -> Modo Campeonato
2. Introduz o seu **Código de Reconexão** (ex: ABC234)
3. Clica em "Retomar" e volta exatamente onde estava!
- O bracket atualiza automaticamente a cada 2 segundos
- Os logs mostram todas as jogadas e resultados

#### Modo Espectador (para jogadores à espera)

Quando um jogador está à espera do seu próximo match:
- Aparece uma interface melhorada com indicação visual de que está à espera
- Pode ver uma lista de todos os jogos em curso no torneio
- Pode selecionar um jogo para observar (modo espectador read-only)
- O tabuleiro atualiza em tempo real enquanto observa
- Quando o seu match é atribuído, é automaticamente redirecionado para o seu jogo

#### Reiniciar jogos bloqueados (admin)

Se um jogo ficar bloqueado ou corrompido, podes reiniciá-lo no painel de administração:

1. No bracket (vista visual ou lista), cada match em curso tem dois botões:
   - **🔄 Jogo** - Reinicia apenas o jogo atual (mantém o score do match)
   - **🔁 Match** - Reinicia o match completo (score volta a 0-0)

2. Os jogadores são notificados e devem clicar "Estou pronto" novamente

**Quando usar cada opção:**
- **Reiniciar jogo**: Quando o jogo atual está bloqueado ou houve interferência (mantém score)
- **Reiniciar match**: Quando o estado está corrupto ou o confronto deve ser repetido (0-0)
- **Pausar/Suspender**: No estado do jogador, podes suspendê-lo para pausar o seu jogo temporariamente
- **Eliminar**: Remove o jogador do torneio e atribui vitória automática ao oponente nos matches pendentes

#### Exportação e Relatórios
No topo do painel de administração:
- **🗂️ Cartões**: Gera PDF com códigos de acesso para os alunos
- **📊 Estado (PDF)**: Gera um relatório completo do bracket e classificações
- **💾 Exportar (JSON)**: Guarda o estado total do torneio para backup
- **📂 Importar (JSON)**: Restaura um torneio de um backup anterior

### 7. Problemas comuns

#### "Não consigo ligar ao servidor"
- Verifica se o servidor está a correr
- Verifica se o túnel está ativo
- Confirma que o URL está correto (inclui `wss://`)
- Se estás na mesma rede, podes usar `ws://IP-DO-COMPUTADOR:4000/ws`

#### "Perdi a ligação durante um jogo"
- O jogador que desconecta perde automaticamente o match atual
- Pode voltar a inscrever-se se o torneio permitir

#### "Um jogo ficou bloqueado"
- No painel admin, localiza o match no bracket
- Clica em "🔄 Jogo" para reiniciar apenas o jogo atual (mantém score)
- Ou clica em "🔁 Match" para reiniciar o confronto todo (score 0-0)
- Os jogadores serão notificados e devem clicar "Estou pronto" novamente

#### "Preciso reiniciar o torneio"
- No painel admin, clica em "🔄 Reiniciar"
- Todos os dados são perdidos e os alunos precisam de se inscrever novamente

## Configuração Avançada

### Variáveis de Ambiente

```bash
# Porta do servidor (default: 4000)
PORT=4000 bun run tournament

# Chave de administração (obrigatória)
ADMIN_KEY=MUDA_PARA_UMA_CHAVE_FORTE bun run tournament
```

### Configurar URL no Frontend (build)

Se queres que o frontend já tenha o URL pré-configurado:

```bash
# Antes de fazer build
VITE_TOURNAMENT_SERVER_URL=wss://torneio.exemplo.com bun run build
```

## Regras do Torneio

### Dupla Eliminação

- Todos começam na **Winners Bracket**
- 1ª derrota → vais para a **Losers Bracket**
- 2ª derrota → estás **eliminado**
- O campeão da Winners enfrenta o campeão da Losers na **Grand Final**
- Se o campeão da Losers ganhar a Grand Final, há um **Grand Final Reset** (ele tem de ganhar duas vezes porque o da Winners ainda não perdeu)

### Melhor de 3

- Cada confronto é melhor de 3 jogos
- No jogo 1, o player1 (sorteado) começa
- No jogo 2, o player2 começa
- No jogo 3, volta ao player1
- Ganha quem vencer 2 jogos primeiro

### Byes Automáticos

- Se o número de jogadores for ímpar, um jogador avança automaticamente para a próxima ronda (bye)
- O servidor gere isto automaticamente

## API de Administração

Para integração ou automação:

```bash
# Ver estado dos torneios
curl http://localhost:4000/api/tournaments

# Iniciar torneio (requer chave admin)
curl -X POST http://localhost:4000/api/tournaments/gatos-caes/start \
-H "Authorization: Bearer MUDA_PARA_A_TUA_CHAVE"

# Reiniciar torneio completo (todos os dados perdidos)
curl -X POST http://localhost:4000/api/tournaments/gatos-caes/reset \
-H "Authorization: Bearer MUDA_PARA_A_TUA_CHAVE"

# Reiniciar apenas o jogo atual de um match (mantém score do match)
curl -X POST http://localhost:4000/api/tournaments/gatos-caes/matches/MATCH_ID/restart-game \
-H "Authorization: Bearer MUDA_PARA_A_TUA_CHAVE"

# Reiniciar match completo (score volta a 0-0)
curl -X POST http://localhost:4000/api/tournaments/gatos-caes/matches/MATCH_ID/restart-match \
-H "Authorization: Bearer MUDA_PARA_A_TUA_CHAVE"

# Suspender jogador (pausa o match se estiver a jogar)
curl -X POST http://localhost:4000/api/tournaments/gatos-caes/players/PLAYER_ID/suspend \
-H "Authorization: Bearer MUDA_PARA_A_TUA_CHAVE"

# Eliminar jogador (oponente ganha automaticamente)
curl -X POST http://localhost:4000/api/tournaments/gatos-caes/players/PLAYER_ID/eliminate \
-H "Authorization: Bearer MUDA_PARA_A_TUA_CHAVE"

# Criar torneio com pré-registo de jogadores
curl -X POST http://localhost:4000/api/tournaments/gatos-caes/create-with-players \
-H "Authorization: Bearer MUDA_PARA_A_TUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{"players": [{"name": "Ana", "classId": "5A"}, {"name": "Bruno", "classId": "5B"}]}'

# Exportar para JSON
curl http://localhost:4000/api/tournaments/gatos-caes/export \
-H "Authorization: Bearer MUDA_PARA_A_TUA_CHAVE"

# Ver logs
curl http://localhost:4000/api/logs
```

## Dicas para um Torneio de Sucesso

1. **Testa antes** - Faz um teste com 2-3 "jogadores" (podes abrir várias janelas) para garantir que tudo funciona

2. **Boa rede** - Garante que tens uma ligação à Internet estável e que os alunos conseguem aceder ao túnel

3. **Backup** - Se algo correr mal, podes sempre reiniciar o torneio e recomeçar

4. **Projetor** - Projeta o painel de administração para que todos vejam o bracket em tempo real

5. **Tempo** - Calcula cerca de 5-10 minutos por match (melhor de 3 jogos)

## Suporte

Se tiveres problemas, verifica:
1. Consola do servidor para erros
2. Consola do browser (F12) para erros de JavaScript
3. Logs no painel de administração

Bom torneio! 🏆
