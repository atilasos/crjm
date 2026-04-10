# ADR-003 — Learner-centric persistent core for CRJM vNext V1

Data: 2026-04-07
Estado: aceite

## Contexto

A ADR-002 definiu o recorte da V1 como:
- bootstrap técnico de sessão do aluno (sem decisão final de autenticação do learner-core);
- utilizador/aluno;
- progresso persistente por jogo;
- dashboard básica do aluno.

O produto atual ainda guarda o estado pedagógico crítico do aluno no browser (`localStorage`) através de `GamificationProvider` e `gamification-state.ts`.

É necessário fixar um núcleo persistente mínimo que permita migrar o perfil/progresso/gamificação para backend sem arrastar já histórico completo de partidas, subdomínios de turma/professor ou persistência detalhada de revisão.

## Decisão

Para a V1 do CRJM vNext, o modelo persistente canónico passa a ser **learner-centric** e contém apenas quatro entidades semânticas:

1. `users`
   - identidade/autenticação do utilizador;
   - `role` com default `learner`.
2. `learner_profiles`
   - perfil base do aluno;
   - campos mínimos: `display_name`, `locale`, `cycle_or_grade`, `total_xp`, `current_streak_days`, `last_active_on`, `created_at`, `updated_at`.
3. `learner_game_progress`
   - snapshot agregado por jogo;
   - chave única `(user_id, game_id)`;
   - campos mínimos: `played_count`, `win_count`, `review_count`, `rules_level`, `strategy_level`, `mastery_level`, `last_played_at`, `updated_at`.
4. `learner_activity_events`
   - log mínimo de atividade pedagógica datada;
   - eventos permitidos: `game_completed`, `review_completed`;
   - campos mínimos: `occurred_at`, `won` (só em `game_completed`), `xp_delta`.

Achievements, missões e training paths continuam como **catálogos/configuração** na V1. O estado visível no dashboard é **derivado** de `learner_profiles + learner_game_progress + learner_activity_events`, com cache não-canónica apenas se necessária por desempenho ou rollout.

`auth_sessions` e `learner_import_markers` podem existir como **infra operacional** para bootstrap técnico/cutover idempotente, mas não contam como entidades semânticas adicionais do núcleo canónico V1.

## Guardrails

### In-scope na V1
- bootstrap técnico de sessão do aluno;
- perfil persistente do aluno;
- progresso persistente por jogo;
- XP, streak e dashboard do aluno;
- atividade pedagógica leve temporal;
- estado derivado de achievements/missões.

### Out-of-scope na V1
- histórico completo de partidas;
- replay, board states, PV, top moves, critical threats e telemetria bruta da IA;
- reviews detalhadas e turning points persistidos;
- classrooms, enrollments, dashboards de professor;
- leaderboards globais;
- campeonato como núcleo do modelo pedagógico persistente.

## Porque esta decisão

- preserva a semântica pedagógica já validada no protótipo atual;
- remove dependência do browser para estado crítico do aluno;
- mantém a V1 pequena e entregável;
- evita materializar cedo demais subdomínios que ADR-002 já empurrou para V2/V3.

## Consequências

- o frontend deixa de usar `localStorage` como fonte de verdade crítica para perfil/progresso do aluno;
- o backend precisa de um bootstrap técnico de sessão + perfil + progresso + eventos;
- `recordGameCompleted` e `recordReviewCompleted` tornam-se comandos narrow sobre factos pedagógicos;
- o dashboard passa a ser uma query derivada de perfil/progresso/eventos;
- é necessário um caminho explícito de import/cutover para estado legado local, com fingerprint/marker idempotente.

## Posição de auth para o branch V1 atual

Para remover ambiguidade no repositório:

- o branch atual **não** implementa ainda a integração final de auth recomendada em ADR-002;
- a implementação corrente assume apenas **bootstrap técnico de sessão assinado por cookie** para suportar a migração do learner-core V1;
- `auth_sessions` existe como infraestrutura operacional desse bootstrap, não como encerramento da decisão final de auth do produto.

## Critérios de aceitação

A ADR-003 está cumprida quando o repositório fornece:
1. backend capaz de servir bootstrap técnico de sessão e endpoints de learner dashboard/comandos sem partir o entrypoint atual;
2. contrato partilhado para perfil, progresso por jogo e eventos de atividade;
3. persistência canónica limitada a `users`, `learner_profiles`, `learner_game_progress` e `learner_activity_events` (ou equivalentes semânticos), com `auth_sessions` e `learner_import_markers` admitidas apenas como infra operacional;
4. dashboard/profile que já não dependem de `localStorage` como fonte de verdade;
5. política explícita de import legado idempotente;
6. ausência de tabelas/rotas V1 para matches/history/classrooms/teacher dashboards.
