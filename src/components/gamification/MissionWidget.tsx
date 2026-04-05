import type { MissionProgress } from './gamification-state';

interface MissionWidgetProps {
  missions: MissionProgress[];
}

export function MissionWidget({ missions }: MissionWidgetProps) {
  const active = missions.find((mission) => !mission.completed) ?? missions[0];
  if (!active) return null;

  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
      <p className="text-xs uppercase tracking-wide text-white/70">
        Missão {active.frequency === 'daily' ? 'diária' : 'semanal'}
      </p>
      <p className="mt-1 text-sm font-semibold">{active.title}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-green-500 transition-all duration-500"
          style={{ width: `${Math.min(100, (active.progress / active.target) * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-white/70">
        {active.progress}/{active.target} · +{active.rewardXp} XP
      </p>
    </div>
  );
}
