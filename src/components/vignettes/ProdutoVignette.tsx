import type { Posicao } from '../../games/produto/types';
import { gerarPosicoesValidas, posToKey } from '../../games/produto/types';

// Vignette de assinatura do Produto: mini-tabuleiro hexagonal (hex-61, lado 5)
// com uma posição real e legal do jogo, em esmeralda (--jogo-produto).
//
// Posição representada (9 peças = abertura de 1 peça + 4 lances de 2 peças):
// - Esmeralda: grupo de 3 {(-1,0),(0,0),(1,-1)} e grupo de 2 {(2,1),(3,1)} → produto 3×2 = 6
// - Brancas:   grupo de 2 {(-2,-1),(-1,-2)} e grupo de 2 {(0,2),(1,2)}     → produto 2×2 = 4
// No hover/focus do .game-card, surge a primeira peça do próximo lance
// esmeralda em (2,2), que cresce o grupo de 2 para 3 → produto 3×3 = 9.

const RAIO_HEX = 7;
const CENTRO = 60;
const RAIO_PECA = RAIO_HEX * 0.6;

// Mesma projeção do ProdutoGame (pointy-top)
function hexCentro(pos: Posicao): { x: number; y: number } {
  return {
    x: CENTRO + RAIO_HEX * Math.sqrt(3) * (pos.q + pos.r / 2),
    y: CENTRO + RAIO_HEX * (3 / 2) * pos.r,
  };
}

function hexPontos(x: number, y: number): string {
  const pontos: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i - 90); // vértice no topo
    pontos.push(
      `${(x + RAIO_HEX * Math.cos(ang)).toFixed(2)},${(y + RAIO_HEX * Math.sin(ang)).toFixed(2)}`
    );
  }
  return pontos.join(' ');
}

const CELULAS: Posicao[] = gerarPosicoesValidas();

const PECAS_ESMERALDA: Posicao[] = [
  // Grupo de 3
  { q: -1, r: 0 },
  { q: 0, r: 0 },
  { q: 1, r: -1 },
  // Grupo de 2
  { q: 2, r: 1 },
  { q: 3, r: 1 },
];

const PECAS_BRANCAS: Posicao[] = [
  // Grupo de 2
  { q: -2, r: -1 },
  { q: -1, r: -2 },
  // Grupo de 2
  { q: 0, r: 2 },
  { q: 1, r: 2 },
];

// Primeira peça do próximo lance esmeralda (jogada em curso legal)
const LANCE: Posicao = { q: 2, r: 2 };

interface ProdutoVignetteProps {
  animate?: boolean;
  className?: string;
}

export default function ProdutoVignette({ animate = true, className }: ProdutoVignetteProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      className={className ? `vignette-produto ${className}` : 'vignette-produto'}
    >
      <style>{`
        .vignette-produto [data-lance] {
          opacity: 0;
          transform: translate(0, -5px);
          transform-box: fill-box;
          transition: opacity 300ms ease, transform 300ms ease;
        }
        .game-card:hover .vignette-produto [data-lance],
        .game-card:focus-within .vignette-produto [data-lance] {
          opacity: 1;
          transform: translate(0, 0);
        }
        @media (prefers-reduced-motion: reduce) {
          .vignette-produto [data-lance] {
            transition: none;
            transform: none;
          }
        }
      `}</style>

      {/* Tabuleiro: 61 casas hexagonais em papel com traço fino */}
      <g>
        {CELULAS.map(pos => {
          const { x, y } = hexCentro(pos);
          return (
            <polygon
              key={posToKey(pos)}
              points={hexPontos(x, y)}
              fill="var(--papel)"
              stroke="var(--linha)"
              strokeWidth={0.75}
            />
          );
        })}
      </g>

      {/* Peças brancas */}
      <g>
        {PECAS_BRANCAS.map(pos => {
          const { x, y } = hexCentro(pos);
          return (
            <circle
              key={posToKey(pos)}
              cx={x}
              cy={y}
              r={RAIO_PECA}
              fill="var(--papel)"
              stroke="var(--tinta-suave)"
              strokeWidth={1.5}
            />
          );
        })}
      </g>

      {/* Peças esmeralda */}
      <g>
        {PECAS_ESMERALDA.map(pos => {
          const { x, y } = hexCentro(pos);
          return (
            <circle
              key={posToKey(pos)}
              cx={x}
              cy={y}
              r={RAIO_PECA}
              fill="var(--jogo-produto)"
              stroke="var(--tinta)"
              strokeWidth={0.75}
            />
          );
        })}
      </g>

      {/* Lance de assinatura: surge no hover/focus do .game-card */}
      {animate && (
        <g data-lance>
          <circle
            cx={hexCentro(LANCE).x}
            cy={hexCentro(LANCE).y}
            r={RAIO_PECA}
            fill="var(--jogo-produto)"
            stroke="var(--tinta)"
            strokeWidth={0.75}
          />
        </g>
      )}
    </svg>
  );
}
