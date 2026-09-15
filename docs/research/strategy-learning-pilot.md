# Piloto: aprender estratégias sem seguir automaticamente a IA

2026-09-15 · branch `learning/strategy-first` · aplicação local preparada em `http://localhost:3410/#/puzzles`.

## Resultado

O tutor dos seis jogos começa sem revelar a jogada. O aluno é convidado a escolher e prever; pede um princípio, ajuda para comparar e, se precisar, um exemplo completo. Coordenadas, marcações, ameaças resolvidas e ranking surgem apenas nessa última etapa.

O Laboratório acrescenta **Escolhe e prevê**: 144 situações de treino, 24 por jogo, com decisão e previsão verificadas no servidor. O perfil distingue prática, resolução sem ajuda em três famílias de situações e sucesso novamente após pelo menos 24 horas. Uma pista ou resposta errada não se transforma em autonomia através de reload/retry.

Esta é uma primeira camada de verificação de **seis fundamentos**, não um currículo completo de todas as estratégias dos jogos. Os limiares de três famílias e 24 horas são opções de desenho do piloto. Não foi medido ainda um efeito na aprendizagem dos alunos.

## O que a investigação mudou

- A auditoria confirmou que H2 já expunha casas/ranking, mas apenas H3 era registado como ajuda. O novo controlo pede ajuda explicitamente e limita em conjunto todas as superfícies da solução.
- O catálogo anterior podia atribuir `used_alone` a um acerto depois de erro com explicação. Passa a prática orientada; a verificação independente tem tentativas próprias persistidas.
- Nove revisões marcadas podiam preencher uma barra de mestria. O perfil passou a mostrar contagens de prática e um bloco separado de evidência; dados anteriores e XP foram preservados.
- Variações cosméticas deixaram de preencher sozinhas a meta. O registo exige contextos e famílias distintos.
- O aluno pode recuperar após precisar de ajuda: a mesma situação só é elegível novamente após 24 horas sem reexposição e não aumenta repetidamente a contagem. Recuperação diferida é distinguida de transferência para situação inédita.
- Em Gatos & Cães, exclusividade não garante segurança: ocupar uma casa pode bloquear uma exclusiva adversária. Os enunciados e o percurso corrigem essa condição.
- Em Nex, três famílias incluem linha com pedra isolada, ramo ligado e caminho com desvio; retirar uma pedra do caminho pode ser seguro no terceiro caso. A previsão testa uma consequência concreta, não apenas repetir a intenção de vencer.

Fontes primárias, resultados e limites: [pesquisa pedagógica](strategy-learning-evidence.md). Diagnóstico do estado anterior e prioridades dos motores: [auditoria técnica](strategy-ai-and-progression-audit.md). Os links/linhas da auditoria descrevem o momento anterior às alterações.

## Verificação técnica

| Verificação | Resultado |
|---|---|
| Suite completa Bun | 516 testes passaram, 12 970 asserções |
| Verificação final das áreas alteradas | 21 testes passaram, 4 245 asserções |
| Build completo | Passou, incluindo cinco motores WASM |
| Learner-core ponta a ponta | Passou, com browser do Agent Browser Hub |
| Classroom smoke | Saúde, sessão, página e seis workers passaram |
| Classroom UI | Seis jogos + Laboratório em desktop, tablet e mobile: 21 percursos passaram |
| Fluxo pedagógico no browser | H0/H1/H2 sem resposta, H3 a pedido, reset por turno, ajuda após reload, feedback persistido e perfil verificados |
| Layout do novo Laboratório | Seis jogos a 1440 e 390 px; texto dentro do cartão, diagrama Nex com scroll próprio |
| Internacionalização | PT-PT/EN/NE; catálogo e textos gerados dos 144 desafios verificados |
| Auditoria reproduzível das situações | 144 verificadas, zero falhas: 96 pelas regras públicas e 48 por cálculo sob as hipóteses declaradas |
| TypeScript | `tsc --noEmit` já falhava no estado inicial; comparação por ficheiro/mensagem não identificou novos diagnósticos |

