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

interface GameProgressBarsProps {
  gameProgress: Record<GameId, GameProgressSnapshot>;
  isReady?: boolean;
}

function Bar({ label, value, isReady = true }: { label: string; value: number; isReady?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-white/80">
        <span>{label}</span>
        <span>{isReady ? `${value}/5` : '-/5'}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-sky-300 to-indigo-400 transition-all duration-500 ${!isReady ? 'animate-pulse opacity-50' : ''}`}
          style={{ width: isReady ? `${(value / 5) * 100}%` : '0%' }}
        />
      </div>
    </div>
  );
}

export function GameProgressBars({ gameProgress, isReady = true }: GameProgressBarsProps) {
  return (
    <section className="rounded-3xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-sm">
      <p className="text-lg font-bold text-white">Progresso por jogo</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(Object.entries(gameProgress) as Array<[GameId, GameProgressSnapshot]>).map(([gameId, progress]) => (
          <div key={gameId} className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{GAME_LABELS[gameId]}</p>
              <span className="text-xs text-white/70">
                {isReady ? `${progress.played} partidas · ${progress.reviews} revisões` : 'A sincronizar...'}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <Bar label="Regras" value={progress.rules} isReady={isReady} />
              <Bar label="Estratégia" value={progress.strategy} isReady={isReady} />
              <Bar label="Mestria" value={progress.mastery} isReady={isReady} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
