# ADR-002 — Stack base recomendada para CRJM vNext

Data: 2026-04-06
Estado: proposta aceite

## Contexto

Na ADR-001 foi decidido que o CRJM vNext deve adotar uma arquitetura backend-first.

Agora é necessário escolher a stack concreta para:
- backend API
- base de dados
- auth
- ORM
- deployment inicial
- integração com a framework operacional de desenvolvimento: **Myau + OmX + clawhip + OmO**

## Decisão

Adotar como stack-base recomendada:

- **Frontend:** React + TypeScript (reaproveitado do CRJM atual)
- **Backend API:** **Hono sobre Bun**
- **Base de dados:** **Postgres**
- **ORM:** **Drizzle**
- **Auth:** **Supabase Auth** (na primeira fase)
- **Deploy inicial:** VPS simples ou plataforma pragmática equivalente
- **Framework de desenvolvimento/orquestração:** **Myau + OmX + clawhip + OmO**

## Porque esta stack

### 1. Hono + Bun
Escolha recomendada porque:
- encaixa no stack atual já orientado a Bun;
- evita introduzir uma stack demasiado pesada;
- permite API clara, pequena e rápida;
- boa ergonomia para evoluir de MVP para produto real.

### 2. Postgres
Escolha principal para:
- utilizadores;
- turmas;
- progresso;
- histórico de partidas;
- relatórios simples;
- achievements / revisão pedagógica.

É a base relacional correta para este tipo de produto.

### 3. Drizzle
Escolha porque:
- combina bem com TypeScript;
- permite schema explícito e migrations previsíveis;
- menor fricção mental para evolução disciplinada do modelo de dados;
- encaixa bem numa equipa que quer clareza e controlo.

### 4. Supabase Auth
Escolha inicial por pragmatismo:
- acelera login e gestão de sessões;
- reduz atrito de password reset / flows de auth;
- acelera a fase V1 sem obrigar já a construir tudo.

Nota:
- isto **não** significa “supabase-first app”; 
- o backend continua a ser nosso;
- o auth é consumido como serviço, não como substituto da arquitetura.

Nota de implementação atual:
- o branch `crjm-vnext` ainda não materializa esta integração;
- enquanto ADR-003 V1 está a ser fechado, o repositório usa apenas bootstrap técnico de sessão assinado para suportar learner persistence e cutover do estado legado.

## Framework de desenvolvimento obrigatória

O desenvolvimento do CRJM vNext não deve seguir um fluxo ad-hoc.
Deve usar explicitamente a framework operacional:

### Myau
- agente coordenador no cockpit
- interpreta direção humana
- decide próximos passos
- mantém coerência de produto e groundedness no repo real

### OmX
- workflow layer principal para Codex
- keywords / modos como `$team`, `$ralph`, `$deep-interview`, `$ralplan`
- responsável por transformar direção humana em protocolo operacional repetível

### clawhip
- observabilidade e routing de eventos
- entrega `session.*`, estado, progresso, bloqueios e follow-up no canal
- separa monitorização do contexto dos coding agents

### OmO
- coordenação multi-agente quando necessário
- loops formais Architect / Executor / Critic / Reviewer
- resolução de divergência e convergência disciplinada

## Regra operacional importante

A stack tecnológica do produto é uma coisa.  
A stack operacional de desenvolvimento é outra.

Para o CRJM vNext, as duas ficam explícitas:

### Produto
- React + TypeScript
- Hono + Bun
- Postgres
- Drizzle
- Supabase Auth

### Desenvolvimento
- Myau
- OmX
- clawhip
- OmO

## Opções consideradas

### Opção A — Recomendada
**Hono + Bun + Postgres + Drizzle + Supabase Auth**

Prós:
- rápida a arrancar
- alinhada com stack atual
- menos boilerplate
- auth resolvida cedo
- mantém backend próprio

Contras:
- dependência parcial em Supabase para auth

### Opção B — Mais soberana
**Hono + Bun + Postgres + Drizzle + Auth.js**

Prós:
- mais controlo
- menos dependência externa

Contras:
- mais trabalho na fase inicial
- mais tempo até login funcional robusto

### Opção C — Mais conservadora Node
**Fastify + Postgres + Drizzle + Auth.js**

Prós:
- stack muito conhecida
- forte ecossistema backend

Contras:
- menos alinhada com o repo atual
- mais peso estrutural sem ganho claro nesta fase

## Decisão final

Escolhe-se a **Opção A**.

## Limites / guardrails

- não transformar o backend numa arquitetura excessiva cedo demais;
- não deslocar lógica de jogo sem necessidade;
- não depender do cliente para identidade e persistência crítica;
- não usar Supabase como substituto de backend próprio;
- não reescrever tudo: migrar faseadamente.

## Implicações imediatas

ADR-003 deverá cobrir:
- modelo de dados inicial;
- fronteiras API;
- entidades principais;
- roadmap V1 (auth + progresso persistente).

## Primeiro recorte de implementação

### V1
- auth funcional
- utilizador/aluno
- progresso persistente por jogo
- dashboard básica do aluno

### V2
- histórico de partidas
- turning points e review persistidos
- achievements persistentes

### V3
- turma/professor
- relatórios simples
- AI backend para jogos com fallback fraco

## Nota final

Esta ADR fecha a stack-base do produto **e** explicita a stack-base do desenvolvimento.

O CRJM vNext será construído com:
- **produto:** Hono/Bun/Postgres/Drizzle/Supabase Auth
- **operação:** Myau + OmX + clawhip + OmO
