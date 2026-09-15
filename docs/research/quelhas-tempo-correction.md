# Quelhas: contar turnos e controlar quem joga por último

## Problema reproduzido

Relato do professor: a IA escolhia quase sempre segmentos de duas casas, e os alunos conseguiam deixá-la com a última jogada, mesmo nos níveis altos.

A posição de regressão tem uma faixa vertical de dez casas e uma horizontal independente de oito. Vertical joga primeiro. A vertical tem capacidade para **1–5 turnos** e a horizontal para **1–4**. A vertical ganha ao esgotar a sua faixa: horizontal ainda tem de jogar e a seguir vertical ganha por não ter jogada.

Antes da correção:

- `calcularIntervalosJogadas` devolvia 45 e 28: contava colocações sobrepostas, não turnos. Esta função pública tinha testes que aceitavam esse erro; a avaliação interna já contava faixas, mas interpretava-as mal.
- Os motores TS e WASM, a profundidade 1, escolhiam um segmento de seis casas e desperdiçavam a vitória. A utilidade da avaliação estava invertida, incluindo as posições ganhas.
- A profundidade 2 encontrava a vitória com oito casas. O ajuste de dificuldade do N4 substituía-a por sete casas, perdendo.
- O solver de finais recusava esta posição: havia 45 colocações verticais, acima do seu limite de 16, apesar de haver poucos turnos efetivos.
- Cancelar o tutor rejeitava a promessa sem interromper o worker partilhado. Dois pedidos de 1000 ms demoravam aproximadamente 1002 e 2002 ms a responder. O segundo podia ultrapassar o prazo da interface, que então jogava o primeiro segmento legal.
- No WASM, uma repetição da pesquisa com uma janela de avaliação maior atualizava a pontuação mas conservava a jogada da pesquisa anterior. Uma pesquisa interrompida também podia guardar informação incompleta na cache.

## O significado das contagens

As contagens são recalculadas para os dois jogadores em cada posição avaliada.

| Medida | Cálculo e significado |
| --- | --- |
| Mínimo atual | Uma jogada por faixa contínua de pelo menos duas casas, consumindo-a de uma vez. |
| Máximo atual | Soma de `floor(comprimento / 2)` por faixa, usando segmentos de duas casas. |
| Faixas exclusivas | Nenhuma casa pode ser ocupada por uma jogada do adversário. |
| Mínimo protegido | Número de faixas com pelo menos um par adjacente de casas que o adversário nunca pode ocupar. Cada uma exige pelo menos uma jogada própria para desaparecer. |

Mínimo/máximo atuais descrevem a capacidade das faixas **sem intervenção do adversário**. Um corte pode dividir uma faixa ou eliminar opções; por isso o mínimo atual não é apresentado como um número garantido de turnos da partida. O máximo continua a limitar o número de jogadas próprias possíveis. O mínimo protegido é um limite inferior sobre o trabalho que só o próprio jogador pode fazer, enquanto a partida continuar.

### Resultados que as contagens permitem provar

Para A a jogar e B a seguir:

- Sem jogadas de A: A ganha. Se só B ficou sem jogadas, A perde ao jogar.
- Sem qualquer interseção entre faixas: A ganha quando `minA <= minB`. Ambos podem consumir uma faixa por turno. A igualdade favorece quem começa.
- Mesmo com interseções: `maxA <= protegidoB` garante a vitória de A; `maxB < protegidoA` garante a vitória de B.
- Nos restantes casos, as diferenças de contagem orientam a pesquisa. Não são uma prova baseada na paridade do total.

Estas condições resultam das regras e foram verificadas contra um solucionador independente em todas as 512 configurações de um canto 3×3, para ambos os jogadores. O teste não demonstra jogo perfeito no tabuleiro 10×10.

## Alterações

- Avaliação coerente com misère em TS e Rust/WASM; desaparece o prémio automático por segmentos curtos.
- N3–N5 conservam a jogada calculada. N1/N2 mantêm seleção simplificada e todos continuam com os seus orçamentos de pesquisa.
- Finais selecionados pela capacidade em turnos; contagens protegidas e faixas independentes permitem encurtar a prova. O solver tem prazo além do limite de nós. Uma tentativa de prova incompleta devolve o controlo à pesquisa normal.
- Pesquisa completa após falha da janela devolve a jogada correspondente à pontuação. Resultados interrompidos não ficam guardados como pesquisa completa. Existe uma jogada legal avaliada mesmo antes de terminar a primeira profundidade.
- Tutor e adversário têm workers distintos; cancelar interrompe o worker ocupado. A recuperação da interface usa uma pesquisa curta em vez do primeiro segmento da lista.
- A decisão de trocar papéis usa a avaliação corrigida e respeita o turno consumido pela troca.
- N6 resolve estes finais antes de consultar a rede e envia a orientação efetiva após uma troca; cancelar também interrompe o pedido HTTP.
- O tutor usa a pesquisa sem erros artificiais do nível fácil, explica os intervalos após a jogada e só classifica a jogada efetivamente pesquisada. As antigas alternativas por preferência geométrica foram retiradas. As pistas continuam graduais.

