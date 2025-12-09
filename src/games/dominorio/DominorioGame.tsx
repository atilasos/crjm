import { useState, useEffect, useCallback } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { DominorioState, Posicao } from './types';
import { 
  criarEstadoInicial, 
  atualizarPreview,
  colocarDomino,
  getDominoPreview,
  jogadaComputador,
} from './logic';
import { GameMode } from '../../types';

interface DominorioGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'O tabuleiro é 5×5.',
  'Os jogadores colocam peças de dominó alternadamente (cada dominó ocupa 2 casas).',
  'O Jogador 1 coloca dominós na HORIZONTAL (─).',
  'O Jogador 2 coloca dominós na VERTICAL (│).',
  'Não se pode sobrepor dominós nem colocar fora do tabuleiro.',
  'Perde o jogador que não conseguir colocar um dominó.',
];

export function DominorioGame({ onVoltar }: DominorioGameProps) {
  const [state, setState] = useState<DominorioState>(() => 
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);

  // Efeito para jogada do computador
  useEffect(() => {
    if (
      state.modo === 'vs-computador' && 
      state.jogadorAtual === 'jogador2' && 
      state.estado === 'a-jogar'
    ) {
      const timer = setTimeout(() => {
        setState(prev => jogadaComputador(prev));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state.jogadorAtual, state.modo, state.estado]);

  // Mostrar anúncio de vencedor quando o jogo termina
  useEffect(() => {
    if (state.estado !== 'a-jogar') {
      setMostrarVencedor(true);
    }
  }, [state.estado]);

  const handleMouseEnter = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual === 'jogador2') return;
    setState(prev => atualizarPreview(prev, pos));
  }, [state.estado, state.modo, state.jogadorAtual]);

  const handleMouseLeave = useCallback(() => {
    setState(prev => ({ ...prev, dominoPreview: null }));
  }, []);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual === 'jogador2') return;

    const preview = getDominoPreview(state, pos);
    if (preview) {
      setState(prev => colocarDomino(prev, preview));
    }
  }, [state]);

  const novoJogo = useCallback(() => {
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
  }, [state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
  }, [state.modo]);

  // Verificar se uma célula faz parte do preview
  const isPreview = (linha: number, coluna: number): boolean => {
    if (!state.dominoPreview) return false;
    const { pos1, pos2 } = state.dominoPreview;
    return (pos1.linha === linha && pos1.coluna === coluna) ||
           (pos2.linha === linha && pos2.coluna === coluna);
  };

  // Obter cor da célula
  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha][coluna];
    const preview = isPreview(linha, coluna);
    
    let classes = 'aspect-square rounded-md flex items-center justify-center transition-all duration-150 ';
    
    if (celula === 'vazia') {
      if (preview) {
        classes += state.jogadorAtual === 'jogador1' 
          ? 'bg-pink-400 ring-2 ring-pink-300' 
          : 'bg-cyan-400 ring-2 ring-cyan-300';
      } else {
        classes += 'bg-gray-100 hover:bg-gray-200 cursor-pointer';
      }
    } else if (celula === 'ocupada-horizontal') {
      classes += 'bg-pink-500';
    } else {
      classes += 'bg-cyan-500';
    }
    
    return classes;
  };

  // Verificar se célula está conectada com vizinha (para visual do dominó)
  const getConexao = (linha: number, coluna: number): string | null => {
    const celula = state.tabuleiro[linha][coluna];
    if (celula === 'vazia') return null;
    
    if (celula === 'ocupada-horizontal') {
      // Verificar se conecta à direita
      if (coluna < 4 && state.tabuleiro[linha][coluna + 1] === 'ocupada-horizontal') {
        return 'direita';
      }
      // Verificar se conecta à esquerda
      if (coluna > 0 && state.tabuleiro[linha][coluna - 1] === 'ocupada-horizontal') {
        return 'esquerda';
      }
    } else {
      // Verificar se conecta abaixo
      if (linha < 4 && state.tabuleiro[linha + 1][coluna] === 'ocupada-vertical') {
        return 'baixo';
      }
      // Verificar se conecta acima
      if (linha > 0 && state.tabuleiro[linha - 1][coluna] === 'ocupada-vertical') {
        return 'cima';
      }
    }
    return null;
  };

  return (
    <GameLayout titulo="Dominório" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1="Horizontal"
          nomeJogador2="Vertical"
          corJogador1="bg-pink-500"
          corJogador2="bg-cyan-500"
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        {/* Tabuleiro */}
        <div className="game-container">
          <div className="aspect-square max-w-md mx-auto">
            <div 
              className="grid grid-cols-5 gap-2 h-full bg-emerald-800 p-3 rounded-xl"
              onMouseLeave={handleMouseLeave}
            >
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((_, colunaIdx) => {
                  const conexao = getConexao(linhaIdx, colunaIdx);
                  
                  return (
                    <button
                      key={`${linhaIdx}-${colunaIdx}`}
                      onClick={() => handleCellClick({ linha: linhaIdx, coluna: colunaIdx })}
                      onMouseEnter={() => handleMouseEnter({ linha: linhaIdx, coluna: colunaIdx })}
                      className={`${getCelulaClasses(linhaIdx, colunaIdx)} relative`}
                      style={{
                        // Estender visualmente para conectar dominós
                        marginRight: conexao === 'direita' ? '-8px' : '0',
                        marginBottom: conexao === 'baixo' ? '-8px' : '0',
                        zIndex: conexao ? 1 : 0,
                      }}
                    >
                      {/* Ponto do dominó */}
                      {state.tabuleiro[linhaIdx][colunaIdx] !== 'vazia' && (
                        <div className="w-3 h-3 rounded-full bg-white/50"></div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 bg-pink-500 rounded"></div>
              <span>Horizontal (Jogador 1)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-8 bg-cyan-500 rounded"></div>
              <span>Vertical (Jogador 2)</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm text-gray-500">
            {state.estado === 'a-jogar' && (
              <>
                {state.jogadorAtual === 'jogador1' 
                  ? 'Clica para colocar um dominó HORIZONTAL' 
                  : 'Clica para colocar um dominó VERTICAL'}
                {' '}• Jogadas disponíveis: {state.jogadasValidas.length}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Anúncio de vencedor */}
      {mostrarVencedor && (
        <WinnerAnnouncement
          estado={state.estado}
          modo={state.modo}
          nomeJogador1="Horizontal"
          nomeJogador2="Vertical"
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}

