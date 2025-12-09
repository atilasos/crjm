import { useState, useEffect, useCallback } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { QuelhasState, Posicao, Segmento } from './types';
import { 
  criarEstadoInicial, 
  colocarSegmento,
  getSegmentoParaPosicao,
  atualizarPreview,
  getCelulasSegmento,
  jogadaComputador,
} from './logic';
import { GameMode } from '../../types';

interface QuelhasGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro 10×10.',
  'O Jogador Vertical coloca segmentos VERTICAIS (mínimo 2 casas).',
  'O Jogador Horizontal coloca segmentos HORIZONTAIS (mínimo 2 casas).',
  'Começa o Vertical.',
  'Os segmentos ocupam casas livres consecutivas.',
  'ATENÇÃO: Este jogo é MISÈRE - perde quem fizer a última jogada!',
  'Se não tiveres jogadas no teu turno, GANHAS (o adversário foi o último a jogar).',
];

export function QuelhasGame({ onVoltar }: QuelhasGameProps) {
  const [state, setState] = useState<QuelhasState>(() => 
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [comprimentoSelecionado, setComprimentoSelecionado] = useState(2);

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

    const segmento = getSegmentoParaPosicao(state, pos);
    if (segmento) {
      setState(prev => colocarSegmento(prev, segmento));
    }
  }, [state]);

  const handleMouseEnter = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual === 'jogador2') return;
    
    const segmento = getSegmentoParaPosicao(state, pos);
    setState(prev => atualizarPreview(prev, segmento));
  }, [state.estado, state.modo, state.jogadorAtual]);

  const handleMouseLeave = useCallback(() => {
    setState(prev => ({ ...prev, segmentoPreview: null }));
  }, []);

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
    if (!state.segmentoPreview) return false;
    const celulas = getCelulasSegmento(state.segmentoPreview);
    return celulas.some(c => c.linha === linha && c.coluna === coluna);
  };

  // Obter classe CSS para cada célula
  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha][coluna];
    const preview = isPreview(linha, coluna);
    
    let classes = 'aspect-square rounded-sm flex items-center justify-center transition-all duration-150 text-xs font-bold ';
    
    if (celula === 'ocupada') {
      classes += 'bg-indigo-600';
    } else if (preview) {
      classes += state.jogadorAtual === 'jogador1' 
        ? 'bg-pink-400 ring-2 ring-pink-300 cursor-pointer' 
        : 'bg-cyan-400 ring-2 ring-cyan-300 cursor-pointer';
    } else {
      classes += 'bg-gray-200 hover:bg-gray-300 cursor-pointer';
    }
    
    return classes;
  };

  return (
    <GameLayout titulo="Quelhas" regras={REGRAS} onVoltar={onVoltar}>
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
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

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
              <span>Vertical (J1)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-6 bg-cyan-500 rounded"></div>
              <span>Horizontal (J2)</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm text-gray-500">
            {state.estado === 'a-jogar' && (
              <>
                {state.jogadorAtual === 'jogador1' 
                  ? 'Clica para colocar um segmento VERTICAL' 
                  : 'Clica para colocar um segmento HORIZONTAL'}
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
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}
