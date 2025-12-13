import { useState, useEffect, useCallback, useRef } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { QuelhasState, Posicao } from './types';
import { 
  criarEstadoInicial, 
  colocarSegmento,
  atualizarPreview,
  getCelulasSegmento,
  isPosicaoInicioValida,
  criarSegmentoEntrePosicoes,
  getOrientacaoJogador,
  trocarOrientacoes,
  recusarTroca,
  decidirTrocaComputador,
} from './logic';
import { GameMode, Player } from '../../types';
import { QuelhasAIClient, INITIAL_METRICS, type AIDifficulty, type AIMetrics } from './ai';

interface QuelhasGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro 10×10.',
  'O Jogador Vertical coloca segmentos VERTICAIS (mínimo 2 casas).',
  'O Jogador Horizontal coloca segmentos HORIZONTAIS (mínimo 2 casas).',
  'Começa o jogador com orientação Vertical.',
  'Clica na casa inicial e depois na casa final para colocar um segmento.',
  'Os segmentos ocupam casas livres consecutivas.',
  'Regra de troca: Após a 1.ª jogada, o jogador Horizontal pode trocar de papel.',
  'ATENÇÃO: Este jogo é MISÈRE - perde quem fizer a última jogada!',
  'Se não tiveres jogadas no teu turno, GANHAS (o adversário foi o último a jogar).',
];

