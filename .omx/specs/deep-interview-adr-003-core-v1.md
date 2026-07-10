# Deep-Interview Spec — ADR-003 core V1 do CRJM vNext

## Metadata
- **Profile:** standard
- **Rounds:** 0 human questions / 4 evidence-pressure passes
- **Final ambiguity:** 0.127
- **Threshold:** 0.20
- **Context type:** brownfield
- **Context snapshot:** `.omx/context/adr-003-core-v1-20260406T141626Z.md`
- **Transcript:** `.omx/interviews/adr-003-core-v1-20260406T141626Z.md`

## Clarity breakdown

| Dimension | Score | Gap note |
|---|---:|---|
| Intent | 0.95 | Intenção clara: fechar o núcleo V1 persistente e sair de `localStorage` para progresso do aluno. |
| Outcome | 0.90 | Resultado pretendido é ADR-ready: entidades mínimas, scope V1, non-goals e invariantes. |
| Scope | 0.88 | O recorte V1 está claro, mas havia ambiguidade entre “progresso” e “histórico completo”. |
| Constraints | 0.87 | Stack e guardrails já foram fixados; restavam detalhes de materialização. |
| Success | 0.78 | Critério inferido: permitir schema/API inicial sem reabrir a direção do produto. |
| Context | 0.95 | O repo já contém semântica pedagógica, perfil local e faseamento suficiente para decidir. |

## Intent (why)
Fechar ADR-003 para que o CRJM vNext tenha um **modelo canónico persistente mínimo e pedagogicamente correto** na V1: autenticação, aluno identificado e progresso durável por jogo. O objetivo não é modelar já o produto inteiro; é congelar o mínimo necessário para migrar a semântica atual do perfil/gamificação/tutor para backend sem arrastar já professor, turma, histórico completo ou infra de IA.

## Desired outcome
ADR-003 deve declarar que o **canónico persistente da V1** é o estado pedagógico do aluno, não o histórico exaustivo de partidas nem o modo campeonato. O backend V1 deve conseguir:
1. autenticar um aluno;
2. criar/ler o seu perfil base;
3. persistir progresso por jogo;
4. suportar dashboard do aluno com XP, streak, eixos por jogo e estado de achievements/missões derivados;
5. guardar evidência leve e datada de prática/reflexão suficiente para streaks, missões e evolução do perfil.

## Proposed ADR-003 decision (ADR-ready)

### Decision statement
Para a V1 do CRJM vNext, o modelo persistente canónico será **learner-centric** e conterá apenas:
- identidade/autenticação do utilizador;
- perfil base do aluno;
- progresso pedagógico agregado por jogo;
- log mínimo de atividade pedagógica datada (`game_completed`, `review_completed`).

Achievements, missões e training paths continuam a existir na V1 como **catálogos/configuração** e o seu estado visível no dashboard pode ser **derivado** do perfil + eventos, sem abrir já um subdomínio persistente autónomo de histórico/review.

Tudo o resto — histórico completo de partidas, turning points persistidos, reviews detalhadas, turmas, professor, torneios, leaderboards, telemetria bruta de IA — fica explicitamente fora do V1.

## Minimal entities

### 1) `users`
**Propósito:** identidade canónica da aplicação, ligada ao provider de auth.  
**Campos mínimos:**
- `id`
- `auth_provider` / `auth_subject`
- `role` (default `learner`; `teacher` pode existir apenas como enum preparatório)
- `created_at`
- `last_login_at`

### 2) `learner_profiles`
**Propósito:** perfil estável do aluno para a experiência pedagógica.  
**Campos mínimos:**
- `user_id` (PK/FK)
- `display_name` ou pseudónimo
- `locale` (default `pt-PT`)
- `cycle_or_grade` (campo first-class; pode ser temporariamente nullable só se o onboarding o recolher logo a seguir)
- `total_xp`
- `current_streak_days`
- `last_active_on`
- `created_at`
- `updated_at`

**Razão pedagógica:** o tutor muda linguagem, cadência e ZPD por ciclo etário; este campo não deve ser um detalhe escondido nem pós-facto.

### 3) `learner_game_progress`
**Propósito:** snapshot agregado por jogo, alinhado com o produto atual.  
**Chave:** `(user_id, game_id)`  
**Campos mínimos:**
- `game_id`
- `played_count`
- `win_count`
- `review_count`
- `rules_level` (0..5)
- `strategy_level` (0..5)
- `mastery_level` (0..5)
- `last_played_at`
- `updated_at`

**Razão:** espelha diretamente `GameProgressSnapshot` já usado no frontend e preserva o contrato pedagógico já validado.

### 4) `learner_activity_events`
**Propósito:** guardar apenas a evidência leve necessária para streaks, missões, achievements derivados e progressão.  
**Campos mínimos:**
- `id`
- `user_id`
- `game_id`
- `event_type` ∈ {`game_completed`, `review_completed`}
- `occurred_at`
- `won` (nullable; apenas para `game_completed`)
- `xp_delta`

**Guardrail:** isto **não** é histórico completo de match. Não guarda estado do tabuleiro, replay, PV, top moves, hints nem turning points detalhados.

