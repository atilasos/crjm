import { useTranslation, LanguageSelector } from '../i18n/LanguageProvider';
import { useEffect, useState } from 'react';
import { loadStudentSession, STUDENT_SESSION_CHANGED_EVENT, type StudentSession } from '../utils/student-session';
import { ProgressChip } from './ProgressChip';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  titulo?: string;
  onVoltar?: () => void;
}

export function Header({ titulo, onVoltar }: HeaderProps) {
  const { t } = useTranslation();
  const [session, setSession] = useState<StudentSession | null>(() => loadStudentSession());

  useEffect(() => {
    const atualizar = () => setSession(loadStudentSession());
    window.addEventListener(STUDENT_SESSION_CHANGED_EVENT, atualizar);
    window.addEventListener('storage', atualizar);
    return () => {
      window.removeEventListener(STUDENT_SESSION_CHANGED_EVENT, atualizar);
      window.removeEventListener('storage', atualizar);
    };
  }, []);

  return (
    <header className="border-b [background:var(--painel)] [border-color:var(--linha)]">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-2 px-4 py-2 sm:flex-nowrap md:h-16 md:gap-3 md:py-0">
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            className="flex shrink-0 items-center gap-1 rounded-lg py-1 pr-1 transition-colors [color:var(--tinta-suave)] hover:[color:var(--tinta)]"
            aria-label={t("Voltar à página inicial")}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden text-sm font-bold sm:inline">{t("Voltar")}</span>
          </button>
        )}

        <h1
          className="min-w-0 flex-1 truncate text-lg font-bold md:text-xl [color:var(--tinta)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t(titulo || 'Jogos Matemáticos')}
        </h1>

        <div className="flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto md:gap-2">
          <LanguageSelector />
          <ProgressChip />
          <ThemeToggle />
          <a
            href="#/entrar"
            className="max-w-24 truncate rounded-full border px-3 py-1 text-xs font-bold transition-colors [border-color:var(--linha)] [color:var(--tinta-suave)] hover:[color:var(--tinta)] md:max-w-40"
            title={t(session ? `Sessão de ${session.name}` : 'Entrar com o teu código')}
          >
            {session ? `${session.name}${session.className ? ` · ${session.className}` : ''}` : t('Entrar')}
          </a>
        </div>
      </div>
    </header>
  );
}
