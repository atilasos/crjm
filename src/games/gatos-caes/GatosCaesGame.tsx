import { useState, useEffect, useCallback } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { GatosCaesState, Posicao, CASAS_CENTRAIS } from './types';
import {
  criarEstadoInicial,
  colocarPeca,
  isJogadaValida,
} from './logic';
import { GameMode, Player } from '../../types';
import { initAI, computeMove, cancelComputation, terminateAI } from './ai';

interface GatosCaesGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro 8×8.',
  'Jogadores alternam colocando UMA peça (Gato ou Cão).',
  'Começam os Gatos.',
  'O primeiro Gato deve ser colocado numa das 4 casas centrais.',
  'O primeiro Cão deve ser colocado FORA das casas centrais.',
  'Nunca podes colocar um Gato adjacente (↑↓←→) a um Cão, nem vice-versa.',
  'Ganha quem colocar a ÚLTIMA peça.',
  'Se não tiveres casas legais no teu turno, PERDES.',
];

export function GatosCaesGame({ onVoltar }: GatosCaesGameProps) {
  const [state, setState] = useState<GatosCaesState>(() =>
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [difficulty, setDifficulty] = useState(3);
  const [aiThinking, setAiThinking] = useState(false);

  // Initialize AI on mount
  useEffect(() => {
    initAI();
    return () => {
      cancelComputation();
      terminateAI();
    };
  }, []);

  // Efeito para jogada do computador
  useEffect(() => {
    const shouldPlayAI =
      state.modo === 'vs-computador' &&
      state.jogadorAtual !== humanPlayer &&
      state.estado === 'a-jogar' &&
      !aiThinking;

    console.log('[GatosCaes] AI check:', {
      shouldPlayAI,
      modo: state.modo,
      jogadorAtual: state.jogadorAtual,
      humanPlayer,
      estado: state.estado,
      aiThinking,
      jogadasValidas: state.jogadasValidas.length,
    });

    if (shouldPlayAI) {
      let cancelled = false;
      setAiThinking(true);

      const makeAIMove = async () => {
        // Small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 300));

        if (cancelled) {
          console.log('[GatosCaes] AI cancelled before compute');
          return;
        }

        try {
          console.log('[GatosCaes] Calling computeMove...');
          const { move, stats } = await computeMove(state, difficulty);
          console.log('[GatosCaes] computeMove returned:', { move, stats });

          if (cancelled) {
            console.log('[GatosCaes] AI cancelled after compute');
            return;
          }

          if (move) {
            console.log('[GatosCaes] Applying AI move:', move);
            setState(prev => colocarPeca(prev, move));
          } else {
            console.log('[GatosCaes] AI returned null move - no valid moves?');
          }
        } catch (error) {
          console.error('[GatosCaes] AI computation error:', error);
        } finally {
          if (!cancelled) {
            setAiThinking(false);
          }
        }
      };

      makeAIMove();

      return () => {
        console.log('[GatosCaes] Cleanup - cancelling AI');
        cancelled = true;
        cancelComputation();
        setAiThinking(false);
      };
    }
  }, [state.jogadorAtual, state.modo, state.estado, humanPlayer, aiThinking, difficulty, state]);

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
      setState(prev => colocarPeca(prev, pos));
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
    setHumanPlayer('jogador1'); // Reset ao trocar modo
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
  }, []);

  // Verificar se é casa central
  const isCasaCentral = (linha: number, coluna: number): boolean => {
    return CASAS_CENTRAIS.some(c => c.linha === linha && c.coluna === coluna);
  };

  // Verificar se é jogada válida
  const isJogadaValidaPos = (linha: number, coluna: number): boolean => {
    return state.jogadasValidas.some(j => j.linha === linha && j.coluna === coluna);
  };

  // Obter classe CSS para cada célula
  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha][coluna];
    const central = isCasaCentral(linha, coluna);
    const jogadaValida = isJogadaValidaPos(linha, coluna);
    
    let classes = 'aspect-square rounded-md flex items-center justify-center transition-all duration-200 text-3xl md:text-4xl ';
    
    // Fundo base
    if (central && celula === 'vazia') {
      classes += 'bg-amber-200 ';
    } else if (celula === 'vazia') {
      classes += 'bg-gray-100 ';
    } else {
      classes += 'bg-gray-50 ';
    }
    
    // Destacar jogadas válidas
    if (jogadaValida) {
      classes += 'ring-3 ring-green-400 bg-green-100 cursor-pointer hover:bg-green-200 ';
    } else if (celula === 'vazia') {
      classes += 'cursor-not-allowed opacity-70 ';
    }
    
    return classes;
  };

  const isVezDaIA =
    state.modo === 'vs-computador' &&
    state.estado === 'a-jogar' &&
    (state.jogadorAtual !== humanPlayer || aiThinking);

  return (
    <GameLayout titulo="Gatos & Cães" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1="Gatos"
          nomeJogador2="Cães"
          corJogador1="bg-orange-500"
          corJogador2="bg-blue-500"
          humanPlayer={humanPlayer}
          onChangeHumanPlayer={handleChangeHumanPlayer}
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        {/* Difficulty selector (only in vs computer mode) */}
        {state.modo === 'vs-computador' && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="text-gray-600">Dificuldade:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  disabled={aiThinking}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    difficulty === level
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } ${aiThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {level}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {difficulty === 1 && '(Fácil)'}
              {difficulty === 2 && '(Normal)'}
              {difficulty === 3 && '(Difícil)'}
              {difficulty === 4 && '(Muito Difícil)'}
              {difficulty === 5 && '(Mestre)'}
            </span>
          </div>
        )}

        {/* Tabuleiro */}
        <div className="game-container">
          <div className="aspect-square max-w-md mx-auto">
            <div className="grid grid-cols-8 gap-1 h-full bg-amber-900 p-2 rounded-xl">
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((celula, colunaIdx) => (
                  <button
                    key={`${linhaIdx}-${colunaIdx}`}
                    onClick={() => handleCellClick({ linha: linhaIdx, coluna: colunaIdx })}
                    className={getCelulaClasses(linhaIdx, colunaIdx)}
                    disabled={!isJogadaValidaPos(linhaIdx, colunaIdx)}
                  >
                    {celula === 'gato' && (
                      <span className="drop-shadow-lg select-none">🐱</span>
                    )}
                    {celula === 'cao' && (
                      <span className="drop-shadow-lg select-none">🐶</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-col items-center gap-2 text-sm text-gray-600">
            <div className="flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐱</span>
                <span>Gatos (J1): {state.totalGatos}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐶</span>
                <span>Cães (J2): {state.totalCaes}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 bg-amber-200 rounded border"></div>
              <span>Casas centrais (1.º Gato)</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm text-gray-500">
            {state.estado === 'a-jogar' && (
              isVezDaIA ? (
                <span className="flex items-center justify-center gap-2 text-indigo-600 font-medium">
                  <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                  IA a pensar…
                </span>
              ) : (
                <>
                  {state.jogadorAtual === 'jogador1' 
                    ? !state.primeiroGatoColocado 
                      ? 'Coloca o primeiro Gato numa casa central (amarela)' 
                      : 'Coloca um Gato (não pode ser adjacente a Cães)'
                    : !state.primeiroCaoColocado
                      ? 'Coloca o primeiro Cão fora das casas centrais'
                      : 'Coloca um Cão (não pode ser adjacente a Gatos)'}
                  {' '}• Jogadas disponíveis: {state.jogadasValidas.length}
                </>
              )
            )}
          </div>
        </div>
      </div>

      {/* Anúncio de vencedor */}
      {mostrarVencedor && (
        <WinnerAnnouncement
          estado={state.estado}
          modo={state.modo}
          nomeJogador1="Gatos"
          nomeJogador2="Cães"
          humanoEhJogador1={humanPlayer === 'jogador1'}
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}