## Static catalogs (not first-class persisted entities in V1)
Devem continuar como catálogos de aplicação/configuração, não como domínio persistente obrigatório da V1:
- `game_catalog` / enum `GameId`
- `achievement_definitions`
- `mission_definitions`
- `training_paths`
- taxonomia pedagógica (`errorCode`, hint levels, `aeCompetency`, `patternId`)

## In-scope for V1

1. **Auth funcional** via Supabase Auth + bootstrap de `users`/`learner_profiles`.
2. **Perfil persistente do aluno** no backend, substituindo o estado crítico hoje guardado no browser.
3. **Progresso persistente por jogo** com os três eixos atuais: regras, estratégia, mestria.
4. **XP, streak e dashboard do aluno** suportados por perfil + eventos.
5. **Atividade pedagógica leve persistida** para suportar missões e consistência temporal.
6. **Estado visível de achievements/missões derivado**, sem abrir ainda histórico detalhado ou authoring backend.
7. **Migração semântica do estado atual** (`gamification-state.ts`) para canónico server-side.

## Out-of-scope / non-goals

1. **Turmas, professor, enrollments, classroom dashboards**.
2. **Histórico completo de partidas** (`matches`, `match_events`, replay, board states).
3. **Turning points persistidos e reviews detalhadas**.
4. **Persistência de hints/topMoves/criticalThreats/telemetria bruta da IA**.
5. **Modo campeonato como núcleo do modelo V1**.
6. **Leaderboards globais / comparação pública entre alunos**.
7. **Server-side AI migration / compute pesado**.
8. **Subdomínio persistente próprio para achievements/missões/pattern cards**.

## Decision boundaries (what OMX may decide without new confirmation)

1. **Achievements/missões derivados vs cacheados:** o default recomendado é derivar a partir de `learner_profiles + learner_game_progress + learner_activity_events`; um cache materializado é aceitável só se não abrir um novo subdomínio funcional.
2. **Granularidade exata de `learner_activity_events`:** desde que fique nos dois eventos mínimos (`game_completed`, `review_completed`) e não derive para replay/histórico completo.
3. **Role enum no `users`:** pode existir `teacher` desde já por compatibilidade futura, sem criar fluxos teacher-facing em V1.
4. **Obrigatoriedade de `cycle_or_grade`:** pode ser nullable apenas durante bootstrap muito curto; o estado estável do perfil deve tê-lo preenchido.
5. **Game catalog/config tables:** podem ficar em código nesta fase; não precisam de tabela dedicada na V1.

## Constraints

- Reusar semântica já validada do protótipo (`GamificationProfile`, `GameProgressSnapshot`, achievements/missions/training paths).
- Manter a promessa de ADR-002: V1 é **auth + aluno + progresso persistente + dashboard básica**.
- Não reintroduzir dependência do browser para estado crítico do aluno.
- Não “alargar V1 por conveniência técnica”; o faseamento pedagógico/produto prevalece.
- O modelo tem de suportar evolução posterior para V2/V3 sem obrigar a recomeçar do zero.

## Pedagogical invariants that must constrain the model

### 1) O objeto canónico é o aluno em aprendizagem, não o torneio
O modelo V1 deve ser organizado à volta do aluno e da sua trajetória pedagógica. Campeonato é um modo lateral; não define o núcleo persistente da V1.

### 2) Aprendizagem > vitória
A revisão pós-jogo tem valor pedagógico próprio e não pode ficar escondida dentro de “match result”. O modelo deve distinguir explicitamente `review_completed` de `game_completed`.

### 3) Processo > resultado
Perdas, tentativas e revisões também contam. O modelo não pode guardar apenas vitórias/score; precisa de evidência mínima de prática e reflexão.

### 4) Progressão pessoal, não comparação pública
A persistência V1 não deve nascer centrada em ranking/leaderboard. O aluno compete sobretudo consigo mesmo; o canónico deve privilegiar progresso individual.

### 5) Progresso por jogo e por eixo
Não reduzir tudo a um só número. Cada jogo tem semântica própria e o frontend atual já trabalha com três eixos (`rules`, `strategy`, `mastery`) que devem permanecer distinguíveis.

### 6) Sem penalização destrutiva
XP, unlocks derivados/cacheados e marcos persistentes são monótonos; más sessões podem gerar eventos, mas não “apagam” progresso já conquistado.

### 7) O que é transitório do tutor não vira canónico automaticamente
`bestMove`, `topMoves`, `criticalThreats`, H1/H2/H3 e contexto de motor são scaffolding operacional; não são o núcleo persistente V1, salvo quando se traduzem em factos pedagógicos duráveis (review concluída, evento de prática, atualização de progresso).

### 8) Tempo importa pedagogicamente
Streaks, missões diárias/semanais e consistência exigem timestamp datado. Por isso o V1 precisa de atividade leve temporal, não apenas counters agregados.

### 9) O ciclo etário importa pedagogicamente
Como linguagem, ritmo e ZPD variam por ciclo, o perfil persistente deve ter um campo explícito de `cycle_or_grade`.

