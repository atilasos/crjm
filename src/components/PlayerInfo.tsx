import { Player, GameMode, GameStatus } from '../types';

// AI-related types (optional, for games that support AI)
export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface AIMetrics {
  isThinking: boolean;
  lastDepth: number;
  lastNodes: number;
  lastTimeMs: number;
  lastTTHitRate: number;
  lastScore: number;
  fromBook: boolean;
}

interface PlayerInfoProps {
  modo: GameMode;
  jogadorAtual: Player;
  estado: GameStatus;
  nomeJogador1?: string;
  nomeJogador2?: string;
  corJogador1?: string;
  corJogador2?: string;
  humanPlayer?: Player; // Em modo vs-computador, qual jogador é humano
  onChangeHumanPlayer?: (player: Player) => void; // Callback para mudar de lado
  onNovoJogo: () => void;
  onTrocarModo: () => void;
  // AI-specific props (optional)
  difficulty?: AIDifficulty;
  onChangeDifficulty?: (difficulty: AIDifficulty) => void;
  aiMetrics?: AIMetrics;
  aiReady?: boolean;
}

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
};

const DIFFICULTY_COLORS: Record<AIDifficulty, string> = {
  easy: 'bg-green-500',
  medium: 'bg-yellow-500',
  hard: 'bg-red-500',
};

export function PlayerInfo({
  modo,
  jogadorAtual,
  estado,
  nomeJogador1 = 'Jogador 1',
  nomeJogador2 = 'Jogador 2',
  corJogador1 = 'bg-pink-500',
  corJogador2 = 'bg-cyan-500',
  humanPlayer = 'jogador1',
  onChangeHumanPlayer,
  onNovoJogo,
  onTrocarModo,
  // AI props
  difficulty,
  onChangeDifficulty,
  aiMetrics,
  aiReady = true,
}: PlayerInfoProps) {
  const jogoTerminado = estado !== 'a-jogar';
  const hasAISupport = difficulty !== undefined && onChangeDifficulty !== undefined;
  
  // Em modo vs-computador, determinar nomes e ícones com base em quem é humano
  const getNomeJogador = (jogador: Player) => {
    if (modo === 'vs-computador') {
      if (jogador === humanPlayer) {
        return jogador === 'jogador1' ? nomeJogador1 : nomeJogador2;
      } else {
        return 'Computador';
      }
    }
    return jogador === 'jogador1' ? nomeJogador1 : nomeJogador2;
  };

  const getIconeJogador = (jogador: Player) => {
    if (modo === 'vs-computador') {
      return jogador === humanPlayer ? '👤' : '🤖';
    }
    return '👤';
  };

  // Format number with K/M suffix
  const formatNumber = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-lg border-2 border-white/50">
      {/* Modo de jogo */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-600">Modo de jogo:</span>
        <button
          onClick={onTrocarModo}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {modo === 'vs-computador' ? '🤖 vs Computador' : '👥 2 Jogadores'}
        </button>
      </div>

      {/* Selector de lado (apenas em modo vs-computador) */}
      {modo === 'vs-computador' && onChangeHumanPlayer && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-600 block mb-2">Jogar como:</span>
          <div className="flex gap-2">
            <button
              onClick={() => onChangeHumanPlayer('jogador1')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                humanPlayer === 'jogador1'
                  ? `${corJogador1} text-white shadow-md`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {nomeJogador1} (1.º)
            </button>
            <button
              onClick={() => onChangeHumanPlayer('jogador2')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                humanPlayer === 'jogador2'
                  ? `${corJogador2} text-white shadow-md`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {nomeJogador2} (2.º)
            </button>
          </div>
        </div>
      )}

      {/* Difficulty selector (only for games with AI support) */}
      {modo === 'vs-computador' && hasAISupport && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-600 block mb-2">Dificuldade:</span>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((level) => (
              <button
                key={level}
                onClick={() => onChangeDifficulty(level)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  difficulty === level
                    ? `${DIFFICULTY_COLORS[level]} text-white shadow-md`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {DIFFICULTY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Indicadores de jogador */}
      <div className="flex justify-around items-center gap-4 mb-4">
        <div
          className={`player-indicator ${corJogador1} text-white ${
            jogadorAtual === 'jogador1' && !jogoTerminado ? 'active' : ''
          }`}
        >
          <span className="text-lg">{getIconeJogador('jogador1')}</span>
          <span>{getNomeJogador('jogador1')}</span>
        </div>
        
        <span className="text-2xl font-bold text-gray-400">VS</span>
        
        <div
          className={`player-indicator ${corJogador2} text-white ${
            jogadorAtual === 'jogador2' && !jogoTerminado ? 'active' : ''
          }`}
        >
          <span className="text-lg">{getIconeJogador('jogador2')}</span>
          <span>{getNomeJogador('jogador2')}</span>
        </div>
      </div>

      {/* Estado do jogo */}
      {!jogoTerminado && (
        <div className="text-center py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
          <p className="text-gray-700">
            {aiMetrics?.isThinking ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                A pensar...
              </span>
            ) : (
              <>Vez de: <span className="font-bold">{getNomeJogador(jogadorAtual)}</span></>
            )}
          </p>
        </div>
      )}

      {/* AI Metrics (only show if AI has made moves) */}
      {modo === 'vs-computador' && hasAISupport && aiMetrics && (aiMetrics.lastDepth > 0 || aiMetrics.fromBook) && (
        <div className="mt-3 p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1 justify-center">
            {aiMetrics.fromBook ? (
              <span className="text-indigo-600 font-medium">📖 Livro de aberturas</span>
            ) : (
              <>
                <span title="Profundidade de pesquisa">🔍 {aiMetrics.lastDepth}</span>
                <span title="Nós pesquisados">🌳 {formatNumber(aiMetrics.lastNodes)}</span>
                <span title="Tempo de cálculo">{aiMetrics.lastTimeMs.toFixed(0)}ms</span>
                {aiMetrics.lastTTHitRate > 0 && (
                  <span title="Taxa de acerto da tabela de transposições">
                    TT: {(aiMetrics.lastTTHitRate * 100).toFixed(0)}%
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* AI status indicator */}
      {modo === 'vs-computador' && hasAISupport && !aiReady && (
        <div className="mt-2 text-center text-xs text-amber-600">
          ⏳ A carregar motor de IA...
        </div>
      )}

      {/* Botões de ação */}
      <div className="mt-4 flex gap-2">
        <button onClick={onNovoJogo} className="btn btn-primary flex-1 text-sm">
          🔄 Novo Jogo
        </button>
      </div>
    </div>
  );
}
