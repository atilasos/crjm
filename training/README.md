# Pipeline AlphaZero — Atari Go 9x9

Treino de uma rede AlphaZero (~0.5M parâmetros) para Atari Go 9x9, validado
contra as regras TypeScript do jogo (`src/games/atari-go/logic.ts`, fonte de
verdade). Regras: vitória = primeira captura; sem passe; suicídio proibido
exceto se captura; sem jogadas legais → empate; máximo 81 plies.

## Estrutura

- `atari_go/rules.py` — regras em numpy (board `(81,)` int8; 0=vazia, 1=preta, 2=branca)
- `atari_go/rules_test.py` — replay dos traces TS, assert campo a campo
- `atari_go/net.py` — rede (9 planos de input, conv 64 + 6 blocos residuais,
  policy 81 logits com máscara aplicada fora, value tanh)
- `atari_go/mcts.py` — PUCT c=1.5, Dirichlet raiz (α=0.15, ε=0.25), batching
  de folhas entre jogos concorrentes (sem virtual loss)
- `atari_go/selfplay.py` — self-play e gating multi-worker
- `atari_go/train.py` — SGD momentum 0.9, cosine lr 1e-2→1e-4, wd 1e-4,
  augmentação D4 on-the-fly, batch 512
- `atari_go/loop.py` — ciclo self-play → treino → gating (promove se ≥55%)
- `traces/` — traces JSONL gerados pelas regras TS (gitignored)
- `runs/<run-id>/` — checkpoints, dados de self-play e `log.jsonl` (gitignored)

Nota sobre os planos de input (interpretação registada): a occupancy
próprias/adversárias é a união dos planos de liberdades ∈ {1, 2, ≥3} de cada
cor (6 planos); os restantes são última jogada, cor a jogar (uns se pretas) e
plano de uns — 9 planos no total.

## Pré-requisitos

A GPU (RTX 5070 Ti) só é acessível via Docker com a imagem
`pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime` (torch e numpy já incluídos).
Prefixo comum a todos os comandos docker:

```bash
DOCKER="docker run --rm --runtime=nvidia --gpus all \
  -v /home/proteu/crjm/training:/workspace/training -w /workspace/training \
  pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime"
```

## 1. Gerar traces e validar as regras Python

No host (bun), gerar 500 jogos aleatórios com seed determinístico:

```bash
cd /home/proteu/crjm && bun scripts/atari-go-dump-traces.ts --games 500
```

Validar `rules.py` contra os traces (zero divergências ou falha com detalhe):

```bash
docker run --rm --runtime=nvidia --gpus all \
  -v /home/proteu/crjm/training:/workspace/training -w /workspace/training \
  pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime \
  python -m atari_go.rules_test
```

## 2. Smoke de treino (escala reduzida, ~1 min/iteração)

```bash
docker run --rm --runtime=nvidia --gpus all \
  -v /home/proteu/crjm/training:/workspace/training -w /workspace/training \
  pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime \
  python -m atari_go.loop --run-id smoke --iterations 1 \
    --games 64 --sims 48 --steps 100 --workers 8 --concurrency 16 \
    --gate-games 16 --gate-sims 24
```

## 3. Treino longo (~30 iterações; defaults: 2000 jogos, 160 sims, 1000 steps)

```bash
docker run --rm --runtime=nvidia --gpus all \
  -v /home/proteu/crjm/training:/workspace/training -w /workspace/training \
  pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime \
  python -m atari_go.loop --run-id az-v1 --iterations 30
```

Resultado do treino `az-v1` (2026-07-17): 30 iterações concluídas, 60 000
jogos de self-play válidos (+2 000 repetidos após uma interrupção antes do
gating), 22 promoções; policy loss 4,2829 → 2,1394. Débito médio: ~667
jogos/min a 160 sims. O campeão fica em `runs/az-v1/best.pt`; progresso em
`runs/az-v1/log.jsonl`. A primeira arena 50–0 usava inadvertidamente o
fallback TypeScript como N5 e foi descartada. Após corrigir a propagação do
deadline no N5, a arena emparelhada contra Rust/WASM obteve N6 46–4 (92%),
zero jogadas ilegais, p95 N6 332 ms e p95 N5 500 ms com budget de 500 ms
(`artifacts/atari-go-arena/2026-07-18T15-24-50-705Z/results.json`). Nota de
leitura: o N5 de produção pensa 2000 ms, pelo que o 92% mede a força relativa
a 500 ms e não transfere diretamente para o budget de produção; em
contrapartida, a arena passa `seed` ao servidor (ativando ruído Dirichlet que
enfraquece o N6), enquanto a produção joga determinística — a medição tende a
subestimar o N6.

## 4. Retomar um treino interrompido

```bash
docker run --rm --runtime=nvidia --gpus all \
  -v /home/proteu/crjm/training:/workspace/training -w /workspace/training \
  pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime \
  python -m atari_go.loop --run-id az-v1 --iterations 30 --resume
```

Retoma da `next_iteration` guardada em `runs/az-v1/state.json`, com o campeão
de `best.pt` e o replay buffer reconstruído dos `.npz` em `runs/az-v1/selfplay/`.

## 5. Serviço de inferência N6 («Mestre»)

