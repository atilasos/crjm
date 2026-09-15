# Internacionalização da experiência do aluno

O site abre em português de Portugal (`pt-PT`). O seletor no cabeçalho permite escolher `Português`, `English` ou `नेपाली` (`ne`), sem deteção automática da língua do navegador. As alternativas destinam-se a alunos da escola em Portugal: conservam os nomes portugueses dos jogos e os ciclos escolares, com explicações traduzidas.

A tradução abrange início, entrada por código, seis jogos, regras, tutor, revisão, exercícios, percursos, perfil, conquistas, missões e campeonato, incluindo observação de partidas. Os painéis administrativos separados mantêm o âmbito anterior, em português.

## Catálogos e revisão

Cada língua tem um catálogo completo em `src/i18n/`: `pt-PT.json`, `en.json` e `ne.json`. **O português também passa pelo catálogo**; já não é uma exceção que apresenta diretamente o texto original do código.

As chaves existentes são os textos canónicos antigos, com espaços normalizados. Funcionam como identificadores estáveis: algumas contêm redação antiga ou um exemplo corrigido. Os **valores** são a redação apresentada. Não voltar a apresentar diretamente uma chave, nem alterar chaves para fazer uma simples correção editorial. Assim, pistas já recebidas e eventos guardados continuam traduzíveis, sem mudar identificadores de exercícios, respostas certas ou progresso.

A revisão inicial de 15 de setembro de 2026 percorreu os três catálogos. Corrigiu, entre outros, os objetivos dos jogos, a impossibilidade de recaptura em Atari Go, as defesas com duas peças no Nex, a contagem da peça de ligação no Produto e condições necessárias nos exercícios de paridade. No pt-PT, uniformizaram-se «confronto», «pontuação», «pista» e «exercício» e simplificaram-se mensagens técnicas. O inglês usa convenções britânicas. O nepalês usa instruções curtas e terminologia consistente.

Esta é uma revisão assistida por IA, não uma validação por um revisor nativo de nepalês. A futura revisão humana pode corrigir os valores do catálogo sem alterar a implementação. O [relatório de pesquisa](research/i18n-editorial-audit.md) documenta os problemas de origem e as fontes usadas.

## Acrescentar textos por defeito

1. Acrescentar a mesma chave e uma tradução completa a **todos** os catálogos. Para novas chaves, usar uma frase clara e completa.
2. Obter `t` e `msg` através de `useTranslation()`. Usar `t('Texto fixo')` para texto fixo e `msg('Texto com {0}', [valor])` para frases variáveis. `msg` aceita apenas chaves do catálogo português e interpola a frase inteira na ordem definida pela tradução.
3. Passar nomes, códigos e outros dados do aluno sem tradução. Se um parâmetro é um rótulo da aplicação, traduzi-lo explicitamente: `msg('{0} — peças por colocar: {1}', [t(cor), quantidade])`.
4. Traduzir também nomes acessíveis, títulos, texto alternativo, campos de formulário, estados vazios, erros e feedback. Manter a linguagem técnica apenas onde serve uma decisão do aluno.
5. Usar `formatNumber`, `formatDuration` e `formatDateTime` de `src/i18n/format.ts`. As unidades e o singular/plural das durações são tratados por `Intl`. Evitar juntar sufixos como `peça` + `s`; preferir frases completas ou rótulos de contagem como «Peças por colocar: {0}».
6. Executar `bun run i18n:check` e verificar o resultado na interface.

A compatibilidade de `t` com mensagens antigas reconhece parâmetros `{0}`, `{1}`, etc. `translatedSlots` em `translate.ts` identifica os parâmetros antigos que contêm rótulos ou outras mensagens da aplicação. Os restantes são copiados literalmente. Para código novo, preferir `msg`: não depende de reconhecer uma frase depois de concatenada. Nomes como «Mestre» e nomes com espaços internos são preservados.

## Acrescentar uma língua

Registar código, nome nativo, direção e convenção numérica em `src/i18n/locale.ts`. Criar o catálogo completo e registá-lo em `catalogs.ts`. O tipo `Locale`, o seletor e a validação da API derivam desse registo único. O contrato tipado e a verificação de compilação exigem um catálogo para cada língua registada.

Verificar a fonte, a ordem das frases, contagens, datas, rótulos acessíveis e dimensões de ecrã. O nepalês usa a fonte local **Noto Sans Devanagari 2.007**, com licença SIL OFL incluída em `src/fonts/`. Não depende de uma CDN nem de tradução em tempo real. As coordenadas, contagens e datas usam algarismos 0–9, coerentes com os tabuleiros usados na escola (`ne-u-nu-latn`). A página define `lang` e `dir` a partir da língua escolhida.

## Estado, preferência e servidor

Traduzir apenas na apresentação. Textos de motores e eventos permanecem canónicos; partidas, seleções, explicações já visíveis e ligações WebSocket não são recriados ao mudar de língua. Os adaptadores guardam `reviewPatternId`: a classificação pedagógica usa identificadores e sinais estruturados, sem procurar palavras em explicações traduzidas.

Sem entrada, `crjm-language` guarda a escolha no navegador. Ao entrar, prevalece a língua da conta identificada pelo código escolar. O servidor de torneios devolve `student.locale` em `POST /api/login` e guarda a preferência em `POST /api/student/locale`, com `{ code, locale }`. Só aceita línguas registadas. Contas antigas sem língua usam `pt-PT`.

A preferência fica no ficheiro de turmas existente. A sessão local conserva uma cópia; sair repõe a preferência de visitante desse navegador. O perfil anónimo do learner-core tem identidade própria e não substitui a conta escolar: o seu tipo aceita as línguas registadas e a API respeita uma língua já guardada, mantendo o padrão português para perfis antigos.

As gravações da preferência são ordenadas. Se falharem, a língua continua a funcionar localmente e surge um botão para tentar novamente. A publicação requer atualizar o site e o servidor de torneios.

## Verificação

```bash
bun run i18n:check
bun test
bun run build
```

A compilação, incluindo `bun run build.ts` diretamente e o CI, executa a verificação antes de produzir o site. Falha se faltarem catálogos ou mensagens, se houver chaves extra ou duplicadas, traduções vazias, parâmetros alterados, texto JSX literal sem tradução ou rótulos acessíveis literais sem tradução. Os testes verificam ainda a cobertura de exercícios, percursos, cartões, conquistas e missões. O verificador estático não consegue deduzir todos os textos calculados dinamicamente: adicionar os respetivos casos de cobertura e validar no navegador ao criar novos fornecedores de texto.

Para a interface, abrir uma sessão pelo Agent Browser Hub e obter o seu `cdp_url` com `abh --json session show NOME`:

```bash
HUB_CDP_URL=http://127.0.0.1:PORTA node scripts/i18n-ui-smoke.ts
HUB_CDP_URL=http://127.0.0.1:PORTA node scripts/classroom-ui-smoke.ts
HUB_CDP_URL=http://127.0.0.1:PORTA node scripts/e2e-learner-core-v1.ts
```

Os testes usam servidores e dados temporários. Verificam seis jogos em 1440, 1024 e 390 px, mudanças PT/EN/NE sem perder peças, pistas e respostas, fonte devanágari, ausência de transbordo horizontal, persistência do nepalês entre navegadores, recuperação de falha de gravação e manutenção da ligação de campeonato. Guardam textos e imagens em `artifacts/i18n/`. Fechar a sessão Hub no fim.
