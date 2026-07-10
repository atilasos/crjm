# PRD — ADR-003 Core V1 (Learner-Centric Persistent Core)

## Requirements Summary

Implement ADR-003 as the accepted V1 persistence boundary for CRJM vNext by replacing browser-owned learner state with a backend-owned learner-centric model that persists auth identity, learner profile, per-game progress, and a minimal dated activity log.

### Grounding evidence
- ADR-002 fixes V1 to auth, learner identity, per-game persistent progress, and a basic learner dashboard while explicitly deferring detailed match history, persistent review artifacts, achievements persistence, and teacher/classroom scope (`docs/agents/reviews/crjm-vnext-adr-002.md:163-187`).
- The current app still boots as a pure SPA (`src/index.ts:1-18`) and the gamification source of truth lives in browser state/localStorage (`src/components/gamification/GamificationProvider.tsx:33-50`).
- The canonical local learning state already has the exact aggregates ADR-003 should migrate: XP, streak, achievements view-state, per-game progress, and recent dated events (`src/components/gamification/gamification-state.ts:25-33`, `src/components/gamification/gamification-state.ts:131-173`, `src/components/gamification/gamification-state.ts:224-255`).
- The learner dashboard currently reads those aggregates directly via `useGamification`, `GameProgressBars`, missions, and achievements (`src/App.tsx:19-24`, `src/App.tsx:65-164`, `src/components/PerfilPage.tsx:10-110`).
- Pedagogical rules require learning over victory, explicit review value, monotonic progression, and personal progress over public comparison (`docs/agents/PEDAGOGY-GAMIFICATION.md:13-20`, `docs/agents/PEDAGOGY-GAMIFICATION.md:222-246`, `docs/agents/PEDAGOGY-GAMIFICATION.md:248-256`).
- Achievement and mission definitions already exist as static catalogs in code, which supports keeping them derived/config-based in V1 (`src/ai-core/gamification.ts:9-26`, `src/ai-core/gamification.ts:28-117`).

## RALPLAN-DR Summary

### Principles
1. **Learner-centric source of truth** — the persistent core is the learner and their pedagogical progression, not tournament state or full replay history.
2. **Pedagogy before exhaustiveness** — persist only what V1 needs to drive progress, streaks, missions, and dashboard semantics.
3. **Derive before materialize** — keep achievements/missions/training paths as catalogs/config unless persistence is strictly required for V1 correctness.
4. **Phased migration, no semantic regression** — preserve the existing frontend dashboard semantics while moving the source of truth from localStorage to server-owned data.

### Decision Drivers
1. Remove browser dependence for critical learner state while matching ADR-002 V1 boundaries (`docs/agents/reviews/crjm-vnext-adr-002.md:155-177`; `src/components/gamification/GamificationProvider.tsx:37-50`).
2. Preserve the current pedagogical semantics of review, XP/streaks, and per-game axes (`src/components/gamification/gamification-state.ts:131-173`, `src/components/gamification/gamification-state.ts:224-255`; `docs/agents/PEDAGOGY-GAMIFICATION.md:15-20`).
3. Keep V1 narrow enough to ship without accidentally pulling in match-history, classroom, or teacher domains (`docs/agents/reviews/crjm-vnext-adr-002.md:179-187`).

### Viable Options

#### Option A — Lean learner-centric core with derived achievements/missions **(chosen)**
- Persist `users`, `learner_profiles`, `learner_game_progress`, and `learner_activity_events`.
- Keep achievements/missions/training paths as code catalogs and derive dashboard state from persisted profile/progress/events, allowing only a non-canonical cache/read-model if unlock timestamps or rollout performance require it.
- Pros: aligns cleanly with ADR-002, maps to existing gamification semantics, avoids premature subdomains.
- Cons: requires careful derivation logic and a migration seam from localStorage.

#### Option B — First-class persistence for achievements/missions in V1
- Add unlock/progress tables now so the dashboard reads fully persisted gamification state.
- Pros: simpler read models for future analytics; fewer recomputations.
- Cons: expands V1 scope beyond the current proven need and risks hardening the wrong domain boundaries too early.

#### Option C — Keep local progress temporarily, add auth/backend later
- Ship auth first but defer learner progress migration.
- Pros: lowest immediate backend effort.
- Cons: directly conflicts with ADR-002’s “do not depend on client for identity and critical persistence” guardrail and delays the real value of V1.

## ADR

### Decision
Adopt Option A: implement a learner-centric persistent core for V1 with four semantic entities — identity/auth user, learner profile, learner per-game progress, and minimal dated learner activity events — while keeping achievements, missions, and training paths as code-defined catalogs with server-derived visible state.

