# Y — validação do tabuleiro da issue #29

Fonte: `docs/research/11crjm-sources/Tabuleiro_Y_regras-2.docx`,
SHA-256 `360be143cd44168cb10b7e071130c9e644b107e4cc1e24af5b1ad656f235c7fc`.
Foi extraída a imagem `word/media/image1.png` (856 × 847). O original não foi alterado.

## Transcrição e conferência

As coordenadas de cada intersecção foram lidas do desenho original, em píxeis,
e registadas em `src/games/y/board.ts`. Os nomes A–M agrupam bandas visuais;
**não** definem linhas de uma grelha regular. As bandas têm, respetivamente,
9, 8, 7, 10, 9, 8, 9, 8, 9, 7, 5, 3 e 1 intersecções: **93 no total**.
A quantidade de peças fornecida no regulamento não foi usada para a contagem.

As **252 ligações** são pares explícitos de intersecções, conferidos seguindo
as linhas da imagem. A amostragem dos traços entre coordenadas auxiliou a
transcrição; não se usa distância entre pontos para gerar o grafo em execução.
Os traços ténues F5–F6 e H4–H5 também estão presentes no original e foram
incluídos. A representação vetorial com identificadores foi comparada
visualmente com o original através do Agent Browser Hub, perfil `research`.

- Superior: A1, A2, A3, A4, A5, A6, A7, A8, A9.
- Esquerdo: A1, D1, E1, G1, I1, J1, K1, L1, M1.
- Direito: A9, D10, E9, G9, I9, J7, K5, L3, M1.

Cada lado contém nove intersecções. A1, A9 e M1 pertencem a dois lados.
Existem 24 intersecções distintas na fronteira. Os três cantos têm grau 3;
as restantes 21 intersecções da fronteira têm grau 4; E3, E7 e I5 têm grau 5;
as restantes 66 têm grau 6. A soma dos graus é 504, consistente com 252 arestas.
Esta conferência estrutural complementa a comparação visual, não a substitui.

## Casos independentes usados nos testes

- E3 liga a D3, D4, E4, F2 e F3; **não** liga a E2, apesar da proximidade.
  Uma partida mantém dois grupos separados nessa zona até colocar D3.
- A1 → B1 → C1 → D3 → E3 → E4 → E5 → E6 → E7 → D8 → C7 → B8 → A9
  une o canto esquerdo ao lado oposto. A vitória ocorre com e sem troca,
  atribuída ao participante que detém azul naquele momento.
- A5, G1 e G9, mesmo acompanhados de A1 e A9, não bastam para uma vitória
  quando os grupos continuam separados.
- A troca conserva a primeira peça, muda a atribuição de cores e passa o turno
  ao primeiro participante. É recusada antes da abertura, depois de uma
  colocação do segundo participante, depois de outra troca e após a vitória.

## Integração limitada à issue

A dependência #26 está presente no commit `6d991d8`, antecessor do ponto de
partida `0a7b6f8`. A issue #26 continuava aberta no GitHub durante a verificação.
O percurso de Y usa `?integracao=1#/y`; a seleção pública anterior mantém-se.
Só estão registadas as capacidades `local` e `progress`.

O perfil deste dispositivo escolhe Jogador 1 ou Jogador 2 antes da abertura.
Essa identidade fica fixa durante a partida; a troca altera apenas as cores.
O comando existente `recordGameCompleted('y', won)` regista a prática e a
vitória desse participante, sem atribuir dados a um segundo perfil inexistente.
Não são criadas tabelas, modos de IA, conteúdos pedagógicos ou adaptadores
online. Os outros sete jogos e os documentos de entrada são preservados.

## Evidência visual

- [Transcrição identificada](../../artifacts/y/board-transcription.png), conferida com a imagem extraída do DOCX.
- [Partida local após a abertura](../../artifacts/y/local-game.png), com identidade, cor, turno, troca e regras.

## Revisão de código

Ponto de comparação: `0a7b6f852c36303ad590df09ac6fcb14357b687c`.
Duas revisões independentes, conforme a skill `code-review`:

### Standards

Sem violações documentadas nem problemas materiais identificados. O progresso
reutiliza o comando da ADR-003, sem persistir tabuleiros ou criar entidades.
A identidade do participante é independente da cor. Os controles são nativos,
têm nomes acessíveis e alvos de 44 px. Não foram identificados smells que
justificassem alterações adicionais. Documentos e anexos de entrada ficam
fora do commit, preservando o estado local anterior.

### Spec

Sem requisitos ausentes, desvios ou expansão de âmbito identificados para #29.
O grafo foi também comparado independentemente com o original na revisão,
incluindo E3/E7/I5 e a ausência de E2–E3. Troca, vitória, perfil, idiomas,
temas e integração limitada correspondem aos critérios da issue. A revisão
dos testes adicionais confirmou recuperação num novo contexto de browser e
importação idempotente.

Resultado: **Standards 0 achados; Spec 0 achados**.

## Gates executados

- Suite completa: **545 testes passaram, zero falhas** (69 ficheiros).
- Idiomas: 1632 mensagens por catálogo; paridade, placeholders, regras e testes passaram.
- TypeScript: **704 diagnósticos antes e depois**, sem novos diagnósticos por ficheiro/código.
- Build completo: os cinco WASM e a aplicação passaram.
- Sala de aula HTTP: passou; [resultado](../../artifacts/y/classroom-http.json).
- Sala de aula UI: passou nos três viewports, incluindo seis jogos anteriores,
  Faísca, Arquivo, Laboratório e Y; [resultado](../../artifacts/y/classroom-ui.json).
  Y cobre os três idiomas, os dois temas, teclado, troca e quatro combinações
  de participante/troca com resultado no perfil por viewport.
- Learner-core e2e: passou; importa o legado, completa Faísca e Y, recupera o
  resultado de Y após troca num novo contexto e repete a importação sem duplicar XP.
- [Y no telemóvel](../../artifacts/y/mobile.png): o tabuleiro pode deslizar
  horizontalmente para conservar alvos táteis de 44 px sem alargar a página.

Os percursos Playwright usaram a sessão `crjm29` do Agent Browser Hub, perfil
`research`, via `HUB_CDP_URL`. Foram executados com Node (`node scripts/classroom-ui-smoke.ts`
e `node scripts/e2e-learner-core-v1.ts`), porque a ligação CDP pelo Bun sofreu
um timeout. O build e o smoke HTTP foram executados com Bun. A sessão do Hub
foi fechada no final. O artefacto de baseline regenerado por `bun test` foi
reposto, sem incluir ruído de latências neste commit.
