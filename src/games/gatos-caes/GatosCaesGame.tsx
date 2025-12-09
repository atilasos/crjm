import { useState, useEffect, useCallback } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { GatosCaesState, Posicao } from './types';
import { 
  criarEstadoInicial, 
  selecionarPeca, 
  executarJogada,
  jogadaComputador,
} from './logic';
import { GameMode } from '../../types';

interface GatosCaesGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'O tabuleiro é 5×5. Só se joga nas casas escuras (diagonais).',
  'Os GATOS (3 peças) começam em cima e movem-se em diagonal para baixo.',
  'O CÃO (1 peça) começa em baixo e move-se em qualquer diagonal.',
  'O CÃO pode capturar gatos saltando por cima deles.',
  'Os GATOS ganham se bloquearem o cão (ele fica sem jogadas).',
  'O CÃO ganha se chegar à linha de cima ou capturar todos os gatos.',
  'Não é obrigatório capturar.',
];

export function GatosCaesGame({ onVoltar }: GatosCaesGameProps) {
  const [state, setState] = useState<GatosCaesState>(() => 
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

    const { tabuleiro, pecaSelecionada, jogadasValidas } = state;
    const peca = tabuleiro[pos.linha][pos.coluna];

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
    const podeSelecionarGato = state.jogadorAtual === 'jogador1' && peca === 'gato';
    const podeSelecionarCao = state.jogadorAtual === 'jogador2' && peca === 'cao';

    if (podeSelecionarGato || podeSelecionarCao) {
      setState(prev => selecionarPeca(prev, pos));
    } else if (pecaSelecionada) {
      // Desselecionar se clicou em casa inválida
      setState(prev => ({ ...prev, pecaSelecionada: null, jogadasValidas: [], capturas: [] }));
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

  // Determinar se uma célula é escura (jogável)
  const isCelulaEscura = (linha: number, coluna: number) => {
    return (linha + coluna) % 2 === 0;
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
          nomeJogador2="Cão"
          corJogador1="bg-orange-500"
          corJogador2="bg-blue-500"
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        {/* Tabuleiro */}
        <div className="game-container">
          <div className="aspect-square max-w-md mx-auto">
            <div className="grid grid-cols-5 gap-1 h-full bg-amber-900 p-2 rounded-xl">
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((celula, colunaIdx) => {
                  const pos = { linha: linhaIdx, coluna: colunaIdx };
                  const escura = isCelulaEscura(linhaIdx, colunaIdx);
                  const selecionada = state.pecaSelecionada?.linha === linhaIdx && 
                                      state.pecaSelecionada?.coluna === colunaIdx;
                  const jogadaValida = state.jogadasValidas.some(
                    j => j.linha === linhaIdx && j.coluna === colunaIdx
                  );
                  const captura = state.capturas.some(
                    c => c.linha === linhaIdx && c.coluna === colunaIdx
                  );

                  return (
                    <button
                      key={`${linhaIdx}-${colunaIdx}`}
                      onClick={() => escura && handleCellClick(pos)}
                      disabled={!escura}
                      className={`
                        aspect-square rounded-lg flex items-center justify-center
                        text-4xl md:text-5xl transition-all duration-200
                        ${escura 
                          ? 'bg-amber-700 hover:bg-amber-600 cursor-pointer' 
                          : 'bg-amber-200 cursor-not-allowed'
                        }
                        ${selecionada ? 'ring-4 ring-yellow-400 bg-amber-500' : ''}
                        ${jogadaValida ? 'ring-4 ring-green-400 bg-green-600/30' : ''}
                        ${captura ? 'ring-4 ring-red-400 bg-red-600/30' : ''}
                      `}
                    >
                      {celula === 'gato' && (
                        <span className="drop-shadow-lg select-none">🐱</span>
                      )}
                      {celula === 'cao' && (
                        <span className="drop-shadow-lg select-none">🐶</span>
                      )}
                      {jogadaValida && !celula && (
                        <span className="w-4 h-4 rounded-full bg-green-400 opacity-75"></span>
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
              <span className="text-2xl">🐱</span>
              <span>Gatos (Jogador 1)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐶</span>
              <span>Cão (Jogador 2)</span>
            </div>
          </div>

          {/* Gatos restantes */}
          <div className="mt-2 text-center text-sm text-gray-500">
            Gatos restantes: {state.gatosRestantes}
          </div>
        </div>
      </div>

      {/* Anúncio de vencedor */}
      {mostrarVencedor && (
        <WinnerAnnouncement
          estado={state.estado}
          modo={state.modo}
          nomeJogador1="Gatos"
          nomeJogador2="Cão"
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}

