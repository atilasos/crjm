import { useState, useEffect, useCallback } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { QuelhasState, Posicao } from './types';
import { 
  criarEstadoInicial, 
  selecionarPeca, 
  executarJogada,
  jogadaComputador,
} from './logic';
import { GameMode } from '../../types';

interface QuelhasGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'O tabuleiro é 4×4.',
  'Cada jogador tem 4 peças numeradas de 1 a 4.',
  'O Jogador 1 começa em cima, o Jogador 2 em baixo.',
  'Uma peça move-se exatamente tantas casas quanto o seu número (na horizontal ou vertical).',
  'Não se pode saltar por cima de outras peças nem parar numa casa ocupada.',
  'O objetivo é ocupar as 4 casas iniciais do adversário.',
  'Ganha quem primeiro tiver as suas 4 peças nas casas de partida do adversário.',
];

export function QuelhasGame({ onVoltar }: QuelhasGameProps) {
  const [state, setState] = useState<QuelhasState>(() => 
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

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual === 'jogador2') return;

    const { tabuleiro, pecaSelecionada, jogadasValidas, jogadorAtual } = state;
    const celula = tabuleiro[pos.linha][pos.coluna];

    // Se já tem peça selecionada e clicou em jogada válida
    if (pecaSelecionada) {
      const jogadaValida = jogadasValidas.some(
        j => j.linha === pos.linha && j.coluna === pos.coluna
      );
      
      if (jogadaValida) {
        setState(prev => executarJogada(prev, pos));
        return;
      }
    }

    // Verificar se pode selecionar esta peça
    if (celula && celula.jogador === jogadorAtual) {
      setState(prev => selecionarPeca(prev, pos));
    } else if (pecaSelecionada) {
      // Desselecionar se clicou em casa inválida
      setState(prev => ({ ...prev, pecaSelecionada: null, jogadasValidas: [] }));
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

  // Verificar se uma posição é casa objetivo
  const isObjetivo = (linha: number, coluna: number, jogador: 'jogador1' | 'jogador2'): boolean => {
    const objetivos = jogador === 'jogador1' ? state.objetivoJogador1 : state.objetivoJogador2;
    return objetivos.some(obj => obj.linha === linha && obj.coluna === coluna);
  };

  // Obter cor de fundo da célula
  const getCelulaBackground = (linha: number, coluna: number): string => {
    const isObj1 = isObjetivo(linha, coluna, 'jogador1');
    const isObj2 = isObjetivo(linha, coluna, 'jogador2');
    
    if (isObj1) return 'bg-pink-200';
    if (isObj2) return 'bg-cyan-200';
    return 'bg-indigo-100';
  };

  return (
    <GameLayout titulo="Quelhas" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1="Jogador 1"
          nomeJogador2="Jogador 2"
          corJogador1="bg-pink-500"
          corJogador2="bg-cyan-500"
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        {/* Tabuleiro */}
        <div className="game-container">
          <div className="aspect-square max-w-sm mx-auto">
            <div className="grid grid-cols-4 gap-2 h-full bg-indigo-900 p-3 rounded-xl">
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((celula, colunaIdx) => {
                  const pos = { linha: linhaIdx, coluna: colunaIdx };
                  const selecionada = state.pecaSelecionada?.linha === linhaIdx && 
                                      state.pecaSelecionada?.coluna === colunaIdx;
                  const jogadaValida = state.jogadasValidas.some(
                    j => j.linha === linhaIdx && j.coluna === colunaIdx
                  );

                  return (
                    <button
                      key={`${linhaIdx}-${colunaIdx}`}
                      onClick={() => handleCellClick(pos)}
                      className={`
                        aspect-square rounded-lg flex items-center justify-center
                        text-2xl md:text-3xl font-bold transition-all duration-200
                        ${getCelulaBackground(linhaIdx, colunaIdx)}
                        ${selecionada ? 'ring-4 ring-yellow-400 scale-105' : ''}
                        ${jogadaValida ? 'ring-4 ring-green-400 bg-green-200' : ''}
                        ${celula ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                        ${jogadaValida ? 'cursor-pointer' : ''}
                      `}
                    >
                      {celula && (
                        <div
                          className={`
                            w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center
                            text-white font-bold text-xl md:text-2xl shadow-lg
                            ${celula.jogador === 'jogador1' ? 'bg-pink-500' : 'bg-cyan-500'}
                            ${selecionada ? 'animate-pulse' : ''}
                          `}
                        >
                          {celula.valor}
                        </div>
                      )}
                      {jogadaValida && !celula && (
                        <span className="w-6 h-6 rounded-full bg-green-400 opacity-75"></span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-col items-center gap-2 text-sm text-gray-600">
            <div className="flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-xs font-bold">1</div>
                <span>Jogador 1</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-white text-xs font-bold">2</div>
                <span>Jogador 2</span>
              </div>
            </div>
            <div className="flex justify-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-pink-200 rounded"></div>
                <span>Objetivo J1</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-cyan-200 rounded"></div>
                <span>Objetivo J2</span>
              </div>
            </div>
          </div>

          {/* Dica */}
          <div className="mt-2 text-center text-sm text-gray-500">
            Seleciona uma peça e move-a exatamente o número de casas indicado.
          </div>
        </div>
      </div>

      {/* Anúncio de vencedor */}
      {mostrarVencedor && (
        <WinnerAnnouncement
          estado={state.estado}
          modo={state.modo}
          nomeJogador1="Jogador 1"
          nomeJogador2="Jogador 2"
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}

