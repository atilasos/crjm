# Timeout Playwright/Bun no CDP do Agent Browser Hub

Investigação local de 2026-09-18. Branch `investigation/cdp-bun-node`, worktree
`/home/proteu/.t3/worktrees/crjm/investigate-cdp-bun-node`, base
`f49975c07fe5d1a1d9f0ba054da618a5e01872df`.

## Resultado

Reproduzido sem arrancar a aplicação: `chromium.connectOverCDP()` falha sob
Bun 1.3.14 e funciona sob Node 24.18.0, usando o mesmo Playwright 1.57.0 do
lockfile e o mesmo Chrome 151.0.7922.75 iniciado exclusivamente pelo Hub.
Plataforma Linux x86_64; [ambiente completo](../../artifacts/cdp-runtime/environment.json).

| Experiência | Bun 1.3.14 | Node 24.18.0 |
| --- | --- | --- |
| Playwright, endpoint HTTP, duas sessões × três repetições | 6/6 timeouts | 6/6 sucessos |
| Playwright, endpoint WebSocket direto, mesmas repetições | 6/6 timeouts | 6/6 sucessos |
| Tempos das ligações acima | 3012–3025 ms, limite de 3000 ms | 18–23 ms |
| Playwright com limite aumentado para 30 s | timeout em 30014 ms | — |
| WebSocket nativo + `Browser.getVersion` | sucesso | sucesso |
| `ws` incluído no Playwright, sem agente personalizado | `unexpected-response:101`, timeout | `upgrade:101`, sucesso |
| Mesmo `ws`, com agente Happy Eyeballs do Playwright | mesmo timeout | sucesso |
| `node:http` sozinho, pedido de upgrade WebSocket | `response:101`, sem `upgrade` | `upgrade:101` |

As ligações foram sequenciais, alternando a ordem Bun/Node. A segunda sessão
foi aberta depois de fechar a primeira. Ambas usaram `research`, headless,
e foram fechadas pelo MCP no final. Não foi usado Browser Use para navegar.

Evidência: [matriz inicial](../../artifacts/cdp-runtime/matrix.jsonl),
[sessão nova](../../artifacts/cdp-runtime/fresh-session.jsonl),
[limite de 30 s](../../artifacts/cdp-runtime/bun-30s.jsonl).

## Causa isolada

O cliente HTTP compatível com Node do Bun 1.3.14 entrega o `101 Switching
Protocols` como resposta HTTP normal neste caso. O `ws` incluído no
Playwright espera o evento `upgrade`; recebe `unexpected-response` e não
atinge `open`. O transporte do Playwright fica em `<ws connecting>` até ao
timeout. A descoberta HTTP do endpoint já terminou nessa altura.

A implementação instalada em `playwright-core/lib/server/transport.js`
usa `ws` de `lib/utilsBundle.js`. O seu handler de `unexpected-response`
espera o fecho da resposta para rejeitar; nesta reprodução o prazo de
`connectOverCDP` termina primeiro. O WebSocket nativo do Bun usa outro
percurso e consegue executar `Browser.getVersion`.

Hipóteses testadas, pela ordem anunciada:

1. **Transporte WebSocket sob Bun:** confirmada e reduzida a `node:http`,
   sem importação de Playwright no caso mínimo de transporte.
2. **Descoberta HTTP do endpoint:** excluída nesta reprodução; `ws://`
   direto apresenta o mesmo timeout.
3. **Sessão ou ordem das ligações:** sem suporte nos dados; nova sessão e
   ordem alternada dão o mesmo resultado. Remover o agente Happy Eyeballs
   também não resolve.