### Drivers
- Existing browser state already defines the minimal aggregates the product uses today (`src/components/gamification/gamification-state.ts:25-33`).
- Review events and streak logic are explicit and pedagogically first-class, so the model needs a minimal activity timeline, not only counters (`src/components/gamification/gamification-state.ts:155-189`, `src/components/gamification/gamification-state.ts:224-255`).
- The profile/dashboard UX already expects XP, streak, mission progress, achievements, and per-game bars from a single source of truth (`src/App.tsx:65-164`; `src/components/PerfilPage.tsx:17-110`).

### Alternatives considered
- **Materialize achievements/missions in V1** — rejected because static definitions already live in code and ADR-002 explicitly defers persistent achievements/history to later phases (`src/ai-core/gamification.ts:28-117`; `docs/agents/reviews/crjm-vnext-adr-002.md:179-183`).
- **Persist full matches/reviews now** — rejected because V1 is scoped to auth + learner + persistent progress + basic dashboard, not replay/history domains (`docs/agents/reviews/crjm-vnext-adr-002.md:173-187`).
- **Keep localStorage as interim source of truth** — rejected because it preserves the current fragility and contradicts the migration objective (`src/components/gamification/GamificationProvider.tsx:37-50`; `docs/agents/reviews/crjm-vnext-adr-002.md:155-161`).

### Why chosen
Option A is the smallest change that satisfies the product boundary, preserves current learner semantics, and keeps future extensibility open for V2/V3 without freezing premature persistence subdomains.

### Consequences
- The repo needs a new backend/API lane rather than only frontend edits.
- `GamificationProvider` becomes a client of an authenticated learner-progress API instead of `localStorage`.
- The app will need a one-time or phased import/migration story for pre-existing local learner progress.
- The team must define derivation rules for achievements/missions on the server side and keep them contract-tested against the current frontend semantics.
- The stack bootstrap is non-trivial because the current package manifest does not yet include Hono/Drizzle/Postgres/Supabase client dependencies (`package.json:7-32`).

### Follow-ups
1. Publish ADR-003 as an accepted repo document.
2. Add the backend skeleton and persistence schema for the four V1 entities.
3. Introduce learner-profile/progress/event API contracts and derivation services.
4. Replace browser-local source-of-truth usage with authenticated API-backed state.
5. Add migration/import safeguards and regression tests for dashboard parity.

## Acceptance Criteria
1. A committed ADR-003 document exists under `docs/agents/reviews/` and explicitly constrains V1 to learner-centric persistence for profile/progress/events while excluding match history, classroom, teacher, and review-detail subdomains.
2. The codebase has a backend entry/service structure that can host authenticated learner endpoints without breaking the current tournament server entry points (`src/index.ts:1-18`, `src/server/tournament-server.ts:1-140`).
3. A shared contract exists for learner profile, per-game progress, and activity events that semantically matches the current gamification profile/events, including ADR-003-required fields `display_name`, `locale`, `cycle_or_grade`, `total_xp`, `current_streak_days`, `last_active_on`, and event `xp_delta`/`occurred_at` semantics (`.omx/specs/deep-interview-adr-003-core-v1.md:58-99`; `src/components/gamification/gamification-state.ts:5-33`).
4. Persistence schema/migrations exist for `users`, `learner_profiles`, `learner_game_progress`, and `learner_activity_events` (or direct semantic equivalents), with no V1 tables for matches/history/classrooms/teacher dashboards.
5. The learner dashboard query contract is explicit: canonical persisted state comes from profile/progress/events, query-derived server read models provide achievement unlock state and mission progress, and client-ephemeral state is limited to `sessionXp` and popup/new-unlock presentation behavior (`src/App.tsx:29-68`; `src/components/gamification/GamificationProvider.tsx:19-29`, `src/components/gamification/GamificationProvider.tsx:52-91`; `src/components/PerfilPage.tsx:17-110`).
6. The write contract is explicit: `recordGameCompleted` / `recordReviewCompleted` become narrow command endpoints over pedagogical facts, while dashboard/profile reads stay query-oriented and do not overload the write path (`src/components/gamification/GamificationProvider.tsx:52-71`).
7. Server-side derivation rules preserve the current pedagogical semantics that review matters, progression is monotonic, and missions/achievements derive from dated activity plus aggregate progress (`docs/agents/PEDAGOGY-GAMIFICATION.md:15-20`, `docs/agents/PEDAGOGY-GAMIFICATION.md:222-256`).
8. There is a migration/import path so existing browser progress can be safely adopted or intentionally discarded with an explicit policy.
9. Import/cutover behavior is idempotent via a persisted import marker/fingerprint (stored as operational metadata on the learner bootstrap path, not a new pedagogical domain): the same learner state cannot be imported twice to double-award XP, duplicate events, or inflate streaks.
10. No critical learner-state screen depends on `localStorage` after cutover, even if a temporary read-model cache exists.

