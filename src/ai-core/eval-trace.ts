/**
 * Traço de avaliação de um jogo vs computador (F4 dos percursos).
 *
 * Cada vez que a IA pensa, o motor devolve uma avaliação da posição na
 * perspetiva da própria IA. Registamos uma amostra por «vez» e, no fim do
 * jogo, mostramos a curva na perspetiva do HUMANO com o momento da maior
 * queda — «onde o jogo virou».
 */

export interface EvalSample {
  /** Índice da amostra (uma por vez da IA). */
  turn: number;
  /** Avaliação normalizada em [-1, 1], perspetiva do humano. */
  value: number;
}

/**
 * Normaliza um score bruto do motor (perspetiva da IA) para [-1, 1] na
 * perspetiva do humano. `scale` controla a sensibilidade (score típico de
 * vantagem clara ≈ scale).
 */
export function normalizeEngineScore(rawAiScore: number, scale = 200): number {
  const humanScore = -rawAiScore;
  return Math.tanh(humanScore / scale);
}

export interface TurningPoint {
  /** Índice da amostra ONDE a queda se materializou (fim do degrau). */
  turn: number;
  /** Dimensão da queda em unidades normalizadas (positiva). */
  drop: number;
}

/**
 * Maior queda de avaliação entre amostras consecutivas, na perspetiva do
 * humano. Devolve null com menos de 2 amostras ou se nunca houve queda
 * relevante (>= minDrop).
 */
export function findTurningPoint(values: number[], minDrop = 0.15): TurningPoint | null {
  let best: TurningPoint | null = null;
  for (let i = 1; i < values.length; i += 1) {
    const drop = values[i - 1]! - values[i]!;
    if (drop >= minDrop && (best === null || drop > best.drop)) {
      best = { turn: i, drop };
    }
  }
  return best;
}
