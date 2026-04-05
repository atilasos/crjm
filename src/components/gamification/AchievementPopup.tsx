import type { AchievementDefinition } from '../../ai-core/gamification';

interface AchievementPopupProps {
  achievement: AchievementDefinition | null;
  onClose: () => void;
}

export function AchievementPopup({ achievement, onClose }: AchievementPopupProps) {
  if (!achievement) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="pointer-events-auto mt-8 max-w-sm rounded-3xl border-2 border-white/70 bg-white/95 px-5 py-4 text-left shadow-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">🏆 Conquista</p>
        <p className="mt-1 text-lg font-bold text-slate-900">{achievement.title}</p>
        <p className="mt-1 text-sm text-slate-700">{achievement.description}</p>
        <p className="mt-2 text-xs font-medium text-emerald-700">+{achievement.xp} XP</p>
      </button>
    </div>
  );
}
