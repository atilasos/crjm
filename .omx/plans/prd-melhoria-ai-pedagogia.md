# PRD — AI + Pedagogia para Dominório e Quelhas

## RALPLAN-DR Summary

### Principles
1. **Aprendizagem antes de ornamentação** — melhorar clareza textual e competência real antes de overlays ou redesign visual.
2. **Vertical slice por jogo prioritário** — fechar Dominório e Quelhas primeiro, sem alargar já aos restantes jogos.
3. **Tutor só pode ensinar o que a AI sustenta** — não expandir tutor sobre um motor que continua a cair silenciosamente em fallback “burro”.
4. **Reutilizar contrato comum quando possível** — usar `AIResponseV1` / perfis de dificuldade como eixo de unificação, não criar um segundo stack paralelo [`src/ai-core/types.ts:13-108`](src/ai-core/types.ts), [`src/ai-core/difficulty.ts:3-75`](src/ai-core/difficulty.ts).
5. **Validação final é pedagógica, mas esta fase precisa proxies técnicos** — a sala de aula fecha o sucesso; o repo precisa sinais de prontidão antes disso.

### Decision Drivers
1. **Competência real da AI**: hoje Dominório reporta sempre `ts-fallback` no adapter [`src/games/dominorio/ai/v1-adapter.ts:59-76`](src/games/dominorio/ai/v1-adapter.ts), e Quelhas cai para inline quando o worker falha [`src/games/quelhas/ai/ai-client.ts:32-70`](src/games/quelhas/ai/ai-client.ts).
2. **Clareza textual do tutor**: Dominório mostra `Insight` + `Ação sugerida`, mas o texto vem de frases genéricas/abstratas como “corredor”, “zona”, “paridade” [`src/games/dominorio/components/TutorHintCard.tsx:35-45`](src/games/dominorio/components/TutorHintCard.tsx), [`src/games/dominorio/ai/v1-adapter.ts:331-350`](src/games/dominorio/ai/v1-adapter.ts).
3. **Assimetria de maturidade**: Dominório já tem tutor UI (`TutorHintCard`, `TopMovesRail`, ameaça crítica, quick review) [`src/games/dominorio/DominorioGame.tsx:503-530`](src/games/dominorio/DominorioGame.tsx), enquanto Quelhas ainda só joga/computa e não expõe tutor V1 equivalente [`src/games/quelhas/QuelhasGame.tsx:87-130`](src/games/quelhas/QuelhasGame.tsx).

### Viable Options

#### Option A — Pedagogy-first
**Approach:** reescrever primeiro textos do tutor em Dominório e copiar a UI/tutor para Quelhas, deixando engine/fallback para uma segunda vaga.
- **Pros:** entrega visível mais cedo aos alunos; reduz logo a ambiguidade textual.
- **Cons:** arrisca ensinar em cima de decisões fracas; Quelhas herdaria tutor antes de o motor merecer confiança.

#### Option B — Engine-first
**Approach:** resolver primeiro worker/WASM/fallback/calibração e só depois mexer na camada pedagógica.
- **Pros:** evita tutorizar más escolhas; melhora a sensação de desafio mais cedo.
- **Cons:** atrasa o benefício pedagógico pedido pelo utilizador; deixa Dominório textualmentre ambíguo por mais tempo.

#### Option C — Hybrid vertical slice by trust boundary (**chosen**)
**Approach:** 1) medir e endurecer fiabilidade engine/fallback suficiente para confiar nos outputs; 2) reescrever a camada textual de Dominório sobre esse baseline; 3) levar o contrato+tutor base para Quelhas; 4) recalibrar ambos dentro do mesmo envelope V1.
- **Pros:** preserva a prioridade pedagógica sem tutorizar um motor não fiável; reutiliza a base existente; mantém foco em Dominório + Quelhas.
- **Cons:** exige tocar simultaneamente em engine, adapter e UI; mais coordenação entre lanes.

