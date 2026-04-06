# Autopilot Implementation Plan — treino de campeonato em todos os jogos

## Fase A — Consolidar baseline existente
- Verificar e preservar Dominório + Quelhas já alterados.
- Manter Atari Go como referência de tutor V1 já estável.

## Fase B — Cobertura V1 dos jogos em falta
1. **Gatos & Cães**
   - criar `v1-adapter` + testes;
   - integrar tutor de turno e top moves em `GatosCaesGame.tsx`.
2. **Produto**
   - criar adapter V1 com decodificação de jogadas e heurísticas explicáveis;
   - integrar tutor/top moves no ecrã.
3. **Nex**
   - criar adapter V1 para ações (swap/colocação/substituição);
   - integrar tutor/top moves no ecrã.

## Fase C — Caminhos de evolução
- adicionar um artefacto/guia de treino por jogo com:
  - princípio base;
  - padrões intermédios;
  - objetivo de nível campeonato;
  - erros comuns a evitar.

## Fase D — Verificação
- testes unitários dos novos adapters;
- smoke tests dos adapters existentes;
- build completo sem WASM obrigatório;
- revisão final do estado de cobertura por jogo.