## Comparação antes/depois

Artefacto: [arena.json](../../artifacts/quelhas-tempo/arena.json).

- 60 partidas, 30 aberturas emparelhadas de quatro lances, seed **20260915**.
- N5 WASM e solver de finais de cada versão; **200 ms por jogada para ambos**; execução serializada, sem treino GPU.
- Resultado: **55–5 a favor da correção** (91,7%). Zero jogadas ilegais.
- Segmentos de duas casas: 790/889 (88,9%) antes; 610/864 (70,6%) depois. Os comprimentos são escolhidos pelas consequências; não há quota de segmentos longos.
- Maior tempo por jogada: 201,2 ms antes e 203,9 ms depois. Nenhuma ultrapassagem de orçamento +100 ms.

Uma segunda execução, com a compilação final, **50 partidas**, seed **20260916** e **100 ms por jogada**, terminou **43–7** (86%) a favor da correção. Zero jogadas ilegais ou ultrapassagens de orçamento +100 ms; máximo de 105,8 ms para o novo motor. [arena-final.json](../../artifacts/quelhas-tempo/arena-final.json) identifica o WASM final por SHA-256.

Estes ensaios medem melhoria perante o motor anterior com orçamento igual. Não medem aprendizagem dos alunos, força absoluta ou equilíbrio entre todos os níveis, nem substituem um ensaio de aula com o orçamento habitual de 2 s do N5.

### Reprodução

Base de código inicial: `65b494945cc054e1ca9d74082553f4c7b4168e2c`. Os motores não tinham alterações locais antes deste trabalho. A cópia original está guardada em [baseline.tar.gz](../../artifacts/quelhas-tempo/baseline.tar.gz), incluindo o WASM utilizado; os hashes dos dois WASM estão no JSON.

```bash
mkdir -p /tmp/crjm-quelhas-before
tar -xzf artifacts/quelhas-tempo/baseline.tar.gz -C /tmp/crjm-quelhas-before
bun test src/games/quelhas/ai
cargo test --manifest-path wasm/quelhas/Cargo.toml -p quelhas-ai
bun run build
bun scripts/quelhas-tempo-arena.ts --baseline /tmp/crjm-quelhas-before --games 60 --budget 200 --seed 20260915
```

O diretório `--baseline` tem de conter o motor TS original `engine.ts`, `quelhas_wasm.js` e `quelhas_wasm_bg.wasm`. Para repetir noutra máquina, compilar o commit inicial numa cópia isolada e guardar esses três ficheiros antes de compilar a versão corrigida.

## Validação da aplicação

- Suite completa final: **525 testes, 15 398 asserções, sem falhas**.
- Build completo com os cinco WASM e verificação i18n: passou.
- Classroom smoke: API, seis workers e 21 verificações visuais (seis jogos e Laboratório em desktop, tablet e telemóvel). Learner-core e2e: passou.
- Rust: três testes, incluindo prova/decisão em todas as 1024 combinações de posição e jogador no canto 3×3 e fallback legal com prazo esgotado.
- Browser real pelo Agent Browser Hub: N1–N5 executaram WASM nos orçamentos de 100/250/500/1000/2000 ms; N6 recuperou de uma resposta neural inválida. A troca enviou orientação 1 e depois 2 ao servidor simulado, e o worker jogou na orientação horizontal após a troca.
- Dois workers, H0/H1/H2 sem solução visível e H3 com contagens apenas a pedido. As contagens não geram automaticamente a etiqueta «Linha forçada».
- Ecrã de 390 px sem transbordo, incluindo o indicador do jogador horizontal ativo. O percurso do Quelhas também deixou de recomendar segmentos curtos por princípio.
- `tsc --noEmit`: sem novas categorias de erro face ao estado anterior desta branch; 17 categorias antigas resolvidas. O repositório ainda tem erros anteriores, pelo que a verificação global de tipos não passa.
- Artefactos: [browser.json](../../artifacts/quelhas-tempo/browser.json) e [captura móvel](../../artifacts/quelhas-tempo/tutor-mobile.png).

Integrado em `main` e publicado em 2026-09-15, após autorização do professor. Ver [registo da publicação e verificação em produção](../deployment/2026-09-15-strategy-learning.md).
