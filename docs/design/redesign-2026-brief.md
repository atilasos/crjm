# Redesign 2026 — Brief de design

**Contexto**: site de treino para o Campeonato Regional de Jogos Matemáticos da Madeira. Audiência dupla: alunos do 1.º Ciclo ao Secundário (6–18 anos) e professores. O trabalho da homepage é um só: pôr um aluno a treinar o seu jogo em menos de dois cliques, com a dignidade de um campeonato a sério.

**Problema do design atual**: "playground de gradientes" — fundo violeta→rosa saturado, cada cartão com gradiente próprio, identidade 100 % emoji (🐱🁓▮), glassmorphism datado, ruidoso e infantil para o Secundário. Tema escuro incompleto (ilhas claras). CTAs redundantes. Header pesado em mobile.

## Conceito

**«O tabuleiro é a identidade.»** Estes jogos têm geometrias fortes e distintas — grelha quadrada, dominós 2×1, segmentos, hexágonos, pedras de Go, ligação hex. A marca nasce daí: cada jogo é representado por um **mini-tabuleiro SVG com uma posição real do jogo**, nas cores de destaque desse jogo. Nada de emojis como identidade; nada de gradientes concorrentes. A página é calma e estruturada; os tabuleiros são o único elemento vivo e colorido — como salas de torneio: paredes sóbrias, tabuleiros ao centro.

## Tokens

### Cor (tema claro)
| Token | Valor | Uso |
|---|---|---|
| `--fundo` | `#F1F4F8` | fundo de página (frio, neutro, tipo pavilhão) |
| `--papel` | `#FDFBF4` | superfícies de tabuleiro e painéis de jogo — o «papel» quente destaca-se do fundo frio |
| `--tinta` | `#1C2B45` | texto principal, marca, botões primários |
| `--tinta-suave` | `#54627A` | texto secundário |
| `--linha` | `#D8DFE9` | hairlines, bordas |
| `--ouro` | `#DDA62E` | campeonato, XP, conquistas — única cor «cerimonial» |

### Acento por jogo (mesma família de saturação/luminosidade — nenhum grita mais que outro)
| Jogo | Token | Valor |
|---|---|---|
| Gatos & Cães | `--jogo-gatos` | `#E06A45` coral |
| Dominório | `--jogo-dominorio` | `#3F7FD9` azul |
| Quelhas | `--jogo-quelhas` | `#7A5FD0` violeta |
| Produto | `--jogo-produto` | `#2E9E74` esmeralda |
| Atari Go | `--jogo-atari` | `#3C4654` grafite (pedras) |
| Nex | `--jogo-nex` | `#C98A2E` âmbar |

### Tema escuro (`data-theme="escuro"`)
`--fundo #101828`, `--papel #F4EFDF` (tabuleiros continuam papel — são o objeto iluminado), painéis de UI `#1A2336`, `--tinta #E8EDF5`, `--tinta-suave #9AA8BF`, `--linha #2A3650`, `--ouro #E3B14C`. **Regra**: nenhum componente pode ter cor clara fixa fora das superfícies de tabuleiro — tudo via tokens. Eliminar as «ilhas claras» atuais (DifficultySelector, TrainingPathCard, AchievementPopup).

### Tipografia (self-hosted, sem CDN — o site é servido localmente e deve funcionar offline)
- **Display**: Bricolage Grotesque (700/800) — títulos, nomes de jogos, hero. Carácter geométrico e caloroso sem ser infantil.
- **Corpo**: Atkinson Hyperlegible (400/700) — desenhada para máxima legibilidade; escolha com justificação real para leitores de 6 anos e para acessibilidade.
- **Números/dados**: tabular nums do Atkinson; sem terceira família.
- Ficheiros woff2 em `src/fonts/`, `@font-face` no CSS, `font-display: swap`. Remover os links Google Fonts do `index.html`.

## Assinatura

Os **mini-tabuleiros vivos** nos seis GameCards: cada um é um SVG com uma posição verdadeira e legal do jogo (idealmente um final interessante — p. ex. no Atari Go uma pedra em atari). No hover/focus, a posição **joga um lance** (uma peça surge/desliza, transição ~300 ms, respeitando `prefers-reduced-motion`). O hero é um mosaico das seis geometrias em traço fino (`--linha`), quase aguarela de fundo, com uma peça de cada acento.

## Layout

- **Header fino**: marca (wordmark «Jogos Matemáticos» em Bricolage) + toggle de tema + sessão. Os 3 widgets de gamificação saem do header global; nas páginas de jogo o header encolhe para uma linha. Progresso/XP vivem no Perfil e num chip compacto único.
- **Homepage**: hero (título, uma frase, CTA primário «Escolher jogo» + chip discreto do campeonato com data) → grelha 1/2/3 dos 6 jogos (vignette SVG, nome, ciclos como chips, botão jogar) → secção única do Campeonato (cartão com `--ouro`) → Laboratório de Estratégias → **um único** bloco do professor no fim → footer sóbrio.
- **Páginas de jogo**: mantêm GameLayout 2/3+1/3; painéis passam a `--papel`/tokens; PlayerInfo e DifficultySelector alinhados ao novo sistema.
- Border-radius consistente: 12 px painéis, 8 px controlos. Sombras: uma só elevação suave (`0 1px 3px rgb(28 43 69 / .08)`), nada de blur pesado.

## O que NÃO mudar
- Estrutura de rotas por hash e nomes de páginas.
- Lógica de jogos, ai-client, workers, gamificação (só apresentação).
- Textos pedagógicos das regras (só a moldura).
- Acessibilidade existente boa (DifficultySelector aria) — preservar e estender: `role="dialog"` + foco no WinnerAnnouncement, focus-visible em tudo.

## Done when
- Zero gradientes de fundo concorrentes; paleta acima aplicada via tokens.
- 6 vignettes SVG substituem emojis nos GameCards (emoji pode ficar como fallback aria-hidden decorativo pequeno, não como identidade).
- Fontes self-hosted; sem pedidos a CDNs externos.
- Tema escuro sem ilhas claras fora de tabuleiros.
- Header ≤ 64 px em mobile nas páginas de jogo; tabuleiro visível above the fold em 390×844.
- `bun test` verde; `bun run build` ok; smoke Playwright dos 6 jogos verde em 3 viewports.
