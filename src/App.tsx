import { useEffect, useRef, useState, type ComponentType } from 'react';
import "./index.css";
import { navegacaoBloqueada } from './navigation-guard';
import { Header } from './components/Header';
import { GameCard } from './components/GameCard';
import GatosCaesVignette from './components/vignettes/GatosCaesVignette';
import DominorioVignette from './components/vignettes/DominorioVignette';
import QuelhasVignette from './components/vignettes/QuelhasVignette';
import ProdutoVignette from './components/vignettes/ProdutoVignette';
import AtariGoVignette from './components/vignettes/AtariGoVignette';
import NexVignette from './components/vignettes/NexVignette';
import { CampeonatoPage } from './components/CampeonatoPage';
import { PerfilPage } from './components/PerfilPage';
import { AchievementPopup } from './components/gamification/AchievementPopup';
import { AdminPanelPage } from './components/AdminPanelPage';
import { GameProgressBars } from './components/gamification/GameProgressBars';
import { GamificationProvider, useGamification } from './components/gamification/GamificationProvider';
import { GatosCaesGame } from './games/gatos-caes/GatosCaesGame';
import { DominorioGame } from './games/dominorio/DominorioGame';
import { QuelhasGame } from './games/quelhas/QuelhasGame';
import { AtariGoGame } from './games/atari-go/AtariGoGame';
import { ProdutoGame } from './games/produto/ProdutoGame';
import { NexGame } from './games/nex/NexGame';
import { PuzzlePage } from './components/PuzzlePage';
import { LoginPage } from './components/LoginPage';

type Pagina = 'inicio' | 'perfil' | 'entrar' | 'puzzles' | 'campeonato' | 'admin' | 'gatos-caes' | 'dominorio' | 'quelhas' | 'atari-go' | 'produto' | 'nex';

const PAGINAS: readonly Pagina[] = ['inicio', 'perfil', 'entrar', 'puzzles', 'campeonato', 'admin', 'gatos-caes', 'dominorio', 'quelhas', 'atari-go', 'produto', 'nex'];

interface JogoInfo {
  id: Pagina;
  titulo: string;
  descricao: string;
  acento: string;
  ciclos: string[];
  Vignette: ComponentType<{ animate?: boolean; className?: string }>;
}

const JOGOS: JogoInfo[] = [
  {
    id: 'gatos-caes',
    titulo: 'Gatos & Cães',
    descricao: 'Jogo de colocação: coloca peças sem que gatos fiquem ao lado de cães. Ganha quem fizer a última jogada!',
    acento: 'var(--jogo-gatos)',
    ciclos: ['1.º Ciclo'],
    Vignette: GatosCaesVignette,
  },
  {
    id: 'dominorio',
    titulo: 'Dominório',
    descricao: 'Coloca dominós no tabuleiro: um joga na vertical, outro na horizontal. Ganha quem colocar a última peça!',
    acento: 'var(--jogo-dominorio)',
    ciclos: ['1.º Ciclo', '2.º Ciclo'],
    Vignette: DominorioVignette,
  },
  {
    id: 'quelhas',
    titulo: 'Quelhas',
    descricao: 'Coloca segmentos no tabuleiro: um joga na vertical, outro na horizontal. ATENÇÃO: Perde quem fizer a última jogada!',
    acento: 'var(--jogo-quelhas)',
    ciclos: ['1.º Ciclo', '2.º Ciclo', '3.º Ciclo'],
    Vignette: QuelhasVignette,
  },
  {
    id: 'produto',
    titulo: 'Produto',
    descricao: 'Maximiza a pontuação dos teus grupos num tabuleiro hexagonal. Sabota o adversário unindo os grupos dele!',
    acento: 'var(--jogo-produto)',
    ciclos: ['2.º Ciclo', '3.º Ciclo', 'Secundário'],
    Vignette: ProdutoVignette,
  },
  {
    id: 'atari-go',
    titulo: 'Atari Go',
    descricao: 'Variante simplificada do Go: rodeia as pedras adversárias. A primeira captura vence o jogo!',
    acento: 'var(--jogo-atari)',
    ciclos: ['3.º Ciclo', 'Secundário'],
    Vignette: AtariGoVignette,
  },
  {
    id: 'nex',
    titulo: 'Nex',
    descricao: 'Jogo de conexão com peças neutras. Liga as tuas margens opostas antes do adversário!',
    acento: 'var(--jogo-nex)',
    ciclos: ['Secundário'],
    Vignette: NexVignette,
  },
];

