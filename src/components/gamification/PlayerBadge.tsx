interface PlayerBadgeProps {
  level: number;
  title: string;
  streakDays: number;
  isReady?: boolean;
}

export function PlayerBadge({ level, title, streakDays, isReady = true }: PlayerBadgeProps) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className={`text-xl ${!isReady ? 'opacity-50' : ''}`}>🏅</span>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/70">Perfil</p>
          <p className="text-sm font-semibold">
            {!isReady ? 'A sincronizar...' : `${title} · Nível ${level}`}
          </p>
        </div>
      </div>
      {isReady && streakDays >= 2 && <p className="mt-1 text-xs text-amber-200">🔥 {streakDays} dias seguidos</p>}
      {!isReady && <p className="mt-1 text-xs text-white/40 animate-pulse">Aguarde...</p>}
    </div>
  );
}
