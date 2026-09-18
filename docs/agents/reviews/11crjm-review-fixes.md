# Correções da revisão global do 11.º CRJM

Base: `9d8bfb0f0a341407eac769b3e60683e7dadf7c03`.
Requisitos: pedido de correção do utilizador, [#25](https://github.com/atilasos/crjm/issues/25),
US37, e [UI-BLUEPRINT](../UI-BLUEPRINT.md), alvos de toque de pelo menos 48×48 px.

O painel de administração passa a transmitir o idioma solicitado ao espectador.
O atributo `lang` do HTML usa o `Locale` validado pelo servidor, que o iframe
já transmite. A correção abrange PT-PT, inglês e nepalês.

Os seletores, botões e casas clicáveis de Faísca passam a ter pelo menos
48×48 px. Em ecrãs estreitos, o tabuleiro pode deslocar-se horizontalmente
sem alargar a página. A refatoração dos workers continua adiada.

## Testes de regressão

Fronteira acordada: a aplicação em execução, através dos percursos públicos
do professor e do aluno. Não se introduziram interfaces de produção para testes.

1. O percurso de torneio de Y abre o painel numa sessão nova por idioma e
   observa uma partida pelo iframe. Verifica o texto do turno e o idioma
   selecionado. A sessão nova impede que uma preferência guardada esconda
   uma falha de transmissão do idioma. O teste falhou antes da correção e
   passou depois, em PT-PT/EN/NE e nos três tamanhos de ecrã.
2. As medições existentes de Faísca verificam largura e altura de 48 px no
   jogo local e no torneio. O teste falhou com os controlos anteriores de
   44 px. A revisão encontrou também células com 44×44 px a 375 px; a
   correção passou a cobri-las. O percurso local inclui 375 e 320 px,
   verificando as células e a ausência de transbordamento da página.

Evidências em [artifacts/11crjm/review-fixes](../../../artifacts/11crjm/review-fixes):

- `language-red.txt` e `language-green.txt`: falha e passagem da regressão do idioma.
- `controls-red.txt` e `cells-red.json`: dimensões insuficientes antes da correção.
- `controls-browser.json`: 41 controlos medidos a 375 e 320 px, todos com
  pelo menos 48×48 px, sem transbordamento da página.
- [Faísca a 375 px](../../../artifacts/11crjm/review-fixes/faisca-375.png).

## Gates

As execuções que geram ficheiros usam uma cópia temporária da base com os
cinco ficheiros alterados. Os percursos Playwright usam Node ligado por CDP
à sessão `crjm-review-fixes` do Agent Browser Hub, perfil `research`.

- Suite: 576 testes passaram, zero falhas, 24040 asserções em 72 ficheiros.
- Build completo: passou com os cinco WASM; após o ajuste final das células,
  foi reconstruída a aplicação com `--skip-wasm`, reutilizando esses WASM.
- Smoke HTTP: passou, incluindo os oito workers.
- Learner-core e2e: passou.
- Idiomas: 11 testes passaram, 4336 asserções.
- TypeScript: os mesmos 704 diagnósticos da base, sem diferenças após
  normalizar caminhos temporários e posições de linha.
- Sala de aula UI: passaram as 40 verificações; resultados em `classroom-ui.json`
  e `validation.json` nos artefactos. A sessão do browser foi encerrada.

Uma execução de browser foi invalidada por uma navegação manual que interferiu
com uma página do teste. Foi descartada e a verificação final decorreu isoladamente.
Outra execução atingiu o limite de 500 ms ao clicar em «Nova partida» durante
o deslocamento suave da página, no teste de cancelamento de Faísca. Esse teste
passa a ativar os botões por Enter, mantendo o atraso da resposta do worker e
as verificações de respostas antigas, falha e recuperação. Os outros percursos
continuam a verificar os cliques. O teste focado de cancelamento passou nos
três tamanhos de ecrã antes de repetir a suite visual completa.

## Revisão desde a base

As correções estão no worktree, sem novos commits. Por isso, o diff revisto é
`git diff 9d8bfb0f0a341407eac769b3e60683e7dadf7c03 --` limitado aos cinco ficheiros
de implementação/teste, excluindo a alteração preexistente em `CLAUDE.md`.

Standards: zero achados pendentes na revisão independente do diff final.
O achado relativo às células abaixo de 48 px foi corrigido e reavaliado.

Spec: zero achados pendentes na revisão independente do diff final.
A confirmação comportamental inclui os gates registados nos artefactos.

## Preservação

O inventário inicial contém 993 ficheiros versionados ou não versionados.
Apenas os cinco ficheiros de implementação/teste deste pedido foram alterados.
Os documentos locais, `CLAUDE.md`, `CONTEXT.md`, anexos e artefactos anteriores
são comparados por SHA-256 com o inventário inicial. Este relatório e os seus
artefactos são novos. Não houve alterações de issues nem publicação em produção.
