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
      className="rounded-xl border [border-color:var(--linha)] [background:var(--painel)] px-4 py-3 text-sm [color:var(--tinta)]"
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full [background:var(--tinta)] text-xs font-bold [color:var(--fundo)]">{t("IA")}</span>{t("Dica do turno")}<span className="rounded-full [background:color-mix(in_srgb,var(--tinta)_8%,transparent)] px-2 py-0.5 text-xs font-medium [color:var(--tinta-suave)]">
          {t(hintLevel)}
        </span>
        {errorCode && (
          <span className="rounded-full [background:color-mix(in_srgb,var(--tinta)_8%,transparent)] px-2 py-0.5 text-xs font-medium [color:var(--tinta-suave)]">
            {t(errorCode)}
          </span>
        )}
      </div>
      {isLoading ? (
        <p className="mt-2 [color:var(--tinta-suave)]">{t("A analisar a posição...")}</p>
      ) : (
        <div className="mt-2 space-y-2">
          <p>
            <strong>{t("Insight:")}</strong> {t(insight)}
          </p>
          <p>
            <strong>{t("Ação sugerida:")}</strong> {t(suggestedAction)}
          </p>
        </div>
      )}
    </section>
  );
}
