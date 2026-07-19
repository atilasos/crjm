# crjm — instruções de projeto

## Verificação (gate antes de commit)

```bash
bun test                      # suite completa (~55 s)
bun run classroom:smoke       # 6 jogos + Laboratório × 3 viewports (Playwright)
bun run e2e:learner-core      # fluxo learner-core ponta-a-ponta
bun run build                 # completo com os 5 WASM; `-- --skip-wasm` para só JS
```

- `bun test` **regenera** `artifacts/atari-go-baseline/latest/baseline.json`
  (timestamp + jitter de latências). Repor com `git checkout --` antes do
  commit para evitar churn.
- Playwright: o chromium não instala neste Ubuntu; os scripts usam fallback
  `channel: 'chrome'` automaticamente.

## Medições de força de motores

- Veredictos de arena exigem **n≥50 jogos, aberturas emparelhadas e seed
  registada**; amostras pequenas invertem-se (o Produto passou de 7–3
  pró-WASM em n=10 para 19–31 contra em n=50).
- Benchmarks com orçamento de tempo (arenas, duelos, referee do Quelhas)
  correm **serializados** — dois em simultâneo distorcem-se mutuamente por
  contenção de CPU. Resultado + artefacto JSON em `artifacts/`.
- Estado e gates de qualidade dos motores:
  `docs/agents/AI-TRAINING-STATUS-2026-07-18.md`.

## Armadilhas conhecidas (documentadas onde mordem)

- Regras Python do Atari Go: `_captures_after_placement` **muta** o
  tabuleiro; usar sempre a API pública `rules.play` (training/README §6).
- Nex indexa `tabuleiro[x][y]` — ao contrário dos outros jogos (nota em
  `scripts/extract-lessons.ts`).
- `docker stop` desativa o rearranque de containers `unless-stopped`
  (incluindo após reboot) — é a forma intencional de libertar a GPU.

## Infra e treino

- GPU (RTX 5070 Ti) **só via Docker** `--runtime=nvidia --gpus all`
  (imagem pytorch 2.7.1-cuda12.8); pipelines AlphaZero em `training/`
  (atari_go, quelhas), serviços de inferência nas portas 8100/8101.
- Deploy caseiro, arranque/paragem e proteções do proxy:
  `docs/deployment/servidor-casa-crjmai.md`.
- Desenho pedagógico (Laboratório, percursos, F1–F4):
  `docs/PERCURSOS-CAMPEONATO.md`.
