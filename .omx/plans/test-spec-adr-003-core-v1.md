# Test Spec — ADR-003 Core V1

## Test Objectives
1. Prove the learner-centric V1 model preserves today’s pedagogical semantics.
2. Prove auth + learner bootstrap + progress persistence replace browser-local critical state.
3. Prove excluded V1 domains (match history, classrooms, teacher dashboards, detailed reviews) do not leak into the delivered schema/API.

## Test Matrix

### Unit / contract
1. **Derivation parity fixtures**
   - Input: representative `game_completed` and `review_completed` event sequences.
   - Assert: XP, streak, per-game rules/strategy/mastery, mission progress, and unlocked achievements match current logic (`src/components/gamification/gamification-state.ts:131-255`).
2. **Catalog-backed derivation**
   - Assert server derivation reads the existing achievement/mission definitions without requiring new persistence tables (`src/ai-core/gamification.ts:28-117`).
3. **Invariant tests**
   - Assert no negative XP paths, no destructive streak rollback outside date rules, and only allowed event types are accepted.

### Integration
4. **Learner bootstrap**
   - Create/authenticate a learner and assert `users` + `learner_profiles` bootstrap correctly with default learner role and ADR-003-required profile fields: `display_name`, `locale`, `cycle_or_grade`, `total_xp`, `current_streak_days`, and `last_active_on` (`.omx/specs/deep-interview-adr-003-core-v1.md:58-69`).
5. **Runtime/bootstrap wiring**
   - Assert the API/runtime entry path can start without breaking the existing SPA/tournament entrypoints and that required env/config validation fails clearly when auth/database configuration is missing.
6. **Progress persistence**
   - Persist per-game progress for multiple games and assert `(user_id, game_id)` uniqueness plus reload parity.
7. **Activity-event ingestion**
   - Persist `game_completed` and `review_completed` events and assert dashboard read-model recomputation is correct.
   - Assert the persisted event shape includes `occurred_at`, `won` (nullable only for game completion), and `xp_delta` semantics from ADR-003 (`.omx/specs/deep-interview-adr-003-core-v1.md:89-100`).
8. **Excluded-domain guard**
   - Assert no required schema/API dependency on matches, match_events, classrooms, enrollments, or teacher dashboard tables/routes for V1 acceptance.

### Frontend regression
9. **Provider bootstrap from API**
   - Assert `GamificationProvider` can initialize from backend data and no longer requires localStorage as the source of truth (`src/components/gamification/GamificationProvider.tsx:33-50`).
10. **Dashboard/profile rendering**
   - Assert home and profile pages render the same XP/streak/progress/mission/achievement outputs with API-backed data (`src/App.tsx:65-164`; `src/components/PerfilPage.tsx:17-110`).
11. **Frontend query-contract split**
   - Assert dashboard/profile queries return persisted profile/progress data plus derived achievement unlock state and mission progress, while `sessionXp` and popup/new-unlock behavior remain client-ephemeral and are driven by command acknowledgements rather than new canonical tables (`src/App.tsx:29-68`; `src/components/gamification/GamificationProvider.tsx:19-29`, `src/components/gamification/GamificationProvider.tsx:52-91`).
12. **Migration/import behavior**
   - If import is supported, assert import is idempotent and does not double-award XP.
   - Assert the import endpoint/path persists and checks the chosen marker/fingerprint so replaying the identical payload is a no-op for XP, events, and streak.
   - If reset policy is chosen, assert the UX communicates it clearly and does not silently mix sources.
13. **Derived-state cache behavior**
   - If a non-canonical cache/read-model is introduced for achievements or missions, assert it is recomputable from canonical profile/progress/events and does not become a second source of truth.

### Manual / end-to-end
14. Sign in as a learner.
15. Complete one game and one review.
16. Reload / sign out / sign back in.
17. Confirm XP, streak, per-game progress, missions, and achievements remain consistent.
18. If local import exists, replay the same import path/payload and confirm learner totals/events do not change.
19. Confirm localStorage is no longer the critical persistence dependency for learner state.

## Acceptance Gate
- All unit/contract and integration tests above pass.
- Frontend regression coverage exists for the provider bootstrap and learner dashboard.
- Manual verification proves reload/session persistence without browser-only source-of-truth behavior.
- Review confirms no V2/V3 scope leaked into V1 schema/API.
