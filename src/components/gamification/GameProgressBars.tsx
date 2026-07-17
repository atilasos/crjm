import type { GameId } from '../../ai-core/types';
import type { GameProgressSnapshot } from './gamification-state';

export const GAME_LABELS: Record<GameId, string> = {
  'gatos-caes': 'Gatos & Cães',
  dominorio: 'Dominório',
  quelhas: 'Quelhas',
  produto: 'Produto',
  'atari-go': 'Atari Go',
  nex: 'Nex',
};

const GAME_ACCENTS: Record<GameId, string> = {
  'gatos-caes': 'var(--jogo-gatos)',
  dominorio: 'var(--jogo-dominorio)',
  quelhas: 'var(--jogo-quelhas)',
  produto: 'var(--jogo-produto)',
  'atari-go': 'var(--jogo-atari)',
  nex: 'var(--jogo-nex)',
};

interface GameProgressBarsProps {
  gameProgress: Record<GameId, GameProgressSnapshot>;
  isReady?: boolean;
}

function Bar({ label, value, accent, isReady = true }: { label: string; value: number; accent: string; isReady?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs [color:var(--tinta-suave)]">
        <span>{label}</span>
        <span>{isReady ? `${value}/5` : '-/5'}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full [background:var(--linha)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${!isReady ? 'animate-pulse opacity-50' : ''}`}
          style={{ width: isReady ? `${(value / 5) * 100}%` : '0%', background: accent }}
        />
      </div>
    </div>
  );
}

export function GameProgressBars({ gameProgress, isReady = true }: GameProgressBarsProps) {
  return (
    <section className="rounded-xl border p-5 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)] [color:var(--tinta)]">
      <p className="text-lg font-bold [color:var(--tinta)]">Progresso por jogo</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(Object.entries(gameProgress) as Array<[GameId, GameProgressSnapshot]>).map(([gameId, progress]) => (
          <div key={gameId} className="rounded-lg border p-4 [background:var(--fundo)] [border-color:var(--linha)]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{GAME_LABELS[gameId]}</p>
              <span className="text-xs [color:var(--tinta-suave)]">
                {isReady ? `${progress.played} partidas · ${progress.reviews} revisões` : 'A sincronizar...'}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <Bar label="Regras" value={progress.rules} accent={GAME_ACCENTS[gameId]} isReady={isReady} />
              <Bar label="Estratégia" value={progress.strategy} accent={GAME_ACCENTS[gameId]} isReady={isReady} />
              <Bar label="Mestria" value={progress.mastery} accent={GAME_ACCENTS[gameId]} isReady={isReady} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