O FastAPI em `atari_go/serve.py` carrega `runs/az-v1/best.pt`, recarrega-o
quando o treino promove um checkpoint novo e expõe `GET /health` e
`POST /move`. O serviço só escuta em localhost; a app Bun faz proxy em
`/api/ai/atari-go/*`. Em caso de indisponibilidade, ocupação ou limite de
pedidos, o cliente degrada silenciosamente para N5 WASM/TypeScript. O proxy
aceita apenas `GET /health` e `POST /move`, limita o corpo a 8 KiB e aplica
30 pedidos/minuto por sessão; o FastAPI admite uma inferência de cada vez e
limita cada budget a 2,2 s, evitando filas de trabalhos GPU abandonados.

```bash
docker rm -f crjm-az-serve 2>/dev/null || true
docker run -d --name crjm-az-serve --restart unless-stopped \
  --runtime=nvidia --gpus all \
  -e HOST=0.0.0.0 \
  -p 127.0.0.1:8100:8100 \
  -v /home/proteu/crjm/training:/workspace/training \
  -v /home/proteu/crjm/training/.pip-cache:/root/.cache/pip \
  -w /workspace/training \
  pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime \
  bash -lc "pip install -q fastapi 'uvicorn[standard]' && python -m atari_go.serve"
```

Verificação:

```bash
curl -s http://127.0.0.1:8100/health
curl -s -X POST http://127.0.0.1:8100/move \
  -H 'content-type: application/json' \
  -d '{"board":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"toPlay":1,"timeBudgetMs":500}'
```

Arena N6 (HTTP) contra N5 local:

```bash
bun scripts/atari-go-arena.ts --games 50 --base http://127.0.0.1:8100 --budget 2000
```

Gate rápido do deadline do N5 WASM (requer build WASM prévio):

```bash
bun run build
bun run ai:budget:atari-go
```

## 6. Extração de lições pedagógicas (F2 dos percursos)

`atari_go/extract_lessons.py` interroga o campeão `best.pt` para produzir
material de ensino (ver `docs/PERCURSOS-CAMPEONATO.md`):

```bash
docker run --rm --runtime=nvidia --gpus all \
  -v /home/proteu/crjm/training:/workspace/training -w /workspace/training \
  pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime \
  python -m atari_go.extract_lessons --run-id az-v1 \
    --iters 27,28,29 --sims 800 --max-candidates 30
```

Resultado de 2026-07-18 (~105 s na RTX 5070 Ti, artefactos em
`artifacts/atari-go-lessons/2026-07-18T17-33-20/`):

- **Aberturas**: a rede reparte ~25% de preferência por cada uma das casas
  (3,3), (3,5), (5,3) e (5,5); o ponto central recebe ~0,1% e os cantos
  ~0,02%. Valor da posição inicial: +0,568 para as pretas.
- **Candidatos a puzzle**: 30 posições do self-play em que o MCTS fresco a
  800 simulações concentra ≥60% das visitas numa jogada com queda de valor
  ≥0,4 para a segunda melhor (25 estratégicas, 5 defesas de captura).
  Quatro foram curados à mão para o Laboratório (`ag-mestre-*` em
  `src/ai-core/puzzles.ts`), com os factos táticos confirmados por
  `rules.py`.

Nota de implementação: `rules._captures_after_placement` muta o tabuleiro
recebido (o chamador reverte); código novo deve usar a API pública
`rules.play`, que não muta.

## 7. AlphaZero para Quelhas (qz-v1)

Pipeline em `training/quelhas/` (porte do atari_go; regras validadas contra
14 813 plies de traces TS, 0 divergências; sem augmentação D4 — rotações
trocariam os jogadores). Treino de 2026-07-19: 30 iterações × 2000 jogos a
160 sims na RTX 5070 Ti (~700 jogos/min), policy loss 3,87 → 2,34.

Motivação e veredicto: o utilizador reportou que o motor clássico «joga
sempre 2 e não gere o fim». O árbitro exato confirmou (86% comprimento 2 no
N5) e a arena da rede contra o N5 WASM + solver de finais deu **39–1
(97,5%)** com 0 ilegais — e uma distribuição de comprimentos muito mais
rica (31% das jogadas com comprimento ≥3, incluindo linhas quase completas)
(`artifacts/quelhas-arena/2026-07-19T09-23-00-373Z/results.json`).

Serviço de inferência (porta 8101, com solver exato de finais no serviço):

```bash
docker run -d --name crjm-qz-serve --restart unless-stopped \
  --runtime=nvidia --gpus all -e HOST=0.0.0.0 -e PORT=8101 \
  -p 127.0.0.1:8101:8101 -v /home/proteu/crjm/training:/workspace/training \
  -w /workspace/training pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime \
  bash -lc "pip install -q fastapi 'uvicorn[standard]' && python -m quelhas.serve"

bun scripts/quelhas-arena.ts --games 40 --budget 2000
```

## 8. Testar a robustez dos workers

Os workers enviam envelopes de sucesso/erro e o processo pai usa leituras com
timeout + inspeção de `exitcode`; uma falha CUDA/Python deixa assim de bloquear
o treino indefinidamente.

```bash
docker run --rm \
  -v /home/proteu/crjm/training:/workspace/training -w /workspace/training \
  pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime \
  python -m atari_go.selfplay_test
```
