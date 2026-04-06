# CRJM vNext — mudança de direção de produto

Data: 2026-04-06

## Decisão

O CRJM atual passa a ser tratado como **protótipo pedagógico funcional / baseline jogável**.

Abre-se uma nova fase: **CRJM vNext**, com backend real, autenticação, progresso persistente por aluno e arquitetura capaz de suportar motores de IA mais fortes e consistentes.

## Razão

Observação prática em uso:
- fallback frequente, sobretudo no jogo **Produto**;
- experiência de IA inconsistente no browser;
- ausência de autenticação / persistência real por aluno;
- limitação estrutural para escalar para turmas, professor, histórico e analytics.

Conclusão: o problema já não é apenas tuning. É **arquitetura**.

## Princípios

1. **Não recomeçar do zero.**
   Reaproveitar lógica dos jogos, UI útil, copy pedagógica, assets e learnings do protótipo atual.

2. **Mover estado crítico para backend.**
   Auth, progresso, perfis, histórico, sessões e avaliação não devem depender apenas do browser.

3. **Separar engine local de engine forte.**
   WASM/local quando bom e barato; backend compute quando o browser não chega.

4. **Primeiro fiabilidade pedagógica, depois sofisticação.**
   Melhor tutor consistente e simples do que “AI forte” errática.

## Objetivos do vNext

- login por aluno / professor
- progresso persistente
- turmas / grupos
- histórico de partidas e revisão
- achievements / progresso pedagógico por utilizador
- camada de API para sessões, resultados e tutor
- engines de IA mais fortes e observáveis
- menos dependência de fallback fraco no cliente

## Stack recomendada (proposta inicial)

### Frontend
- React + TypeScript (reaproveitar o máximo possível)
- continuar com os componentes/jogos atuais como base

### Backend
- **Postgres**
- **Auth**: Lucia/Auth.js ou Supabase Auth (decidir na ADR)
- **API**: Bun server / Hono / Fastify (escolher pela integração mais simples com o stack atual)
- **Storage**: progresso, utilizadores, partidas, eventos pedagógicos

### AI / Engines
- local/WASM quando estável
- engine service no backend para jogos onde o browser falha
- tutor/review também com capacidade server-side

## Reaproveitamento do CRJM atual

### Reaproveitar
- regras dos jogos
- componentes de tabuleiro
- adapters V1
- copy pedagógica já validada
- gamification local como base semântica
- assets/screenshots/docs pedagógicos

### Reavaliar / migrar
- compute da IA no cliente
- persistência via local state/localStorage
- fallback heurístico do Produto/Nex
- packaging WASM dos jogos mais sensíveis

## Fases recomendadas

### Fase V0 — Diagnóstico e ADR
- mapear engines/fallbacks por jogo
- decidir stack backend
- desenhar modelo de dados
- desenhar fronteira frontend/backend

### Fase V1 — Identidade e progresso
- auth
- perfis de aluno
- progresso persistente
- páginas base de sessão/perfil

### Fase V2 — Sessões e histórico
- guardar partidas
- guardar turning points/review
- progresso por jogo
- painel básico do professor

### Fase V3 — AI reforçada
- mover compute pesado para backend onde necessário
- observar latência, custo, qualidade
- reduzir fallback local

### Fase V4 — Sala de aula real
- turmas
- relatórios simples
- vista professor
- revisão pedagógica por aluno

## Próximos entregáveis

1. ADR de arquitetura
2. plano de migração vNext
3. modelo de dados inicial
4. backlog faseado
