interface TutorHintCardProps {
  insight: string;
  suggestedAction: string;
  hintLevel?: 'H1' | 'H2' | 'H3';
  isLoading?: boolean;
}

export function TutorHintCard({
  insight,
  suggestedAction,
  hintLevel = 'H2',
  isLoading = false,
}: TutorHintCardProps) {
  return (
    <section
      aria-live="polite"
      className="rounded-xl border px-4 py-3 text-sm [border-color:color-mix(in_srgb,var(--jogo-atari)_35%,var(--linha))] [background:color-mix(in_srgb,var(--jogo-atari)_8%,var(--painel))] [color:var(--tinta)]"
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white [background:var(--jogo-atari)]">
          IA
        </span>
        Dica do turno
        <span className="rounded-full px-2 py-0.5 text-xs font-medium [background:color-mix(in_srgb,var(--jogo-atari)_15%,var(--painel))] [color:var(--tinta-suave)]">
          {hintLevel}
        </span>
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
