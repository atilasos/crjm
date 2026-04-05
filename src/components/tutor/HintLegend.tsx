interface HintLegendProps {
  showThreat?: boolean;
  showAlternative?: boolean;
}

export function HintLegend({
  showThreat = false,
  showAlternative = true,
}: HintLegendProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
      <p className="font-semibold uppercase tracking-wide text-slate-500">Leitura visual</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-300 ring-2 ring-amber-500" />
          Jogada recomendada
        </div>
        {showAlternative && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-300 ring-2 ring-emerald-500" />
            Alternativa/apoio
          </div>
        )}
        {showThreat && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-rose-300 ring-2 ring-rose-500" />
            Resposta crítica
          </div>
        )}
      </div>
    </section>
  );
}
