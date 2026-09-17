import { useTranslation } from '../../i18n/LanguageProvider';
import type { GameId } from '../../ai-core/types';
import type { GameProgressSnapshot } from './gamification-state';
import { getProfileGames, isIntegrationPreview } from '../../games/catalog';

import { GAME_NAMES as GAME_LABELS } from '../../games/catalog';
export { GAME_NAMES as GAME_LABELS } from '../../games/catalog';

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
        {getProfileGames(isIntegrationPreview()).map(({ id: gameId }) => {
          const progress = gameProgress[gameId];
          if (!progress) return null;
          return (
          <div key={gameId} className="rounded-lg border p-4 [background:var(--fundo)] [border-color:var(--linha)]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{t(GAME_LABELS[gameId])}</p>
              <span className="text-xs [color:var(--tinta-suave)]">
                {t(isReady ? `${progress.played} partidas · ${progress.reviews} revisões` : 'A sincronizar...')}
              </span>
            </div>
            <p className="mt-3 text-sm">{t('Vitórias:')} {isReady ? progress.wins : '—'}</p>
          </div>
          );
        })}
      </div>
    </section>
  );
}
