import { useState, useEffect, useCallback } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { QuelhasState, Posicao } from './types';
import { 
  criarEstadoInicial, 
  colocarSegmento,
  atualizarPreview,
  getCelulasSegmento,
  jogadaComputador,
  isPosicaoInicioValida,
  criarSegmentoEntrePosicoes,
  getOrientacaoJogador,
  trocarOrientacoes,
  recusarTroca,
  decidirTrocaComputador,
} from './logic';
import { GameMode } from '../../types';

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
  const [humanoEhJogador1, setHumanoEhJogador1] = useState(true); // true = humano joga como Vertical (J1)

  // Verificar se é a vez do humano jogar
  const isVezDoHumano = useCallback(() => {
    if (state.modo === 'dois-jogadores') return true;
    return humanoEhJogador1 ? state.jogadorAtual === 'jogador1' : state.jogadorAtual === 'jogador2';
  }, [state.modo, state.jogadorAtual, humanoEhJogador1]);

  // Verificar se a IA controla o jogador Horizontal (para decisão de troca)
  const iaControlaHorizontal = useCallback(() => {
    if (state.modo === 'dois-jogadores') return false;
    // Se humano é jogador1, IA é jogador2. Se orientação de jogador2 é horizontal, IA controla horizontal.
    // Se humano é jogador2, IA é jogador1. Se orientação de jogador1 é horizontal, IA controla horizontal.
    if (humanoEhJogador1) {
      return state.orientacaoJogador2 === 'horizontal';
    } else {
      return state.orientacaoJogador1 === 'horizontal';
    }
  }, [state.modo, state.orientacaoJogador1, state.orientacaoJogador2, humanoEhJogador1]);

  // Efeito para a IA decidir sobre a troca (se for ela a controlar o Horizontal)
  useEffect(() => {
    if (
      state.modo === 'vs-computador' &&
      state.trocaDisponivel &&
      state.estado === 'a-jogar' &&
      iaControlaHorizontal()
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
  }, [state.trocaDisponivel, state.modo, state.estado, iaControlaHorizontal]);

  // Efeito para jogada do computador
  useEffect(() => {
    if (state.modo !== 'vs-computador') return;
    if (state.estado !== 'a-jogar') return;
    if (state.trocaDisponivel) return; // Aguardar decisão de troca primeiro
    
    const isVezDaIA = humanoEhJogador1 
      ? state.jogadorAtual === 'jogador2' 
      : state.jogadorAtual === 'jogador1';
    
    if (isVezDaIA) {
      const timer = setTimeout(() => {
        setState(prev => jogadaComputador(prev));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state.jogadorAtual, state.modo, state.estado, state.trocaDisponivel, humanoEhJogador1]);

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
    if (state.trocaDisponivel && state.modo === 'dois-jogadores') return; // Aguardar decisão de troca
    if (state.trocaDisponivel && !iaControlaHorizontal()) return; // Humano horizontal deve decidir troca
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
  }, [state, posicaoInicial, isVezDoHumano, iaControlaHorizontal]);

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
    setState(prev => ({ ...prev, segmentoPreview: null }));
  }, []);

  const novoJogo = useCallback(() => {
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
  }, [state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
  }, [state.modo]);

  const escolherLado = useCallback((jogarComoVertical: boolean) => {
    setHumanoEhJogador1(jogarComoVertical);
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
  }, [state.modo]);

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

  // Verificar se o humano controla o horizontal (para mostrar UI de troca)
  const humanoControlaHorizontal = state.modo === 'dois-jogadores' || !humanoEhJogador1;
  const mostrarUiTroca = state.trocaDisponivel && 
                         state.estado === 'a-jogar' && 
                         humanoControlaHorizontal &&
                         (state.modo === 'dois-jogadores' || !iaControlaHorizontal());

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
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        {/* Escolha de lado (apenas vs computador) */}
        {state.modo === 'vs-computador' && state.primeiraJogada && !state.trocaDisponivel && (
          <div className="bg-indigo-100 border-2 border-indigo-300 rounded-xl p-4">
            <p className="text-indigo-800 font-semibold text-sm mb-3 text-center">
              Escolhe o teu lado:
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => escolherLado(true)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  humanoEhJogador1 
                    ? 'bg-pink-500 text-white ring-2 ring-pink-300' 
                    : 'bg-white text-pink-600 border border-pink-300 hover:bg-pink-50'
                }`}
              >
                Vertical (começa)
              </button>
              <button
                onClick={() => escolherLado(false)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  !humanoEhJogador1 
                    ? 'bg-cyan-500 text-white ring-2 ring-cyan-300' 
                    : 'bg-white text-cyan-600 border border-cyan-300 hover:bg-cyan-50'
                }`}
              >
                Horizontal (2.º)
              </button>
            </div>
          </div>
        )}

        {/* UI de decisão de troca */}
        {mostrarUiTroca && (
          <div className="bg-purple-100 border-2 border-purple-400 rounded-xl p-4">
            <p className="text-purple-800 font-semibold text-sm mb-2 text-center">
              🔄 Regra de Troca
            </p>
            <p className="text-purple-700 text-xs mb-3 text-center">
              O jogador Horizontal pode trocar de papel e ficar com a jogada que o Vertical acabou de fazer.
              {state.modo === 'vs-computador' && ' (É a tua vez de decidir!)'}
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
              <div className="w-6 h-3 bg-pink-500 rounded"></div>
              <span>Vertical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-6 bg-cyan-500 rounded"></div>
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
          humanoEhJogador1={humanoEhJogador1}
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}
