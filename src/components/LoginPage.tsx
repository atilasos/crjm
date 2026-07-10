import { useState } from 'react';
import { Header } from './Header';
import { DEFAULT_TOURNAMENT_SERVER_URL } from '../tournament/server-config';
import {
  clearStudentSession,
  loadStudentSession,
  loginStudent,
  type StudentSession,
} from '../utils/student-session';

interface LoginPageProps {
  onVoltar: () => void;
}

export function LoginPage({ onVoltar }: LoginPageProps) {
  const [session, setSession] = useState<StudentSession | null>(() => loadStudentSession());
  const [serverUrl, setServerUrl] = useState(DEFAULT_TOURNAMENT_SERVER_URL);
  const [code, setCode] = useState('');
  const [aEntrar, setAEntrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const entrar = async () => {
    if (aEntrar) return;
    setErro(null);

    if (!serverUrl.trim()) {
      setErro('Indica o endereço do servidor de torneios.');
      return;
    }
    if (!code.trim()) {
      setErro('Escreve o teu código para entrar.');
      return;
    }

    setAEntrar(true);
    try {
      const novaSessao = await loginStudent(serverUrl, code);
      setSession(novaSessao);
      setCode('');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tenta novamente.');
    } finally {
      setAEntrar(false);
    }
  };

  const sair = () => {
    clearStudentSession();
    setSession(null);
    setErro(null);
  };

  return (
    <div className="min-h-screen">
      <Header titulo="Entrar" onVoltar={onVoltar} />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {session ? (
          <section className="rounded-3xl border border-white/20 bg-white/10 p-6 md:p-8 text-white backdrop-blur-sm text-center space-y-4">
            <div className="text-6xl">👋</div>
            <h2 className="text-2xl font-bold">
              Estás ligado como {session.name}
              {session.className ? ` (${session.className})` : ''}
            </h2>
            <p className="text-white/80">
              As tuas partidas de campeonato vão usar automaticamente o teu nome e a tua turma.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={sair}
                className="rounded-2xl border border-red-300/40 bg-red-500/20 px-5 py-3 font-semibold text-red-100 transition hover:bg-red-500/30"
              >
                Sair
              </button>
              <button
                type="button"
                onClick={onVoltar}
                className="rounded-2xl border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
              >
                Voltar ao início
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-white/20 bg-white/10 p-6 md:p-8 text-white backdrop-blur-sm space-y-5">
            <div className="text-center">
              <div className="text-6xl mb-3">🔑</div>
              <h2 className="text-2xl font-bold mb-2">Entrar com o teu código</h2>
              <p className="text-white/80">
                Pede o teu código ao professor e escreve-o aqui. Assim, o teu nome e a tua turma ficam
                preenchidos automaticamente no campeonato.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void entrar();
              }}
            >
              <label className="block">
                <span className="mb-1 block text-sm text-white/70">Servidor de torneios</span>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  placeholder="wss://exemplo.escola.pt"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-white/70">O teu código</span>
                <input
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="EX.: ABC123"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono text-lg tracking-widest uppercase"
                />
              </label>

              {erro && (
                <p className="rounded-lg border border-red-400/50 bg-red-500/20 px-3 py-2 text-sm text-red-100">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={aEntrar}
                className="w-full rounded-2xl bg-cyan-400/90 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aEntrar ? 'A entrar...' : 'Entrar'}
              </button>
            </form>

            <p className="text-center text-sm text-white/60">
              Não tens código? Não faz mal — podes continuar a jogar e a treinar sem entrar.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
