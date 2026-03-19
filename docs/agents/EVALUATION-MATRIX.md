# EVALUATION MATRIX — CRJM

Data: 2026-03-18  
Papel: Especialista de Avaliação (CRJM)

## 1) Objetivo e Escopo

Esta matriz define a avaliação inicial para as IAs dos 6 jogos do CRJM em três dimensões:
- Performance técnica por jogo
- Benchmarks por dificuldade (N1 a N5)
- Critérios pedagógicos observáveis em jogo e pós-jogo

A matriz é pensada para uso contínuo em regressão e calibração de dificuldade, sem alterar UI nem algoritmos.

## 2) Protocolo de Medição (baseline)

| Campo | Definição inicial |
|---|---|
| Motores avaliados | Rust/WASM (primário) + TypeScript fallback |
| Modos | AI vs AI (benchmark), Humano vs AI (pedagógico) |
| Amostra mínima técnica | 200 partidas por jogo por nível (espelhando jogador inicial) |
| Controlo de aleatoriedade | 3 seeds fixas por cenário + 1 seed livre |
| Ambiente | Browser target de produção, Web Worker ativo |
| Registo | CSV/JSON com: jogo, nível, seed, vencedor, tempo, jogada, avaliação local |
| Gating de aprovação | Só promove nível se cumprir métricas técnicas + pedagógicas mínimas |

## 3) Métricas Técnicas por Jogo

### 3.1 Métricas comuns (todos os jogos)

| Código | Métrica | Como medir | Meta inicial |
|---|---|---|---|
| T1 | Winrate espelhado | AI(N) vs AI(N-1), alternando primeiro jogador | >= 60% |
| T2 | Tempo por jogada (p50/p95) | ms por decisão no cliente | p50 <= orçamento do nível; p95 <= 2x p50 |
| T3 | Legalidade | % jogadas inválidas geradas | 0% |
| T4 | Estabilidade WASM vs TS | Divergência de resultado em posições idênticas | <= 5% |
| T5 | Não-regressão | Diferença vs baseline anterior | sem queda > 5 p.p. em winrate |

### 3.2 Métricas específicas por jogo

| Jogo | Métricas específicas observáveis | Critério de sucesso inicial |
|---|---|---|
| Gatos & Cães | Controlo de centro, mobilidade média, bloqueios eficazes | +10% controlo centro vs nível inferior; mobilidade adversária reduzida em >= 8% |
| Dominório | Qualidade de abertura (book hit), gestão de paridade, espaço útil restante | Book hit >= 70% (N4-N5); vantagem de espaço no midgame em >= 60% das vitórias |
| Quelhas (misère) | Erros de última jogada, controlo de runs, conversão em finais isolados | Redução de blunders misère em >= 20% por nível; finais isolados resolvidos >= 75% |
| Produto | Eficiência MCTS (UCT), ganho incremental de score por lance, qualidade de ligação de grupos | Melhoria de score acumulado por nível; top-1 estável em >= 65% das repetições |
| Atari Go | Capturas táticas (atari), salvamento de grupos, gestão de liberdades | Taxa de conversão de atari >= 70% (N3+); auto-atari evitado >= 90% |
| Nex | Progresso de conectividade, defesa de ameaças duplas, virtual connections | Ameaças críticas respondidas >= 80%; caminho de conexão mais curto melhora por nível |

## 4) Benchmarks por Dificuldade (N1-N5)

### 4.1 Orçamento e comportamento esperado

| Nível | Tempo alvo por jogada | Força relativa esperada | Variabilidade intencional |
|---|---:|---|---|
| N1 | 100 ms | introdutório, com erros didáticos | alta |
| N2 | 250 ms | básico consistente | média-alta |
| N3 | 500 ms | intermédio competitivo | média |
| N4 | 1000 ms | avançado, pressão tática | baixa-média |
| N5 | 2000+ ms | quase ótimo no contexto client-side | baixa |

### 4.2 Metas de benchmark por família de jogos

| Família | Jogos | Benchmark N1->N2 | Benchmark N2->N3 | Benchmark N3->N4 | Benchmark N4->N5 |
|---|---|---|---|---|---|
| Busca clássica | Gatos & Cães, Dominório, Quelhas | N2 vence N1 >= 60% | N3 vence N2 >= 58% | N4 vence N3 >= 56% | N5 vence N4 >= 54% |
| MCTS / conexão / captura | Produto, Atari Go, Nex | N2 vence N1 >= 62% | N3 vence N2 >= 60% | N4 vence N3 >= 57% | N5 vence N4 >= 55% |

