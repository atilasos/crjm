import { LIGACOES, NOS } from '../../games/y/board';
const byId = new Map(NOS.map(no => [no.id, no]));
export default function YVignette({ className }: { animate?: boolean; className?: string }) {
  return <svg viewBox="-25 -15 900 900" width="100%" height="100%" className={className} aria-hidden="true">
    {LIGACOES.map(([a, b]) => <line key={`${a}-${b}`} x1={byId.get(a)!.x} y1={byId.get(a)!.y}
      x2={byId.get(b)!.x} y2={byId.get(b)!.y} stroke="currentColor" strokeWidth="5" />)}
  </svg>;
}