## Requirements Summary
- O contrato comum já suporta `bestMove`, `topMoves`, `explainText`, `criticalThreats`, `pedagogy` e `stats` [`src/ai-core/types.ts:68-84`](src/ai-core/types.ts).
- Os perfis globais de dificuldade já carregam budget/search/hint defaults, mas Dominório e Quelhas ainda usam presets locais separados [`src/ai-core/difficulty.ts:12-75`](src/ai-core/difficulty.ts), [`src/games/quelhas/ai/types.ts:3-16`](src/games/quelhas/ai/types.ts), [`src/games/dominorio/ai/v1-adapter.ts:96-133`](src/games/dominorio/ai/v1-adapter.ts).
- Dominório já renderiza tutor durante o turno humano e quick review no fim [`src/games/dominorio/DominorioGame.tsx:503-530`](src/games/dominorio/DominorioGame.tsx), [`src/games/dominorio/ai/pedagogy-mvp.ts:58-75`](src/games/dominorio/ai/pedagogy-mvp.ts).
- Dominório expõe coordenadas cruas no rail (`(l,c)-(l,c)`) [`src/games/dominorio/components/TopMovesRail.tsx:9-15`](src/games/dominorio/components/TopMovesRail.tsx) e um texto de insight/ação sem grounding adicional [`src/games/dominorio/components/TutorHintCard.tsx:38-44`](src/games/dominorio/components/TutorHintCard.tsx).
- Quelhas tem client+worker+engine próprios, com fallback inline e WASM opcional, mas não tem adapter V1 nem UI tutor [`src/games/quelhas/ai/ai-client.ts:32-154`](src/games/quelhas/ai/ai-client.ts), [`src/games/quelhas/ai/quelhas.worker.ts:77-180`](src/games/quelhas/ai/quelhas.worker.ts), [`src/games/quelhas/QuelhasGame.tsx:87-130`](src/games/quelhas/QuelhasGame.tsx).
- Fora de escopo nesta fase: redesign visual dos tabuleiros.

## Acceptance Criteria
1. **Dominório e Quelhas são o foco exclusivo da fase.** Nenhum passo obrigatório depende de expandir já o tutor aos restantes jogos.
2. **Fiabilidade da AI é observável.** Respostas usadas pelo tutor/reporting distinguem corretamente engine/fallback/usedWasm, sem hardcode enganador como o atual `usedWasm: false`/`engine: 'ts-fallback'` do adapter de Dominório [`src/games/dominorio/ai/v1-adapter.ts:70-76`](src/games/dominorio/ai/v1-adapter.ts).
3. **Texto de tutor em Dominório fica mais claro.** `explainText`/`reasonShort` deixam de depender de termos não ancorados (“zona”, “corredor”, “paridade”) sem explicação operacional; cada dica contém ação explícita e referência compreensível para aluno, validada por fixtures/golden cases de copy.
4. **Quelhas ganha camada base tutor equivalente.** Deve passar a produzir um envelope V1 com `bestMove`, `topMoves`, `explainText`, `pedagogy`, `stats`, e renderizar tutor do turno + alternativas, sem redesign do tabuleiro.
5. **Proxy de sucesso técnico-pedagógico é verificável.** O repo passa a ter fixtures/golden cases de copy e cenários de confiança onde: (a) `stats` expõem corretamente engine/fallback, (b) Dominório gera texto acionável sem jargão implícito, e (c) Quelhas entrega envelope tutor V1 mínimo; a validação final com alunos continua reservada para a prática em sala.
6. **Sem fallback opaco para primeira jogada válida.** Os cenários em que Quelhas hoje degrada para `prev.jogadasValidas[0]` no loop de UI ou no path de erro passam a expor estado/telemetria compatível com o tutor, e a decisão de degradar deixa de ser invisível ao sistema [`src/games/quelhas/QuelhasGame.tsx:111-123`](src/games/quelhas/QuelhasGame.tsx).
7. **Regressão coberta.** Há testes para adapters/pedagogy/UI proxies e evidência de build/test green.

## Implementation Steps

