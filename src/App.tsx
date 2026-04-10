import { useState } from 'react';
import "./index.css";
import { Header } from './components/Header';
import { GameCard } from './components/GameCard';
import { CampeonatoPage } from './components/CampeonatoPage';
import { PerfilPage } from './components/PerfilPage';
import { AchievementPopup } from './components/gamification/AchievementPopup';
import { GameProgressBars } from './components/gamification/GameProgressBars';
import { GamificationProvider, useGamification } from './components/gamification/GamificationProvider';
import { GatosCaesGame } from './games/gatos-caes/GatosCaesGame';
import { DominorioGame } from './games/dominorio/DominorioGame';
import { QuelhasGame } from './games/quelhas/QuelhasGame';
import { AtariGoGame } from './games/atari-go/AtariGoGame';
import { ProdutoGame } from './games/produto/ProdutoGame';
import { NexGame } from './games/nex/NexGame';

type Pagina = 'inicio' | 'perfil' | 'campeonato' | 'gatos-caes' | 'dominorio' | 'quelhas' | 'atari-go' | 'produto' | 'nex';

export function App() {
  return (
    <GamificationProvider>
      <AppContent />
    </GamificationProvider>
  );
}

function AppContent() {
  const [paginaAtual, setPaginaAtual] = useState<Pagina>('inicio');
  const { activePopup, dismissPopup, isReady, profile } = useGamification();

  const voltarInicio = () => setPaginaAtual('inicio');

  if (paginaAtual === 'campeonato') {
    return <CampeonatoPage onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'perfil') {
    return <PerfilPage onVoltar={voltarInicio} />;
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
      
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <div className="inline-block mb-6 animate-float">
            <span className="text-7xl">🎯</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white text-shadow-lg mb-4">
            Treino para o CRJM
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-2">
            Campeonato Regional de Jogos Matemáticos da Madeira
          </p>
          <p className="text-lg text-white/75 max-w-xl mx-auto">
            Pratica todos os jogos oficiais do campeonato — do 1.º Ciclo ao Secundário!
          </p>
          <button
            type="button"
            onClick={() => setPaginaAtual('perfil')}
            className="mt-6 rounded-2xl border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
          >
            Ver perfil e progresso
          </button>
        </section>

        {/* Cartões dos jogos */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white text-shadow text-center mb-8">
            Escolhe um jogo para começar
          </h2>
          
          {/* Card especial do Campeonato */}
          <div className="mb-8">
            <GameCard
              titulo="🏆 Modo Campeonato"
              descricao="Participa no campeonato interno da escola! Liga-te ao servidor, compete contra colegas em dupla eliminação e representa a escola no CRJM."
              emoji="🏆"
              corFundo="bg-gradient-to-br from-yellow-500 to-orange-600"
              onClick={() => setPaginaAtual('campeonato')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <GameCard
              titulo="Gatos & Cães"
              descricao="Jogo de colocação: coloca peças sem que gatos fiquem ao lado de cães. Ganha quem fizer a última jogada!"
              emoji="🐱🐶"
              corFundo="bg-gradient-to-br from-orange-500 to-amber-600"
              onClick={() => setPaginaAtual('gatos-caes')}
            />
            
            <GameCard
              titulo="Dominório"
              descricao="Coloca dominós no tabuleiro: um joga na vertical, outro na horizontal. Ganha quem colocar a última peça!"
              emoji="🁓"
              corFundo="bg-gradient-to-br from-emerald-500 to-teal-600"
              onClick={() => setPaginaAtual('dominorio')}
            />
            
            <GameCard
              titulo="Quelhas"
              descricao="Coloca segmentos no tabuleiro: um joga na vertical, outro na horizontal. ATENÇÃO: Perde quem fizer a última jogada!"
              emoji="▮"
              corFundo="bg-gradient-to-br from-blue-500 to-indigo-600"
              onClick={() => setPaginaAtual('quelhas')}
            />
            
            <GameCard
              titulo="Produto"
              descricao="Maximiza a pontuação dos teus grupos num tabuleiro hexagonal. Sabota o adversário unindo os grupos dele!"
              emoji="✖️"
              corFundo="bg-gradient-to-br from-purple-500 to-fuchsia-600"
              onClick={() => setPaginaAtual('produto')}
            />
            
            <GameCard
              titulo="Atari Go"
              descricao="Variante simplificada do Go: rodeia as pedras adversárias. A primeira captura vence o jogo!"
              emoji="⚫⚪"
              corFundo="bg-gradient-to-br from-stone-600 to-stone-800"
              onClick={() => setPaginaAtual('atari-go')}
            />
            
            <GameCard
              titulo="Nex"
              descricao="Jogo de conexão com peças neutras. Liga as tuas margens opostas antes do adversário!"
              emoji="🔗"
              corFundo="bg-gradient-to-br from-cyan-500 to-sky-600"
              onClick={() => setPaginaAtual('nex')}
            />
          </div>
        </section>

        <section className="mb-12">
          <GameProgressBars isReady={isReady} gameProgress={profile.gameProgress} />
        </section>

        {/* Informações */}
        <section className="bg-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>ℹ️</span>
            Sobre este site
          </h2>
          <div className="text-white/80 space-y-3">
            <p>
              Este site permite praticar todos os jogos oficiais do Campeonato Regional 
              de Jogos Matemáticos da Madeira (CRJM), abrangendo do 1.º Ciclo ao Secundário.
            </p>
            <p>
              Podes jogar sozinho contra o computador ou com um amigo no mesmo computador.
              As regras de cada jogo seguem as regras oficiais do campeonato.
            </p>
            <div className="bg-blue-500/20 border border-blue-400/50 rounded-lg p-3 mt-4">
              <p className="text-blue-200 text-sm">
                <strong>📚 Jogos por ciclo:</strong><br/>
                • 1.º Ciclo: Gatos & Cães, Dominório, Quelhas<br/>
                • 2.º Ciclo: Dominório, Quelhas, Produto<br/>
                • 3.º Ciclo: Quelhas, Produto, Atari Go<br/>
                • Secundário: Produto, Atari Go, Nex
              </p>
            </div>
            <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-lg p-3 mt-2">
              <p className="text-yellow-200 text-sm">
                <strong>💡 Dica importante:</strong> O Quelhas é um jogo <strong>misère</strong> — 
                perde quem faz a última jogada! Nos outros jogos, ganha quem faz a última jogada 
                (exceto Atari Go, onde a primeira captura vence).
              </p>
            </div>
            <p className="text-sm">
              Para mais informações sobre o CRJM, visita:{' '}
              <a 
                href="https://projetosdre.madeira.gov.pt/crjmram/jogos/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-300 hover:text-yellow-200 underline"
              >
                projetosdre.madeira.gov.pt/crjmram/jogos
              </a>
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-white/60 text-sm space-y-2">
        <p>Jogos Matemáticos - Treino para o CRJM 2025</p>
        <p>
          <a
            href="https://github.com/atilasos/crjm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-white/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
