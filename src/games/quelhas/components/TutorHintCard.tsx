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
  return (
    <section
      aria-live="polite"
      className="rounded-xl border px-4 py-3 text-sm [background:var(--painel)] [border-color:color-mix(in_srgb,var(--jogo-quelhas)_35%,var(--linha))] [color:var(--tinta)]"
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white [background:var(--jogo-quelhas)]">
          IA
        </span>
        Dica do turno
        <span className="rounded-full px-2 py-0.5 text-xs font-medium [background:color-mix(in_srgb,var(--jogo-quelhas)_15%,var(--painel))] [color:var(--jogo-quelhas)]">
          {hintLevel}
        </span>
        {errorCode && (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium [background:color-mix(in_srgb,var(--jogo-quelhas)_15%,var(--painel))] [color:var(--jogo-quelhas)]">
            {errorCode}
          </span>
        )}
      </div>
      {isLoading ? (
        <p className="mt-2 [color:var(--tinta-suave)]">A analisar a posição...</p>
      ) : (
        <div className="mt-2 space-y-2">
          <p>
            <strong>Insight:</strong> {insight}
          </p>
          <p>
            <strong>Ação sugerida:</strong> {suggestedAction}
          </p>
        </div>
      )}
    </section>
  );
}
