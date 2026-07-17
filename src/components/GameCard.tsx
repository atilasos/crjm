import type { ReactNode } from 'react';

interface GameCardProps {
  titulo: string;
  descricao: string;
  /** Mini-tabuleiro SVG de assinatura do jogo (anima no hover/focus do cartão) */
  vignette: ReactNode;
  /** Cor de acento do jogo, ex.: 'var(--jogo-gatos)' */
  acento?: string;
  /** Ciclos de ensino em que o jogo é disputado (chips) */
  ciclos?: string[];
  onClick: () => void;
}

export function GameCard({ titulo, descricao, vignette, acento = 'var(--tinta)', ciclos = [], onClick }: GameCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="game-card w-full text-left"
    >
      {/* Vignette: o tabuleiro é a identidade */}
      <div className="mx-auto mb-4 h-36 w-36" aria-hidden="true">
        {vignette}
      </div>

      <h2
        className="mb-2 text-xl font-bold [color:var(--tinta)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {titulo}
      </h2>
      <p className="text-sm [color:var(--tinta-suave)]">{descricao}</p>

      {ciclos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Ciclos de ensino">
          {ciclos.map(ciclo => (
            <li
              key={ciclo}
              className="rounded-full border px-2 py-0.5 text-xs font-bold [border-color:var(--linha)] [color:var(--tinta-suave)]"
            >
              {ciclo}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center text-sm font-bold" style={{ color: acento }}>
        <span>Jogar agora</span>
        <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
