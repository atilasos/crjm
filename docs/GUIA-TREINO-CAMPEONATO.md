# Guia de treino para o campeonato regional

Este guia resume o foco de treino mais útil para cada jogo no CRJM.

## Arranque local para uma aula

```bash
bun install
bun run classroom:smoke
bun run start
```

Depois abre `http://127.0.0.1:3000`. Para outros dispositivos na mesma rede, usa o endereço IP local do computador que executa o servidor e confirma primeiro as regras da firewall da escola.

O perfil do aluno é anónimo: não é necessário introduzir nome real. O progresso no servidor fica associado a um cookie assinado do browser; limpar cookies ou mudar de browser cria outro perfil. A versão estática continua a funcionar com progresso local, mas não partilha esse progresso entre dispositivos.

### Ritmo recomendado

1. 2–3 minutos de aquecimento/regras ou um puzzle do Laboratório de Estratégias.
2. Uma partida em N1–N3, conforme a experiência.
3. Revisão curta de 1–3 momentos e desbloqueio de um cartão de padrão.
4. Repetição do mesmo padrão ou nova partida; aceitar mudanças adaptativas apenas entre partidas.

O laboratório oferece três desafios por jogo. A primeira resposta certa atribui XP uma única vez; usar a pista fica registado apenas como evidência pedagógica, sem recolher texto livre do aluno.

Antes da aula, usa também [CLASSROOM-CHECKLIST.md](./CLASSROOM-CHECKLIST.md).

## Gatos & Cães
- **Objetivo-chave:** ganhar a luta pela mobilidade.
- **Treino base:** dominar as regras das primeiras jogadas e o valor do centro.
- **Treino intermédio:** comparar sempre quantas casas legais tu tens e quantas entregas ao adversário.
- **Treino campeonato:** criar finais em que o rival fica sem resposta no turno seguinte.

## Dominório
- **Objetivo-chave:** controlar o espaço útil e planear o fim de jogo.
- **Treino base:** identificar depressa se queres preservar opções verticais ou horizontais.
- **Treino intermédio:** ler finais curtos e reconhecer posições instáveis.
- **Treino campeonato:** jogar para tirar mobilidade ao adversário sem destruir a tua.

## Quelhas
- **Objetivo-chave:** gerir o misère e evitar a última jogada.
- **Treino base:** preferir segmentos curtos que fecham pouco espaço.
- **Treino intermédio:** comparar saídas restantes depois de cada segmento.
- **Treino campeonato:** entrar nos finais com plano explícito para obrigar o adversário a jogar por último.

## Produto
- **Objetivo-chave:** maximizar o produto de dois grupos fortes.
- **Treino base:** criar cedo duas zonas úteis em vez de um único grupo.
- **Treino intermédio:** usar a cor adversária para sabotar o produto rival.
- **Treino campeonato:** equilibrar os dois maiores grupos e destruir a segunda cadeia do adversário.

## Atari Go
- **Objetivo-chave:** contar liberdades antes de atacar.
- **Treino base:** defender grupos em atari antes de procurar captura.
- **Treino intermédio:** escolher jogadas que aumentam liberdades tuas e reduzem as do rival.
- **Treino campeonato:** reconhecer capturas forçadas e sequências locais de pressão.

## Nex
- **Objetivo-chave:** reduzir a tua distância de ligação e bloquear a rota rival com a neutra.
- **Treino base:** saber sempre que margens a tua cor quer ligar.
- **Treino intermédio:** usar a regra da torta com critério e distinguir ligação própria de bloqueio neutro.
- **Treino campeonato:** decidir bem entre colocação e substituição para fechar caminhos vencedores.