export function QuelhasGame({ onVoltar }: QuelhasGameProps) {
  const [state, setState] = useState<QuelhasState>(() => 
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [posicaoInicial, setPosicaoInicial] = useState<Posicao | null>(null);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('hard');
  const [aiMetrics, setAiMetrics] = useState<AIMetrics>(INITIAL_METRICS);
  const [aiReady, setAiReady] = useState(false);
  const aiClientRef = useRef<QuelhasAIClient | null>(null);

  // Inicializar cliente de IA (Worker) uma vez
  useEffect(() => {
    const client = new QuelhasAIClient({
      onMetricsUpdate: setAiMetrics,
      onReady: () => setAiReady(true),
    });
    aiClientRef.current = client;
    return () => client.terminate();
  }, []);

  // Verificar se é a vez do humano jogar
  const isVezDoHumano = useCallback(() => {
    if (state.modo === 'dois-jogadores') return true;
    return state.jogadorAtual === humanPlayer;
  }, [state.modo, state.jogadorAtual, humanPlayer]);

  // Efeito para a IA decidir sobre a troca (se for ela a controlar o Horizontal)
  useEffect(() => {
    if (state.modo !== 'vs-computador') return;
    if (
      state.trocaDisponivel &&
      state.estado === 'a-jogar' &&
      state.jogadorAtual !== humanPlayer &&
      getOrientacaoJogador(state, state.jogadorAtual) === 'horizontal'
    ) {
      const timer = setTimeout(() => {
        const deveTrocar = decidirTrocaComputador(state);
        if (deveTrocar) {
          setState(prev => trocarOrientacoes(prev));
        } else {
          setState(prev => recusarTroca(prev));
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.trocaDisponivel, state.modo, state.estado, state.jogadorAtual, state, humanPlayer]);

  // Efeito para jogada do computador
  useEffect(() => {
    if (state.modo !== 'vs-computador') return;
    if (state.estado !== 'a-jogar') return;
    if (state.trocaDisponivel) return; // Aguardar decisão de troca primeiro
    
    const isVezDaIA = state.jogadorAtual !== humanPlayer;
    
    if (isVezDaIA && aiClientRef.current) {
      let cancelled = false;
      const timer = setTimeout(async () => {
        if (cancelled || !aiClientRef.current) return;

        try {
          const bestMove = await aiClientRef.current.getBestMove(state, difficulty);
          if (cancelled) return;
          if (bestMove) {
            setState(prev => colocarSegmento(prev, bestMove));
          }
        } catch (e) {
          if (e instanceof Error && e.message === 'cancelled') return;
          console.error('[QuelhasGame] AI error:', e);
        }
      }, 200);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        aiClientRef.current?.cancel();
      };
    }
  }, [state.jogadorAtual, state.modo, state.estado, state.trocaDisponivel, humanPlayer, difficulty, state]);

  // Mostrar anúncio de vencedor quando o jogo termina
  useEffect(() => {
    if (state.estado !== 'a-jogar') {
      setMostrarVencedor(true);
    }
  }, [state.estado]);

  // Limpar posição inicial quando muda o jogador
  useEffect(() => {
    setPosicaoInicial(null);
  }, [state.jogadorAtual]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (!isVezDoHumano()) return;
    if (state.trocaDisponivel) return; // Aguardar decisão de troca
    if (state.tabuleiro[pos.linha][pos.coluna] === 'ocupada') return;

    if (posicaoInicial === null) {
      // Primeiro clique: definir posição inicial
      if (isPosicaoInicioValida(state, pos)) {
        setPosicaoInicial(pos);
      }
    } else {
      // Segundo clique: tentar criar segmento
      const segmento = criarSegmentoEntrePosicoes(state, posicaoInicial, pos);
      if (segmento) {
        setState(prev => colocarSegmento(prev, segmento));
        setPosicaoInicial(null);
      } else {
        // Segmento inválido, tentar usar esta posição como novo início
        if (isPosicaoInicioValida(state, pos)) {
          setPosicaoInicial(pos);
        } else {
          setPosicaoInicial(null);
        }
      }
    }
  }, [state, posicaoInicial, isVezDoHumano]);

  const handleMouseEnter = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (!isVezDoHumano()) return;
    if (state.trocaDisponivel) return;
    if (state.tabuleiro[pos.linha][pos.coluna] === 'ocupada') return;
    
    if (posicaoInicial) {
      // Mostrar preview do segmento entre posição inicial e atual
      const segmento = criarSegmentoEntrePosicoes(state, posicaoInicial, pos);
      setState(prev => atualizarPreview(prev, segmento));
    }
  }, [state, posicaoInicial, isVezDoHumano]);

  const handleMouseLeave = useCallback(() => {
    if (state.estado !== 'a-jogar') return;
    if (!isVezDoHumano()) return;
    if (state.trocaDisponivel) return;
    if (!state.segmentoPreview) return;
    setState(prev => ({ ...prev, segmentoPreview: null }));
  }, [state.estado, state.trocaDisponivel, state.segmentoPreview, isVezDoHumano]);

  const novoJogo = useCallback(() => {
    aiClientRef.current?.cancel();
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
    setAiMetrics(INITIAL_METRICS);
  }, [state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    aiClientRef.current?.cancel();
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
    setAiMetrics(INITIAL_METRICS);
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    aiClientRef.current?.cancel();
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
    setAiMetrics(INITIAL_METRICS);
  }, []);

  const handleChangeDifficulty = useCallback((d: AIDifficulty) => {
    setDifficulty(d);
  }, []);

  const handleTroca = useCallback(() => {
    setState(prev => trocarOrientacoes(prev));
  }, []);

  const handleRecusarTroca = useCallback(() => {
    setState(prev => recusarTroca(prev));
  }, []);

  // Verificar se uma célula faz parte do preview
  const isPreview = (linha: number, coluna: number): boolean => {
    if (!state.segmentoPreview) return false;
    const celulas = getCelulasSegmento(state.segmentoPreview);
    return celulas.some(c => c.linha === linha && c.coluna === coluna);
  };

  // Verificar se uma célula é a posição inicial selecionada
  const isPosicaoInicialSelecionada = (linha: number, coluna: number): boolean => {
    return posicaoInicial !== null && 
           posicaoInicial.linha === linha && 
           posicaoInicial.coluna === coluna;
  };

  // Obter a orientação atual do jogador
  const orientacaoAtual = getOrientacaoJogador(state, state.jogadorAtual);

  // Obter classe CSS para cada célula
  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha][coluna];
    const preview = isPreview(linha, coluna);
    const inicioSelecionado = isPosicaoInicialSelecionada(linha, coluna);
    
    let classes = 'aspect-square rounded-sm flex items-center justify-center transition-all duration-150 text-xs font-bold ';
    
    if (celula === 'ocupada') {
      classes += 'bg-indigo-600';
    } else if (inicioSelecionado) {
      classes += orientacaoAtual === 'vertical'
        ? 'bg-pink-500 ring-2 ring-pink-300 cursor-pointer scale-110' 
        : 'bg-cyan-500 ring-2 ring-cyan-300 cursor-pointer scale-110';
    } else if (preview) {
      classes += orientacaoAtual === 'vertical'
        ? 'bg-pink-400 ring-2 ring-pink-300 cursor-pointer' 
        : 'bg-cyan-400 ring-2 ring-cyan-300 cursor-pointer';
    } else {
      classes += 'bg-gray-200 hover:bg-gray-300 cursor-pointer';
    }
    
    return classes;
  };

  const mostrarUiTroca =
    state.trocaDisponivel &&
    state.estado === 'a-jogar' &&
    getOrientacaoJogador(state, state.jogadorAtual) === 'horizontal' &&
    (state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer);

  // Determinar nomes dos jogadores baseado nas orientações atuais
  const getNomeJogador = (jogador: 'jogador1' | 'jogador2') => {
    const orientacao = getOrientacaoJogador(state, jogador);
    return orientacao === 'vertical' ? 'Vertical' : 'Horizontal';
  };

  return (
    <GameLayout titulo="Quelhas" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1={getNomeJogador('jogador1')}
          nomeJogador2={getNomeJogador('jogador2')}
          corJogador1={state.orientacaoJogador1 === 'vertical' ? 'bg-pink-500' : 'bg-cyan-500'}
          corJogador2={state.orientacaoJogador2 === 'vertical' ? 'bg-pink-500' : 'bg-cyan-500'}
          humanPlayer={humanPlayer}
          onChangeHumanPlayer={handleChangeHumanPlayer}
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
          difficulty={difficulty}
          onChangeDifficulty={handleChangeDifficulty}
          aiMetrics={aiMetrics}
          aiReady={aiReady}
        />

        {/* UI de decisão de troca */}
        {mostrarUiTroca && (
          <div className="bg-purple-100 border-2 border-purple-400 rounded-xl p-4">
            <p className="text-purple-800 font-semibold text-sm mb-2 text-center">
              🔄 Regra de Troca
            </p>
            <p className="text-purple-700 text-xs mb-3 text-center">
              Podes trocar de papel e ficar com a jogada que o Vertical acabou de fazer.
              A troca consome a tua jogada — a seguir joga o adversário.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleTroca}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium text-sm hover:bg-purple-600 transition-colors"
              >
                Trocar papéis
              </button>
              <button
                onClick={handleRecusarTroca}
                className="px-4 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg font-medium text-sm hover:bg-purple-50 transition-colors"
              >
                Manter como está
              </button>
            </div>
          </div>
        )}

        {/* Aviso Misère */}
        <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl p-3 text-center">
          <p className="text-yellow-800 font-semibold text-sm">
            ⚠️ MISÈRE: Quem fizer a última jogada PERDE!
          </p>
        </div>

        {/* Tabuleiro */}
        <div className="game-container">
          <div className="aspect-square max-w-lg mx-auto">
            <div 
              className="grid grid-cols-10 gap-0.5 h-full bg-gray-400 p-1 rounded-xl"
              onMouseLeave={handleMouseLeave}
            >
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((_, colunaIdx) => (
                  <button
                    key={`${linhaIdx}-${colunaIdx}`}
                    onClick={() => handleCellClick({ linha: linhaIdx, coluna: colunaIdx })}
                    onMouseEnter={() => handleMouseEnter({ linha: linhaIdx, coluna: colunaIdx })}
                    className={getCelulaClasses(linhaIdx, colunaIdx)}
                    disabled={state.tabuleiro[linhaIdx][colunaIdx] === 'ocupada'}
                  />
                ))
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-6 bg-pink-500 rounded"></div>
              <span>Vertical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-cyan-500 rounded"></div>
              <span>Horizontal</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm text-gray-500">
            {state.estado === 'a-jogar' && !state.trocaDisponivel && (
              <>
                {posicaoInicial ? (
                  <span className="text-indigo-600 font-medium">
                    Clica na casa final do segmento {orientacaoAtual === 'vertical' ? 'VERTICAL' : 'HORIZONTAL'}
                  </span>
                ) : (
                  <span>
                    Clica na casa inicial do segmento {orientacaoAtual === 'vertical' ? 'VERTICAL' : 'HORIZONTAL'}
                  </span>
                )}
                {' '}• Jogadas disponíveis: {state.jogadasValidas.length}
              </>
            )}
            {state.trocaDisponivel && !mostrarUiTroca && (
              <span className="text-purple-600 font-medium">
                A IA está a decidir sobre a troca de papéis...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Anúncio de vencedor */}
      {mostrarVencedor && (
        <WinnerAnnouncement
          estado={state.estado}
          modo={state.modo}
          nomeJogador1={getNomeJogador('jogador1')}
          nomeJogador2={getNomeJogador('jogador2')}
          humanoEhJogador1={humanPlayer === 'jogador1'}
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}
