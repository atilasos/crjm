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
      className="rounded-xl border [border-color:var(--linha)] [background:var(--painel)] px-4 py-3 text-sm [color:var(--tinta)]"
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full [background:var(--jogo-nex)] text-xs font-bold text-white">
          IA
        </span>
        Dica do turno
        <span className="rounded-full [background:color-mix(in_srgb,var(--jogo-nex)_15%,var(--painel))] px-2 py-0.5 text-xs font-medium [color:color-mix(in_srgb,var(--jogo-nex)_60%,var(--tinta))]">
          {hintLevel}
        </span>
        {errorCode && (
          <span className="rounded-full [background:color-mix(in_srgb,var(--jogo-nex)_15%,var(--painel))] px-2 py-0.5 text-xs font-medium [color:color-mix(in_srgb,var(--jogo-nex)_60%,var(--tinta))]">
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
