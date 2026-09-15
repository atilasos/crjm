import { useTranslation } from '../../../i18n/LanguageProvider';
interface TutorHintCardProps {
  insight: string;
  suggestedAction: string;
  hintLevel?: 'H1' | 'H2' | 'H3';
  errorCode?: string;
  isLoading?: boolean;
}

export function TutorHintCard({
  insight,
  suggestedAction,
  hintLevel = 'H2',
  errorCode,
  isLoading = false,
}: TutorHintCardProps) {
  const { t } = useTranslation();
  return (
    <section
      aria-live="polite"
      className="rounded-xl border px-4 py-3 text-sm [background:var(--painel)] [border-color:color-mix(in_srgb,var(--jogo-dominorio)_35%,var(--linha))] [color:var(--tinta)]"
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white [background:var(--jogo-dominorio)]">{t("IA")}</span>{t("Dica do turno")}<span className="rounded-full px-2 py-0.5 text-xs font-medium [background:color-mix(in_srgb,var(--jogo-dominorio)_15%,var(--painel))] [color:var(--tinta)]">
          {t(hintLevel)}
        </span>
        {errorCode && (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium [background:color-mix(in_srgb,var(--jogo-dominorio)_15%,var(--painel))] [color:var(--tinta)]">
            {t(errorCode)}
          </span>
        )}
      </div>
      {isLoading ? (
        <p className="mt-2 [color:var(--tinta-suave)]">{t("A analisar a posição...")}</p>
      ) : (
        <div className="mt-2 space-y-2">
          <p>
            <strong>{t("O que deves procurar:")}</strong> {t(insight)}
          </p>
          <p>
            <strong>{t("Próximo passo:")}</strong> {t(suggestedAction)}
          </p>
        </div>
      )}
    </section>
  );
}
