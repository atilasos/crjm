import type { MissionProgress } from './gamification-state';

interface MissionWidgetProps {
  missions: MissionProgress[];
  isReady?: boolean;
}

export function MissionWidget({ missions, isReady = true }: MissionWidgetProps) {
  const active = missions.find((mission) => !mission.completed) ?? missions[0];
  if (!active && isReady) return null;

  return (
    <div className="rounded-lg border px-3 py-2 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)] [color:var(--tinta)]">
      <p className="text-xs uppercase tracking-wide [color:var(--tinta-suave)]">
        {!isReady ? 'Missões' : `Missão ${active?.frequency === 'daily' ? 'diária' : 'semanal'}`}
      </p>
      <p className="mt-1 text-sm font-semibold">
        {!isReady ? 'A sincronizar...' : active?.title}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full [background:var(--linha)]">
        <div
          className={`h-full rounded-full transition-all duration-500 [background:var(--sucesso)] ${!isReady ? 'animate-pulse opacity-50' : ''}`}
          style={{ width: isReady && active ? `${Math.min(100, (active.progress / active.target) * 100)}%` : '0%' }}
        />
      </div>
      <p className="mt-1 text-[11px] [color:var(--tinta-suave)]">
        {!isReady ? 'Aguarde...' : `${active?.progress}/${active?.target} · +${active?.rewardXp} XP`}
      </p>
    </div>
  );
}
