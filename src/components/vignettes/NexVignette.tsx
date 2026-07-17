// Vignette de assinatura do jogo Nex — mini-tabuleiro SVG com uma posição real.
//
// Geometria: a mesma projeção do NexGame — losango horizontal 11×11 com
// screen_x = (x + y) · 1.5·r e screen_y = (y − x) · (√3/2)·r, hexágonos flat-top.
// Cantos: (0,0) à esquerda (W), (10,0) no topo (N), (10,10) à direita (E),
// (0,10) em baixo (S). Margens: âmbar liga NW (y=0) a SE (y=10); as margens
// cinzentas (x=0 e x=10) pertencem ao adversário.
//
// Posição LEGAL (verificada contra src/games/nex/logic.ts): 8 turnos de
// colocação alternados — cada turno coloca 1 peça própria + 1 neutra:
//   1. Pretas (âmbar) (6,0) + neutra (9,2)     2. Brancas (2,5) + neutra (2,2)
//   3. Pretas (6,1) + neutra (8,4)             4. Brancas (3,5) + neutra (1,7)
//   5. Pretas (5,2) + neutra (7,7)             6. Brancas (4,5) + neutra (3,8)
//   7. Pretas (5,3) + neutra (8,8)             8. Brancas (5,5) + neutra (6,9)
// Resultado: 4 âmbar, 4 brancas, 8 neutras — vez das Pretas, ninguém ligou
// as suas margens. O lance de hover é o 9.º turno, também legal:
//   9. Pretas (4,4) + neutra (8,6) — a peça (4,4) é vizinha diagonal (−1,+1)
//      de (5,3) e prolonga o caminho âmbar em direção à margem SE.

interface NexVignetteProps {
  animate?: boolean;
  className?: string;
}

const LADO = 11;
const RAIO = 3.4; // circunraio de cada hexágono (vizinhos a √3·RAIO)
const PASSO_X = 1.5 * RAIO;
const PASSO_Y = (Math.sqrt(3) / 2) * RAIO;
const OFFSET_X = 60 - 15 * RAIO; // x+y ∈ [0,20] → centro do losango em 60
const OFFSET_Y = 60;
const RAIO_PECA = RAIO * 0.68;

interface Ponto {
  cx: number;
  cy: number;
}

function centro(x: number, y: number): Ponto {
  return {
    cx: OFFSET_X + (x + y) * PASSO_X,
    cy: OFFSET_Y + (y - x) * PASSO_Y,
  };
}

// Hexágono flat-top (vértices a 0°, 60°, …), igual ao hexPoints do NexGame
function hexPontos(x: number, y: number): string {
  const { cx, cy } = centro(x, y);
  const pontos: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angulo = (Math.PI / 3) * i;
    pontos.push(
      `${(cx + RAIO * Math.cos(angulo)).toFixed(2)},${(cy + RAIO * Math.sin(angulo)).toFixed(2)}`
    );
  }
  return pontos.join(' ');
}

const CELULAS: string[] = [];
for (let y = 0; y < LADO; y++) {
  for (let x = 0; x < LADO; x++) {
    CELULAS.push(hexPontos(x, y));
  }
}