### Step 1 — Criar baseline de confiança e observabilidade para Dominório + Quelhas
**Why:** o tutor não deve depender de caminhos que ocultam fallback ou qualidade real.
- Auditar e alinhar os `stats`/métricas entre Dominório e Quelhas, usando o contrato comum como referência [`src/ai-core/types.ts:52-84`](src/ai-core/types.ts).
- Remover/reportar hardcodes enganosos no adapter de Dominório [`src/games/dominorio/ai/v1-adapter.ts:59-76`](src/games/dominorio/ai/v1-adapter.ts).
- Expor de forma uniforme sinais de fallback, time budget e readiness em Quelhas [`src/games/quelhas/ai/ai-client.ts:32-154`](src/games/quelhas/ai/ai-client.ts), [`src/games/quelhas/ai/quelhas.worker.ts:112-180`](src/games/quelhas/ai/quelhas.worker.ts).
- Output esperado: um baseline verificável para saber quando o tutor pode confiar no motor.

### Step 2 — Reescrever o texto pedagógico de Dominório em termos acionáveis
**Why:** o problema reportado é ambiguidade textual antes de ambiguidade visual.
- Refatorar `buildExplainText`, `buildCriticalThreats`, `reasonShort` e `suggestedAction` para linguagem de aluno, não jargão implícito [`src/games/dominorio/ai/v1-adapter.ts:310-350`](src/games/dominorio/ai/v1-adapter.ts).
- Ajustar `TutorHintCard`/`TopMovesRail` para suportar texto mais explícito (sem redesign visual do tabuleiro) [`src/games/dominorio/components/TutorHintCard.tsx:1-49`](src/games/dominorio/components/TutorHintCard.tsx), [`src/games/dominorio/components/TopMovesRail.tsx:17-47`](src/games/dominorio/components/TopMovesRail.tsx).
- Revisitar `pedagogy-mvp` para garantir que hint escalation/review não reaproveita explicações vagas [`src/games/dominorio/ai/pedagogy-mvp.ts:29-75`](src/games/dominorio/ai/pedagogy-mvp.ts).
- Introduzir fixtures/regra de copy para bloquear termos vagos sem definição operacional no turno (“zona”, “corredor”, “paridade”, “região”) quando não vierem acompanhados de ação concreta observável no tabuleiro atual.
- Output esperado: uma gramática textual reutilizável para tutor v1.

### Step 3 — Levar Quelhas para o envelope tutor V1
**Why:** hoje Quelhas tem motor, worker e UI de jogo, mas não a camada tutor equivalente.
- Criar `src/games/quelhas/ai/v1-adapter.ts` usando `AIRequestV1`/`AIResponseV1` como contrato alvo [`src/ai-core/types.ts:13-108`](src/ai-core/types.ts).
- Mapear resultados do client/worker/engine de Quelhas para `bestMove`, `topMoves`, `explainText`, `pedagogy`, `stats` [`src/games/quelhas/ai/ai-client.ts:114-154`](src/games/quelhas/ai/ai-client.ts), [`src/games/quelhas/ai/quelhas.worker.ts:120-180`](src/games/quelhas/ai/quelhas.worker.ts).
- Criar `src/games/quelhas/components/TutorHintCard.tsx` e `src/games/quelhas/components/TopMovesRail.tsx` (ou extrair componentes partilháveis) e integrá-los no `QuelhasGame`, sem tocar no design do tabuleiro [`src/games/quelhas/QuelhasGame.tsx:38-130`](src/games/quelhas/QuelhasGame.tsx).
- Preferir touchpoints explícitos em Quelhas para evitar espalhar a lógica tutor no componente principal: `src/games/quelhas/ai/v1-adapter.ts`, `src/games/quelhas/components/TutorHintCard.tsx`, `src/games/quelhas/components/TopMovesRail.tsx` e, se necessário, `src/games/quelhas/ai/pedagogy-mvp.ts`.
- Output esperado: paridade funcional mínima de tutor entre Dominório e Quelhas.

