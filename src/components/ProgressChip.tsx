import { useGamification } from './gamification/GamificationProvider';

/**
 * Chip compacto de progresso: substitui os três widgets de gamificação do
 * header global. Mostra nível e XP total e liga ao Perfil, onde vive o detalhe.
 */
export function ProgressChip() {
  const { isReady, level, levelTitle, profile } = useGamification();

  return (
    <a
      href="#/perfil"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tabular-nums transition-colors [border-color:var(--linha)] [color:var(--tinta)] hover:[border-color:var(--ouro)]"
      aria-label={
        isReady
          ? `Nível ${level}, ${levelTitle}, ${profile.totalXp} XP — ver perfil e progresso`
          : 'Ver perfil e progresso'
      }
      title="Ver perfil e progresso"
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full [background:var(--ouro)]" />
      {isReady ? (
        <span>
          N{level} · {profile.totalXp} XP
        </span>
      ) : (
        <span className="[color:var(--tinta-suave)]">Perfil</span>
      )}
    </a>
  );
}
