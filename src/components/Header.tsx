import { useEffect, useState } from 'react';
import { loadStudentSession, STUDENT_SESSION_CHANGED_EVENT, type StudentSession } from '../utils/student-session';
import { ProgressChip } from './ProgressChip';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  titulo?: string;
  onVoltar?: () => void;
}

export function Header({ titulo, onVoltar }: HeaderProps) {
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
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 md:h-16 md:gap-3">
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            className="flex shrink-0 items-center gap-1 rounded-lg py-1 pr-1 transition-colors [color:var(--tinta-suave)] hover:[color:var(--tinta)]"
            aria-label="Voltar à página inicial"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden text-sm font-bold sm:inline">Voltar</span>
          </button>
        )}

        <h1
          className="min-w-0 flex-1 truncate text-lg font-bold md:text-xl [color:var(--tinta)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {titulo || 'Jogos Matemáticos'}
        </h1>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <ProgressChip />
          <ThemeToggle />
          <a
            href="#/entrar"
            className="max-w-24 truncate rounded-full border px-3 py-1 text-xs font-bold transition-colors [border-color:var(--linha)] [color:var(--tinta-suave)] hover:[color:var(--tinta)] md:max-w-40"
            title={session ? `Sessão de ${session.name}` : 'Entrar com o teu código'}
          >
            {session ? `${session.name}${session.className ? ` · ${session.className}` : ''}` : 'Entrar'}
          </a>
        </div>
      </div>
    </header>
  );
}
