import type { TutorContextItem } from '../../ai-core/tutor-context';

interface TutorContextBarProps {
  items: TutorContextItem[];
}

function getToneClasses(tone: TutorContextItem['tone']): string {
  switch (tone) {
    case 'success':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'warning':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'danger':
      return 'bg-rose-100 text-rose-900 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

export function TutorContextBar({ items }: TutorContextBarProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={`${item.tone}-${item.label}`}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getToneClasses(item.tone)}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