// Margem: segmento reto de canto a canto, afastado para fora do losango
function linhaMargem(de: Ponto, para: Ponto, nx: number, ny: number): string {
  const AFASTAMENTO = RAIO + 1.2;
  const EXTENSAO = RAIO * 0.5;
  const comprimento = Math.hypot(para.cx - de.cx, para.cy - de.cy);
  const ux = (para.cx - de.cx) / comprimento;
  const uy = (para.cy - de.cy) / comprimento;
  const x1 = de.cx - ux * EXTENSAO + nx * AFASTAMENTO;
  const y1 = de.cy - uy * EXTENSAO + ny * AFASTAMENTO;
  const x2 = para.cx + ux * EXTENSAO + nx * AFASTAMENTO;
  const y2 = para.cy + uy * EXTENSAO + ny * AFASTAMENTO;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const CANTO_W = centro(0, 0);
const CANTO_N = centro(10, 0);
const CANTO_E = centro(10, 10);
const CANTO_S = centro(0, 10);
const MEIO = Math.sqrt(3) / 2;

// Margens das Pretas (âmbar): NW (y=0, de W a N) e SE (y=10, de S a E)
const MARGENS_AMBAR = [
  linhaMargem(CANTO_W, CANTO_N, -0.5, -MEIO),
  linhaMargem(CANTO_S, CANTO_E, 0.5, MEIO),
];
// Margens das Brancas (cinza): NE (x=10, de N a E) e SW (x=0, de W a S)
const MARGENS_CINZA = [
  linhaMargem(CANTO_N, CANTO_E, 0.5, -MEIO),
  linhaMargem(CANTO_W, CANTO_S, -0.5, MEIO),
];

// Posição (ver sequência legal no topo do ficheiro)
const CAMINHO_AMBAR: Array<[number, number]> = [
  [6, 0],
  [6, 1],
  [5, 2],
  [5, 3],
];
const BRANCAS: Array<[number, number]> = [
  [2, 5],
  [3, 5],
  [4, 5],
  [5, 5],
];
const NEUTRAS: Array<[number, number]> = [
  [9, 2],
  [2, 2],
  [8, 4],
  [1, 7],
  [7, 7],
  [3, 8],
  [8, 8],
  [6, 9],
];
// 9.º turno (hover): própria âmbar em (4,4) + neutra em (8,6)
const LANCE_PROPRIA: [number, number] = [4, 4];
const LANCE_NEUTRA: [number, number] = [8, 6];

// Traço fino que liga o caminho âmbar (sob as peças)
function polilinha(casas: Array<[number, number]>): string {
  return casas
    .map(([x, y]) => {
      const { cx, cy } = centro(x, y);
      return `${cx.toFixed(2)},${cy.toFixed(2)}`;
    })
    .join(' ');
}

// A peça do lance desliza da casa anterior (5,3) para (4,4): delta só em y
const DESLIZE_Y = (centro(...LANCE_PROPRIA).cy - centro(5, 3).cy).toFixed(2);

const ESTILO = `
.nex-vignette--animada [data-lance] {
  opacity: 0;
  transition: opacity 300ms ease;
}
.nex-vignette--animada [data-lance] .nex-vignette__lance-propria {
  transform: translateY(-${DESLIZE_Y}px);
  transition: transform 300ms ease;
}
.game-card:hover .nex-vignette--animada [data-lance],
.game-card:focus-within .nex-vignette--animada [data-lance] {
  opacity: 1;
}
.game-card:hover .nex-vignette--animada [data-lance] .nex-vignette__lance-propria,
.game-card:focus-within .nex-vignette--animada [data-lance] .nex-vignette__lance-propria {
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .nex-vignette--animada [data-lance] {
    opacity: 1;
    transition: none;
  }
  .nex-vignette--animada [data-lance] .nex-vignette__lance-propria {
    transform: none;
    transition: none;
  }
}
`;

function Peca({ casa, tipo, className }: { casa: [number, number]; tipo: 'ambar' | 'branca' | 'neutra'; className?: string }) {
  const { cx, cy } = centro(casa[0], casa[1]);
  if (tipo === 'branca') {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={RAIO_PECA}
        fill="var(--papel)"
        stroke="var(--tinta-suave)"
        strokeWidth={0.9}
        className={className}
      />
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={RAIO_PECA}
      fill={tipo === 'ambar' ? 'var(--jogo-nex)' : 'var(--tinta-suave)'}
      className={className}
    />
  );
}

export default function NexVignette({ animate = true, className }: NexVignetteProps) {
  const classes = ['nex-vignette'];
  if (animate) classes.push('nex-vignette--animada');
  if (className) classes.push(className);

  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      className={classes.join(' ')}
    >
      {animate && <style>{ESTILO}</style>}

      {/* Casas do tabuleiro: papel com traço fino */}
      <g fill="var(--papel)" stroke="var(--linha)" strokeWidth={0.4} strokeLinejoin="round">
        {CELULAS.map((pontos, i) => (
          <polygon key={i} points={pontos} />
        ))}
      </g>

      {/* Margens coloridas: âmbar liga NW–SE, cinza liga SW–NE */}
      <g fill="none" strokeWidth={1.6} strokeLinecap="round">
        {MARGENS_AMBAR.map((d, i) => (
          <path key={`a${i}`} d={d} stroke="var(--jogo-nex)" />
        ))}
        {MARGENS_CINZA.map((d, i) => (
          <path key={`c${i}`} d={d} stroke="var(--tinta-suave)" opacity={0.55} />
        ))}
      </g>

      {/* Fio do caminho âmbar, sob as peças */}
      <polyline
        points={polilinha(CAMINHO_AMBAR)}
        fill="none"
        stroke="var(--jogo-nex)"
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
      />

      {/* Peças neutras (cinzentas) e brancas do adversário */}
      <g opacity={0.8}>
        {NEUTRAS.map((casa) => (
          <Peca key={casa.join(',')} casa={casa} tipo="neutra" />
        ))}
      </g>
      {BRANCAS.map((casa) => (
        <Peca key={casa.join(',')} casa={casa} tipo="branca" />
      ))}

      {/* Caminho parcial âmbar (Pretas: NW → SE) */}
      {CAMINHO_AMBAR.map((casa) => (
        <Peca key={casa.join(',')} casa={casa} tipo="ambar" />
      ))}

      {/* 9.º turno: surge no hover/focus do .game-card (ou estático se animate=false) */}
      <g data-lance>
        <polyline
          points={polilinha([[5, 3], LANCE_PROPRIA])}
          fill="none"
          stroke="var(--jogo-nex)"
          strokeWidth={1.1}
          strokeLinecap="round"
          opacity={0.45}
        />
        <g opacity={0.8}>
          <Peca casa={LANCE_NEUTRA} tipo="neutra" />
        </g>
        <Peca casa={LANCE_PROPRIA} tipo="ambar" className="nex-vignette__lance-propria" />
      </g>
    </svg>
  );
}