### Step 4 — Recalibrar competência e fallback por jogo dentro da mesma narrativa
**Why:** os alunos só ganham confiança se o tutor e a AI deixarem de se contradizer.
- Rever presets de dificuldade locais vs globais para reduzir incoerência entre budgets/intensidade [`src/ai-core/difficulty.ts:12-75`](src/ai-core/difficulty.ts), [`src/games/quelhas/ai/types.ts:12-16`](src/games/quelhas/ai/types.ts), [`src/games/dominorio/ai/v1-adapter.ts:96-133`](src/games/dominorio/ai/v1-adapter.ts).
- Avaliar se Quelhas deve aproximar a nomenclatura/escala ao core (1..5) ou se precisa ponte explícita no adapter.
- Endurecer cenários em que o jogo cai para `prev.jogadasValidas[0]`/fallback silencioso no loop de UI de Quelhas [`src/games/quelhas/QuelhasGame.tsx:103-123`](src/games/quelhas/QuelhasGame.tsx).
- Output esperado: menos comportamento “burro” observável e menor dissociação tutor↔motor.

### Step 5 — Fechar com harness de verificação e readiness para sala de aula
**Why:** a validação final é fora do repo, mas a fase precisa prova interna.
- Adicionar/estender testes de adapters, copy pedagógica, fallback/worker stats e integração UI mínima.
- Produzir um relatório curto de readiness com proxies: engine path, clareza textual, paridade Dominório/Quelhas.
- Garantir build/test green antes do handoff para execução completa.

## Risks and Mitigations
- **R1: Melhorar texto sobre motor ainda fraco.**
  - *Mitigation:* Step 1 vem antes do rollout tutor para Quelhas; Step 4 recalibra motor antes de declarar prontidão.
- **R2: Paridade V1 em Quelhas introduz regressão de UX ou duplicação de lógica.**
  - *Mitigation:* reutilizar contrato `AIResponseV1` e componentes tutor existentes, mas isolar game-specific mapping em adapter novo.
- **R3: Clareza textual sem apoio visual ainda pode ficar limitada.**
  - *Mitigation:* assumir text-first como fase, mas proibir jargão não definido e deixar backlog explícito para grounding visual posterior.
- **R4: Métricas de sucesso final dependem de sala de aula.**
  - *Mitigation:* usar proxies técnicos agora e documentar claramente a validação final como follow-up externo.

## Verification Steps
1. **Unit / contract tests**
   - Dominório: `v1-adapter`, `pedagogy-mvp`, copy-generation rules.
   - Quelhas: novo adapter V1, mapping de stats/fallback, topMoves/explainText.
2. **UI integration tests / render assertions**
   - Dominório continua a mostrar tutor do turno e review.
   - Quelhas passa a mostrar tutor do turno e alternativas no turno humano.
3. **Behavioral probes**
   - Cenários onde Dominório/Quelhas antes caiam em fallback silencioso devem agora expor `stats` corretos e não mascarar engine path.
4. **Regression checks**
   - `bun test`
   - `bun run build -- --skip-wasm` (ou build equivalente do repo)
   - diagnostics limpos nos ficheiros tocados.
5. **Manual readiness script/report**
   - Gerar/checklist curto para usar antes da validação em sala.

## Architect Review (sequential pass)
**Steelman antithesis:** um plano estritamente engine-first evitaria qualquer risco de ensinar más jogadas e simplificaria a narrativa técnica.

**Tradeoff tension:** quanto mais cedo expomos tutor em Quelhas, maior o valor pedagógico; quanto menos confiável o engine path, maior o risco de feedback enganoso.

**Synthesis:** usar um **trust boundary**: primeiro observabilidade/fallback correctness, depois refatorar a linguagem pedagógica em Dominório, e só então propagar tutor para Quelhas. Isto mantém o ganho pedagógico sem aceitar tutor sobre outputs opacos.

