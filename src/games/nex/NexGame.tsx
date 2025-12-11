import { useState, useEffect, useCallback, useRef } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { NexState, Posicao, TipoAcao, LADO_TABULEIRO, posToKey } from './types';
import { 
  criarEstadoInicial, 
  executarColocacao,
  executarSwap,
  recusarSwap,
  selecionarTipoAcao,
  adicionarPosicaoAcao,
  isAcaoCompleta,
  executarAcao,
  cancelarAcao,
  podeSubstituir,
  podeColocar,
  jogadaComputador,
} from './logic';
import { GameMode, Player } from '../../types';

interface NexGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Grelha hexagonal em losango (11×11 casas).',
  'Pretas: ligam os lados ↖ superior-esquerdo e inferior-direito ↘',
  'Brancas: ligam os lados ↗ superior-direito e inferior-esquerdo ↙',
  'Em cada turno, escolhe UMA ação:',
  '• Colocação: 1 peça própria + 1 neutra (cinzenta)',
  '• Substituição: 2 neutras→próprias + 1 própria→neutra',
  'Regra da Torta: Após 1.ª jogada, Brancas podem trocar de cor.',
  'Ganha quem conectar primeiro as suas duas margens!',
];

export function NexGame({ onVoltar }: NexGameProps) {
  const [state, setState] = useState<NexState>(() => 
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [tipoSelecao, setTipoSelecao] = useState<'propria' | 'neutra'>('propria');
  
  // Estado para pan/drag do tabuleiro
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boardDraggableRef = useRef<HTMLDivElement>(null);

  // Efeito para jogada do computador
  useEffect(() => {
    if (
      state.modo === 'vs-computador' && 
      state.jogadorAtual !== humanPlayer && 
      state.estado === 'a-jogar' &&
      !state.swapDisponivel // Esperar decisão de swap
    ) {
      const timer = setTimeout(() => {
        setState(prev => jogadaComputador(prev));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state.jogadorAtual, state.modo, state.estado, state.swapDisponivel, humanPlayer]);

  // Efeito para IA decidir swap
  useEffect(() => {
    if (
      state.modo === 'vs-computador' && 
      state.swapDisponivel &&
      state.jogadorAtual !== humanPlayer
    ) {
      const timer = setTimeout(() => {
        setState(prev => jogadaComputador(prev));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.swapDisponivel, state.modo, state.jogadorAtual, humanPlayer]);

  // Mostrar anúncio de vencedor quando o jogo termina
  useEffect(() => {
    if (state.estado !== 'a-jogar') {
      setMostrarVencedor(true);
    }
  }, [state.estado]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;
    if (state.swapDisponivel) return; // Deve decidir swap primeiro
    
    const celula = state.tabuleiro[pos.x][pos.y];
    const acao = state.acaoEmCurso;
    const corJogador = state.jogadorAtual === 'jogador1' ? 'preta' : 'branca';
    
    // Se não há tipo de ação selecionado, selecionar colocação por defeito
    if (acao.tipo === null) {
      setState(prev => selecionarTipoAcao(prev, 'colocacao'));
      return;
    }
    
    if (acao.tipo === 'colocacao') {
      if (celula !== 'vazia') return;
      
      setState(prev => adicionarPosicaoAcao(prev, pos, tipoSelecao));
    } else if (acao.tipo === 'substituicao') {
      if (tipoSelecao === 'neutra' && celula === 'neutra') {
        setState(prev => adicionarPosicaoAcao(prev, pos, 'neutra'));
      } else if (tipoSelecao === 'propria' && celula === corJogador) {
        setState(prev => adicionarPosicaoAcao(prev, pos, 'propria'));
      }
    }
  }, [state, humanPlayer, tipoSelecao]);

  // Executar ação quando completa
  useEffect(() => {
    if (isAcaoCompleta(state.acaoEmCurso)) {
      const timer = setTimeout(() => {
        setState(prev => executarAcao(prev));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state.acaoEmCurso]);

  const handleSelectTipoAcao = useCallback((tipo: TipoAcao) => {
    setState(prev => selecionarTipoAcao(prev, tipo));
    setTipoSelecao(tipo === 'colocacao' ? 'propria' : 'neutra');
  }, []);

  const handleCancelar = useCallback(() => {
    setState(prev => cancelarAcao(prev));
    setTipoSelecao('propria');
  }, []);

  const handleSwap = useCallback(() => {
    setState(prev => executarSwap(prev));
  }, []);

  const handleRecusarSwap = useCallback(() => {
    setState(prev => recusarSwap(prev));
  }, []);

  const novoJogo = useCallback(() => {
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
  }, [state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setHumanPlayer('jogador1');
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
  }, []);

  // Handlers para pan/drag do tabuleiro
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Só permitir drag se não estiver clicando diretamente em uma célula
    const target = e.target as SVGElement;
    if (target.tagName === 'polygon' || target.closest('polygon')) {
      return;
    }
    // Verificar se é clique no SVG ou no container
    if (target.tagName === 'svg' || target.tagName === 'DIV') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    // Só aplicar pan se o movimento for significativo (evitar interferir com cliques)
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setPanOffset({
        x: deltaX,
        y: deltaY,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Só permitir drag se não estiver tocando diretamente em uma célula
    const target = e.target as SVGElement;
    if (target.tagName === 'polygon' || target.closest('polygon')) {
      return;
    }
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - panOffset.x, 
        y: e.touches[0].clientY - panOffset.y 
      });
    }
  }, [panOffset]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const target = e.target as SVGElement;
    // Se estiver sobre uma célula, não fazer pan
    if (target.tagName === 'polygon' || target.closest('polygon')) {
      return;
    }
    e.preventDefault();
    setPanOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Adicionar listeners nativos para touch events com passive: false
  useEffect(() => {
    const draggable = boardDraggableRef.current;
    if (!draggable) return;

    const touchStartHandler = (e: TouchEvent) => {
      handleTouchStart(e);
    };

    const touchMoveHandler = (e: TouchEvent) => {
      handleTouchMove(e);
    };

    const touchEndHandler = () => {
      handleTouchEnd();
    };

    // Adicionar listeners com passive: false para touchmove permitir preventDefault
    draggable.addEventListener('touchstart', touchStartHandler, { passive: true });
    draggable.addEventListener('touchmove', touchMoveHandler, { passive: false });
    draggable.addEventListener('touchend', touchEndHandler, { passive: true });

    return () => {
      draggable.removeEventListener('touchstart', touchStartHandler);
      draggable.removeEventListener('touchmove', touchMoveHandler);
      draggable.removeEventListener('touchend', touchEndHandler);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Reset pan quando necessário
  const resetPan = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Verificar se uma posição está selecionada na ação em curso
  const isPosicaoSelecionada = (pos: Posicao): boolean => {
    const acao = state.acaoEmCurso;
    if (acao.tipo === 'colocacao') {
      return (acao.posPropria !== null && posToKey(acao.posPropria) === posToKey(pos)) ||
             (acao.posNeutra !== null && posToKey(acao.posNeutra) === posToKey(pos));
    } else if (acao.tipo === 'substituicao') {
      return acao.neutrasParaProprias.some(p => posToKey(p) === posToKey(pos)) ||
             (acao.propriaParaNeutra !== null && posToKey(acao.propriaParaNeutra) === posToKey(pos));
    }
    return false;
  };

  // Constantes para hexágonos (flat-top após rotação)
  const HEX_SIZE = 16; // Raio do hexágono
  const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;  // Largura do hexágono
  const HEX_HEIGHT = 2 * HEX_SIZE;  // Altura do hexágono
  
  // Calcular posição do hexágono no layout LOSANGO HORIZONTAL
  // Rotação de 90° do layout anterior para corresponder ao tabuleiro físico
  // - (0,0) está na ESQUERDA do losango
  // - (10,10) está na DIREITA do losango
  // - (10,0) está no TOPO
  // - (0,10) está na BASE
  const getHexPosition = (row: number, col: number) => {
    // Rotação 90°: trocar os eixos
    const x = (row + col) * HEX_HEIGHT * 0.75;
    const y = (row - col) * HEX_WIDTH / 2;
    return { x, y };
  };
  
  // Gerar pontos para hexágono flat-top (aresta no topo, após rotação 90°)
  const hexPoints = (cx: number, cy: number, size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      // Flat-top: começar da aresta direita (0°)
      const angle = (Math.PI / 3) * i;
      const px = cx + size * Math.cos(angle);
      const py = cy + size * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    return points.join(' ');
  };

  // Calcular dimensões totais do tabuleiro (horizontal)
  const calcularDimensoesTabuleiro = () => {
    // Para o layout diamante horizontal:
    // x varia de 0 a 20 * HEX_HEIGHT * 0.75
    // y varia de -10 * HEX_WIDTH/2 a +10 * HEX_WIDTH/2
    const xRange = (LADO_TABULEIRO * 2 - 1) * HEX_HEIGHT * 0.75;
    const yRange = LADO_TABULEIRO * HEX_WIDTH;
    return { 
      width: xRange + HEX_SIZE * 4,
      height: yRange + HEX_SIZE * 4,
      centerY: yRange / 2 + HEX_SIZE * 2  // Centro vertical
    };
  };

  const dimensoes = calcularDimensoesTabuleiro();

  const isVezDoHumano = state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer;
  const podeFazerColocacao = podeColocar(state.tabuleiro);
  const podeFazerSubstituicao = podeSubstituir(state.tabuleiro, state.jogadorAtual);

  // Determinar o que está em falta na ação
  const getInstrucaoAcao = () => {
    const acao = state.acaoEmCurso;
    if (acao.tipo === 'colocacao') {
      if (acao.posPropria === null) return 'Clica numa casa vazia para a peça própria';
      if (acao.posNeutra === null) return 'Clica noutra casa vazia para a peça neutra';
      return 'A executar...';
    } else if (acao.tipo === 'substituicao') {
      if (acao.neutrasParaProprias.length < 2) {
        return `Seleciona ${2 - acao.neutrasParaProprias.length} peça(s) neutra(s) para converter`;
      }
      if (acao.propriaParaNeutra === null) return 'Seleciona uma peça própria para converter em neutra';
      return 'A executar...';
    }
    return 'Seleciona o tipo de ação';
  };

  return (
    <GameLayout titulo="Nex" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1="Pretas (↖↘)"
          nomeJogador2="Brancas (↗↙)"
          corJogador1="bg-gray-900"
          corJogador2="bg-gray-200"
          humanPlayer={humanPlayer}
          onChangeHumanPlayer={handleChangeHumanPlayer}
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        {/* Swap disponível */}
        {state.swapDisponivel && isVezDoHumano && (
          <div className="bg-purple-100 border-2 border-purple-400 rounded-xl p-4">
            <p className="text-purple-800 font-semibold text-sm mb-2 text-center">
              🔄 Regra da Torta (Swap)
            </p>
            <p className="text-purple-700 text-xs mb-3 text-center">
              Podes trocar de cor e ficar com a posição das Pretas!
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleSwap}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium text-sm hover:bg-purple-600 transition-colors"
              >
                Trocar cores
              </button>
              <button
                onClick={handleRecusarSwap}
                className="px-4 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg font-medium text-sm hover:bg-purple-50 transition-colors"
              >
                Manter
              </button>
            </div>
          </div>
        )}

        {/* Seleção de ação */}
        {!state.swapDisponivel && state.estado === 'a-jogar' && isVezDoHumano && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3">
            <div className="flex justify-center gap-3 mb-2">
              <button
                onClick={() => handleSelectTipoAcao('colocacao')}
                disabled={!podeFazerColocacao}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  state.acaoEmCurso.tipo === 'colocacao'
                    ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                    : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                } ${!podeFazerColocacao ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Colocação
              </button>
              <button
                onClick={() => handleSelectTipoAcao('substituicao')}
                disabled={!podeFazerSubstituicao}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  state.acaoEmCurso.tipo === 'substituicao'
                    ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                    : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                } ${!podeFazerSubstituicao ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Substituição
              </button>
              {state.acaoEmCurso.tipo !== null && (
                <button
                  onClick={handleCancelar}
                  className="px-3 py-2 text-red-600 hover:text-red-800 text-sm underline"
                >
                  Cancelar
                </button>
              )}
            </div>
            
            {state.acaoEmCurso.tipo !== null && (
              <div className="text-center">
                <p className="text-blue-700 text-sm">{getInstrucaoAcao()}</p>
                
                {/* Seletor propria/neutra para colocação */}
                {state.acaoEmCurso.tipo === 'colocacao' && (
                  <div className="flex justify-center gap-2 mt-2">
                    <button
                      onClick={() => setTipoSelecao('propria')}
                      className={`px-2 py-1 rounded text-xs ${
                        tipoSelecao === 'propria' 
                          ? 'bg-gray-800 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Própria
                    </button>
                    <button
                      onClick={() => setTipoSelecao('neutra')}
                      className={`px-2 py-1 rounded text-xs ${
                        tipoSelecao === 'neutra' 
                          ? 'bg-gray-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Neutra
                    </button>
                  </div>
                )}
                
                {/* Seletor para substituição */}
                {state.acaoEmCurso.tipo === 'substituicao' && (
                  <div className="flex justify-center gap-2 mt-2">
                    <button
                      onClick={() => setTipoSelecao('neutra')}
                      className={`px-2 py-1 rounded text-xs ${
                        tipoSelecao === 'neutra' 
                          ? 'bg-gray-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Neutras→Próprias
                    </button>
                    <button
                      onClick={() => setTipoSelecao('propria')}
                      className={`px-2 py-1 rounded text-xs ${
                        tipoSelecao === 'propria' 
                          ? 'bg-gray-800 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Própria→Neutra
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tabuleiro Hexagonal em Losango */}
        <div className="game-container">
          <div className="relative">
            {/* Botão para resetar pan (apenas visível quando há offset) */}
            {(panOffset.x !== 0 || panOffset.y !== 0) && (
              <button
                onClick={resetPan}
                className="absolute top-2 right-2 z-10 px-3 py-1 bg-blue-500 text-white text-xs rounded-lg shadow-md hover:bg-blue-600 transition-colors"
                title="Reposicionar tabuleiro"
              >
                ↺ Reposicionar
              </button>
            )}
            
            {/* Container com overflow e pan */}
            <div 
              ref={boardContainerRef}
              className="overflow-auto"
              style={{ 
                maxHeight: '70vh',
                cursor: isDragging ? 'grabbing' : 'default',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x pan-y',
                // Garantir que o scroll funciona em todos os dispositivos
                overscrollBehavior: 'contain'
              }}
            >
              <div 
                ref={boardDraggableRef}
                className="relative inline-block p-12"
                style={{
                  transform: panOffset.x !== 0 || panOffset.y !== 0 
                    ? `translate(${panOffset.x}px, ${panOffset.y}px)` 
                    : 'none',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Indicadores de canto - fora do tabuleiro, nos cantos da área */}
                {/* Pretas: superior-esquerdo e inferior-direito */}
                <div className="absolute top-0 left-0 w-7 h-7 rounded-full bg-gray-800 z-10"></div>
                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-gray-800 z-10"></div>
                {/* Brancas: superior-direito e inferior-esquerdo */}
                <div className="absolute top-0 right-0 w-7 h-7 rounded-full bg-white border-2 border-gray-800 z-10"></div>
                <div className="absolute bottom-0 left-0 w-7 h-7 rounded-full bg-white border-2 border-gray-800 z-10"></div>
                
                <svg 
                  width={dimensoes.width} 
                  height={dimensoes.height}
                  viewBox={`${-HEX_SIZE * 2} ${-dimensoes.centerY} ${dimensoes.width} ${dimensoes.height}`}
                  className="block"
                >
                
                {/* Hexágonos do tabuleiro */}
                {Array.from({ length: LADO_TABULEIRO }, (_, row) => (
                  Array.from({ length: LADO_TABULEIRO }, (_, col) => {
                    const pos = getHexPosition(row, col);
                    const cx = pos.x;
                    const cy = pos.y;
                    
                    // Note: tabuleiro usa [col][row] (x, y)
                    const celula = state.tabuleiro[col][row];
                    const posicao = { x: col, y: row };
                    const selecionada = isPosicaoSelecionada(posicao);
                    
                    // Determinar cor de preenchimento
                    let fill = '#fef3c7'; // amber-100 - vazia
                    let stroke = '#92400e'; // amber-800
                    let strokeWidth = 1;
                    
                    if (celula === 'preta') {
                      fill = '#1f2937'; // gray-800
                      stroke = '#111827';
                    } else if (celula === 'branca') {
                      fill = '#ffffff';
                      stroke = '#6b7280';
                    } else if (celula === 'neutra') {
                      fill = '#9ca3af'; // gray-400
                      stroke = '#6b7280';
                    }
                    
                    return (
                      <g key={`${col}-${row}`}>
                        {/* Hexágono principal */}
                        <polygon
                          points={hexPoints(cx, cy, HEX_SIZE - 1)}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleCellClick(posicao)}
                        />
                        
                        {/* Indicador de seleção */}
                        {selecionada && (
                          <polygon
                            points={hexPoints(cx, cy, HEX_SIZE + 2)}
                            fill="none"
                            stroke="#4ade80"
                            strokeWidth={3}
                          />
                        )}
                      </g>
                    );
                  })
                ))}
                
                </svg>
              </div>
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gray-900"></div>
              <span>Pretas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-white border-2 border-gray-300"></div>
              <span>Brancas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gray-400"></div>
              <span>Neutra</span>
            </div>
          </div>
        </div>
      </div>

      {/* Anúncio de vencedor */}
      {mostrarVencedor && (
        <WinnerAnnouncement
          estado={state.estado}
          modo={state.modo}
          nomeJogador1="Pretas"
          nomeJogador2="Brancas"
          humanoEhJogador1={humanPlayer === 'jogador1'}
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}

