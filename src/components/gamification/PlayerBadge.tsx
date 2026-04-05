interface PlayerBadgeProps {
  level: number;
  title: string;
  streakDays: number;
}

export function PlayerBadge({ level, title, streakDays }: PlayerBadgeProps) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏅</span>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/70">Perfil</p>
          <p className="text-sm font-semibold">
            {title} · Nível {level}
          </p>
        </div>
      </div>
      {streakDays >= 2 && <p className="mt-1 text-xs text-amber-200">🔥 {streakDays} dias seguidos</p>}
    </div>
  );
}