## Critic Review (verdict: APPROVE with applied improvements)
Applied improvements:
- strengthened acceptance criterion around non-misleading `stats`
- made Quelhas V1 parity explicit instead of implicit
- added regression/build gates and classroom-readiness proxy section
- made team/ralph staffing explicit
- added explicit copy-policy guardrails and named Quelhas file targets to reduce architectural drift

## ADR
- **Decision:** seguir a opção híbrida por vertical slice de confiança: observabilidade/fiabilidade -> texto pedagógico Dominório -> paridade tutor em Quelhas -> recalibração final.
- **Drivers:** AI hoje parece fraca; texto de Dominório é ambíguo; Quelhas ainda não tem tutor equivalente; utilizador autorizou autonomia total e validará sucesso em sala.
- **Alternatives considered:** pedagogy-first; engine-first; hybrid.
- **Why chosen:** minimiza o risco pedagógico sem adiar demasiado o benefício ao aluno.
- **Consequences:** exige tocar em engine, adapters e UI; aumenta coordenação, mas reduz retrabalho e desalinhamento tutor↔motor.
- **Follow-ups:** grounding visual posterior; expansão a outros jogos após Dominório/Quelhas; validação observacional com alunos.

## Available-Agent-Types Roster
Relevant available roles from the current catalog:
- `planner`
- `architect`
- `critic`
- `executor`
- `verifier`
- `test-engineer`
- `writer`
- `designer`
- `build-fixer`
- `debugger`
- `code-reviewer`
- `explore` / `explorer`

## Follow-up Staffing Guidance

### If executing via `$ralph`
Recommended lanes inside Ralph/ultrawork:
1. **Implementation lane — executor (high)**
   - Owns adapter/UI/code changes for Dominório + Quelhas.
2. **Regression lane — test-engineer (medium) + build-fixer (high if needed)**
   - Owns tests, failing builds, fixture/harness updates.
3. **Sign-off lane — verifier (high) + architect (standard floor)**
   - Owns acceptance-criteria proof and final architecture sanity check.
4. **Docs/readiness lane — writer (high, optional)**
   - Owns readiness checklist / teacher-facing validation notes.

**Ralph hint:**
```bash
$ralph .omx/plans/prd-melhoria-ai-pedagogia.md
```

### If executing via `$team`
Recommended team shape: **3 workers + leader**
- **Worker 1: executor lane (engine/adapter)** — reasoning high
- **Worker 2: executor lane (tutor UI/text/pedagogy)** — reasoning high
- **Worker 3: verifier lane (tests/build/readiness evidence)** — reasoning medium/high

If you want a 4th worker, add:
- **Worker 4: writer/designer support lane** for copy consistency and classroom-readiness notes (reasoning medium)

**Launch hints:**
```bash
omx team 3:executor "Execute .omx/plans/prd-melhoria-ai-pedagogia.md for Dominório + Quelhas; keep one lane on verification evidence"
# or
$team 3:executor "Execute .omx/plans/prd-melhoria-ai-pedagogia.md for Dominório + Quelhas; keep one lane on verification evidence"
```

## Team Verification Path
Before team shutdown, require:
1. Dominório textual tutor changes demonstrated by tests or fixture output.
2. Quelhas V1+tutor integration demonstrated by tests/render evidence.
3. Build + test evidence collected by the verification lane.
4. No in-progress tasks left in team state.
5. Optional post-team Ralph follow-up only if one owner is still needed for final polish or architectural cleanup.

## Changelog after consensus review
- Added explicit Quelhas target files for V1 adapter and tutor components.
- Tightened Dominório copy acceptance to require fixture-based validation.
- Kept the fallback-opacity guardrail and build/test gates explicit in the main plan.

## Changelog de consenso
- reforçados os targets explícitos para Quelhas (`ai/v1-adapter.ts`, `components/TutorHintCard.tsx`, `components/TopMovesRail.tsx`)
- acceptance criteria do proxy técnico-pedagógico passaram a exigir fixtures/golden cases e sinais de confiança verificáveis
- guardrail contra fallback opaco e contra mascarar `stats` ficou explícito
