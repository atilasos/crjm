import { useEffect, useMemo, useState } from 'react';
import { Header } from './Header';
import {
  DEFAULT_TOURNAMENT_SERVER_URL,
  PRESET_TOURNAMENT_SERVERS,
  toTournamentAdminUrl,
  toTournamentHttpBaseUrl,
  toTournamentSpectatorUrl,
} from '../tournament/server-config';
import {
  addStudents,
  createClass,
  deleteClass,
  fetchClasses,
  removeStudent,
  type SchoolClassSummary,
} from '../utils/class-admin-api';

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
        <section className="rounded-xl border p-6 md:p-8 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border [border-color:var(--linha)] [background:var(--fundo)] px-3 py-1 text-sm [color:var(--tinta-suave)] mb-4">
                <span>🧑‍🏫</span>
                <span>Área reservada ao professor</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold [color:var(--tinta)] mb-3">
                Gestão rápida do campeonato e da projeção
              </h1>
              <p className="[color:var(--tinta)] text-lg leading-relaxed">
                Os alunos usam o site principal para treinar e entrar nos jogos. O professor usa esta página para abrir,
                numa nova aba, o painel de administração do servidor de torneio e o modo espectador projetado na sala.
              </p>
            </div>

            <div className="rounded-xl border p-4 [background:var(--fundo)] [border-color:var(--linha)] min-w-0 md:w-80">
              <div className="text-sm uppercase tracking-wide [color:var(--tinta-suave)] mb-2">Servidor ativo</div>
              <div className="[color:var(--tinta)] font-semibold break-all">{browserBaseUrl || 'Introduz o endereço do servidor'}</div>
              <p className="[color:var(--tinta-suave)] text-sm mt-2">
                O painel abre sempre no mesmo servidor onde os alunos estão a jogar em tempo real.
              </p>
              <p className="[color:var(--tinta-suave)] text-sm mt-2">
                Ao abrir o painel, o browser vai pedir a palavra-passe de administração configurada no servidor de torneio.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-xl border p-6 space-y-4 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
            <div>
              <h2 className="text-2xl font-bold [color:var(--tinta)] mb-2">Ligação ao servidor do torneio</h2>
              <p className="[color:var(--tinta-suave)]">
                Introduz o servidor da escola ou usa o valor configurado no ambiente. Este endereço é o mesmo usado no modo campeonato.
              </p>
            </div>

            <div>
              <label className="block [color:var(--tinta-suave)] text-xs font-medium mb-1">Servidor do torneio</label>
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
                className="w-full px-3 py-2 rounded-lg [background:var(--fundo)] border [border-color:var(--linha)] [color:var(--tinta)] focus:outline-none focus:ring-2 focus:ring-[var(--ouro)] text-sm mb-2"
              >
                {PRESET_TOURNAMENT_SERVERS.map((server) => (
                  <option key={server.url} value={server.url} className="[background:var(--painel)] [color:var(--tinta)]">
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
                  className="w-full px-3 py-2 rounded-lg [background:var(--fundo)] border [border-color:var(--linha)] [color:var(--tinta)] placeholder:[color:var(--tinta-suave)] focus:outline-none focus:ring-2 focus:ring-[var(--ouro)] font-mono text-sm"
                />
              )}

              <p className="[color:var(--tinta-suave)] text-xs mt-2">
                Se colares um endereço WebSocket, esta página converte-o automaticamente para a versão de browser.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <a
                href={canOpenLinks ? adminUrl : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canOpenLinks}
                className={`rounded-xl border p-4 transition ${canOpenLinks
                  ? '[border-color:var(--sucesso)] [background:color-mix(in_srgb,var(--sucesso)_10%,transparent)] hover:[background:color-mix(in_srgb,var(--sucesso)_18%,transparent)]'
                  : '[background:var(--fundo)] [border-color:var(--linha)] [color:var(--tinta-suave)] opacity-60 pointer-events-none'
                  }`}
              >
                <div className="text-3xl mb-3">🛠️</div>
                <h3 className="text-lg font-bold [color:var(--tinta)] mb-1">Abrir painel de administração</h3>
                <p className="text-sm [color:var(--tinta-suave)]">
                  Inscrições, arranque do torneio, reinícios de partidas, classificação, exportação e logs.
                </p>
              </a>

              <a
                href={canOpenLinks ? spectatorUrl : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canOpenLinks}
                className={`rounded-xl border p-4 transition ${canOpenLinks
                  ? '[border-color:var(--jogo-dominorio)] [background:color-mix(in_srgb,var(--jogo-dominorio)_10%,transparent)] hover:[background:color-mix(in_srgb,var(--jogo-dominorio)_18%,transparent)]'
                  : '[background:var(--fundo)] [border-color:var(--linha)] [color:var(--tinta-suave)] opacity-60 pointer-events-none'
                  }`}
              >
                <div className="text-3xl mb-3">📺</div>
                <h3 className="text-lg font-bold [color:var(--tinta)] mb-1">Abrir modo espectador</h3>
                <p className="text-sm [color:var(--tinta-suave)]">
                  Observa tabuleiros em tempo real e projeta os jogos ativos para a turma acompanhar.
                </p>
              </a>
            </div>
          </div>

          <div className="rounded-xl border p-6 space-y-4 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
            <h2 className="text-2xl font-bold [color:var(--tinta)]">Como usar na prática</h2>
            <div className="space-y-3 [color:var(--tinta)] text-sm leading-relaxed">
              <div className="rounded-xl border p-4 [background:var(--fundo)] [border-color:var(--linha)]">
                <div className="font-semibold [color:var(--tinta)] mb-1">1. Alunos</div>
                <p>Entram no site principal, escolhem “Modo Campeonato” e ligam-se ao servidor da escola.</p>
              </div>
              <div className="rounded-xl border p-4 [background:var(--fundo)] [border-color:var(--linha)]">
                <div className="font-semibold [color:var(--tinta)] mb-1">2. Professor</div>
                <p>Abre o painel de administração para criar o torneio, gerir jogadores e iniciar as partidas.</p>
              </div>
              <div className="rounded-xl border p-4 [background:var(--fundo)] [border-color:var(--linha)]">
                <div className="font-semibold [color:var(--tinta)] mb-1">3. Projeção</div>
                <p>Abre o modo espectador noutra aba ou ecrã para mostrar jogos e classificações em direto.</p>
              </div>
            </div>

            <div className="rounded-xl border p-4 [border-color:var(--ouro)] [background:color-mix(in_srgb,var(--ouro)_10%,transparent)]">
              <div className="font-semibold [color:var(--tinta)] mb-1">Importante</div>
              <p className="[color:var(--tinta-suave)] text-sm leading-relaxed">
                Este painel usa o servidor de torneio separado. Se o link não abrir, confirma primeiro se o servidor do campeonato
                está online no endereço indicado acima.
              </p>
            </div>
          </div>
        </section>

        <ClassManagementSection serverUrl={serverUrl} />
      </main>
    </div>
  );
}

