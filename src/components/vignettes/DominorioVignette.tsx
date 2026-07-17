// Vignette de assinatura do Dominório — mini-tabuleiro 8×8 com posição legal de meio-jogo.
// Posição (Vertical começa; 3 verticais + 3 horizontais colocados → é a vez do Vertical):
//   Verticais (azul --jogo-dominorio): (1,2)-(2,2), (3,4)-(4,4), (5,1)-(6,1)
//   Horizontais (--tinta-suave):       (4,1)-(4,2), (6,4)-(6,5), (1,5)-(1,6)
//   Lance animado (vertical, azul):    (2,3)-(3,3) — desliza para o tabuleiro no hover/focus do .game-card
// Nenhuma célula sobreposta; todas dentro do tabuleiro; jogo longe do fim (ambos têm jogadas).

interface DominorioVignetteProps {
  animate?: boolean;
  className?: string;
}

const CELULA = 13;
const MARGEM = 8;
const TABULEIRO = CELULA * 8; // 104
const INSET = 1.5;

interface DominoVig {
  linha: number;
  coluna: number;
  orientacao: 'horizontal' | 'vertical';
}

// Dominós colocados (pos1 = célula de topo/esquerda; pos2 implícita pela orientação)
const DOMINOS_VERTICAIS: DominoVig[] = [
  { linha: 1, coluna: 2, orientacao: 'vertical' },
  { linha: 3, coluna: 4, orientacao: 'vertical' },
  { linha: 5, coluna: 1, orientacao: 'vertical' },
];

const DOMINOS_HORIZONTAIS: DominoVig[] = [
  { linha: 4, coluna: 1, orientacao: 'horizontal' },
  { linha: 6, coluna: 4, orientacao: 'horizontal' },
  { linha: 1, coluna: 5, orientacao: 'horizontal' },
];

// Próximo lance (é a vez do Vertical): (2,3)-(3,3)
const LANCE: DominoVig = { linha: 2, coluna: 3, orientacao: 'vertical' };

function DominoPeca({ domino, cor }: { domino: DominoVig; cor: string }) {
  const x = MARGEM + domino.coluna * CELULA + INSET;
  const y = MARGEM + domino.linha * CELULA + INSET;
  const largura = domino.orientacao === 'horizontal' ? CELULA * 2 - INSET * 2 : CELULA - INSET * 2;
  const altura = domino.orientacao === 'vertical' ? CELULA * 2 - INSET * 2 : CELULA - INSET * 2;

  // Hairline a meio da peça, sobre a linha da grelha entre as duas células
  const meio =
    domino.orientacao === 'vertical'
      ? { x1: x + 2, y1: MARGEM + (domino.linha + 1) * CELULA, x2: x + largura - 2, y2: MARGEM + (domino.linha + 1) * CELULA }
      : { x1: MARGEM + (domino.coluna + 1) * CELULA, y1: y + 2, x2: MARGEM + (domino.coluna + 1) * CELULA, y2: y + altura - 2 };

  return (
    <g>
      <rect x={x} y={y} width={largura} height={altura} rx={3} fill={cor} />
      <line {...meio} stroke="var(--papel)" strokeWidth={1} opacity={0.55} />
    </g>
  );
}

export default function DominorioVignette({ animate = true, className }: DominorioVignetteProps) {
  const linhasGrelha = Array.from({ length: 7 }, (_, i) => MARGEM + (i + 1) * CELULA);

  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      className={className ? `dominorio-vignette ${className}` : 'dominorio-vignette'}
    >
      <style>{`
        .dominorio-vignette [data-lance] {
          opacity: 0;
          transform: translateY(-6px);
          transition: opacity 300ms ease, transform 300ms ease;
        }
        .game-card:hover .dominorio-vignette [data-lance],
        .game-card:focus-within .dominorio-vignette [data-lance] {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .dominorio-vignette [data-lance] {
            transition: none;
            transform: none;
          }
        }
      `}</style>

      {/* Tabuleiro: papel quente com traço fino */}
      <rect
        x={MARGEM}
        y={MARGEM}
        width={TABULEIRO}
        height={TABULEIRO}
        rx={4}
        fill="var(--papel)"
        stroke="var(--linha)"
        strokeWidth={1}
      />

      {/* Grelha 8×8 em hairlines */}
      <g stroke="var(--linha)" strokeWidth={0.6}>
        {linhasGrelha.map((pos) => (
          <line key={`v-${pos}`} x1={pos} y1={MARGEM} x2={pos} y2={MARGEM + TABULEIRO} />
        ))}
        {linhasGrelha.map((pos) => (
          <line key={`h-${pos}`} x1={MARGEM} y1={pos} x2={MARGEM + TABULEIRO} y2={pos} />
        ))}
      </g>

      {/* Dominós horizontais (tinta suave) */}
      {DOMINOS_HORIZONTAIS.map((domino) => (
        <DominoPeca key={`h-${domino.linha}-${domino.coluna}`} domino={domino} cor="var(--tinta-suave)" />
      ))}

      {/* Dominós verticais (acento do jogo) */}
      {DOMINOS_VERTICAIS.map((domino) => (
        <DominoPeca key={`v-${domino.linha}-${domino.coluna}`} domino={domino} cor="var(--jogo-dominorio)" />
      ))}

      {/* Lance seguinte do Vertical — surge no hover/focus do cartão */}
      {animate && (
        <g data-lance>
          <DominoPeca domino={LANCE} cor="var(--jogo-dominorio)" />
        </g>
      )}
    </svg>
  );
}
