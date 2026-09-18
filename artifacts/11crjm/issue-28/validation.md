# Validação da issue #28 — Faísca local

Base: `c28d9bec0a3d929fac6cc6fb0d4545db5941eb22`. Dependência #26 implementada em `6d991d8384c04134f3186690322b2a987838cf54`, ancestral deste worktree; catálogo, seleção por capacidades e rota de integração presentes e contratos testados. A issue #26 permanece aberta no GitHub, mas o bloqueio técnico está resolvido.

Âmbito: https://github.com/atilasos/crjm/issues/28, especificação #25 em `docs/design/11crjm-spec.md` e regulamento original `docs/research/11crjm-sources/Tabuleiro_Faisca_regras-1.docx`. Apenas regras, partida local e progresso. Entrada `/?integracao=1#/faisca`; a seleção pública anterior mantém-se, sem anunciar IA, tutor, aprendizagem ou torneios de Faísca.

## Regras e progresso

A sequência oficial foi reproduzida pelas ações públicas e pela UI: f3 → c3 → c1 → f1 → f2 → c2 → c5 → f5 → f4 → c4 → a4 → a2 → a5 → b5 → b4 → d4 → d1 → e1 → b1 → b2 → b3. Vinte peças colocadas, alvo b3, Azul com reservas 2/3/0 e Vermelho com 1/3/1. Na UI a continuação b3 → a3 → a1 conclui com vitória de Vermelho.

A conclusão usa `recordGameCompleted('faisca', false)`, seguindo os outros modos locais: contabiliza prática (+10 XP), sem atribuir vitória contra computador ao aluno. Não acrescenta dificuldade nem revisão fictícias. O vencedor é mostrado no tabuleiro; o núcleo existente persiste a atividade agregada. Uma nova sessão recupera a partida contabilizada, mantém o progresso dos seis jogos e não duplica XP ao repetir a importação legada. Testes de serviço verificam também isolamento entre alunos.

## Verificações

- `HUB_CDP_URL=<research> node scripts/classroom-ui-smoke.ts`: **31 verificações passaram**, repetidas após as correções finais; ver `classroom-ui.json`. Incluem os seis jogos e Laboratório em computador/tablet/telemóvel, Arquivo e torneios existentes, além de Faísca em PT-PT/EN/NE × claro/escuro, regras, teclado, recusa inválida, turno, casa obrigatória, tabuleiro sem overflow e botões de pelo menos 44 × 44 px.

- TDD nas ações públicas: abertura, casa obrigatória, direções/distâncias, saltos, reservas, recusas sem efeitos, derrota por falta de jogadas/peças e bloqueio após resultado.
- `bun test`: **535 passaram, 0 falharam**, 68 ficheiros, 15 533 asserções, 53,39 s. Baseline Atari Go regenerado reposto para evitar churn.
- `HUB_CDP_URL=<research> node scripts/e2e-learner-core-v1.ts`: passou; partida completa, resultado, novo contexto de browser, progresso preservado e importação idempotente.
- `bun run scripts/classroom-smoke.ts`: saúde, página, sessão anónima, runtime e seis workers passaram.
- `bun run build`: passaram os cinco WASM, app e espectador, incluindo o gate de idiomas (1611 mensagens PT-PT/EN/NE e nove testes de i18n).
- `bunx tsc --noEmit`: **704 diagnósticos anteriores e 704 finais**. Sem diferenças após normalizar números de linha e o alargamento de `GameId` com `faisca`. Não se afirma typecheck limpo.

Os scripts Playwright usam Node ligado por CDP à sessão `crjm-issue28`, criada no Agent Browser Hub com perfil `research`. A execução com Bun voltou a expirar na ligação CDP, limitação já documentada na #27. Nenhum browser foi lançado fora do Hub. Sessão encerrada no final. Captura final inspecionada: `faisca-mobile.png` (telemóvel, tema escuro).

## Revisão Standards

Revisão independente identificou a ausência da classe base `.btn` em Confirmar jogada/Nova partida. Corrigida e coberta pela verificação de área mínima de 44 × 44 px. A inspeção visual identificou contraste insuficiente no painel em tema escuro; corrigido usando as superfícies e tintas do tema. Destinos exteriores mostram agora texto traduzido em vez de coordenadas inválidas. Reavaliação: zero violações documentadas, zero smells relevantes, zero problemas pendentes.

## Revisão Spec

Revisão independente: zero requisitos ausentes/parciais, zero implementações incorretas e zero alargamentos de âmbito na #28.

Os 130 documentos e anexos preexistentes foram verificados por SHA-256 e permanecem byte a byte inalterados. CLAUDE.md, CONTEXT.md, configuração local de agentes, especificação, investigação e originais mantêm o estado local anterior e não integram este commit.
