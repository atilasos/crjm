interface SessionXpBarProps {
  currentXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  sessionXp: number;
}

export function SessionXpBar({
  currentXp,
  currentLevelXp,
  nextLevelXp,
  sessionXp,
}: SessionXpBarProps) {
  const range = Math.max(1, nextLevelXp - currentLevelXp);
  const progress = Math.max(0, Math.min(100, ((currentXp - currentLevelXp) / range) * 100));

  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 text-xs text-white/80">
        <span>XP total: {currentXp}</span>
        <span>+{sessionXp} sessão</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-white/70">
        {currentXp - currentLevelXp} / {range} XP para o próximo nível
      </div>
    </div>
  );
}
