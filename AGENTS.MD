# Agentes e IAs (CRJM)

Este documento descreve as arquiteturas, tecnologias e estratégias utilizadas nas IAs do projeto **Jogos Matemáticos - CRJM**.

## 🏗️ Arquitetura Geral

As IAs de maior desempenho seguem um padrão comum:
1. **Core em Rust**: Lógica de jogo e algoritmos de busca implementados em Rust para máxima performance.
2. **WebAssembly (WASM)**: Compilação do código Rust para WASM para execução eficiente no browser.
3. **Web Workers**: Execução num Worker dedicado para garantir que o cálculo da IA não bloqueia a interface do utilizador (UI).
4. **Comunicação por Mensagens**: Troca de dados compacta entre o thread principal (TypeScript) e o Worker.

---

## 🎮 Detalhes por Jogo

### 🐱🐶 Gatos & Cães (1.º Ciclo)
- **Estratégia**: Baseada em heurísticas de posicionamento.
- **Implementação**: Atualmente integrada em TypeScript.

### 🁓 Dominório (1.º, 2.º Ciclo)
- **Estratégia**: Motor de busca com avaliação de espaço e paridade.
- **Tecnologia**: Implementado em Rust/WASM para o build de produção.

### ▮ Quelhas (1.º, 2.º, 3.º Ciclo) - *MISÈRE*
- **Algoritmo**: **Principal Variation Search (PVS)** com Alpha-Beta.
- **Especial**: **Island Solver (PNS)** para resolver independentemente partes isoladas do tabuleiro no fim do jogo.
- **Heurísticas**: Focadas em controlo de paridade e "runs" (correntes), essenciais para o modo misère.

### ✖️ Produto (2.º, 3.º Ciclo, Secundário)
- **Algoritmo**: **Monte Carlo Tree Search (MCTS)** com UCT.
- **Especial**: **Minimax Completo** no fim de jogo (quando restam poucas casas vazias).
- **Branching**: Pruning inteligente baseado em peças "ponte" e adjacências críticas.

### ⚫⚪ Atari Go (3.º Ciclo, Secundário)
- **Algoritmo**: **PVS** com aprofundamento iterativo.
- **Tecnologia**: Uso intensivo de **Bitboards** (81 bits) para detecção rápida de grupos e liberdades.
- **Prioridade**: Salvamento de grupos em atari e captura imediata.

### 🔗 Nex (Secundário)
- **Estratégia**: Minimax com heurísticas de conexão (estilo Hex/Nex).
- **Implementação**: Rust/WASM planeado para suporte a níveis de dificuldade avançados.

---

## 🏆 Torneios e Conectividade

O projeto inclui um sistema de torneios online para permitir competições em tempo real.

### Servidor de Torneios
- **Motor de Dupla Eliminação**: Gere automaticamente os brackets de *Winners* e *Losers*, incluindo *Byes* e o *Grand Final Reset*.
- **WebSocket (Bun)**: Comunicação bidirecional e persistente para garantir jogadas rápidas e estado síncrono entre todos os participantes.
- **Painel Admin**: Interface para o organizador gerir inscrições, iniciar o torneio e monitorizar os jogos.

### Protocolo de Comunicação
- **Mensagens JSON**: O sistema utiliza um protocolo baseado em eventos (ex: `join_tournament`, `match_assigned`, `submit_move`).
- **Estados Compartilhados**: O servidor envia o estado completo do torneio e estados parciais de jogo a cada atualização.

### Validação e Integridade
- **Autoridade do Servidor**: Todas as jogadas enviadas pelos clientes são validadas pelo `game-adapter` no servidor antes de serem aplicadas.
- **Prevenção de Batota**: O servidor é a fonte da verdade para o estado do tabuleiro e a vez de cada jogador.

---

## 📊 Níveis de Dificuldade

Os níveis de dificuldade (Geralmente 1 a 5) são geridos através de:
- **Orçamento de Tempo**: Tempo máximo de computação por jogada.
- **Profundidade de Busca**: Limite de jogadas antecipadas.
- **Qualidade de Heurística**: Filtros mais ou menos agressivos na geração de movimentos.

---

## 🛠️ Desenvolvimento e Compilação

Para compilar as IAs em Rust para WASM, o `build.ts` do projeto utiliza:
```bash
# O build automático tenta compilar as crates em /wasm/
bun run build
```
*(Requer Rust + `wasm-bindgen` instalados)*

Para documentação técnica específica de cada implementação, consulta a pasta [`docs/`](./docs/).