### 4.3 Benchmarks de robustez (todos os níveis)

| Código | Benchmark | Meta |
|---|---|---|
| B1 | Simetria de arranque | Diferença de winrate entre começar/segundo <= 10 p.p. |
| B2 | Reprodutibilidade por seed | Mesmo seed reproduz mesmo resultado em >= 98% |
| B3 | Queda sob stress (multi-partidas) | Sem timeout crítico; aumento de tempo <= 30% |
| B4 | Consistência de ranking | Ordem N1..N5 preservada em >= 90% dos confrontos |

## 5) Critérios Pedagógicos Observáveis

### 5.1 Checklist de sessão (durante a partida)

| Código | Critério observável | Evidência | Mínimo aceitável |
|---|---|---|---|
| P1 | Feedback curto e acionável | Mensagem aponta 1 razão de jogada | >= 90% das intervenções |
| P2 | Dica não intrusiva | Ajuda surge sem bloquear fluxo | 100% |
| P3 | Linguagem adequada ao ciclo | Vocabulário compatível com nível escolar | >= 95% por revisão manual/amostral |
| P4 | Erro como oportunidade | Após erro, oferece alternativa concreta | >= 80% dos erros relevantes |
| P5 | Transparência mínima | Indica “porque” (ameaça, conexão, captura, paridade) | >= 85% |

### 5.2 Checklist pós-jogo (revisão e aprendizagem)

| Código | Critério observável | Evidência | Mínimo aceitável |
|---|---|---|---|
| P6 | Turning points | Apresenta 1-3 momentos críticos | >= 90% das partidas |
| P7 | Próximo passo claro | Sugere 1 ação treinável para a próxima partida | >= 90% |
| P8 | Progressão percebida | Mostra indicador simples (melhorou/piorou) | >= 85% |
| P9 | Alinhamento com ZPD | Dificuldade não frustra nem trivializa | taxa de sucesso-alvo 40-60% |
| P10 | Sem sobrecarga cognitiva | Explicações curtas (<= 2 frases) e focadas | >= 95% |

## 6) Matriz Integrada (Técnica x Pedagógica)

| Jogo | KPI técnico principal | KPI pedagógico principal | Critério de passagem (inicial) |
|---|---|---|---|
| Gatos & Cães | mobilidade + controlo centro | P1 + P6 | Cumpre T1-T4 e >= 4/5 de P1-P5 |
| Dominório | paridade + espaço útil | P5 + P7 | Cumpre T1-T4 e >= 4/5 de P1-P5 |
| Quelhas | blunder misère + finais | P4 + P9 | Cumpre T1-T4 e >= 4/5 de P1-P5 |
| Produto | score incremental + estabilidade MCTS | P1 + P8 | Cumpre T1-T4 e >= 4/5 de P1-P5 |
| Atari Go | conversão de atari + anti-auto-atari | P5 + P6 | Cumpre T1-T4 e >= 4/5 de P1-P5 |
| Nex | conectividade + resposta a ameaças | P5 + P7 | Cumpre T1-T4 e >= 4/5 de P1-P5 |

## 7) Plano Inicial de Execução (Work Packages)

| WP | Entrega | Conteúdo | Dependências |
|---|---|---|---|
| WP-E1 | Matriz de métricas por jogo | Tabelas técnicas + métricas específicas | logs de partidas |
| WP-E2 | Benchmarks por dificuldade | ladder N1-N5 + robustez | harness AI vs AI |
| WP-E3 | Regressão de motores | comparação WASM vs TS + baseline | snapshots de posições |
| WP-E4 | Checklist pedagógico | rubrica observável sessão/pós-jogo | amostra de sessões |

## 8) Critério de Aceitação da Fase Inicial

Uma configuração de IA por jogo é considerada “aprovada para piloto” quando:
- cumpre benchmarks técnicos T1-T4 e B1-B4 no nível alvo;
- mantém progressão monotónica de dificuldade (N+1 tende a superar N);
- cumpre pelo menos 80% dos critérios pedagógicos P1-P10 em amostra mínima definida.

---

Versão: v0.1 (baseline inicial)  
Próxima revisão sugerida: após 2 ciclos de benchmark completos por jogo.
