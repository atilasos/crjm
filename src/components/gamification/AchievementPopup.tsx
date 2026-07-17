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
        className="pointer-events-auto mt-8 max-w-sm rounded-xl border px-5 py-4 text-left [background:var(--painel)] [border-color:var(--ouro)] [box-shadow:var(--sombra)]"
      >
        <p className="text-xs font-bold uppercase tracking-wide [color:var(--ouro)]">🏆 Conquista</p>
        <p className="mt-1 text-lg font-bold [color:var(--tinta)]">{achievement.title}</p>
        <p className="mt-1 text-sm [color:var(--tinta-suave)]">{achievement.description}</p>
        <p className="mt-2 text-xs font-bold tabular-nums [color:var(--sucesso)]">+{achievement.xp} XP</p>
      </button>
    </div>
  );
}
