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
      className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          IA
        </span>
        Dica do turno
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
          {hintLevel}
        </span>
        {errorCode && (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {errorCode}
          </span>
        )}
      </div>
      {isLoading ? (
        <p className="mt-2 text-indigo-700">A analisar a posição...</p>
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
