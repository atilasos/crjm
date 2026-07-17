import type { Segmento } from '../../games/quelhas/types';

// Vinheta de assinatura do Quelhas — mini-tabuleiro SVG com uma posição real.
//
// O tabuleiro real é 10×10 (ver src/games/quelhas/types.ts); cada célula é
// representada por um ponto e cada segmento por uma barra violeta que cobre
// os pontos das células ocupadas.
//
// A posição é legal: segmentos de comprimento ≥ 2, sem sobreposições, e
// alcançável pela sequência alternada (começa o Vertical):
//   1. V  col 2, linhas 1–4   2. H  linha 5, cols 0–2
//   3. V  col 7, linhas 0–2   4. H  linha 8, cols 6–8
//   5. V  col 4, linhas 6–9
// O lance animado (6.º, do Horizontal, que é quem joga a seguir):
//   6. H  linha 2, cols 4–5
// Jogo misère: ambos os jogadores continuam com jogadas disponíveis.

interface QuelhasVignetteProps {
  animate?: boolean;
  className?: string;
}

const TAMANHO = 10;
const MARGEM = 15;
const PASSO = 10;

// Posição estática (5 segmentos já colocados)
const SEGMENTOS: Segmento[] = [
  { inicio: { linha: 1, coluna: 2 }, comprimento: 4, orientacao: 'vertical' },
  { inicio: { linha: 5, coluna: 0 }, comprimento: 3, orientacao: 'horizontal' },
  { inicio: { linha: 0, coluna: 7 }, comprimento: 3, orientacao: 'vertical' },
  { inicio: { linha: 8, coluna: 6 }, comprimento: 3, orientacao: 'horizontal' },
  { inicio: { linha: 6, coluna: 4 }, comprimento: 4, orientacao: 'vertical' },
];

// Lance que surge no hover/focus do .game-card (jogada do Horizontal)
const LANCE: Segmento = {
  inicio: { linha: 2, coluna: 4 },
  comprimento: 2,
  orientacao: 'horizontal',
};

function coordenadas(segmento: Segmento) {
  const x1 = MARGEM + segmento.inicio.coluna * PASSO;
  const y1 = MARGEM + segmento.inicio.linha * PASSO;
  const delta = (segmento.comprimento - 1) * PASSO;
  return segmento.orientacao === 'vertical'
    ? { x1, y1, x2: x1, y2: y1 + delta }
    : { x1, y1, x2: x1 + delta, y2: y1 };
}

function SegmentoLinha({ segmento }: { segmento: Segmento }) {
  const { x1, y1, x2, y2 } = coordenadas(segmento);
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="var(--jogo-quelhas)"
      strokeWidth={5}
      strokeLinecap="round"
      strokeOpacity={segmento.orientacao === 'horizontal' ? 0.65 : 1}
    />
  );
}

export default function QuelhasVignette({ animate = true, className }: QuelhasVignetteProps) {
  const classes = [
    'vinheta-quelhas',
    animate ? 'vinheta-quelhas--animada' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const pontos: { cx: number; cy: number }[] = [];
  for (let linha = 0; linha < TAMANHO; linha++) {
    for (let coluna = 0; coluna < TAMANHO; coluna++) {
      pontos.push({ cx: MARGEM + coluna * PASSO, cy: MARGEM + linha * PASSO });
    }
  }

  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      className={classes}
    >
      <style>{`
        .vinheta-quelhas--animada [data-lance] {
          opacity: 0;
          transform: translateX(-6px);
          transition: opacity 300ms ease, transform 300ms ease;
        }
        .game-card:hover .vinheta-quelhas--animada [data-lance],
        .game-card:focus-within .vinheta-quelhas--animada [data-lance] {
          opacity: 1;
          transform: translateX(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .vinheta-quelhas--animada [data-lance] {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>

      {/* Superfície do tabuleiro: papel quente com hairline */}
      <rect
        x={5.5}
        y={5.5}
        width={109}
        height={109}
        rx={12}
        fill="var(--papel)"
        stroke="var(--linha)"
        strokeWidth={1}
      />

      {/* Grelha de pontos 10×10 (uma célula = um ponto) */}
      <g fill="var(--tinta-suave)" fillOpacity={0.45}>
        {pontos.map(ponto => (
          <circle key={`${ponto.cx}-${ponto.cy}`} cx={ponto.cx} cy={ponto.cy} r={1.1} />
        ))}
      </g>

      {/* Segmentos colocados (Vertical opaco, Horizontal translúcido) */}
      <g>
        {SEGMENTOS.map((segmento, indice) => (
          <SegmentoLinha key={indice} segmento={segmento} />
        ))}
      </g>

      {/* Lance seguinte: desliza para o tabuleiro no hover/focus do cartão */}
      <g data-lance>
        <SegmentoLinha segmento={LANCE} />
      </g>
    </svg>
  );
}