Existem relatos equivalentes no upstream, incluindo
[Bun #28450](https://github.com/oven-sh/bun/issues/28450) e
[Bun #32526](https://github.com/oven-sh/bun/issues/32526). São corroborantes;
a conclusão acima resulta das medições locais. Não se extrapola este
resultado para versões posteriores do Bun, outros sistemas ou WSS.

## Reprodução

Instalar as versões fixadas com `bun install --frozen-lockfile`. Abrir uma
sessão exclusiva através do MCP `hub_browser_start`, perfil `research`,
e obter o `cdp_url` com `abh --json session show NOME`. Fechar sempre através
de `hub_browser_close` quando terminar. Se o perfil estiver ocupado, usar
`temporary`, sem contornar o lock. Os scripts não iniciam browsers.

Com `HUB_CDP_URL` definido para o endpoint HTTP dessa sessão:

```bash
bun scripts/debug/cdp-runtime/minimal.mjs
node scripts/debug/cdp-runtime/minimal.mjs
bun scripts/debug/cdp-runtime/http-upgrade.mjs
node scripts/debug/cdp-runtime/http-upgrade.mjs
python3 scripts/debug/cdp-runtime/matrix.py
```

O caso Playwright contém apenas a ligação, medição e desconexão. Resultado
efetivamente observado: Bun `connected:false`, `Timeout 3000ms exceeded`,
exit 1; Node `connected:true`, exit 0. O script `http-upgrade.mjs` reduz a
causa a um pedido `node:http`, conservando o Hub como servidor real.

`matrix.py` regista os exit codes de cada subprocesso; o exit code global
da matriz não é um gate de sucesso. Cada processo tem um limite externo
de oito segundos. Os probes isolados usam três segundos. Os logs não
guardam headers de autenticação, cookies nem URLs de ligação completas.

## Correção aplicada

Os processos Playwright dos comandos
`e2e:learner-core`, `classroom:ui-smoke` e da fase UI de `classroom:smoke`
passam a executar em **Node**. Bun continua a executar a compilação,
o servidor e o smoke HTTP.

O [patch inicial](../../artifacts/cdp-runtime/proposed-package-scripts.patch)
foi aplicado a `package.json` depois da investigação, a pedido do utilizador.
Compila os scripts com `bun build --target=node --packages=external` para
ficheiros `.mjs` diretamente em `.cache/`, executando depois `node`.
Isto resolve os imports TypeScript locais sem extensão e preserva a
expressão existente `new URL('..', import.meta.url)` como raiz do projeto.
O Playwright continua externo e é carregado da instalação fixada no lockfile.

Não aumentar o timeout como correção: o teste de 30 s continua a falhar.
Não substituir internals do Playwright pelo WebSocket nativo: o probe prova
que esse transporte funciona, mas não valida a compatibilidade de uma
substituição com todas as opções do Playwright.

O comando `test:cdp` conserva a regressão no browser real do Hub. Requer
`HUB_CDP_URL` e não lança um browser independente:

```bash
HUB_CDP_URL=http://127.0.0.1:PORTA bun run test:cdp
```

Comparação direta dos runtimes usando o mesmo bundle:

```bash
bun build scripts/debug/cdp-runtime/smoke.ts --target=node --packages=external --outfile=.cache/cdp-smoke.mjs
bun .cache/cdp-smoke.mjs
node .cache/cdp-smoke.mjs
```

O mesmo bundle falhou por timeout sob Bun e passou sob Node: import
TypeScript sem extensão, raiz do projeto, ligação CDP, novo contexto,
criação de página, clique DOM e leitura do resultado. Fecha o contexto e
desliga o cliente em `finally`; o ciclo de vida do browser pertence ao Hub.
[Resultado guardado](../../artifacts/cdp-runtime/proposed-fix.jsonl).

Na investigação inicial, os dois scripts reais foram compilados com esses
argumentos e validados com `node --check`. A implementação mantém as versões
existentes. Os resultados dos gates completos são registados abaixo.

## Validação da implementação

- `bun run test:cdp`: passou com Node 24.18.0. O mesmo caso mínimo voltou
  a falhar com Bun antes da aplicação do patch.
  [Falha reproduzida](../../artifacts/cdp-runtime/implementation-red.jsonl)
  e [regressão verde](../../artifacts/cdp-runtime/implementation-green.txt).
- `HUB_CDP_URL=… bun run classroom:smoke`: passou, incluindo o smoke HTTP
  e as 40 verificações UI completas de desktop, tablet e telemóvel. A fase
  UI executa o mesmo comando de compilação/Node de `classroom:ui-smoke`.
  Nenhuma opção `*_ONLY` foi usada.
  [Log](../../artifacts/cdp-runtime/classroom-smoke.txt).
- `HUB_CDP_URL=… bun run e2e:learner-core`: passou o percurso completo.
  [Log](../../artifacts/cdp-runtime/learner-core.txt).
- `bun run build`: passou, com compilação dos cinco módulos WASM,
  Dominório, Quelhas, Produto, Atari Go e Nex.
  [Log](../../artifacts/cdp-runtime/build.txt).
- `bun test`: 576 testes passaram, zero falhas, em 72 ficheiros.
  [Resumo](../../artifacts/cdp-runtime/tests.txt). O baseline de Atari Go
  regenerado pela suite foi reposto.
- `tsc --noEmit`: os 714 diagnósticos preexistentes permaneceram idênticos
  antes/depois do patch. Nenhum diagnóstico nos novos scripts CDP.
  Após o build WASM, ficam 704: desaparecem 13 imports sem declarações e
  surgem três incompatibilidades nos casts existentes dos workers de
  Atari Go, Nex e Produto, agora verificáveis com os tipos gerados.
  Esses ficheiros não foram alterados. O typecheck global continua a falhar.
  [Comparação](../../artifacts/cdp-runtime/typecheck.json).

Os testes de browser usaram uma sessão exclusiva `research`,
`cdp-node-implementation`, aberta e fechada pelo MCP do Hub. O browser
não foi lançado pelos scripts. As capturas regeneradas pelo smoke foram
repostas para não alterar artefactos de outras funcionalidades.

Revisão independente dos eixos Standards e Spec: zero findings em ambos.
[Relatório](../agents/reviews/cdp-runtime.md).

## Isolamento

O único ficheiro existente alterado é `package.json`, nos comandos de testes.
Os ficheiros novos são os casos de diagnóstico, os resultados e este relatório.
Os bundles temporários estão em `.cache/`, já ignorado pelo repositório.
PRs #40 e #49 preservados; não houve push, novo PR, merge ou deploy.
