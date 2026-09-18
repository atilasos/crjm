import { useTranslation } from '../../i18n/LanguageProvider';
import { LIGACOES, NOS } from './board';
import type { YState } from './types';

const BY_ID = new Map(NOS.map(no => [no.id, no]));

/** The same validated drawing for play and the position kept for review. */
export function YBoard({ state, disabled = false, onPlace }: {
  state: YState; disabled?: boolean; onPlace?: (node: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="y-board-viewport" role="region" aria-label={t('Tabuleiro de Y')} tabIndex={0}>
      <div className="y-board" role="group" aria-label={t('Intersecções de Y')}>
        <svg viewBox="-25 -15 900 900" aria-hidden="true">
          {LIGACOES.map(([a, b]) => {
            const start = BY_ID.get(a)!;
            const end = BY_ID.get(b)!;
            const boundary = start.lados.some(lado => end.lados.includes(lado));
            return <line key={`${a}-${b}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y}
              stroke="currentColor" strokeWidth={boundary ? 5 : 1.5} />;
          })}
        </svg>
        {NOS.map(no => {
          const piece = state.tabuleiro[no.id];
          const sides = no.lados.map(lado => t(lado === 'superior' ? 'Lado superior' : lado === 'esquerdo' ? 'Lado esquerdo' : 'Lado direito')).join(', ');
          const Node = onPlace ? 'button' : 'span';
          return <Node type={onPlace ? 'button' : undefined} key={no.id} className="y-node" role={onPlace ? undefined : 'img'} data-color={piece ?? 'empty'}
            style={{ left: `${(no.x + 25) / 9}%`, top: `${(no.y + 15) / 9}%` }}
            disabled={onPlace ? disabled || !!piece : undefined}
            aria-label={`${no.id}: ${piece ? t(piece === 'azul' ? 'Azul' : 'Vermelho') : t('Vazia')}${sides ? `; ${sides}` : ''}`}
            onClick={() => onPlace?.(no.id)}>
            {piece && <span aria-hidden="true">{piece === 'azul' ? '●' : '◆'}</span>}
            <small>{no.id}</small>
          </Node>;
        })}
      </div>
    </div>
  );
}
