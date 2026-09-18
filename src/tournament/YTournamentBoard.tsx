import { useTranslation } from '../i18n/LanguageProvider';
import type { Player } from '../types';
import { YBoard } from '../games/y/YBoard';
import type { YMove, YState } from '../games/y/types';
import '../games/y/y.css';

/** Seats and names remain fixed when colours change, including in even games. */
export function YTournamentBoard({ state, gameNumber, player1Name, player2Name, myRole, interactive = false, onMove }: {
  state: YState;
  gameNumber: number;
  player1Name: string;
  player2Name: string;
  myRole?: Player;
  interactive?: boolean;
  onMove?: (move: YMove) => void;
}) {
  const { t, msg } = useTranslation();
  const name = (player: Player) => (player === 'jogador1') === (gameNumber % 2 === 1) ? player1Name : player2Name;
  const colour = (player: Player) => t(state.cores[player] === 'azul' ? 'Azul' : 'Vermelho');
  const symbol = (player: Player) => state.cores[player] === 'azul' ? '●' : '◆';
  const finished = state.estado !== 'a-jogar';
  const canPlay = interactive && !!onMove && !!myRole && myRole === state.jogadorAtual && !finished;
  const winner = state.estado === 'vitoria-jogador1' ? 'jogador1' : 'jogador2';
  return <div className="y-game y-tournament">
    <div className="y-identities">
      <span>{name('jogador1')}: {symbol('jogador1')} {colour('jogador1')}</span>
      <span>{name('jogador2')}: {symbol('jogador2')} {colour('jogador2')}</span>
    </div>
    {myRole && <p>{t('Jogar como:')} {symbol(myRole)} {colour(myRole)}</p>}
    <p role="status" className="text-xl font-bold my-2">
      {finished ? msg('Venceu {0} com {1}!', [name(winner), colour(winner)])
        : msg('Vez de {0} — {1}', [name(state.jogadorAtual), colour(state.jogadorAtual)])}
    </p>
    {state.podeTrocar && <p className="my-2">{t('Na sua primeira oportunidade, o segundo jogador pode trocar de cores em vez de colocar uma peça.')}</p>}
    {state.cores.jogador1 === 'vermelho' && <p className="my-2">{t('Após a troca, a peça inicial fica no lugar e pertence ao segundo jogador. O primeiro jogador continua com a outra cor.')}</p>}
    {onMove && state.podeTrocar && <button type="button" disabled={!canPlay}
      className="min-h-12 px-4 py-2 my-2 border rounded [border-color:var(--linha)] disabled:opacity-50"
      onClick={() => onMove({ type: 'swap' })}>{t('Trocar de cores')}</button>}
    <YBoard state={state} disabled={!canPlay} onPlace={onMove ? node => onMove({ type: 'place', node }) : undefined} />
  </div>;
}
