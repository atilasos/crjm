import type { BrowsableSelection } from '../games/catalog';
import { useTranslation } from '../i18n/LanguageProvider';

interface GameSelectionControlProps {
  selection: BrowsableSelection;
  onChange: (selection: BrowsableSelection) => void;
  disabled?: boolean;
}

export function GameSelectionControl({ selection, onChange, disabled }: GameSelectionControlProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-4">
      <div role="group" aria-label={t('Seleção de jogos')} className="flex flex-wrap gap-2">
        {(['current', 'archive'] as const).map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={selection === value}
            disabled={disabled}
            onClick={() => onChange(value)}
            className={`min-h-12 rounded-lg border px-4 py-2 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ouro)] disabled:opacity-60 ${selection === value
              ? '[background:var(--tinta)] [color:var(--fundo)] [border-color:var(--tinta)]'
              : '[background:var(--painel)] [color:var(--tinta)] [border-color:var(--linha)]'}`}
          >{t(value === 'archive' ? 'Arquivo' : 'Seleção atual')}</button>
        ))}
      </div>
      {selection === 'archive' && <p className="mt-3 text-sm [color:var(--tinta-suave)]">{t('Arquivo jogável: continua a jogar e a aprender, com todo o teu progresso.')}</p>}
    </div>
  );
}
