interface SessionXpBarProps {
  currentXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  sessionXp: number;
  isReady?: boolean;
}

export function SessionXpBar({
  currentXp,
  currentLevelXp,
  nextLevelXp,
  sessionXp,
  isReady = true,
}: SessionXpBarProps) {
  const range = Math.max(1, nextLevelXp - currentLevelXp);
  const progress = Math.max(0, Math.min(100, ((currentXp - currentLevelXp) / range) * 100));

  return (
    <div className="rounded-lg border px-3 py-2 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)] [color:var(--tinta)]">
      <div className="flex items-center justify-between gap-3 text-xs [color:var(--tinta-suave)]">
        <span>{isReady ? `XP total: ${currentXp}` : 'XP total: -'}</span>
        <span>{isReady ? `+${sessionXp} sessão` : 'A sincronizar...'}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full [background:var(--linha)]">
        <div
          className={`h-full rounded-full transition-all duration-500 [background:var(--ouro)] ${!isReady ? 'animate-pulse opacity-50' : ''}`}
          style={{ width: isReady ? `${progress}%` : '0%' }}
        />
      </div>
      <div className="mt-1 text-[11px] [color:var(--tinta-suave)]">
        {isReady ? `${currentXp - currentLevelXp} / ${range} XP para o próximo nível` : 'A carregar progresso...'}
      </div>
    </div>
  );
}
