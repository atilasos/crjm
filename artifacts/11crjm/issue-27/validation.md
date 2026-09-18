# Validação da issue #27 — Arquivo jogável

Base: `6d991d8384c04134f3186690322b2a987838cf54`, implementação de #26 presente neste worktree. A issue #26 permanecia aberta no GitHub; a dependência técnica foi confirmada no código e pelos testes. Referência: https://github.com/atilasos/crjm/issues/27 e especificação local `docs/design/11crjm-spec.md` (#25).

A seleção pública mantém os seis jogos anteriores. `#/arquivo` e `#/puzzles/arquivo` disponibilizam Gatos & Cães e Nex explicitamente. `?integracao=1` permite verificar a separação atual/arquivo sem ativar a edição incompleta. A ativação continua reservada a #38.

- `bun test`: 528 pass, 0 fail, 67 ficheiros; 53,27 s. Artefacto regenerado do baseline Atari Go reposto.
- `bun run scripts/classroom-smoke.ts`: saúde, sessão, runtime e seis workers passaram.
- `HUB_CDP_URL=<sessão research> node scripts/classroom-ui-smoke.ts`: 28 verificações passaram; ver `classroom-ui.json`. Inclui os seis jogos e Laboratório em três viewports, Arquivo em PT/EN/NE e claro/escuro, ligações antigas e regresso, reload/back, seleção de torneios e saída conservando Arquivo/Nex. Num servidor isolado, cria torneios de ambos os jogos, liga dois participantes por código, inicia a partida e verifica os tabuleiros no espectador. Administração também verificada em EN/NE.
- `HUB_CDP_URL=<sessão research> node scripts/e2e-learner-core-v1.ts`: importação legada com progresso em Gatos & Cães/Nex, comandos de progresso, novo contexto de browser e importação repetida passaram.
- `bun run i18n:check`: 1572 mensagens por idioma; paridade, parâmetros e testes passaram.
- `bun run build`: build completo dos cinco WASM e app/espectador passou; repetido após a correção da revisão.
- `bunx tsc --noEmit`: os mesmos 704 diagnósticos anteriores, sem diagnósticos adicionados ou removidos (comparação sem números de linha).
- Após a revisão: 38 testes focados de persistência, Laboratório e contratos/adaptadores passaram, além da repetição completa do percurso visual.

Os scripts Playwright foram executados com Node e ligados por CDP ao Agent Browser Hub; a ligação por Bun expirou neste ambiente. Não foi lançado outro browser. Perfil `research`, sessão `crjm-27`, encerrada. Screenshot: `arquivo.png` (original em `/home/proteu/agent-browser-hub/screenshots/crjm-27-arquivo.png`).

## Revisão Standards

Sem violações documentadas nem smells que justificassem alterações. Catálogo e controlo de seleção partilhados; persistência canónica intacta.

## Revisão Spec

Um problema de estado ao desmontar o formulário de torneio foi corrigido: seleção e jogo escolhido vivem agora no componente pai. A revisão confirmou zero problemas pendentes e o teste de saída/regresso passou. Sem alargamento para as outras issues da edição.

Os documentos e anexos preexistentes foram preservados byte a byte (SHA-256), incluindo CLAUDE.md, CONTEXT.md, configuração local de agentes, especificação, investigação e originais. Mantêm o estado local anterior e não integram este commit.
