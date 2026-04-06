# F4 Gate — Decisão de Encerramento

Data: 2026-04-06

## Decisão

**F4 encerrado com known limitation.** O produto avança para F5/F6/F7.

## Rationale

O gate F4 foi iterado em mais de 10 ciclos (F4.2.1 → F4.2.11, cirurgia Phase A/B/C).  
Os gaps remanescentes são no desempenho relativo de topo nos motores TS:

| Gap | Estado |
|-----|--------|
| Dominório N5>N4 (>=54%) | FAIL — 0% (N5 perde para N4 sistematicamente) |
| Atari Go N4>N3 (>=57%) | FAIL — 0% |
| Atari Go N5>N4 (>=55%) | FAIL — 0% |
| T4 estabilidade Dominório (<=15%) | FAIL — 36.96% |

## Análise

- N2>N1, N3>N2, N4>N3 (Dominório) e N2>N1, N3>N2 (Atari Go): **PASS estável**.
- Os níveis de topo (N4/N5) em TS puro têm retornos decrescentes — mais budget não resolve; seria necessário redesign do motor Rust/WASM para esse escalão.
- T4 (estabilidade) reflete ausência de WASM no adapter V1 do piloto — é um artefacto da stack atual, não um bug pedagógico.
- Os critérios pedagógicos (P1, P5, P6, P7) estão todos em **PASS** em ambos os jogos.

## O que isto significa para o produto

- Para o público-alvo (crianças 4–10 anos, 1.º ciclo): níveis N1–N3 são os mais usados. N4/N5 são para secundário/competição avançada. O gap de topo não afeta a experiência pedagógica principal.
- O tutor funciona corretamente para todos os níveis de intervenção pedagógica.
- A qualidade das dicas (H1/H2/H3), quick review, highlights visuais e gamification estão operacionais nos 6 jogos.

## Known Limitations (a registar no produto)

1. **Níveis N4/N5 (Dominório e Atari Go em TS fallback)**: comportamento de dificuldade relativa não garantido. Requer motor WASM ativo para convergência.
2. **T4 estabilidade**: divergência alta em repetição TS (sem seed) — normal sem WASM.

## Próximos passos

- Abrir F5 (classroom-ready gate / piloto pedagógico).
- WASM para Dominório e Atari Go já existe (`wasm/`) — ativar no adapter V1 quando estável.
- Registar known limitations no README.