## Implementation Steps

### 1. Land the ADR and a shared boundary contract
- Add `docs/agents/reviews/crjm-vnext-adr-003.md` from the accepted spec in `.omx/specs/deep-interview-adr-003-core-v1.md`.
- Add a shared learner-core contract module (likely under `src/types/` or `src/ai-core/`) for `LearnerProfile`, `LearnerGameProgress`, and `LearnerActivityEvent`, mapped from `GamificationProfile` / `GameProgressSnapshot` / `GamificationEvent` (`src/components/gamification/gamification-state.ts:5-33`).
- Promote the source-spec-required stable fields into the contract/schema checklist: `display_name`, `locale`, `cycle_or_grade`, `total_xp`, `current_streak_days`, `last_active_on`, plus `xp_delta` on learner activity events (`.omx/specs/deep-interview-adr-003-core-v1.md:58-99`).
- Explicitly document which fields remain derived vs persisted.

### 2. Introduce the V1 backend/app skeleton without breaking current runtime
- Split SPA serving from API serving so `src/index.ts` no longer blocks backend growth as a static-only entry (`src/index.ts:1-18`).
- Add a backend app module and env/config module aligned with ADR-002’s Hono+Bun+Postgres+Drizzle stack (`docs/agents/reviews/crjm-vnext-adr-002.md:20-28`).
- Update the runtime/toolchain bootstrap (`package.json`, Bun entry scripts, env example, dependency install path) because the repo currently has no Hono/Drizzle/Postgres/Supabase packages or API-oriented scripts (`package.json:7-32`).
- Preserve `src/server/tournament-server.ts` as an isolated tournament lane rather than making it the learner-progress core (`src/server/tournament-server.ts:63-83`).

### 3. Add persistence schema + repository/service layer for the four V1 entities
- Create schema files for `users`, `learner_profiles`, `learner_game_progress`, and `learner_activity_events`.
- Encode key invariants: role default `learner`, `(user_id, game_id)` uniqueness for progress snapshots, bounded activity event types, monotonic XP/streak handling, and timestamps on all durable learner facts.
- Add repository/service tests that prove the schema can bootstrap a learner and store/read progress/events.

### 4. Implement auth bootstrap and learner API routes
- Add auth integration seams for session verification and learner bootstrap (`users` + `learner_profiles`).
- Add read/write endpoints for learner dashboard state: profile read, progress upsert, and activity ingestion for `game_completed` / `review_completed`.
- Keep the write surface narrow: V1 accepts pedagogical facts, not full board-state history.
- Separate **commands** (record game/review facts, import local profile once) from **queries** (learner dashboard read model) so derived achievement/mission state can evolve without overloading write endpoints.
- Define the frontend-facing query payload explicitly: persisted profile/progress/event-backed dashboard reads must return achievement unlock state and mission progress, while `sessionXp` and popup/new-unlock queue state remain client-ephemeral view-model data computed from command acknowledgements rather than new canonical persistence requirements.

### 5. Move derivation logic server-side while preserving current semantics
- Extract or port derivation logic from `recordGameCompletion`, `recordReviewCompletion`, `unlockAchievements`, and `getMissionProgress` into a shared service layer (`src/components/gamification/gamification-state.ts:131-255`).
- Continue using `STARTER_ACHIEVEMENTS` and `STARTER_MISSIONS` as catalogs (`src/ai-core/gamification.ts:28-117`).
- Add contract tests that compare derived results against the current known frontend behavior for representative sessions.

### 6. Replace localStorage-backed learner state in the frontend
- Refactor `GamificationProvider` to initialize from authenticated API responses rather than `localStorage` (`src/components/gamification/GamificationProvider.tsx:33-50`).
- Keep `App`, `PerfilPage`, and `GameProgressBars` rendering contracts stable while swapping the data source (`src/App.tsx:19-24`, `src/App.tsx:65-164`, `src/components/PerfilPage.tsx:10-110`).
- Introduce optimistic or queued writes only if needed for UX continuity; otherwise prefer explicit save-on-event semantics.
- Make the cutover staged: first support remote bootstrap behind a feature flag or adapter seam, then remove `localStorage` as the critical source of truth once parity and import safety are proven.

