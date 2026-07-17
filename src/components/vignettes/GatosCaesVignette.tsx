// Vignette de assinatura do jogo Gatos & Cães — mini-tabuleiro SVG decorativo.
//
// Posição LEGAL (verificada contra src/games/gatos-caes/logic.ts):
// sequência G(3,3) → C(1,1) → G(4,4) → C(6,6) → G(2,4) → C(1,6) → G(4,2).
// - O primeiro gato está numa casa central (3,3) ✓
// - O primeiro cão está fora da zona central ✓
// - Nenhum gato fica ortogonalmente adjacente a um cão ✓
// Ficam 4 gatos e 3 cães: é a vez dos cães. No hover/focus do .game-card,
// o lance C(6,2) surge — um cão que aperta o cerco pelo canto inferior,
// também ele sem adjacência a gatos ✓.

interface GatosCaesVignetteProps {
  animate?: boolean;
  className?: string;
}

const TAMANHO = 8;
const CELULA = 13;
const MARGEM = 8; // tabuleiro ocupa 8..112 num viewBox de 120

// Centro (x, y) de uma casa {linha, coluna}
function centro(linha: number, coluna: number): { x: number; y: number } {
  return {
    x: MARGEM + coluna * CELULA + CELULA / 2,
    y: MARGEM + linha * CELULA + CELULA / 2,
  };
}

// Gatos (jogador1) — acento coral do jogo
const GATOS: Array<[number, number]> = [
  [3, 3],
  [4, 4],
  [2, 4],
  [4, 2],
];

// Cães (jogador2) — tinta
const CAES: Array<[number, number]> = [
  [1, 1],
  [6, 6],
  [1, 6],
];

// Lance de assinatura: cão em (6, 2), revelado no hover
const LANCE_CAO: [number, number] = [6, 2];

// Gato: disco coral com duas orelhas triangulares
function Gato({ linha, coluna }: { linha: number; coluna: number }) {
  const { x, y } = centro(linha, coluna);
  return (
    <g fill="var(--jogo-gatos)">
      <polygon
        points={`${x - 4.4},${y - 1.2} ${x - 3.6},${y - 6.2} ${x - 0.9},${y - 3.6}`}
      />
      <polygon
        points={`${x + 4.4},${y - 1.2} ${x + 3.6},${y - 6.2} ${x + 0.9},${y - 3.6}`}
      />
      <circle cx={x} cy={y} r={4.4} />
    </g>
  );
}

// Cão: quadrado arredondado em tinta — silhueta distinta da do gato
function Cao({ linha, coluna }: { linha: number; coluna: number }) {
  const { x, y } = centro(linha, coluna);
  return (
    <rect
      x={x - 4.2}
      y={y - 4.2}
      width={8.4}
      height={8.4}
      rx={2.6}
      fill="var(--tinta)"
    />
  );
}

export default function GatosCaesVignette({
  animate = true,
  className,
}: GatosCaesVignetteProps) {
  const linhasInternas = Array.from({ length: TAMANHO - 1 }, (_, i) => MARGEM + (i + 1) * CELULA);
  const zonaCentral = {
    x: MARGEM + 3 * CELULA,
    y: MARGEM + 3 * CELULA,
    lado: 2 * CELULA,
  };

  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {animate && (
        <style>{`
          .gcv-lance {
            opacity: 0;
            transform: translateY(5px);
            transition: opacity 300ms ease, transform 300ms ease;
          }
          .game-card:hover .gcv-lance,
          .game-card:focus-within .gcv-lance {
            opacity: 1;
            transform: translateY(0);
          }
          @media (prefers-reduced-motion: reduce) {
            .gcv-lance {
              transition: none;
              transform: none;
            }
          }
        `}</style>
      )}

      {/* Tabuleiro: papel quente com traço fino */}
      <rect
        x={MARGEM}
        y={MARGEM}
        width={TAMANHO * CELULA}
        height={TAMANHO * CELULA}
        rx={4}
        fill="var(--papel)"
        stroke="var(--linha)"
        strokeWidth={1}
      />

      {/* Zona central (casas do primeiro gato), num véu do acento do jogo */}
      <rect
        x={zonaCentral.x}
        y={zonaCentral.y}
        width={zonaCentral.lado}
        height={zonaCentral.lado}
        fill="var(--jogo-gatos)"
        opacity={0.08}
      />

      {/* Grelha 8×8 */}
      <g stroke="var(--linha)" strokeWidth={0.75}>
        {linhasInternas.map(v => (
          <line key={`v${v}`} x1={v} y1={MARGEM} x2={v} y2={MARGEM + TAMANHO * CELULA} />
        ))}
        {linhasInternas.map(h => (
          <line key={`h${h}`} x1={MARGEM} y1={h} x2={MARGEM + TAMANHO * CELULA} y2={h} />
        ))}
      </g>

      {/* Posição: gatos seguram o centro, cães cercam pelos cantos */}
      {GATOS.map(([linha, coluna]) => (
        <Gato key={`g${linha}${coluna}`} linha={linha} coluna={coluna} />
      ))}
      {CAES.map(([linha, coluna]) => (
        <Cao key={`c${linha}${coluna}`} linha={linha} coluna={coluna} />
      ))}

      {/* Lance de assinatura: um cão fecha o cerco no hover do cartão */}
      <g data-lance className={animate ? 'gcv-lance' : undefined}>
        <Cao linha={LANCE_CAO[0]} coluna={LANCE_CAO[1]} />
      </g>
    </svg>
  );
}
