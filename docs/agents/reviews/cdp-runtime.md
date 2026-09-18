# Revisão da execução Playwright/CDP com Node

Base: `f49975c07fe5d1a1d9f0ba054da618a5e01872df`.
Branch: `investigation/cdp-bun-node`.
Pedido: aplicar a correção proposta, validar os smokes completos, rever o
diff e fazer commit local. Preservar os PRs #40 e #49; sem push, merge ou deploy.

Revisão de trabalho staged com `git diff --cached f49975c --`, por dois
agentes independentes, conforme a skill `code-review`. Especificação e
evidência em [playwright-bun-cdp-timeout.md](../../research/playwright-bun-cdp-timeout.md).

## Standards

Nenhuma violação documentada encontrada. Fontes lidas: `CLAUDE.md`,
`CONTEXT.md` e `docs/agents/domain.md`. A alteração respeita o vocabulário e
não modifica decisões de domínio. Os probes recebem o endpoint do Hub,
não lançam browsers e distinguem a desconexão do cliente do encerramento
da sessão pelo Hub.

Nenhum smell acionável encontrado. A repetição dos pequenos probes permite
reproduzir cada camada isoladamente; extrair uma biblioteca comum
dificultaria a reprodução mínima. `verify-page.ts` verifica o import
TypeScript sem extensão após bundling.

Antes do commit aplicam-se os gates de `CLAUDE.md`: suite completa,
`classroom:smoke`, `e2e:learner-core` e build completo. As capturas e o
baseline regenerados pelos testes ficam fora do commit.

## Spec

Nenhum desvio encontrado. `package.json` corresponde ao patch proposto:
compila os scripts Playwright com Bun e executa-os com Node; mantém o
servidor e o smoke HTTP em Bun. O bundle em `.cache/` preserva a resolução
da raiz do projeto.

O novo `test:cdp` verifica a ligação ao Hub, imports TypeScript, criação de
contexto/página e clique DOM. Os probes e resultados guardados sustentam a
comparação Bun/Node pedida na investigação. Não foram identificadas
alterações funcionais alheias ao pedido.

A conclusão depende dos resultados finais dos smokes completos. O commit
local deve ocorrer depois dos gates e da revisão.

Resultado das revisões: Standards 0 findings; Spec 0 findings.

## Verificação final

O agente principal confirmou os gates depois das revisões:

- `test:cdp`: passou no browser do Hub, com Node.
- `classroom:smoke`: smoke HTTP e 40 verificações UI passaram.
- `e2e:learner-core`: percurso completo passou.
- `bun run build`: passou, incluindo os cinco módulos WASM.
- `bun test`: 576 passaram, zero falhas, em 72 ficheiros.
- Typecheck: 714 diagnósticos preexistentes, idênticos antes/depois do patch.
  O build WASM reduz o total para 704, ao gerar declarações: resolve 13
  imports e expõe três casts incompatíveis nos workers existentes.
  Nenhum diagnóstico nos novos scripts CDP; o typecheck global não passa.

[Resultados](../../../artifacts/cdp-runtime/validation.json).
A sessão do Hub foi fechada e os artefactos regenerados de outras
funcionalidades foram repostos. O commit inclui a correção de comandos,
a reprodução e a evidência de validação.
