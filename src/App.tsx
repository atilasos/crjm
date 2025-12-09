import { useState } from 'react';
import "./index.css";
import { Header } from './components/Header';
import { GameCard } from './components/GameCard';
import { GatosCaesGame } from './games/gatos-caes/GatosCaesGame';
import { DominorioGame } from './games/dominorio/DominorioGame';
import { QuelhasGame } from './games/quelhas/QuelhasGame';

type Pagina = 'inicio' | 'gatos-caes' | 'dominorio' | 'quelhas';

export function App() {
  const [paginaAtual, setPaginaAtual] = useState<Pagina>('inicio');

  const voltarInicio = () => setPaginaAtual('inicio');

  if (paginaAtual === 'gatos-caes') {
    return <GatosCaesGame onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'dominorio') {
    return <DominorioGame onVoltar={voltarInicio} />;
  }

  if (paginaAtual === 'quelhas') {
    return <QuelhasGame onVoltar={voltarInicio} />;
  }

  return (
    <div className="min-h-screen">
      <Header />
      
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
            Pratica os jogos do 1.º Ciclo e fica preparado para o campeonato!
          </p>
        </section>

        {/* Cartões dos jogos */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white text-shadow text-center mb-8">
            Escolhe um jogo para começar
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          </div>
        </section>

        {/* Informações */}
        <section className="bg-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>ℹ️</span>
            Sobre este site
          </h2>
          <div className="text-white/80 space-y-3">
            <p>
              Este site foi criado para ajudar os alunos do 1.º Ciclo a praticarem 
              os jogos do Campeonato Regional de Jogos Matemáticos da Madeira (CRJM).
            </p>
            <p>
              Podes jogar sozinho contra o computador ou com um amigo no mesmo computador.
              As regras de cada jogo seguem as regras oficiais do campeonato.
            </p>
            <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-lg p-3 mt-4">
              <p className="text-yellow-200 text-sm">
                <strong>💡 Dica importante:</strong> O Quelhas é um jogo <strong>misère</strong> — 
                perde quem faz a última jogada! Nos outros dois jogos, ganha quem faz a última jogada.
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
      <footer className="text-center py-6 text-white/60 text-sm">
        <p>Jogos Matemáticos - Treino para o CRJM 2025</p>
      </footer>
    </div>
  );
}

export default App;
