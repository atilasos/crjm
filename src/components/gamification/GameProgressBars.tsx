import { useTranslation } from '../../i18n/LanguageProvider';
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

export function GameProgressBars({ gameProgress, isReady = true }: GameProgressBarsProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border p-5 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)] [color:var(--tinta)]">
      <p className="text-lg font-bold [color:var(--tinta)]">{t('Prática por jogo')}</p>
      <p className="mt-2 text-sm [color:var(--tinta-suave)]">{t('XP, partidas e revisões registam a tua prática. A aprendizagem confirma-se nas decisões sem ajuda.')}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(Object.entries(gameProgress) as Array<[GameId, GameProgressSnapshot]>).map(([gameId, progress]) => (
          <div key={gameId} className="rounded-lg border p-4 [background:var(--fundo)] [border-color:var(--linha)]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{t(GAME_LABELS[gameId])}</p>
              <span className="text-xs [color:var(--tinta-suave)]">
                {t(isReady ? `${progress.played} partidas · ${progress.reviews} revisões` : 'A sincronizar...')}
              </span>
            </div>
            <p className="mt-3 text-sm">{t('Vitórias:')} {isReady ? progress.wins : '—'}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
