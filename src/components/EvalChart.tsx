import { findTurningPoint } from '../ai-core/eval-trace';

interface EvalChartProps {
  /** Avaliações normalizadas em [-1, 1], perspetiva do humano, uma por vez. */
  values: number[];
  humanWon: boolean;
}

const WIDTH = 320;
const HEIGHT = 120;
const PAD = 12;

export function EvalChart({ values, humanWon }: EvalChartProps) {
  if (values.length < 3) return null;
  const turningPoint = findTurningPoint(values);

  const x = (i: number) => PAD + (i * (WIDTH - 2 * PAD)) / Math.max(1, values.length - 1);
  const y = (v: number) => HEIGHT / 2 - v * (HEIGHT / 2 - PAD);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <figure data-eval-chart className="mt-3">
      <p className="text-xs font-black uppercase tracking-[0.18em] [color:var(--ouro)]">
        Revisão do jogo
      </p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-2 w-full max-w-sm rounded-lg border [background:var(--fundo)] [border-color:var(--linha)]"
        role="img"
        aria-label="Avaliação do computador ao longo do jogo, na tua perspetiva"
      >
        <line x1={PAD} y1={HEIGHT / 2} x2={WIDTH - PAD} y2={HEIGHT / 2} stroke="var(--linha)" strokeDasharray="4 4" />
        <text x={PAD} y={PAD + 2} fontSize="9" fill="var(--tinta-suave)">a teu favor</text>
        <text x={PAD} y={HEIGHT - 4} fontSize="9" fill="var(--tinta-suave)">contra ti</text>
        <polyline points={points} fill="none" stroke="var(--ouro)" strokeWidth="2" strokeLinejoin="round" />
        {turningPoint && (
          <circle
            cx={x(turningPoint.turn)}
            cy={y(values[turningPoint.turn]!)}
            r="4.5"
            fill="var(--perigo, #dc2626)"
            stroke="var(--fundo)"
            strokeWidth="1.5"
          />
        )}
      </svg>
      <figcaption className="mt-1 max-w-sm text-xs leading-relaxed [color:var(--tinta-suave)]">
        {turningPoint
          ? `O ponto vermelho marca a vez ${turningPoint.turn + 1}: foi aí que a avaliação mais caiu — revê o que jogaste nesse momento.`
          : humanWon
            ? 'A avaliação manteve-se do teu lado — jogo controlado do início ao fim.'
            : 'Sem uma única queda decisiva: a desvantagem acumulou-se aos poucos.'}
      </figcaption>
    </figure>
  );
}