const ADMIN_KEY_STORAGE_KEY = 'crjm-admin-key';

function lerChaveGuardada(): string {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function guardarChave(chave: string): void {
  try {
    sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, chave);
  } catch {
    // sessionStorage indisponível: a chave só dura enquanto a página estiver aberta.
  }
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Ocorreu um erro inesperado. Tenta novamente.';
}

function separarNomes(texto: string): string[] {
  return texto
    .split('\n')
    .map((nome) => nome.trim())
    .filter((nome) => nome.length > 0);
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function construirHtmlDeImpressao(turma: SchoolClassSummary): string {
  const cartoes = turma.students
    .map(
      (aluno) => `
        <div class="cartao">
          <div class="nome">${escaparHtml(aluno.name)}</div>
          <div class="codigo">${escaparHtml(aluno.code)}</div>
        </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>Códigos de acesso — ${escaparHtml(turma.name)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p.dica { color: #555; font-size: 13px; margin-top: 0; }
  .cartoes { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
  .cartao { border: 1px dashed #888; border-radius: 8px; padding: 12px 16px; width: 200px; page-break-inside: avoid; }
  .nome { font-weight: 600; margin-bottom: 6px; }
  .codigo { font-family: ui-monospace, monospace; font-size: 22px; letter-spacing: 2px; }
</style>
</head>
<body>
<h1>Códigos de acesso — ${escaparHtml(turma.name)}</h1>
<p class="dica">Recorta e entrega um cartão a cada aluno. O código é pessoal e serve para entrar no site.</p>
<div class="cartoes">
${cartoes}
</div>
</body>
</html>`;
}

interface ClassManagementSectionProps {
  serverUrl: string;
}

function ClassManagementSection({ serverUrl }: ClassManagementSectionProps) {
  const [adminKey, setAdminKey] = useState(lerChaveGuardada);
  const [turmas, setTurmas] = useState<SchoolClassSummary[] | null>(null);
  const [erro, setErro] = useState('');
  const [aLigar, setALigar] = useState(false);
  const [mutacaoEmCurso, setMutacaoEmCurso] = useState(false);
  const [turmasExpandidas, setTurmasExpandidas] = useState<Set<string>>(new Set());
  const [copiadoTurmaId, setCopiadoTurmaId] = useState<string | null>(null);

  // Formulário de nova turma
  const [nomeNovaTurma, setNomeNovaTurma] = useState('');
  const [alunosNovaTurma, setAlunosNovaTurma] = useState('');

  // Formulário "adicionar alunos" (uma turma de cada vez)
  const [turmaEmAdicao, setTurmaEmAdicao] = useState<string | null>(null);
  const [novosAlunosTexto, setNovosAlunosTexto] = useState('');

  const podeLigar = Boolean(toTournamentHttpBaseUrl(serverUrl)) && adminKey.trim().length > 0;

  // Mudar de servidor invalida a lista carregada.
  useEffect(() => {
    setTurmas(null);
    setErro('');
    setTurmasExpandidas(new Set());
    setTurmaEmAdicao(null);
  }, [serverUrl]);

  async function recarregarTurmas(): Promise<void> {
    const lista = await fetchClasses(serverUrl, adminKey);
    setTurmas(lista);
  }

  async function ligar(): Promise<void> {
    setALigar(true);
    setErro('');
    try {
      await recarregarTurmas();
      guardarChave(adminKey);
    } catch (excecao) {
      setErro(mensagemDeErro(excecao));
    } finally {
      setALigar(false);
    }
  }

  async function executarMutacao(operacao: () => Promise<void>): Promise<void> {
    setMutacaoEmCurso(true);
    setErro('');
    try {
      await operacao();
      await recarregarTurmas();
    } catch (excecao) {
      setErro(mensagemDeErro(excecao));
    } finally {
      setMutacaoEmCurso(false);
    }
  }

  async function criarTurma(): Promise<void> {
    const nome = nomeNovaTurma.trim();
    if (!nome) {
      setErro('Indica o nome da turma antes de a criar.');
      return;
    }

    await executarMutacao(async () => {
      const turmaCriada = await createClass(serverUrl, adminKey, nome, separarNomes(alunosNovaTurma));
      setNomeNovaTurma('');
      setAlunosNovaTurma('');
      setTurmasExpandidas((atual) => new Set(atual).add(turmaCriada.id));
    });
  }

  async function adicionarAlunos(turmaId: string): Promise<void> {
    const nomes = separarNomes(novosAlunosTexto);
    if (nomes.length === 0) {
      setErro('Escreve pelo menos um nome de aluno (um por linha).');
      return;
    }

    await executarMutacao(async () => {
      await addStudents(serverUrl, adminKey, turmaId, nomes);
      setTurmaEmAdicao(null);
      setNovosAlunosTexto('');
    });
  }

  async function apagarTurma(turma: SchoolClassSummary): Promise<void> {
    const confirmado = window.confirm(
      `Apagar a turma "${turma.name}"? Os códigos de todos os alunos desta turma deixam de funcionar.`,
    );
    if (!confirmado) return;

    await executarMutacao(async () => {
      await deleteClass(serverUrl, adminKey, turma.id);
    });
  }

  async function removerAluno(turma: SchoolClassSummary, alunoId: string, alunoNome: string): Promise<void> {
    const confirmado = window.confirm(`Remover "${alunoNome}" da turma "${turma.name}"? O código deixa de funcionar.`);
    if (!confirmado) return;

    await executarMutacao(async () => {
      await removeStudent(serverUrl, adminKey, turma.id, alunoId);
    });
  }

  function alternarExpansao(turmaId: string): void {
    setTurmasExpandidas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(turmaId)) {
        proximo.delete(turmaId);
      } else {
        proximo.add(turmaId);
      }
      return proximo;
    });
  }

  async function copiarCodigos(turma: SchoolClassSummary): Promise<void> {
    const texto = turma.students.map((aluno) => `${aluno.name}\t${aluno.code}`).join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoTurmaId(turma.id);
      window.setTimeout(() => setCopiadoTurmaId((atual) => (atual === turma.id ? null : atual)), 2000);
    } catch {
      setErro('Não foi possível copiar para a área de transferência.');
    }
  }

  function imprimirCodigos(turma: SchoolClassSummary): void {
    const janela = window.open('', '_blank');
    if (!janela) {
      setErro('O browser bloqueou a janela de impressão. Permite pop-ups para esta página e tenta novamente.');
      return;
    }

    janela.document.write(construirHtmlDeImpressao(turma));
    janela.document.close();
    janela.focus();
    janela.print();
  }

  return (
    <section className="rounded-xl border p-6 md:p-8 space-y-6 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold [color:var(--tinta)] mb-2">🎒 Turmas e códigos dos alunos</h2>
          <p className="[color:var(--tinta-suave)]">
            Cria turmas, gera códigos de acesso e imprime cartões para distribuir. Os alunos usam o código para entrar no
            site sem passwords nem emails.
          </p>
        </div>

        {turmas !== null && (
          <button
            type="button"
            onClick={() => void ligar()}
            disabled={aLigar || mutacaoEmCurso}
            className="self-start px-4 py-2 rounded-lg border [border-color:var(--linha)] [color:var(--tinta)] text-sm hover:[background:color-mix(in_srgb,var(--tinta)_6%,transparent)] transition disabled:opacity-50"
          >
            🔄 {aLigar ? 'A atualizar...' : 'Atualizar lista'}
          </button>
        )}
      </div>

      <div className="rounded-xl border p-4 [background:var(--fundo)] [border-color:var(--linha)] space-y-3">
        <label className="block [color:var(--tinta-suave)] text-xs font-medium" htmlFor="admin-key-input">
          Chave de professor (ADMIN_KEY do servidor)
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="admin-key-input"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="Chave de administração"
            autoComplete="off"
            className="flex-1 px-3 py-2 rounded-lg [background:var(--fundo)] border [border-color:var(--linha)] [color:var(--tinta)] placeholder:[color:var(--tinta-suave)] focus:outline-none focus:ring-2 focus:ring-[var(--ouro)] font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => void ligar()}
            disabled={!podeLigar || aLigar}
            className="px-4 py-2 rounded-lg [background:var(--tinta)] [color:var(--fundo)] font-semibold text-sm hover:[background:var(--tinta-suave)] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {aLigar ? 'A ligar...' : turmas === null ? '🔑 Ligar às turmas' : '🔑 Voltar a ligar'}
          </button>
        </div>
        <p className="[color:var(--tinta-suave)] text-xs">
          A chave fica guardada apenas nesta sessão do browser e é a mesma palavra-passe do painel de administração.
        </p>
      </div>

      {erro && (
        <div className="rounded-xl border p-4 [border-color:var(--perigo)] [background:color-mix(in_srgb,var(--perigo)_10%,transparent)] [color:var(--perigo)] text-sm" role="alert">
          ⚠️ {erro}
        </div>
      )}

      {turmas !== null && (
        <>
          <div className="space-y-4">
            {turmas.length === 0 && (
              <p className="[color:var(--tinta-suave)] text-sm">Ainda não há turmas neste servidor. Cria a primeira em baixo.</p>
            )}

            {turmas.map((turma) => {
              const expandida = turmasExpandidas.has(turma.id);
              return (
                <div key={turma.id} className="rounded-xl border p-4 [background:var(--fundo)] [border-color:var(--linha)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => alternarExpansao(turma.id)}
                      className="flex items-center gap-3 text-left [color:var(--tinta)] hover:[color:var(--tinta-suave)] transition"
                    >
                      <span aria-hidden="true">{expandida ? '▾' : '▸'}</span>
                      <span className="text-lg font-bold">{turma.name}</span>
                      <span className="[color:var(--tinta-suave)] text-sm">
                        {turma.students.length} {turma.students.length === 1 ? 'aluno' : 'alunos'}
                      </span>
                    </button>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copiarCodigos(turma)}
                        disabled={turma.students.length === 0}
                        className="px-3 py-1.5 rounded-lg border [border-color:var(--linha)] [color:var(--tinta)] text-xs hover:[background:color-mix(in_srgb,var(--tinta)_6%,transparent)] transition disabled:opacity-40"
                      >
                        {copiadoTurmaId === turma.id ? '✅ Copiado!' : '📋 Copiar códigos'}
                      </button>
                      <button
                        type="button"
                        onClick={() => imprimirCodigos(turma)}
                        disabled={turma.students.length === 0}
                        className="px-3 py-1.5 rounded-lg border [border-color:var(--linha)] [color:var(--tinta)] text-xs hover:[background:color-mix(in_srgb,var(--tinta)_6%,transparent)] transition disabled:opacity-40"
                      >
                        🖨️ Imprimir códigos
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTurmaEmAdicao((atual) => {
                            setNovosAlunosTexto('');
                            return atual === turma.id ? null : turma.id;
                          })
                        }
                        disabled={mutacaoEmCurso}
                        className="px-3 py-1.5 rounded-lg border [border-color:var(--jogo-dominorio)] [background:color-mix(in_srgb,var(--jogo-dominorio)_12%,transparent)] [color:var(--tinta)] text-xs hover:[background:color-mix(in_srgb,var(--jogo-dominorio)_20%,transparent)] transition disabled:opacity-40"
                      >
                        ➕ Adicionar alunos
                      </button>
                      <button
                        type="button"
                        onClick={() => void apagarTurma(turma)}
                        disabled={mutacaoEmCurso}
                        className="px-3 py-1.5 rounded-lg border [border-color:var(--perigo)] [color:var(--perigo)] text-xs hover:[background:color-mix(in_srgb,var(--perigo)_10%,transparent)] transition disabled:opacity-40"
                      >
                        🗑️ Apagar turma
                      </button>
                    </div>
                  </div>

                  {turmaEmAdicao === turma.id && (
                    <div className="rounded-xl border p-4 space-y-3 [background:var(--fundo)] [border-color:var(--linha)]">
                      <label className="block [color:var(--tinta-suave)] text-xs font-medium" htmlFor={`novos-alunos-${turma.id}`}>
                        Novos alunos (um nome por linha)
                      </label>
                      <textarea
                        id={`novos-alunos-${turma.id}`}
                        value={novosAlunosTexto}
                        onChange={(event) => setNovosAlunosTexto(event.target.value)}
                        rows={4}
                        placeholder={'Maria\nRui\nAna'}
                        className="w-full px-3 py-2 rounded-lg [background:var(--fundo)] border [border-color:var(--linha)] [color:var(--tinta)] placeholder:[color:var(--tinta-suave)] focus:outline-none focus:ring-2 focus:ring-[var(--ouro)] text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void adicionarAlunos(turma.id)}
                          disabled={mutacaoEmCurso}
                          className="px-4 py-2 rounded-lg [background:var(--tinta)] [color:var(--fundo)] text-sm font-semibold hover:[background:var(--tinta-suave)] transition disabled:opacity-40"
                        >
                          {mutacaoEmCurso ? 'A adicionar...' : 'Adicionar à turma'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTurmaEmAdicao(null);
                            setNovosAlunosTexto('');
                          }}
                          className="px-4 py-2 rounded-lg border [border-color:var(--linha)] [color:var(--tinta)] text-sm hover:[background:color-mix(in_srgb,var(--tinta)_6%,transparent)] transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {expandida && (
                    <div className="overflow-x-auto">
                      {turma.students.length === 0 ? (
                        <p className="[color:var(--tinta-suave)] text-sm">Esta turma ainda não tem alunos.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left [color:var(--tinta-suave)] border-b [border-color:var(--linha)]">
                              <th className="py-2 pr-4 font-medium">Alcunha</th>
                              <th className="py-2 pr-4 font-medium">Código</th>
                              <th className="py-2 font-medium sr-only">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {turma.students.map((aluno) => (
                              <tr key={aluno.id} className="border-b [border-color:var(--linha)] last:border-b-0">
                                <td className="py-2 pr-4 [color:var(--tinta)]">{aluno.name}</td>
                                <td className="py-2 pr-4">
                                  <span className="font-mono text-base font-bold tracking-widest [color:var(--tinta)] border [border-color:var(--linha)] [background:var(--fundo)] rounded px-2 py-0.5">
                                    {aluno.code}
                                  </span>
                                </td>
                                <td className="py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => void removerAluno(turma, aluno.id, aluno.name)}
                                    disabled={mutacaoEmCurso}
                                    className="px-2 py-1 rounded-lg border [border-color:var(--perigo)] [color:var(--perigo)] text-xs hover:[background:color-mix(in_srgb,var(--perigo)_10%,transparent)] transition disabled:opacity-40"
                                  >
                                    Remover
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border p-4 [background:var(--fundo)] [border-color:var(--linha)] space-y-3">
            <h3 className="text-lg font-bold [color:var(--tinta)]">➕ Criar nova turma</h3>
            <div>
              <label className="block [color:var(--tinta-suave)] text-xs font-medium mb-1" htmlFor="nome-nova-turma">
                Nome da turma
              </label>
              <input
                id="nome-nova-turma"
                type="text"
                value={nomeNovaTurma}
                onChange={(event) => setNomeNovaTurma(event.target.value)}
                placeholder="Ex.: 5.º A"
                className="w-full px-3 py-2 rounded-lg [background:var(--fundo)] border [border-color:var(--linha)] [color:var(--tinta)] placeholder:[color:var(--tinta-suave)] focus:outline-none focus:ring-2 focus:ring-[var(--ouro)] text-sm"
              />
            </div>
            <div>
              <label className="block [color:var(--tinta-suave)] text-xs font-medium mb-1" htmlFor="alunos-nova-turma">
                Alunos (um por linha, alcunha ou primeiro nome)
              </label>
              <textarea
                id="alunos-nova-turma"
                value={alunosNovaTurma}
                onChange={(event) => setAlunosNovaTurma(event.target.value)}
                rows={5}
                placeholder={'Maria\nRui\nAna'}
                className="w-full px-3 py-2 rounded-lg [background:var(--fundo)] border [border-color:var(--linha)] [color:var(--tinta)] placeholder:[color:var(--tinta-suave)] focus:outline-none focus:ring-2 focus:ring-[var(--ouro)] text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void criarTurma()}
              disabled={mutacaoEmCurso || nomeNovaTurma.trim().length === 0}
              className="px-4 py-2 rounded-lg [background:var(--tinta)] [color:var(--fundo)] font-semibold text-sm hover:[background:var(--tinta-suave)] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mutacaoEmCurso ? 'A criar...' : 'Criar turma e gerar códigos'}
            </button>
            <p className="[color:var(--tinta-suave)] text-xs">
              Os códigos são gerados automaticamente pelo servidor. Depois de criar, expande a turma para os ver, copiar
              ou imprimir.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
