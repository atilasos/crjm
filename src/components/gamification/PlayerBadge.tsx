import { useTranslation } from '../../i18n/LanguageProvider';
interface PlayerBadgeProps {
  level: number;
  title: string;
  streakDays: number;
  isReady?: boolean;
}

export function PlayerBadge({ level, title, streakDays, isReady = true }: PlayerBadgeProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border px-3 py-2 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)] [color:var(--tinta)]">
      <div className="flex items-center gap-2">
        <span className={`text-xl ${!isReady ? 'opacity-50' : ''}`}>🏅</span>
        <div>
          <p className="text-xs uppercase tracking-wide [color:var(--tinta-suave)]">{t("Perfil")}</p>
          <p className="text-sm font-semibold">
            {t(!isReady ? 'A sincronizar...' : `${t(title)} · Nível ${level}`)}
          </p>
        </div>
      </div>
      {isReady && streakDays >= 2 && <p className="mt-1 text-xs font-bold [color:var(--ouro)]">🔥 {t(streakDays)}{t(" dias seguidos")}</p>}
      {!isReady && <p className="mt-1 text-xs animate-pulse [color:var(--tinta-suave)]">{t("Aguarde...")}</p>}
    </div>
  );
}
