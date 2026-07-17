// Vignette de assinatura do Atari Go — mini-tabuleiro 9×9 com uma posição real.
//
// Posição (legal, validada com src/games/atari-go/logic.ts; pretas jogaram primeiro,
// lances alternados, sem capturas):
//   Pretas:  (3,4), (2,5), (3,6), (6,2)
//   Brancas: (3,5), (5,3), (5,4), (1,3)
// A branca de (3,5) está em atari — a sua única liberdade é (4,5).
// No hover/focus do .game-card, as pretas jogam o lance de captura em (4,5)
// e a pedra capturada esbate-se (transição ~300 ms, sem JS).

interface AtariGoVignetteProps {
  animate?: boolean;
  className?: string;
}

const TAMANHO = 9;
const MARGEM = 12;
const PASSO = 12; // (120 − 2×12) / (9 − 1)
const RAIO_PEDRA = 5;

// Converte coordenadas de tabuleiro (linha, coluna) em coordenadas SVG
const px = (coluna: number) => MARGEM + coluna * PASSO;
const py = (linha: number) => MARGEM + linha * PASSO;

// Pedras da posição estática, em coordenadas { linha, coluna }
const PEDRAS_PRETAS = [
  { linha: 2, coluna: 5 },
  { linha: 3, coluna: 4 },
  { linha: 3, coluna: 6 },
  { linha: 6, coluna: 2 },
];

const PEDRAS_BRANCAS = [
  { linha: 1, coluna: 3 },
  { linha: 5, coluna: 3 },
  { linha: 5, coluna: 4 },
];

// Branca em atari (1 liberdade: 4,5) e lance de captura das pretas
const PEDRA_EM_ATARI = { linha: 3, coluna: 5 };
const LANCE_CAPTURA = { linha: 4, coluna: 5 };

// Pontos hoshi do tabuleiro 9×9
const HOSHI = [
  { linha: 2, coluna: 2 },
  { linha: 2, coluna: 6 },
  { linha: 4, coluna: 4 },
  { linha: 6, coluna: 2 },
  { linha: 6, coluna: 6 },
];

export default function AtariGoVignette({ animate = true, className }: AtariGoVignetteProps) {
  const indices = Array.from({ length: TAMANHO }, (_, i) => i);

  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      className={['atari-go-vignette', className].filter(Boolean).join(' ')}
    >
      {animate && (
        <style>{`
          .atari-go-vignette [data-lance] {
            opacity: 0;
            transform: translateY(-4px) scale(0.6);
            transform-box: fill-box;
            transform-origin: center;
            transition: opacity 300ms ease, transform 300ms ease;
          }
          .atari-go-vignette [data-atari] {
            transition: opacity 300ms ease;
          }
          .game-card:hover .atari-go-vignette [data-lance],
          .game-card:focus-within .atari-go-vignette [data-lance] {
            opacity: 1;
            transform: none;
          }
          .game-card:hover .atari-go-vignette [data-atari],
          .game-card:focus-within .atari-go-vignette [data-atari] {
            opacity: 0.35;
          }
          @media (prefers-reduced-motion: reduce) {
            .atari-go-vignette [data-lance] {
              transform: none;
              transition: none;
            }
            .atari-go-vignette [data-atari] {
              transition: none;
            }
          }
        `}</style>
      )}

      {/* Superfície do tabuleiro */}
      <rect
        x="2"
        y="2"
        width="116"
        height="116"
        rx="6"
        fill="var(--papel)"
        stroke="var(--linha)"
        strokeWidth="1"
      />

      {/* Grelha 9×9 — joga-se nas interseções */}
      <g stroke="var(--tinta-suave)" strokeWidth="0.6" opacity="0.5">
        {indices.map(i => (
          <line key={`h${i}`} x1={px(0)} y1={py(i)} x2={px(TAMANHO - 1)} y2={py(i)} />
        ))}
        {indices.map(i => (
          <line key={`v${i}`} x1={px(i)} y1={py(0)} x2={px(i)} y2={py(TAMANHO - 1)} />
        ))}
      </g>

      {/* Pontos hoshi */}
      <g fill="var(--tinta-suave)" opacity="0.5">
        {HOSHI.map(p => (
          <circle key={`hoshi-${p.linha}-${p.coluna}`} cx={px(p.coluna)} cy={py(p.linha)} r="1.3" />
        ))}
      </g>

      {/* Pedras pretas (grafite) */}
      <g fill="var(--jogo-atari)">
        {PEDRAS_PRETAS.map(p => (
          <circle key={`preta-${p.linha}-${p.coluna}`} cx={px(p.coluna)} cy={py(p.linha)} r={RAIO_PEDRA} />
        ))}
      </g>

      {/* Pedras brancas */}
      <g fill="var(--papel)" stroke="var(--jogo-atari)" strokeWidth="1">
        {PEDRAS_BRANCAS.map(p => (
          <circle key={`branca-${p.linha}-${p.coluna}`} cx={px(p.coluna)} cy={py(p.linha)} r={RAIO_PEDRA} />
        ))}
        {/* Branca em atari — única liberdade em (4,5) */}
        <circle
          data-atari=""
          cx={px(PEDRA_EM_ATARI.coluna)}
          cy={py(PEDRA_EM_ATARI.linha)}
          r={RAIO_PEDRA}
        />
      </g>

      {/* Lance de assinatura: pretas capturam ao ocupar a última liberdade */}
      {animate && (
        <g data-lance="">
          <circle
            cx={px(LANCE_CAPTURA.coluna)}
            cy={py(LANCE_CAPTURA.linha)}
            r={RAIO_PEDRA}
            fill="var(--jogo-atari)"
          />
        </g>
      )}
    </svg>
  );
}
