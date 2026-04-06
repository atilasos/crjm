# Deep Interview Spec — melhoria-ai-pedagogia

## Metadata
- Profile: standard
- Rounds: 10
- Final ambiguity: 0.10
- Threshold: 0.20
- Context type: brownfield
- Context snapshot: `.omx/context/melhoria-ai-pedagogia-20260403T110742Z.md`
- Transcript: `.omx/interviews/melhoria-ai-pedagogia-20260403T111300Z.md`

## Clarity breakdown
| Dimension | Score |
|---|---:|
| Intent | 0.94 |
| Outcome | 0.92 |
| Scope | 0.86 |
| Constraints | 0.82 |
| Success | 0.74 |
| Context | 0.92 |

## Intent
Improve the project so playing against the AI is both:
1. a **real challenge** rather than a weak fallback-driven opponent, and
2. a **real learning aid** for students, helping them discover stronger strategies and achieve better championship results.

## Desired outcome
For **Dominório** and **Quelhas** first:
- AI quality should materially improve so it no longer feels obviously weak in common important scenarios.
- Tutor guidance should become clearer, more actionable, and more understandable for students during play.
- The work should move the project toward better student performance in classroom/championship practice.

## In scope
- Prioritize **Dominório** and **Quelhas**.
- Improve **AI competence** where fallback/weakness currently undermines challenge.
- Improve **textual tutor guidance** first.
- Reuse/adapt the **base tutor layer pattern** from Dominório for Quelhas if appropriate.
- Deep refactors are allowed if they are the best path to the target outcome.
- Architecture/order of execution may be decided autonomously.

## Out of scope / Non-goals
- **Do not redesign the visual look of the boards** in this phase.
- Visual grounding overlays/highlights may be deferred to a later phase.

## Decision boundaries
OMX may decide without further confirmation:
- execution order,
- architecture,
- whether to prioritize engine/worker/fallback competence before textual pedagogy,
- whether large refactors are warranted,
provided the work remains focused on the final objective: stronger student outcomes through stronger AI + clearer pedagogy.

## Constraints
- Brownfield codebase with existing AI core contracts (`AIResponseV1`, difficulty profiles).
- Dominório already has tutor UI + pedagogy MVP; Quelhas does not yet have equivalent tutor integration.
- Immediate focus should be **text clarity before visual assist**.
- Final proof of success will happen in **real classroom practice**, not purely from code-level metrics.

## Testable acceptance criteria
### This phase
1. Dominório and Quelhas are the first delivery focus.
2. AI quality is improved enough that it does not commonly collapse into obviously weak fallback behavior in key scenarios.
3. Tutor text is rewritten/refactored to be more understandable and actionable for students.
4. Tutor text should avoid references that require undefined visual conventions (e.g. unexplained territories/coordinates without grounding).
5. No board visual redesign is introduced.
6. If architecture changes are needed, they are acceptable.

### Proxy success criteria for this phase
- Dominório/Quelhas AI appears materially less “burra” in practical play.
- Text hints become clearer and more directly useful to students.
- The resulting system is ready for classroom validation.

### Final real-world validation
- Success is ultimately judged by **better student results in classroom/championship practice**.

## Assumptions exposed + resolutions
- Assumption: text ambiguity is the main immediate pedagogical blocker.
  - Resolution: yes, text-first is preferred even though visual grounding is a known issue.
- Assumption: copying Dominório tutor into Quelhas is acceptable.
  - Resolution: yes as a base pattern, but Dominório clarity problems must be fixed rather than cloned.
- Assumption: autonomous sequencing is acceptable.
  - Resolution: yes, full autonomy granted as long as final objective is preserved.

## Pressure-pass findings
- Revisited earlier tradeoff: whether stronger AI should come before textual pedagogy if needed.
- Outcome of pressure pass: user explicitly authorized autonomous reprioritization, including engine-first if required.

## Brownfield evidence vs inference notes
### Evidence from repo
- `src/ai-core/types.ts` defines `AIResponseV1` and pedagogy-related fields.
- `src/ai-core/difficulty.ts` defines normalized difficulty profiles.
- Dominório and Atari Go already have tutor UI integration.
- Quelhas currently lacks the same tutor integration pattern.
- Dominório has a pedagogy MVP and existing metrics/reporting references.

### Inference
- Dominório is the best base pattern for Quelhas tutor expansion, but not necessarily in its current wording quality.
- Worker/fallback/engine quality may need to be addressed before pedagogy can be trusted.

## Technical context findings
- Existing contracts support explainability and tutor expansion.
- Current product maturity is uneven across games.
- Dominório and Quelhas are the correct first vertical slice for combined AI + pedagogy work.

## Recommended execution bridge
Recommended next step: **`$ralplan`**
- Invocation: `$plan --consensus --direct .omx/specs/deep-interview-melhoria-ai-pedagogia.md`
- Why: requirements are now clear, but architecture/sequence should still be formalized before execution.
