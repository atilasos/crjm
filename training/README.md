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

Débito medido: ~367 jogos/min de self-play a 160 sims (12 workers × 128 jogos
concorrentes) → ~5.5 min de self-play por iteração; iteração completa
(self-play + treino + gating) ~9–10 min; 30 iterações ≈ 5 h. O campeão fica em
`runs/az-v1/best.pt`; progresso em `runs/az-v1/log.jsonl`.

## 4. Retomar um treino interrompido

```bash
docker run --rm --runtime=nvidia --gpus all \
  -v /home/proteu/crjm/training:/workspace/training -w /workspace/training \
  pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime \
  python -m atari_go.loop --run-id az-v1 --iterations 30 --resume
```

Retoma da `next_iteration` guardada em `runs/az-v1/state.json`, com o campeão
de `best.pt` e o replay buffer reconstruído dos `.npz` em `runs/az-v1/selfplay/`.
