import { useState, useEffect, useCallback } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { AtariGoState, Posicao, TAMANHO_TABULEIRO } from './types';
import { 
  criarEstadoInicial, 
  colocarPedra,
  isJogadaValida,
  jogadaComputador,
} from './logic';
import { GameMode, Player } from '../../types';

interface AtariGoGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro 9×9 (joga-se nas interseções).',
  'Pretas jogam primeiro.',
  'Grupo: pedras da mesma cor ligadas na vertical/horizontal.',
  'Liberdade: interseção vazia ao lado de um grupo.',
  'Se um grupo ficar com 0 liberdades, é capturado e removido.',
  'Suicídio proibido (exceto se captura pedras adversárias).',
  'OBJETIVO: O primeiro a fazer QUALQUER captura VENCE!',
];

export function AtariGoGame({ onVoltar }: AtariGoGameProps) {
  const [state, setState] = useState<AtariGoState>(() => 
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');

  // Efeito para jogada do computador
  useEffect(() => {
    if (
      state.modo === 'vs-computador' && 
      state.jogadorAtual !== humanPlayer && 
      state.estado === 'a-jogar'
    ) {
      const timer = setTimeout(() => {
        setState(prev => jogadaComputador(prev));
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [state.jogadorAtual, state.modo, state.estado, humanPlayer]);

  // Mostrar anúncio de vencedor quando o jogo termina
  useEffect(() => {
    if (state.estado !== 'a-jogar') {
      setMostrarVencedor(true);
    }
  }, [state.estado]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;

    if (isJogadaValida(state, pos)) {
      setState(prev => colocarPedra(prev, pos));
    }
  }, [state, humanPlayer]);

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

  // Verificar se é última jogada
  const isUltimaJogada = (linha: number, coluna: number): boolean => {
    return state.ultimaJogada !== null && 
           state.ultimaJogada.linha === linha && 
           state.ultimaJogada.coluna === coluna;
  };

  // Verificar se é jogada válida
  const isJogadaValidaPos = (linha: number, coluna: number): boolean => {
    return state.jogadasValidas.some(j => j.linha === linha && j.coluna === coluna);
  };

  // Renderizar uma interseção do tabuleiro
  const renderIntersecao = (linha: number, coluna: number) => {
    const celula = state.tabuleiro[linha][coluna];
    const ultimaJogada = isUltimaJogada(linha, coluna);
    const jogadaValida = isJogadaValidaPos(linha, coluna);
    const isVezDoHumano = state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer;
    
    // Calcular posição das linhas do grid
    const isTop = linha === 0;
    const isBottom = linha === TAMANHO_TABULEIRO - 1;
    const isLeft = coluna === 0;
    const isRight = coluna === TAMANHO_TABULEIRO - 1;

    return (
      <button
        key={`${linha}-${coluna}`}
        onClick={() => handleCellClick({ linha, coluna })}
        className={`
          relative w-full aspect-square
          ${jogadaValida && isVezDoHumano && state.estado === 'a-jogar' ? 'cursor-pointer' : 'cursor-default'}
        `}
        disabled={!jogadaValida || state.estado !== 'a-jogar'}
      >
        {/* Linhas do grid */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Linha horizontal */}
          <div 
            className={`absolute h-[2px] bg-gray-800 top-1/2 -translate-y-1/2
              ${isLeft ? 'left-1/2 right-0' : isRight ? 'left-0 right-1/2' : 'left-0 right-0'}
            `}
          />
          {/* Linha vertical */}
          <div 
            className={`absolute w-[2px] bg-gray-800 left-1/2 -translate-x-1/2
              ${isTop ? 'top-1/2 bottom-0' : isBottom ? 'top-0 bottom-1/2' : 'top-0 bottom-0'}
            `}
          />
        </div>

        {/* Pontos de referência (hoshi) */}
        {((linha === 2 || linha === 4 || linha === 6) && (coluna === 2 || coluna === 4 || coluna === 6)) && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-800 rounded-full z-10" />
        )}

        {/* Pedra */}
        {celula !== 'vazia' && (
          <div 
            className={`
              absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
              w-[85%] h-[85%] rounded-full z-20
              ${celula === 'preta' 
                ? 'bg-gradient-to-br from-gray-700 via-gray-900 to-black shadow-lg' 
                : 'bg-gradient-to-br from-white via-gray-100 to-gray-200 shadow-lg border border-gray-300'
              }
              ${ultimaJogada ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''}
            `}
          >
            {/* Brilho da pedra */}
            <div 
              className={`absolute top-1 left-1 w-3 h-3 rounded-full 
                ${celula === 'preta' ? 'bg-gray-600' : 'bg-white'}
                opacity-60
              `}
            />
            {/* Marcador de última jogada */}
            {ultimaJogada && (
              <div 
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                  w-3 h-3 rounded-full
                  ${celula === 'preta' ? 'bg-white' : 'bg-black'}
                `}
              />
            )}
          </div>
        )}

        {/* Indicador de jogada válida */}
        {celula === 'vazia' && jogadaValida && isVezDoHumano && state.estado === 'a-jogar' && (
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
              w-[40%] h-[40%] rounded-full bg-green-400 opacity-40 z-10
              hover:opacity-70 transition-opacity"
          />
        )}
      </button>
    );
  };

  return (
    <GameLayout titulo="Atari Go" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1="Pretas"
          nomeJogador2="Brancas"
          corJogador1="bg-gray-900"
          corJogador2="bg-gray-100"
          humanPlayer={humanPlayer}
          onChangeHumanPlayer={handleChangeHumanPlayer}
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        {/* Aviso de vitória na primeira captura */}
        <div className="bg-red-100 border-2 border-red-400 rounded-xl p-3 text-center">
          <p className="text-red-800 font-semibold text-sm">
            ⚔️ OBJETIVO: A primeira captura VENCE o jogo!
          </p>
        </div>

        {/* Tabuleiro */}
        <div className="game-container">
          <div className="aspect-square max-w-md mx-auto">
            <div 
              className="w-full h-full bg-amber-200 p-4 rounded-xl shadow-inner"
              style={{ 
                backgroundImage: 'linear-gradient(135deg, #f5d89a 0%, #e8c76b 100%)',
              }}
            >
              <div className="grid grid-cols-9 gap-0 h-full w-full">
                {Array.from({ length: TAMANHO_TABULEIRO }, (_, linha) =>
                  Array.from({ length: TAMANHO_TABULEIRO }, (_, coluna) => 
                    renderIntersecao(linha, coluna)
                  )
                )}
              </div>
            </div>
          </div>

          {/* Legenda e estatísticas */}
          <div className="mt-4 flex flex-col items-center gap-2 text-sm text-gray-600">
            <div className="flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-black border border-gray-600"></div>
                <span>Pretas (J1)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-white to-gray-200 border border-gray-300"></div>
                <span>Brancas (J2)</span>
              </div>
            </div>
            <div className="flex justify-center gap-4 text-xs">
              <span>Capturadas pelas Pretas: {state.pedrasCapturadas.brancas}</span>
              <span>Capturadas pelas Brancas: {state.pedrasCapturadas.pretas}</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm text-gray-500">
            {state.estado === 'a-jogar' && (
              <>
                {state.jogadorAtual === 'jogador1' 
                  ? 'Pretas: clica numa interseção para colocar uma pedra' 
                  : 'Brancas: clica numa interseção para colocar uma pedra'}
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