function paginaDoHash(): Pagina {
  if (typeof window === 'undefined') return 'inicio';
  const slug = window.location.hash.replace(/^#\/?/, '');
  return (PAGINAS as readonly string[]).includes(slug) ? (slug as Pagina) : 'inicio';
}

export function App() {
  return (
    <GamificationProvider>
      <AppContent />
    </GamificationProvider>
  );
}

function AppContent() {
  const [paginaAtual, setPaginaAtualState] = useState<Pagina>(paginaDoHash);
  const { activePopup, dismissPopup, isReady, profile } = useGamification();
  const grelhaRef = useRef<HTMLElement | null>(null);

  const paginaRef = useRef(paginaAtual);
  paginaRef.current = paginaAtual;

  useEffect(() => {
    const sincronizar = () => {
      const destino = paginaDoHash();
      if (destino === paginaRef.current) return;
      if (navegacaoBloqueada()) {
        // Repõe o hash da página atual para o retroceder não abandonar um torneio
        window.location.hash = paginaRef.current === 'inicio' ? '/' : `/${paginaRef.current}`;
        return;
      }
      setPaginaAtualState(destino);
    };
    window.addEventListener('hashchange', sincronizar);
    return () => window.removeEventListener('hashchange', sincronizar);
  }, []);

  const setPaginaAtual = (pagina: Pagina) => {
    window.location.hash = pagina === 'inicio' ? '/' : `/${pagina}`;
    setPaginaAtualState(pagina);
  };

  const voltarInicio = () => setPaginaAtual('inicio');

  if (paginaAtual === 'campeonato') {
    return <CampeonatoPage onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'perfil') {
    return <PerfilPage onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'entrar') {
    return <LoginPage onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'puzzles') {
    return <PuzzlePage onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'admin') {
    return <AdminPanelPage onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'gatos-caes') {
    return <GatosCaesGame onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'dominorio') {
    return <DominorioGame onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'quelhas') {
    return <QuelhasGame onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'atari-go') {
    return <AtariGoGame onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'produto') {
    return <ProdutoGame onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'nex') {
    return <NexGame onVoltar={voltarInicio} />;
  }


  return (
    <div className="min-h-screen">
      <Header />
      <AchievementPopup achievement={activePopup} onClose={dismissPopup} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Hero */}
        <section className="mx-auto max-w-2xl py-10 text-center md:py-14">
          <h1
            className="mb-4 text-4xl font-extrabold md:text-5xl [color:var(--tinta)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Treino para o CRJM
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-lg [color:var(--tinta-suave)]">
            Pratica os seis jogos oficiais do Campeonato Regional de Jogos Matemáticos
            da Madeira — do 1.º Ciclo ao Secundário.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => grelhaRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="btn btn-primary"
            >
              Escolher jogo
            </button>
            <button
              type="button"
              onClick={() => setPaginaAtual('campeonato')}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors [border-color:var(--linha)] [color:var(--tinta-suave)] hover:[border-color:var(--ouro)] hover:[color:var(--tinta)]"
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full [background:var(--ouro)]" />
              Modo Campeonato
            </button>
          </div>
        </section>

        {/* Grelha dos 6 jogos */}
        <section ref={grelhaRef} className="mb-12 scroll-mt-20" aria-labelledby="titulo-jogos">
          <h2
            id="titulo-jogos"
            className="mb-6 text-2xl font-bold [color:var(--tinta)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Escolhe o teu jogo
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {JOGOS.map(({ id, titulo, descricao, acento, ciclos, Vignette }) => (
              <GameCard
                key={id}
                titulo={titulo}
                descricao={descricao}
                acento={acento}
                ciclos={ciclos}
                vignette={<Vignette />}
                onClick={() => setPaginaAtual(id)}
              />
            ))}
          </div>
        </section>

        {/* Campeonato — única secção cerimonial */}
        <section className="mb-6 rounded-[var(--raio-painel)] border p-6 md:p-8 [background:var(--painel)] [border-color:var(--ouro)] [box-shadow:var(--sombra)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-sm font-bold uppercase tracking-wide [color:var(--ouro)]">
                Campeonato
              </p>
              <h2
                className="mb-2 text-2xl font-bold [color:var(--tinta)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Modo Campeonato
              </h2>
              <p className="[color:var(--tinta-suave)]">
                Participa no campeonato interno da escola: liga-te ao servidor, compete
                contra colegas em dupla eliminação e representa a escola no CRJM.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPaginaAtual('campeonato')}
              className="btn self-start md:self-auto"
              style={{ background: 'var(--ouro)', color: '#1C2B45' }}
            >
              Entrar no campeonato
            </button>
          </div>
        </section>

        {/* Laboratório de Estratégias */}
        <section className="mb-12 rounded-[var(--raio-painel)] border p-6 md:p-8 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2
                className="mb-2 text-2xl font-bold [color:var(--tinta)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Laboratório de Estratégias
              </h2>
              <p className="[color:var(--tinta-suave)]">
                Resolve puzzles curtos, pede uma pista quando precisares e transforma
                cada ideia num cartão dominado.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPaginaAtual('puzzles')}
              className="btn btn-secondary self-start md:self-auto"
            >
              Resolver puzzles
            </button>
          </div>
        </section>

        <section className="mb-12">
          <GameProgressBars isReady={isReady} gameProgress={profile.gameProgress} />
        </section>

        {/* Informações */}
        <section className="mb-6 rounded-[var(--raio-painel)] border p-6 md:p-8 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
          <h2
            className="mb-4 text-xl font-bold [color:var(--tinta)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sobre este site
          </h2>
          <div className="space-y-3 [color:var(--tinta-suave)]">
            <p>
              Este site permite praticar todos os jogos oficiais do Campeonato Regional
              de Jogos Matemáticos da Madeira (CRJM), abrangendo do 1.º Ciclo ao Secundário.
            </p>
            <p>
              Podes jogar sozinho contra o computador ou com um amigo no mesmo computador.
              As regras de cada jogo seguem as regras oficiais do campeonato.
            </p>
            <div className="mt-4 rounded-[var(--raio-controlo)] border p-3 [border-color:var(--linha)]">
              <p className="text-sm">
                <strong className="[color:var(--tinta)]">Jogos por ciclo:</strong><br/>
                • 1.º Ciclo: Gatos & Cães, Dominório, Quelhas<br/>
                • 2.º Ciclo: Dominório, Quelhas, Produto<br/>
                • 3.º Ciclo: Quelhas, Produto, Atari Go<br/>
                • Secundário: Produto, Atari Go, Nex
              </p>
            </div>
            <div className="mt-2 rounded-[var(--raio-controlo)] border p-3 [border-color:var(--linha)]">
              <p className="text-sm">
                <strong className="[color:var(--tinta)]">Dica importante:</strong> O Quelhas é um
                jogo <strong className="[color:var(--tinta)]">misère</strong> — perde quem faz a
                última jogada! Nos outros jogos, ganha quem faz a última jogada
                (exceto Atari Go, onde a primeira captura vence).
              </p>
            </div>
            <p className="text-sm">
              Para mais informações sobre o CRJM, visita:{' '}
              <a
                href="https://projetosdre.madeira.gov.pt/crjmram/jogos/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline [color:var(--tinta)] hover:[color:var(--tinta-suave)]"
              >
                projetosdre.madeira.gov.pt/crjmram/jogos
              </a>
            </p>
          </div>
        </section>

        {/* Área do professor — bloco único, no fim */}
        <section className="mb-12 rounded-[var(--raio-painel)] border p-6 md:p-8 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-sm font-bold uppercase tracking-wide [color:var(--tinta-suave)]">
                Área do professor
              </p>
              <h2
                className="mb-2 text-2xl font-bold [color:var(--tinta)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Gerir torneios, projeção e ligações da turma
              </h2>
              <p className="[color:var(--tinta-suave)]">
                O painel de administração abre o servidor do campeonato já existente,
                sem misturar as ferramentas do professor com a área dos alunos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPaginaAtual('admin')}
              className="btn btn-secondary self-start md:self-auto"
            >
              Abrir painel do professor
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm [border-color:var(--linha)] [color:var(--tinta-suave)]">
        <p>Jogos Matemáticos — Treino para o CRJM</p>
        <p className="mt-2">
          <a
            href="https://github.com/atilasos/crjm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:[color:var(--tinta)]"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            Código fonte no GitHub
          </a>
          {' · '}
          <span>Uso educativo gratuito</span>
        </p>
      </footer>
    </div>
  );
}

export default App;
