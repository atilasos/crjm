import { useMemo, useState } from 'react';
import { Header } from './Header';
import {
  DEFAULT_TOURNAMENT_SERVER_URL,
  PRESET_TOURNAMENT_SERVERS,
  toTournamentAdminUrl,
  toTournamentHttpBaseUrl,
  toTournamentSpectatorUrl,
} from '../tournament/server-config';

interface AdminPanelPageProps {
  onVoltar: () => void;
}

export function AdminPanelPage({ onVoltar }: AdminPanelPageProps) {
  const [serverUrl, setServerUrl] = useState(DEFAULT_TOURNAMENT_SERVER_URL);

  const selectedPreset = PRESET_TOURNAMENT_SERVERS.find((server) => server.url === serverUrl)?.url || 'custom';
  const showCustomInput = !PRESET_TOURNAMENT_SERVERS.some((server) => server.url === serverUrl && server.url !== 'custom');

  const adminUrl = useMemo(() => toTournamentAdminUrl(serverUrl), [serverUrl]);
  const spectatorUrl = useMemo(() => toTournamentSpectatorUrl(serverUrl), [serverUrl]);
  const browserBaseUrl = useMemo(() => toTournamentHttpBaseUrl(serverUrl), [serverUrl]);
  const canOpenLinks = Boolean(browserBaseUrl);

  return (
    <div className="min-h-screen">
      <Header titulo="Painel do professor" onVoltar={onVoltar} />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white/12 backdrop-blur-md rounded-3xl border border-white/20 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/80 mb-4">
                <span>🧑‍🏫</span>
                <span>Área reservada ao professor</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white text-shadow-lg mb-3">
                Gestão rápida do campeonato e da projeção
              </h1>
              <p className="text-white/80 text-lg leading-relaxed">
                Os alunos usam o site principal para treinar e entrar nos jogos. O professor usa esta página para abrir,
                numa nova aba, o painel de administração do servidor de torneio e o modo espectador projetado na sala.
              </p>
            </div>

            <div className="bg-white/10 rounded-2xl border border-white/15 p-4 min-w-0 md:w-80">
              <div className="text-sm uppercase tracking-wide text-white/55 mb-2">Servidor ativo</div>
              <div className="text-white font-semibold break-all">{browserBaseUrl || 'Introduz o endereço do servidor'}</div>
              <p className="text-white/60 text-sm mt-2">
                O painel abre sempre no mesmo servidor onde os alunos estão a jogar em tempo real.
              </p>
              <p className="text-white/50 text-sm mt-2">
                Ao abrir o painel, o browser vai pedir a palavra-passe de administração configurada no servidor de torneio.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Ligação ao servidor do torneio</h2>
              <p className="text-white/75">
                Escolhe o servidor da escola ou escreve um endereço manual. Este endereço é o mesmo usado no modo campeonato.
              </p>
            </div>

            <div>
              <label className="block text-white/60 text-xs font-medium mb-1">Servidor do torneio</label>
              <select
                value={selectedPreset}
                onChange={(event) => {
                  const selected = event.target.value;
                  if (selected === 'custom') {
                    setServerUrl('');
                  } else {
                    setServerUrl(selected);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50 text-sm mb-2"
              >
                {PRESET_TOURNAMENT_SERVERS.map((server) => (
                  <option key={server.url} value={server.url} className="bg-gray-800">
                    {server.label}
                  </option>
                ))}
              </select>

              {showCustomInput && (
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  placeholder="wss://torneio.exemplo.com ou ws://192.168.1.100:4000"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 font-mono text-sm"
                />
              )}

              <p className="text-white/40 text-xs mt-2">
                Se colares um endereço WebSocket, esta página converte-o automaticamente para a versão de browser.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <a
                href={canOpenLinks ? adminUrl : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canOpenLinks}
                className={`rounded-2xl border p-4 transition ${canOpenLinks
                  ? 'bg-gradient-to-br from-emerald-500/30 to-green-600/30 border-emerald-300/40 hover:bg-emerald-500/40'
                  : 'bg-white/5 border-white/10 text-white/40 pointer-events-none'
                  }`}
              >
                <div className="text-3xl mb-3">🛠️</div>
                <h3 className="text-lg font-bold text-white mb-1">Abrir painel de administração</h3>
                <p className="text-sm text-white/75">
                  Inscrições, arranque do torneio, reinícios de partidas, classificação, exportação e logs.
                </p>
              </a>

              <a
                href={canOpenLinks ? spectatorUrl : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canOpenLinks}
                className={`rounded-2xl border p-4 transition ${canOpenLinks
                  ? 'bg-gradient-to-br from-sky-500/30 to-indigo-600/30 border-sky-300/40 hover:bg-sky-500/40'
                  : 'bg-white/5 border-white/10 text-white/40 pointer-events-none'
                  }`}
              >
                <div className="text-3xl mb-3">📺</div>
                <h3 className="text-lg font-bold text-white mb-1">Abrir modo espectador</h3>
                <p className="text-sm text-white/75">
                  Observa tabuleiros em tempo real e projeta os jogos ativos para a turma acompanhar.
                </p>
              </a>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 space-y-4">
            <h2 className="text-2xl font-bold text-white">Como usar na prática</h2>
            <div className="space-y-3 text-white/80 text-sm leading-relaxed">
              <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                <div className="font-semibold text-white mb-1">1. Alunos</div>
                <p>Entram no site principal, escolhem “Modo Campeonato” e ligam-se ao servidor da escola.</p>
              </div>
              <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                <div className="font-semibold text-white mb-1">2. Professor</div>
                <p>Abre o painel de administração para criar o torneio, gerir jogadores e iniciar as partidas.</p>
              </div>
              <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                <div className="font-semibold text-white mb-1">3. Projeção</div>
                <p>Abre o modo espectador noutra aba ou ecrã para mostrar jogos e classificações em direto.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-yellow-300/30 bg-yellow-500/10 p-4">
              <div className="font-semibold text-yellow-100 mb-1">Importante</div>
              <p className="text-yellow-100/85 text-sm leading-relaxed">
                Este painel usa o servidor de torneio separado. Se o link não abrir, confirma primeiro se o servidor do campeonato
                está online no endereço indicado acima.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
