import { useState, useEffect, useCallback } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { GatosCaesState, Posicao, CASAS_CENTRAIS } from './types';
import { 
  criarEstadoInicial, 
  colocarPeca,
  isJogadaValida,
  jogadaComputador,
} from './logic';
import { GameMode, Player } from '../../types';

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

  // Efeito para jogada do computador
  useEffect(() => {
    if (
      state.modo === 'vs-computador' && 
      state.jogadorAtual !== humanPlayer && 
      state.estado === 'a-jogar'
    ) {
      const timer = setTimeout(() => {
        setState(prev => jogadaComputador(prev));
      }, 800);
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
