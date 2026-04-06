# Dominorio F1.4 Baseline (AI vs AI)

- Generated at: 2026-03-21T10:05:24.289Z
- Games: 16
- Decisions: 470
- Harness mode: ts-repeatability-proxy

## Technical Metrics

| Metric | Value | Target | Status |
| --- | ---: | --- | --- |
| T1 N2 vs N1 | 50.0% | >= 60% | FAIL |
| T1 N3 vs N2 | 100.0% | >= 58% | PASS |
| T1 N4 vs N3 | 100.0% | >= 56% | PASS |
| T1 N5 vs N4 | 100.0% | >= 54% | PASS |
| T2 N1 p50/p95 | 4.1ms / 13.0ms | p50 <= 100ms; p95 <= 2x p50 | FAIL |
| T2 N2 p50/p95 | 4.2ms / 30.6ms | p50 <= 250ms; p95 <= 2x p50 | FAIL |
| T2 N3 p50/p95 | 60.1ms / 61.1ms | p50 <= 500ms; p95 <= 2x p50 | PASS |
| T2 N4 p50/p95 | 120.1ms / 121.2ms | p50 <= 1000ms; p95 <= 2x p50 | PASS |
| T2 N5 p50/p95 | 240.1ms / 241.0ms | p50 <= 2000ms; p95 <= 2x p50 | PASS |
| T3 legalidade | 100% legal | 100% legal | PASS |
| T4 estabilidade | 0.00% divergência | <= 15% | PASS |

## Pedagogical Proxies

| Metric | Value | Target | Status |
| --- | ---: | --- | --- |
| P1 (feedback curto + acionável) | 100.0% | >= 90% | PASS |
| P5 (transparência mínima) | 100.0% | >= 85% | PASS |
| P6 (turning points 1-3) | 100.0% | >= 90% | PASS |
| P7 (próximo passo claro) | 100.0% | >= 90% | PASS |

## Notes

- T4 proxy note: WASM ainda não está ativo no adapter V1 do piloto; T4 mede divergência em repetição TS para manter cobertura até ativação WASM.
