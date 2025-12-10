import { useState, useEffect, useCallback, useMemo } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { PlayerInfo } from '../../components/PlayerInfo';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { ProdutoState, Posicao, gerarPosicoesValidas, posToKey, LADO_TABULEIRO } from './types';
import { 
  criarEstadoInicial, 
  colocarPeca,
  cancelarJogadaEmCurso,
  jogadaComputador,
} from './logic';
import { GameMode, Player } from '../../types';

interface ProdutoGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro hexagonal com 5 casas de lado.',
  'Em cada turno, coloca DUAS peças em casas vazias.',
  'IMPORTANTE: Podes colocar peças de QUALQUER cor (tua ou do adversário)!',
  'Exceção: Na primeira jogada, Pretas colocam apenas UMA peça.',
  'Pontuação: (maior grupo) × (2.º maior grupo).',
  'Se tiveres apenas 1 grupo, a tua pontuação é ZERO.',
  'Desempate: quem tiver menos peças no tabuleiro vence.',
  'O jogo termina quando o tabuleiro estiver cheio.',
];

export function ProdutoGame({ onVoltar }: ProdutoGameProps) {
  const [state, setState] = useState<ProdutoState>(() => 
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [corSelecionada, setCorSelecionada] = useState<'preta' | 'branca'>('preta');

  // Gerar posições do tabuleiro uma vez
  const posicoes = useMemo(() => gerarPosicoesValidas(), []);

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

  // Atualizar cor selecionada baseado no jogador atual
  useEffect(() => {
    setCorSelecionada(state.jogadorAtual === 'jogador1' ? 'preta' : 'branca');
  }, [state.jogadorAtual]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;
    if (state.tabuleiro.get(posToKey(pos)) !== 'vazia') return;

    setState(prev => colocarPeca(prev, pos, corSelecionada));
  }, [state, humanPlayer, corSelecionada]);

  const handleCancelar = useCallback(() => {
    setState(prev => cancelarJogadaEmCurso(prev));
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

  // Converter coordenadas axiais para posição no ecrã (pointy-top orientation)
  const hexToPixel = (q: number, r: number, size: number) => {
    const x = size * Math.sqrt(3) * (q + r / 2);
    const y = size * (3 / 2) * r;
    return { x, y };
  };

  // Calcular bounding box do tabuleiro
  const boundingBox = useMemo(() => {
    const size = 28; // Tamanho base do hexágono
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (const pos of posicoes) {
      const { x, y } = hexToPixel(pos.q, pos.r, size);
      minX = Math.min(minX, x - size);
      maxX = Math.max(maxX, x + size);
      minY = Math.min(minY, y - size);
      maxY = Math.max(maxY, y + size);
    }
    
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [posicoes]);

  // Renderizar hexágono
  const renderHex = (pos: Posicao) => {
    const size = 28;
    const { x, y } = hexToPixel(pos.q, pos.r, size);
    const key = posToKey(pos);
    const celula = state.tabuleiro.get(key);
    const isVezDoHumano = state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer;
    const isPrimeiraJogadaEmCurso = state.jogadaEmCurso.pos1 !== null && 
      state.jogadaEmCurso.pos1.q === pos.q && state.jogadaEmCurso.pos1.r === pos.r;
    
    // Pontos do hexágono (pointy-top: vértice no topo)
    const pontos = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 90); // -90 para começar do topo
      pontos.push(`${x + size * Math.cos(angle) - boundingBox.minX},${y + size * Math.sin(angle) - boundingBox.minY}`);
    }
    
    const isVazia = celula === 'vazia';
    const podeCelula = isVazia && state.estado === 'a-jogar' && isVezDoHumano;
    
    return (
      <g key={key} onClick={() => podeCelula && handleCellClick(pos)} style={{ cursor: podeCelula ? 'pointer' : 'default' }}>
        <polygon
          points={pontos.join(' ')}
          fill={celula === 'vazia' ? '#f5f5f5' : celula === 'preta' ? '#1f2937' : '#f9fafb'}
          stroke={isPrimeiraJogadaEmCurso ? '#10b981' : '#9ca3af'}
          strokeWidth={isPrimeiraJogadaEmCurso ? 3 : 1.5}
          className={podeCelula ? 'hover:fill-gray-200 transition-colors' : ''}
        />
        {celula !== 'vazia' && (
          <circle
            cx={x - boundingBox.minX}
            cy={y - boundingBox.minY}
            r={size * 0.6}
            fill={celula === 'preta' ? 'url(#gradPreta)' : 'url(#gradBranca)'}
            stroke={celula === 'preta' ? '#000' : '#6366f1'}
            strokeWidth={celula === 'preta' ? 1 : 2}
            filter={celula === 'branca' ? 'url(#shadowBranca)' : undefined}
          />
        )}
      </g>
    );
  };

  // Verificar quantas peças faltam na jogada atual
  const pecasFaltam = state.primeiraJogada ? 1 : (state.jogadaEmCurso.pos1 === null ? 2 : 1);

  return (
    <GameLayout titulo="Produto" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1="Pretas"
          nomeJogador2="Brancas"
          corJogador1="bg-gray-900"
          corJogador2="bg-gray-200"
          humanPlayer={humanPlayer}
          onChangeHumanPlayer={handleChangeHumanPlayer}
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        {/* Painel de pontuação */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 text-white rounded-xl p-3 text-center">
            <div className="text-xs opacity-75 mb-1">Pretas</div>
            <div className="text-2xl font-bold">{state.pontuacaoPretas.produto}</div>
            <div className="text-xs opacity-75">
              {state.pontuacaoPretas.maiorGrupo} × {state.pontuacaoPretas.segundoMaiorGrupo}
            </div>
            <div className="text-xs opacity-50 mt-1">
              {state.pontuacaoPretas.totalPecas} peças
            </div>
          </div>
          <div className="bg-gray-100 text-gray-900 rounded-xl p-3 text-center border-2 border-gray-300">
            <div className="text-xs opacity-75 mb-1">Brancas</div>
            <div className="text-2xl font-bold">{state.pontuacaoBrancas.produto}</div>
            <div className="text-xs opacity-75">
              {state.pontuacaoBrancas.maiorGrupo} × {state.pontuacaoBrancas.segundoMaiorGrupo}
            </div>
            <div className="text-xs opacity-50 mt-1">
              {state.pontuacaoBrancas.totalPecas} peças
            </div>
          </div>
        </div>

        {/* Seletor de cor (só se não é primeira jogada) */}
        {!state.primeiraJogada && state.estado === 'a-jogar' && 
         (state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer) && (
          <div className="bg-purple-100 border-2 border-purple-400 rounded-xl p-3">
            <p className="text-purple-800 text-sm mb-2 text-center font-medium">
              Cor da peça a colocar ({pecasFaltam} peça{pecasFaltam > 1 ? 's' : ''} restante{pecasFaltam > 1 ? 's' : ''}):
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setCorSelecionada('preta')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  corSelecionada === 'preta'
                    ? 'bg-gray-900 text-white ring-2 ring-purple-400'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-gray-900 border border-gray-600"></div>
                Preta
              </button>
              <button
                onClick={() => setCorSelecionada('branca')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  corSelecionada === 'branca'
                    ? 'bg-indigo-50 text-gray-900 ring-2 ring-purple-400 border border-indigo-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-200 border-2 border-indigo-400"></div>
                Branca
              </button>
            </div>
            {state.jogadaEmCurso.pos1 !== null && (
              <div className="mt-2 flex justify-center">
                <button
                  onClick={handleCancelar}
                  className="text-sm text-red-600 hover:text-red-800 underline"
                >
                  Cancelar primeira peça
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tabuleiro hexagonal */}
        <div className="game-container">
          <div className="flex justify-center">
            <svg 
              width={Math.min(boundingBox.width + 20, 400)} 
              height={Math.min(boundingBox.height + 20, 400)}
              viewBox={`-10 -10 ${boundingBox.width + 20} ${boundingBox.height + 20}`}
              className="max-w-full"
            >
              <defs>
                <linearGradient id="gradPreta" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#374151" />
                  <stop offset="100%" stopColor="#111827" />
                </linearGradient>
                <linearGradient id="gradBranca" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f0f4ff" />
                  <stop offset="50%" stopColor="#e0e7ff" />
                  <stop offset="100%" stopColor="#c7d2fe" />
                </linearGradient>
                <filter id="shadowBranca" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#6366f1" floodOpacity="0.4"/>
                </filter>
              </defs>
              {posicoes.map(pos => renderHex(pos))}
            </svg>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-gray-600"></div>
              <span>Pretas (J1)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-200 border-2 border-indigo-400 shadow-sm shadow-indigo-300"></div>
              <span>Brancas (J2)</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm text-gray-500">
            {state.estado === 'a-jogar' && (
              <>
                {state.primeiraJogada 
                  ? 'Pretas: coloca a primeira peça (apenas 1 nesta jogada)'
                  : `${state.jogadorAtual === 'jogador1' ? 'Pretas' : 'Brancas'}: coloca ${pecasFaltam} peça${pecasFaltam > 1 ? 's' : ''}`
                }
                {' '}• Casas livres: {state.casasVazias.length}
              </>
            )}
          </div>

          {/* Dica de estratégia */}
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800 text-center">
            <strong>Dica:</strong> Podes colocar peças do adversário para unir os grupos dele e reduzir a pontuação a 0!
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

