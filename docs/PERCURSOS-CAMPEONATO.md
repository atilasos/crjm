# Percursos de desenvolvimento para o campeonato

Desenho pedagógico para transformar o conhecimento dos motores de IA
(AlphaZero no Atari Go; motores de busca nos restantes) em percursos de
treino por jogo, com destino ao campeonato. Complementa o Laboratório de
Estratégias existente (`src/ai-core/puzzles.ts`, 3 puzzles/jogo) e o
learner-core (progresso, streaks, recomendação adaptativa).

## Princípio

Os motores não fornecem teoremas — fornecem um **oráculo** que avalia
posições melhor do que qualquer aluno. O conhecimento pedagógico extrai-se
por análise: onde o oráculo concentra as suas escolhas, que jogadas fazem a
avaliação cair (erros típicos) e que posições têm uma única jogada boa
(puzzles naturais). A confiança varia por jogo e deve ficar explícita no
material (ver tabela em `docs/agents/AI-TRAINING-STATUS-2026-07-18.md`).

## Pipeline de extração de conhecimento

### Atari Go (fonte: rede AlphaZero + 60 000 jogos de self-play)

1. **Mapa de aberturas** — avaliar a policy da rede na posição inicial e
   nas primeiras 4 jogadas; gerar heatmaps 9×9 (a rede já mostra `topMoves`
   com priors e visitas no endpoint `/move`). Output: imagem + tabela das
   5 melhores aberturas com percentagem de preferência da rede.
2. **Vantagem do primeiro jogador** — dado já medido: no self-play forte,
   as pretas ganham ~80% (iterações 27–29 do `az-v1`). Lição direta:
   iniciativa vale muito; quem joga segundo tem de disputar, não reagir.
3. **Motivos táticos frequentes** — reanalisar os `.npz` de self-play e
   detetar padrões programaticamente com as regras Python já validadas
   (`training/atari_go/rules.py`): ataris duplos, escadas, redes, grupos
   com 2 liberdades capturáveis. Contar frequência por fase do jogo.
4. **Puzzles automáticos** — posições do self-play onde (a) a policy
   concentra ≥60% numa jogada e (b) a segunda melhor perde ≥0,4 de value.
   São posições «só há uma jogada boa» — puzzles de tabuleiro reais, com
   solução verificada pelo MCTS a 800 sims. Gerar 20–30, curar à mão 10.

### Restantes jogos (fonte: motor de busca como oráculo)

Harness comum (novo script `scripts/extract-lessons.ts`, um jogo de cada
vez), reutilizando o padrão das arenas com seeds e aberturas emparelhadas:

1. **Estatística de aberturas** — N jogos motor-vs-motor no nível máximo;
   registar primeiras jogadas dos vencedores → tabela de aberturas fortes.
2. **Deteção de erros típicos** — jogar motor forte vs motor fraco (N5 vs
   N2); onde a avaliação do forte salta bruscamente após jogada do fraco
   está um erro instrutivo. Classificar os 5 erros mais frequentes por jogo.
3. **Puzzles de jogada única** — posições dos jogos onde o motor, com
   profundidade alta, encontra exatamente uma jogada vencedora (todas as
   outras perdem). Verificáveis por busca; não dependem de rede.

### Conceitos estratégicos por jogo (currículo mínimo)

| Jogo | Conceitos nucleares a ensinar | Fonte |
|---|---|---|
| Atari Go | liberdades; atari; escadas e redes; iniciativa (dado ~80% pretas); não meter grupos em auto-atari | rede az-v1 + regras Go |
| Dominório | paridade (contar jogadas de cada região); reservar regiões exclusivas; cortar as do adversário | teoria de Domineering + motor |
| Gatos & Cães | mobilidade como recurso; casas reservadas (só a tua espécie pode lá jogar); bloqueio | heurísticas do motor |
| Quelhas | pensamento misère (quem fecha perde); paridade de cadeias; sacrifício de tempo | motor PVS + ladder |
| Produto | controlo dos produtos-alvo; jogadas que criam dupla ameaça; negação | motor MCTS (confiança média-baixa — validar lições com amostra maior) |
| Nex | conexão e ameaças duplas; uso das peças neutras; bloqueio de caminhos | motor novo (84% vs legado) |

## Estrutura do percurso (igual nos 6 jogos)

Cada percurso tem 4 etapas com critérios observáveis, registados no
learner-core:

1. **Descobrir** — regras jogando: vencer o N1 uma vez + puzzle de regras.
2. **Táticas** — 3–4 puzzles do padrão tático central do jogo (dos gerados
   pelo pipeline) + vencer o N2 duas vezes seguidas.
3. **Estratégia** — puzzles dos conceitos nucleares (tabela acima) +
   vencer o N3 e depois o N4 (uma vez cada, cores alternadas).
4. **Campeonato** — jogos cronometrados contra N4/N5 (e N6 no Atari Go
   como «desafio do mestre»), com as duas cores; meta: ≥50% contra N4.
   Inclui rever 2 derrotas próprias com a análise do motor («onde caiu a
   avaliação»).

Progresso e recomendação usam o que já existe: `student_puzzles`, streaks
e o tutor adaptativo (níveis 1..5 do contrato V1; o N6 fica fora da
recomendação automática, como desafio explícito).

## Implementação por fases

- **F1 — concluída (2026-07-18)**: 6 puzzles/jogo com opções baralhadas a
  cada visita e diagramas nas posições concretas; percursos de 4 etapas com
  progresso automático dos puzzles no Laboratório.
- **F2 — concluída (2026-07-18)**: `training/atari_go/extract_lessons.py`
  extraiu da rede az-v1 o mapa de aberturas (~25% por cada casa diagonal ao
  centro; centro exato ~0,1%; valor inicial +0,568 pretas) e 30 candidatos
  a puzzle verificados por MCTS a 800 sims; 4 curados como puzzles
  «encontra a jogada» (`ag-mestre-*`) na etapa Campeonato do Atari Go.
  Artefactos: `artifacts/atari-go-lessons/2026-07-18T17-33-20/`. Falta de
  F2 alargada: persistir o nível das vitórias contra a IA (exige migração
  de schema) para os desafios «vence o Nx» contarem sozinhos.
- **F3**: `extract-lessons.ts` para os outros 5 jogos, começando por
  Dominório e Quelhas (teoria limpa) e deixando o Produto para depois de
  alargar a amostra da arena (pré-requisito de confiança).
- **F4**: revisão de derrotas na app (mostrar o gráfico de avaliação do
  motor sobre um jogo terminado) — a funcionalidade com mais valor de
  treino e mais custo de UI.

## Salvaguardas

- Nenhuma lição afirma «jogada sempre vencedora» sem prova exaustiva; o
  material usa «o mestre prefere» / «tende a ganhar».
- Cada lição extraída regista a evidência (run, seed, artefacto) como os
  gates de `AI-TRAINING-STATUS-2026-07-18.md` exigem.
- Puzzles automáticos passam curadoria humana antes de chegarem a alunos.
