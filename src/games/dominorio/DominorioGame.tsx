import { useState, useEffect, useCallback, useRef } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { DominorioState, Posicao } from './types';
import { 
  criarEstadoInicial, 
  atualizarPreview,
  colocarDomino,
  getDominoPreview,
} from './logic';
import { GameMode, Player } from '../../types';
import { 
  DominorioAIClient, 
  type AIDifficulty, 
  type AIMetrics,
  INITIAL_METRICS 
} from './ai';

interface DominorioGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro 8×8.',
  'O Jogador Vertical coloca dominós VERTICAIS (2 casas).',
  'O Jogador Horizontal coloca dominós HORIZONTAIS (2 casas).',
  'Começa o Vertical.',
  'Cada dominó ocupa duas casas livres adjacentes.',
  'Ganha quem colocar a ÚLTIMA peça.',
  'Se não tiveres jogadas no teu turno, PERDES.',
];

export function DominorioGame({ onVoltar }: DominorioGameProps) {
  const [state, setState] = useState<DominorioState>(() => 
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [aiMetrics, setAiMetrics] = useState<AIMetrics>(INITIAL_METRICS);
  const [aiReady, setAiReady] = useState(false);
  
  // AI client ref (persistent across renders)
  const aiClientRef = useRef<DominorioAIClient | null>(null);
  
  // Initialize AI client
  useEffect(() => {
    const client = new DominorioAIClient({
      onMetricsUpdate: setAiMetrics,
      onReady: () => setAiReady(true),
    });
    aiClientRef.current = client;
    
    return () => {
      client.terminate();
    };
  }, []);

  // Efeito para jogada do computador (usando AI Worker)
  useEffect(() => {
    if (
      state.modo === 'vs-computador' && 
      state.jogadorAtual !== humanPlayer && 
      state.estado === 'a-jogar' &&
      aiClientRef.current
    ) {
      let cancelled = false;
      
      // Small delay for UX
      const timer = setTimeout(async () => {
        if (cancelled || !aiClientRef.current) return;
        
        try {
          const move = await aiClientRef.current.getBestMove(state, difficulty);
          
          if (cancelled) return;
          
          if (move) {
            setState(prev => colocarDomino(prev, move));
          }
        } catch (e) {
          console.error('[DominorioGame] AI error:', e);
        }
      }, 200);
      
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [state.jogadorAtual, state.modo, state.estado, humanPlayer, difficulty, state]);

  // Mostrar anúncio de vencedor quando o jogo termina
  useEffect(() => {
    if (state.estado !== 'a-jogar') {
      setMostrarVencedor(true);
    }
  }, [state.estado]);

  const handleMouseEnter = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;
    setState(prev => atualizarPreview(prev, pos));
  }, [state.estado, state.modo, state.jogadorAtual, humanPlayer]);

  const handleMouseLeave = useCallback(() => {
    setState(prev => ({ ...prev, dominoPreview: null }));
  }, []);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;

    const preview = getDominoPreview(state, pos);
    if (preview) {
      setState(prev => colocarDomino(prev, preview));
    }
  }, [state, humanPlayer]);

  const novoJogo = useCallback(() => {
    // Cancel any pending AI search
    aiClientRef.current?.cancel();
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setAiMetrics(INITIAL_METRICS);
  }, [state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    // Cancel any pending AI search
    aiClientRef.current?.cancel();
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setHumanPlayer('jogador1'); // Reset ao trocar modo
    setAiMetrics(INITIAL_METRICS);
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    // Cancel any pending AI search
    aiClientRef.current?.cancel();
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
    setAiMetrics(INITIAL_METRICS);
  }, []);

  const handleChangeDifficulty = useCallback((newDifficulty: AIDifficulty) => {
    setDifficulty(newDifficulty);
  }, []);

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
    } else if (celula === 'ocupada-vertical') {
      classes += 'bg-pink-500';
    } else {
      classes += 'bg-cyan-500';
    }
    
    return classes;
  };

  return (
    <GameLayout titulo="Dominório" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1="Vertical"
          nomeJogador2="Horizontal"
          corJogador1="bg-pink-500"
          corJogador2="bg-cyan-500"
          humanPlayer={humanPlayer}
          onChangeHumanPlayer={handleChangeHumanPlayer}
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
          // AI props
          difficulty={difficulty}
          onChangeDifficulty={handleChangeDifficulty}
          aiMetrics={aiMetrics}
          aiReady={aiReady}
        />

        {/* Tabuleiro */}
        <div className="game-container">
          <div className="aspect-square max-w-md mx-auto">
            <div 
              className="grid grid-cols-8 gap-1 h-full bg-emerald-800 p-2 rounded-xl"
              onMouseLeave={handleMouseLeave}
            >
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((_, colunaIdx) => (
                  <button
                    key={`${linhaIdx}-${colunaIdx}`}
                    onClick={() => handleCellClick({ linha: linhaIdx, coluna: colunaIdx })}
                    onMouseEnter={() => handleMouseEnter({ linha: linhaIdx, coluna: colunaIdx })}
                    className={getCelulaClasses(linhaIdx, colunaIdx)}
                  >
                    {/* Ponto do dominó */}
                    {state.tabuleiro[linhaIdx][colunaIdx] !== 'vazia' && (
                      <div className="w-2 h-2 rounded-full bg-white/50"></div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-8 bg-pink-500 rounded"></div>
              <span>Vertical (J1)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 bg-cyan-500 rounded"></div>
              <span>Horizontal (J2)</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm text-gray-500">
            {state.estado === 'a-jogar' && (
              <>
                {state.jogadorAtual === 'jogador1' 
                  ? 'Clica para colocar um dominó VERTICAL' 
                  : 'Clica para colocar um dominó HORIZONTAL'}
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
          nomeJogador1="Vertical"
          nomeJogador2="Horizontal"
          humanoEhJogador1={humanPlayer === 'jogador1'}
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}