### 10) O modelo deve permitir leitura curricular sem exigir burocracia extra
A semântica AE/MEM/ZPD deve poder ser refletida por progresso, reviews e padrões, mas sem obrigar o V1 a já modelar observação de sala, relatórios ou turma.

## Testable acceptance criteria

ADR-003 estará suficientemente clarificada quando declarar explicitamente que:
1. V1 persistente inclui apenas `users`, `learner_profiles`, `learner_game_progress` e `learner_activity_events` (ou equivalente semântico restrito).
2. `matches`, `match_events`, `tutor_reviews`, `classrooms`, `enrollments`, `teacher dashboards` ficam fora do V1.
3. O progresso canónico é learner-centric e por jogo.
4. Revisão pós-jogo é evento first-class, não detalhe opcional de partida.
5. Achievements/missões/training paths permanecem catálogos/configuração na V1, com estado derivado quando necessário.
6. O backend V1 substitui `localStorage` como fonte de verdade do perfil/progresso do aluno.

## Assumptions exposed + resolutions

| Assumption | Resolution |
|---|---|
| A lista ampla de entidades em ADR-001 pode significar que V1 já precisa de tudo | Não; ADR-002 recorta V1 e vence para efeitos de faseamento. |
| Agregados de progresso bastam sem log temporal | Não totalmente; um log mínimo de eventos é necessário para streaks/missões/estado derivado de achievements. |
| Teacher/classroom devem entrar porque a direção menciona professor | Não no núcleo V1; a direção abre o horizonte, mas ADR-002 adia isso para fases seguintes. |
| Achievements persistentes exigem tabela própria já na V1 | Não; na V1 podem ser derivados da atividade e do progresso, preservando o dashboard sem abrir um subdomínio extra. |
| O campeonato atual pode servir de base ao canónico V1 | Não como núcleo; é um fluxo lateral e não o centro pedagógico persistente do aluno. |

## Pressure-pass findings

A pressão principal foi revisitar a tensão entre:
- **ADR-001 (visão ampla do data layer)** e
- **ADR-002 (faseamento estrito do V1)**.

Resultado: ADR-003 deve alinhar-se com o recorte mais estreito, porque é esse que fecha o V1 canónico sem reabrir complexidade desnecessária. A segunda pressão foi testar se bastavam snapshots agregados; concluiu-se que um log leve de atividade continua necessário para respeitar a semântica pedagógica atual. A terceira foi testar se achievements precisavam de entidade própria; concluiu-se que V1 pode mantê-los derivados para respeitar o faseamento de ADR-002.

## Brownfield evidence vs inference notes

### Direct evidence
- `src/components/gamification/gamification-state.ts` já define o shape pedagógico local: XP, streak, progresso por jogo e eventos recentes.
- `docs/agents/PEDAGOGY-GAMIFICATION.md` afirma explicitamente “aprendizagem > vitória”, “progressão pessoal > comparação” e “sem penalização”.
- `docs/agents/reviews/crjm-vnext-adr-002.md` define V1 e empurra histórico persistido/reviews detalhadas/turma-professor para fases posteriores.

### Inference (high confidence)
- `learner_activity_events` é a menor unidade persistente adicional necessária para migrar a lógica atual sem perder streaks/missões.
- `achievement_definitions`, `mission_definitions` e `training_paths` podem continuar fora da base de dados em V1.
- `cycle_or_grade` deve existir no perfil estável, mesmo que o onboarding permita preenchimento logo após registo.

## Technical context findings

- O frontend já consome um contrato estável de perfil/progresso e pode ser migrado sem redefinir a semântica pedagógica.
- O estado local atual distingue corretamente factos duráveis (counters, streak) de dados transitórios do tutor.
- O modo campeonato já possui entidades próprias (`Player`, `classId`, reconnection codes), mas isso pertence a outro subdomínio e não deve contaminar o núcleo V1 do aluno.

## Condensed transcript
- Recolhi evidência documental e de código.
- Testei internamente se ADR-003 devia ser largo ou estritamente V1; ficou estritamente V1.
- Forcei a exclusão de histórico/turma/professor apesar de já existirem sinais desses domínios no repo.
- Confirmei que o mínimo semanticamente seguro é: perfil do aluno + progresso por jogo + eventos leves.
- Ajustei a decisão para achievements derivados, alinhando melhor com o faseamento já aceite em ADR-002.

## Residual-risk notes
Há apenas uma decisão que ADR-003 deve tornar explícita para evitar reabertura futura: **teacher/classroom continuam fora de V1 mesmo existindo role/enum preparatório**. A recomendação deste deep-interview é **sim**.

## Recommended execution bridge

### `$ralplan` (recommended)
Usar este spec como source of truth para redigir/validar a ADR-003 e, em seguida, descer para PRD/test-spec do schema/API V1.

Suggested invocation:
```text
$ralplan .omx/specs/deep-interview-adr-003-core-v1.md
```

### Other valid handoffs
- `$autopilot .omx/specs/deep-interview-adr-003-core-v1.md`
- `$ralph .omx/specs/deep-interview-adr-003-core-v1.md`
- `$team .omx/specs/deep-interview-adr-003-core-v1.md`