Os testes novos verificam consequências para o aluno: preservar exposição a uma pista através de reload, bloquear alteração da primeira resposta, exigir escolha **e** previsão certas, isolamento entre utilizadores, progresso nos seis jogos, reteste diferido, recuperação após ajuda e diversidade de famílias. Testam também as duas colocações e cancelamento de Produto.

Os cenários foram auditados contra as regras: bolsas isoladas em Dominório/Quelhas, jogadas de captura no Atari Go e substituições no Nex; produtos e contagens sob as hipóteses declaradas. A auditoria não equivale a provar força estratégica global ou a origem dessas posições numa partida real.

[Verificador independente](../../scripts/verify-strategy-challenges.js) · [resultado por jogo e família](../../artifacts/strategy-learning/challenge-verification.json).

## Como rever

1. Abrir o Laboratório local e experimentar **Escolhe e prevê**.
2. Pedir uma pista, recarregar, responder corretamente: deve aparecer prática sem aumentar a contagem autónoma.
3. Abrir um jogo, verificar que o tabuleiro não mostra a recomendação, e percorrer os três pedidos de ajuda.
4. Jogar ou reiniciar: a próxima decisão começa sem solução revelada.
5. Consultar o perfil: os contadores de partidas/revisões ficam separados da verificação da aprendizagem.

Capturas: [Nex no telemóvel](../../artifacts/strategy-learning/nex-390.png), [Nex no computador](../../artifacts/strategy-learning/nex-1440.png), [perfil](../../artifacts/strategy-learning/profile.png). A captura manual do Hub está em `/home/proteu/agent-browser-hub/screenshots/crjm-strategy-laboratory-review.png`.

Verificação reproduzível, depois de abrir uma sessão `research` no Agent Browser Hub:

```bash
# Usar a porta CDP da sessão aberta e uma app local com base de dados temporária.
bun run scripts/verify-strategy-challenges.js
bun build scripts/strategy-learning-smoke.ts --target=node --packages=external --outfile=.tmp/strategy-learning-smoke.mjs
HUB_CDP_URL=http://127.0.0.1:9330 STRATEGY_TEST_URL=http://127.0.0.1:3410 node .tmp/strategy-learning-smoke.mjs
HUB_CDP_URL=http://127.0.0.1:9330 node scripts/classroom-ui-smoke.ts
HUB_CDP_URL=http://127.0.0.1:9330 node scripts/e2e-learner-core-v1.ts
```

O teste de aprendizagem usa Node para a ligação CDP; a tentativa com Bun terminou por timeout. O browser é iniciado e fechado pelo Hub, sem uma instância paralela independente.

## Decisões de âmbito e continuação

- Foi escolhida uma alteração incremental da camada pedagógica; não foi necessária refatorização completa nem uma issue de refatorização.
- Os motores competitivos foram mantidos. A RTX não foi usada: mais força não corrige a exposição prematura de respostas. A auditoria inclui prioridades de calibração, consequências verificadas por alternativa e utilização futura da GPU para gerar/analisar exercícios.
- A aplicação usa o learner-core já existente; a nova migração é aditiva e foi validada em bases temporárias. A integração e publicação foram autorizadas em 2026-09-15, com cópia de segurança dos dados antes da atualização.
- Os níveis de dificuldade e o ranking heurístico do tutor não são uma medida validada de aprendizagem. As estimativas adaptativas anteriores continuam a exigir calibração própria.
- As famílias são próximas e delimitadas. Mesmo com retenção neste piloto, é necessário observar aplicação em partidas completas, diferentes estratégias e avaliações posteriores; não se presume transferência distante.
- Traduções completas não substituem revisão linguística por falantes, sobretudo no vocabulário escolar em nepalês.
- As alterações anteriores de internacionalização foram preservadas. [Lista das alterações desta tarefa](../../artifacts/strategy-learning/changed-files.json) obtida por comparação com a cópia do estado inicial, não apenas com `HEAD`.

O [workflow de sessões de 30 minutos](../../workflows/treino-estrategico.md) contém o percurso, os critérios, a adaptação às idades confirmadas e o protocolo de observação em turma. A próxima decisão pedagógica deve partir dessa observação.
