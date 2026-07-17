import type { TutorContextItem } from '../../ai-core/tutor-context';

interface TutorContextBarProps {
  items: TutorContextItem[];
}

function getToneClasses(tone: TutorContextItem['tone']): string {
  switch (tone) {
    case 'success':
      return '[background:var(--painel)] [border-color:var(--sucesso)] [color:var(--tinta)]';
    case 'warning':
      return '[background:var(--painel)] [border-color:var(--ouro)] [color:var(--tinta)]';
    case 'danger':
      return '[background:var(--painel)] [border-color:var(--perigo)] [color:var(--tinta)]';
    default:
      return '[background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta-suave)]';
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
