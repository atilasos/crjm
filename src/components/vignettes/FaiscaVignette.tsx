export default function FaiscaVignette({ className }: { animate?: boolean; className?: string }) {
  return <svg viewBox="0 0 120 110" width="100%" height="100%" className={className} aria-hidden="true">
    {Array.from({ length: 30 }, (_, i) => <rect key={i} x={3 + (i % 6) * 19} y={5 + Math.floor(i / 6) * 19}
      width="18" height="18" rx="2" fill="var(--papel)" stroke="var(--linha)" />)}
    <path d="M111 46 L98 52 L111 58 Z" fill="#164b99" />
    <path d="M45 46 L57 46 L51 58 Z" fill="#a32c38" />
    <circle cx="51" cy="90" r="6" fill="none" stroke="var(--tinta)" strokeDasharray="2 2" />
  </svg>;
}