### 7. Add migration and rollout safeguards
- Define how existing `crjm.gamification.v1` browser data is handled: one-time import, feature-flagged fallback, or explicit reset policy (`src/components/gamification/gamification-state.ts:45`; `src/components/gamification/GamificationProvider.tsx:37-50`).
- If import is supported, make it transactional and idempotent with a persisted import marker/fingerprint on the learner bootstrap path (for example a profile-level bootstrap hash or equivalent operational metadata) so replaying the same browser payload cannot duplicate XP/events/streaks.
- Add regression checks for the dashboard and no-regression tests for missions/achievements/streaks after migration.
- Document out-of-scope follow-up lanes for V2/V3 rather than leaking them into V1.

## Risks and Mitigations
- **Risk:** Backend scaffolding balloons beyond V1.  
  **Mitigation:** Keep the schema/API surface limited to the four semantic entities and reject match-history/classroom additions during review.
- **Risk:** Derived achievements/missions diverge from current UX behavior.  
  **Mitigation:** Freeze existing semantics with shared fixtures/contract tests based on `gamification-state.ts` before moving logic.
- **Risk:** Migration from localStorage causes learner data loss or duplicated XP.  
  **Mitigation:** Define a single import policy, a persisted import marker/fingerprint with transactional dedupe, and explicit fallback/rollback behavior.
- **Risk:** Backend dependency/bootstrap work destabilizes the existing Bun SPA workflow.  
  **Mitigation:** add the API/runtime bootstrap in a dedicated step with isolated scripts and keep tournament/server entries separate during rollout.
- **Risk:** Tournament code becomes entangled with learner-progress APIs.  
  **Mitigation:** Keep tournament server/runtime isolated and treat it as a separate lane.

## Verification Steps
1. ADR doc review: verify ADR-003 text matches the accepted scope boundaries from the spec and ADR-002.
2. Contract/unit tests: learner event → progress/mission/achievement derivation parity with current behavior.
3. Repository/integration tests: bootstrap learner, persist progress/events, reload dashboard read model.
4. Frontend regression tests: profile page and home dashboard render the same learner metrics against API-backed data.
5. Manual verification: authenticate a learner, complete a game, complete a review, reload, and confirm XP/streak/progress survive without localStorage as source of truth.

## Available-Agent-Types Roster
- `architect` — boundary review for schema/API/domain cuts
- `executor` — backend + frontend implementation lanes
- `test-engineer` — contract/integration/regression coverage
- `debugger` — migration or auth-flow failures
- `security-reviewer` — auth/session trust boundary review
- `verifier` — completion evidence and rollout readiness
- `writer` — ADR and migration/runbook documentation
- `build-fixer` — toolchain/build failures if new backend wiring breaks CI

## Follow-up Staffing Guidance

### Recommended `$ralph` follow-up
- **Primary owner:** `executor` (high reasoning) for end-to-end implementation.
- **Embedded review calls:** `architect` (high) at the schema/API boundary checkpoint; `test-engineer` (medium) before frontend migration lands; `verifier` (high) before completion.
- **Optional lane:** `security-reviewer` (medium) once auth routes exist.

### Recommended `$team` follow-up
- **Lane 1 — Domain/backend foundation:** `architect` + `executor` (high) for ADR landing, shared contracts, schema, repositories, and auth/API boundaries.
- **Lane 2 — Derivation + parity tests:** `executor` + `test-engineer` (medium/high) for server derivation logic and contract fixtures against current gamification semantics.
- **Lane 3 — Frontend migration:** `executor` (medium) for provider/dashboard API integration and migration UX.
- **Lane 4 — Final validation:** `verifier` + `security-reviewer` (medium/high) for end-to-end auth/persistence proof and trust-boundary review.

## Launch Hints

### Ralph
```bash
$ralph ".omx/plans/prd-adr-003-core-v1.md"
```
Use when one owner should drive the sequence: ADR -> schema/API -> derivation parity -> frontend migration -> verification.

### Team
```bash
$team ".omx/plans/prd-adr-003-core-v1.md"
# or
omx team start --plan .omx/plans/prd-adr-003-core-v1.md
```
Use when backend foundation, derivation tests, and frontend migration can progress in parallel with explicit boundaries.

## Team Verification Path
1. Backend lane proves schema, repositories, and learner API endpoints with integration tests.
2. Derivation/test lane proves parity with current gamification semantics using shared fixtures.
3. Frontend lane proves dashboard/profile rendering against API-backed learner state.
4. Security/verifier lane proves auth/session checks and confirms no V2/V3 scope leaked into the delivered schema/API.
5. Final Ralph/verifier pass confirms no remaining localStorage source-of-truth dependency for critical learner state.

## Plan Changelog
- Initial consensus draft created from ADR-003 core spec, current gamification code, and ADR-002 scope boundaries.
- Added dependency/bootstrap, import-idempotence, command/query separation, staged-cutover, explicit ADR field coverage, and frontend query-contract requirements after architecture/critic review.
