import { useTranslation } from '../i18n/LanguageProvider';
import { useGamification } from './gamification/GamificationProvider';

/**
 * Chip compacto de progresso: substitui os três widgets de gamificação do
 * header global. Mostra nível e XP total e liga ao Perfil, onde vive o detalhe.
 */
export function ProgressChip() {
  const { t } = useTranslation();
  const { isReady, level, levelTitle, profile } = useGamification();

  return (
    <a
      href="#/perfil"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tabular-nums transition-colors [border-color:var(--linha)] [color:var(--tinta)] hover:[border-color:var(--ouro)]"
      aria-label={
        t(isReady
          ? `Nível ${level}, ${t(levelTitle)}, ${profile.totalXp} XP — ver perfil e progresso`
          : 'Ver perfil e progresso')
      }
      title={t("Ver perfil e progresso")}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full [background:var(--ouro)]" />
      {isReady ? (
        <span>{t("N")}{t(level)} · {t(profile.totalXp)}{t(" XP")}</span>
      ) : (
        <span className="[color:var(--tinta-suave)]">{t("Perfil")}</span>
      )}
    </a>
  );
}
