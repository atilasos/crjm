# Autopilot Spec — treino de campeonato em todos os jogos

## Objetivo do produto
Transformar o CRJM num ambiente de treino suficientemente forte e pedagógico para preparar alunos para o campeonato regional em **todos os jogos**:
- adversário mais fiável e competitivo;
- tutor contextual com alternativas e explicação acionável;
- caminhos de evolução por jogo para orientar estudo e prática.

## Escopo desta execução
1. Preservar e consolidar o trabalho em curso em **Dominório** e **Quelhas**.
2. Estender a camada de tutor/estratégia aos restantes jogos sem quebrar UX/base atual.
3. Produzir um artefacto explícito de progressão/estratégias por jogo.

## Requisitos funcionais
- Cada jogo deve expor pelo menos uma destas melhorias visíveis:
  - tutor de turno com `explainText` + `topMoves`, ou
  - trilho pedagógico/estratégico integrado no produto.
- Para jogos com AI jogável (`gatos-caes`, `produto`, `nex`), criar envelope V1 compatível com o core e integrar no ecrã do jogo.
- Manter `atari-go`, `dominorio` e `quelhas` coerentes com o mesmo modelo mental de treino.
- Fornecer “caminho de evolução” por jogo: foco inicial, padrões intermédios, objetivo competitivo.

## Critérios de aceitação
1. Os seis jogos têm suporte pedagógico explícito.
2. Gatos & Cães, Produto e Nex passam a ter adapter+tutor de turno.
3. Dominório, Quelhas e Atari Go continuam a funcionar e mantêm testes verdes.
4. Existe documentação/trilho de treino cobrindo os seis jogos.
5. `bun test` relevante e `bun run build -- --skip-wasm` passam.

## Decisões
- Reutilizar o contrato `AIResponseV1` como superfície comum.
- Reutilizar padrões visuais leves já presentes (`TutorHintCard`, `TopMovesRail`) em vez de redesign grande.
- Codificar progressão por jogo num artefacto simples e reutilizável.
