# ADR-001 — Arquitetura base para CRJM vNext

Data: 2026-04-06
Estado: proposta aceite

## Contexto

O CRJM atual funciona como protótipo jogável, mas apresenta limites estruturais:
- fallback frequente em jogos como Produto;
- ausência de autenticação e persistência real por aluno;
- dependência excessiva do browser para compute de IA e estado do utilizador;
- dificuldade em escalar para uso real em contexto de turma.

É necessária uma arquitetura backend-first que preserve o reaproveitamento do frontend e da lógica de jogo já existente.

## Decisão

Adotar uma arquitetura **frontend React + backend API + Postgres**, com separação clara entre:
- experiência do utilizador (frontend)
- identidade/progresso/sessões (backend + base de dados)
- motores de IA (local/WASM ou serviço backend, conforme o jogo)

## Escolhas-base

### 1. Frontend
Manter **React + TypeScript** e reaproveitar o máximo do código atual:
- componentes dos jogos
- regras de UI
- componentes de tutor e gamification
- assets e estrutura pedagógica

### 2. Backend
Criar um backend dedicado com estas responsabilidades:
- autenticação
- gestão de utilizadores/alunos/professores
- progresso persistente
- histórico de partidas
- turning points / revisões / achievements
- API para sessões e resultados
- eventual compute server-side para IA

### 3. Base de dados
Usar **Postgres** como store principal.

Razão:
- robustez suficiente para perfis, progresso, relações turma/aluno, histórico e analytics simples;
- fácil evolução futura;
- boa compatibilidade com ferramentas modernas.

### 4. Autenticação
Preferência inicial: **Auth.js** ou solução equivalente simples e self-hostable.

Critérios:
- login por email/password
- gestão simples de sessões
- viável para alunos/professor
- sem lock-in forte

> Nota: Supabase Auth continua opção válida, mas a decisão final depende do tradeoff entre velocidade de arranque e dependência externa.

### 5. Engines de IA
Estratégia híbrida:
- **browser/WASM** quando o jogo estiver estável e confiável;
- **backend compute** quando a qualidade do browser/fallback for insuficiente.

Isto aplica-se especialmente a:
- Produto
- Nex
- qualquer jogo em que a força/consistência da IA seja pedagogicamente relevante.

## Consequências

### Positivas
- progresso real por aluno
- base para turmas/professor
- menos fragilidade no cliente
- possibilidade de melhorar a IA sem depender do browser do aluno
- separação mais limpa entre produto pedagógico e motor de decisão

### Negativas / custo
- aumento de complexidade operacional
- necessidade de desenhar modelo de dados e API
- necessidade de migração faseada
- maior custo de hosting e observabilidade

## Não-decisões (por agora)

Ainda não fica fechado:
- Bun server vs Hono vs Fastify
- ORM específico
- solução final de auth
- deploy target (VPS, Railway, Fly, self-hosted, etc.)
- se a IA server-side será local, externa, ou híbrida

Estas decisões entram na ADR seguinte.

## Modelo arquitetural inicial

### Frontend
- páginas públicas
- login
- dashboard do aluno
- perfil/progresso
- jogo em execução
- revisão pós-jogo

### Backend API
- `/auth/*`
- `/users/*`
- `/progress/*`
- `/games/*`
- `/sessions/*`
- `/reviews/*`
- `/teacher/*`

### Data layer
- users
- classrooms
- enrollments
- game_progress
- matches
- match_events
- tutor_reviews
- achievements

## Regra de migração

Nada do frontend atual deve ser reescrito sem prova de necessidade.
A regra é:

**extrair, adaptar, integrar — não recomeçar.**

## Próximo passo

ADR-002:
- escolha concreta de backend stack
- auth
- ORM
- deploy target
