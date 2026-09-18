# Issue tracker: GitHub

As issues e especificações deste projeto vivem em https://github.com/atilasos/crjm/issues. Usar a CLI `gh` com `--repo atilasos/crjm`.

## Operações

- Publicar uma especificação ou ticket: `gh issue create --repo atilasos/crjm --title "..." --body-file <ficheiro>`.
- Ler uma issue e a discussão: `gh issue view <número> --repo atilasos/crjm --comments`. Para metadados, usar `--json number,title,body,state,labels,comments,url`.
- Listar: `gh issue list --repo atilasos/crjm --state open --json number,title,body,labels`, com os filtros necessários.
- Comentar: `gh issue comment <número> --repo atilasos/crjm --body-file <ficheiro>`.
- Atualizar etiquetas: `gh issue edit <número> --repo atilasos/crjm --add-label "<etiqueta>"` ou `--remove-label "<etiqueta>"`.
- Fechar: `gh issue close <número> --repo atilasos/crjm`.

Preparar corpos multilinha num ficheiro e passá-lo por `--body-file`. Depois de publicar, verificar o corpo, as etiquetas e o URL da issue. Usar o vocabulário de [triagem](triage-labels.md).

## Pull requests as a triage surface

**PRs as a request surface: no.**

As pull requests não entram na fila de pedidos da triagem. Issues e pull requests partilham a numeração no GitHub; resolver o tipo antes de atuar sobre uma referência ambígua.

## Instruções das skills

Quando uma skill disser "publish to the issue tracker", criar uma issue neste repositório. Quando disser "fetch the relevant ticket", ler a issue, as etiquetas e os comentários.
