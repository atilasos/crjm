import { useEffect, useState } from 'react';

type Tema = 'claro' | 'escuro';

const STORAGE_KEY = 'crjm-tema';

// localStorage pode lançar SecurityError em contextos com armazenamento bloqueado
function lerTemaGuardado(): Tema | null {
  try {
    const guardado = window.localStorage.getItem(STORAGE_KEY);
    return guardado === 'claro' || guardado === 'escuro' ? guardado : null;
  } catch {
    return null;
  }
}

function guardarTema(tema: Tema) {
  try {
    window.localStorage.setItem(STORAGE_KEY, tema);
  } catch {
    // sem persistência disponível — o tema vale apenas para esta sessão
  }
}

function temaInicial(): Tema {
  if (typeof window === 'undefined') return 'claro';
  const guardado = lerTemaGuardado();
  if (guardado) return guardado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

// Aplica o tema guardado logo no arranque, mesmo em páginas onde o toggle ainda não montou
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = temaInicial();
}

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    guardarTema(tema);
  }, [tema]);

  const alternar = () => setTema((atual) => (atual === 'claro' ? 'escuro' : 'claro'));

  return (
    <button
      type="button"
      onClick={alternar}
      className="rounded-full border p-2 text-xl leading-none transition-colors [border-color:var(--linha)] hover:[border-color:var(--tinta-suave)]"
      aria-label={tema === 'claro' ? 'Ativar modo noite' : 'Ativar modo dia'}
      title={tema === 'claro' ? 'Modo noite' : 'Modo dia'}
    >
      {tema === 'claro' ? '🌙' : '☀️'}
    </button>
  );
}
