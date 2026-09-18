# Domain docs

Este repositório tem um único contexto de domínio.

## Antes de explorar uma área

1. Ler `CONTEXT.md` na raiz e usar o seu vocabulário nas especificações, testes e propostas.
2. Ler os ADRs relevantes em `docs/adr/`, quando existirem.
3. Consultar também os ADRs existentes em `docs/agents/reviews/crjm-vnext-adr-*.md`. Mantêm-se nessa localização; a ADR-003 regista o núcleo de progresso centrado no aluno.

Se um documento ainda não existir, continuar. A skill `domain-modeling` cria documentos quando há termos resolvidos ou decisões que justificam um ADR.

## Organização

- `CONTEXT.md`: glossário do domínio, sem detalhes de implementação.
- `docs/adr/`: localização dos novos ADRs. Criar apenas quando houver uma decisão a registar.
- `docs/agents/reviews/crjm-vnext-adr-*.md`: ADRs já existentes, preservados.

Não existe divisão em contextos nem necessidade de um `CONTEXT-MAP.md` para a estrutura atual.

## Uso e conflitos

Usar os termos definidos no glossário, respeitando as distinções entre jogo, partida, edição e arquivo jogável. Quando faltar um termo necessário, assinalar a lacuna para `domain-modeling`.

Quando uma proposta contrariar um ADR, identificar a decisão e explicar o motivo antes de a substituir. Se o código observado divergir de um ADR, registar a diferença; não apresentar uma intenção antiga como comportamento já implementado.
