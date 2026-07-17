import type { Player, GameMode, GameStatus } from '../types';
import type { DifficultyLevel } from '../ai-core/types';
import type { DifficultyRecommendation } from '../ai-core/adaptive-difficulty';
import { DifficultySelector } from './DifficultySelector';

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
  difficulty?: DifficultyLevel;
  onChangeDifficulty?: (difficulty: DifficultyLevel) => void;
  difficultyRecommendation?: DifficultyRecommendation;
  canAcceptDifficultyRecommendation?: boolean;
  onAcceptDifficultyRecommendation?: (difficulty: DifficultyLevel) => void;
  aiMetrics?: AIMetrics;
  aiReady?: boolean;
}

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
  difficultyRecommendation,
  canAcceptDifficultyRecommendation,
  onAcceptDifficultyRecommendation,
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
    <div className="rounded-[var(--raio-painel)] border p-4 [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
      {/* Modo de jogo */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b [border-color:var(--linha)]">
        <span className="text-sm font-medium [color:var(--tinta-suave)]">Modo de jogo:</span>
        <button
          onClick={onTrocarModo}
          className="text-sm font-semibold transition-colors [color:var(--tinta)] hover:[color:var(--tinta-suave)]"
        >
          {modo === 'vs-computador' ? '🤖 vs Computador' : '👥 2 Jogadores'}
        </button>
      </div>

      {/* Selector de lado (apenas em modo vs-computador) */}
      {modo === 'vs-computador' && onChangeHumanPlayer && (
        <div className="mb-4 pb-4 border-b [border-color:var(--linha)]">
          <span className="text-sm font-medium block mb-2 [color:var(--tinta-suave)]">Jogar como:</span>
          <div className="flex gap-2">
            <button
              onClick={() => onChangeHumanPlayer('jogador1')}
              className={`flex-1 py-2 px-3 rounded-[var(--raio-controlo)] text-sm font-medium transition-all ${
                humanPlayer === 'jogador1'
                  ? `${corJogador1} text-white`
                  : 'border [border-color:var(--linha)] [color:var(--tinta-suave)] hover:[border-color:var(--tinta-suave)]'
              }`}
            >
              {nomeJogador1} (1.º)
            </button>
            <button
              onClick={() => onChangeHumanPlayer('jogador2')}
              className={`flex-1 py-2 px-3 rounded-[var(--raio-controlo)] text-sm font-medium transition-all ${
                humanPlayer === 'jogador2'
                  ? `${corJogador2} text-white`
                  : 'border [border-color:var(--linha)] [color:var(--tinta-suave)] hover:[border-color:var(--tinta-suave)]'
              }`}
            >
              {nomeJogador2} (2.º)
            </button>
          </div>
        </div>
      )}

      {/* Difficulty selector (only for games with AI support) */}
      {modo === 'vs-computador' && hasAISupport && (
        <div className="mb-4 pb-4 border-b [border-color:var(--linha)]">
          <DifficultySelector
            level={difficulty!}
            onChange={onChangeDifficulty!}
            recommendation={difficultyRecommendation}
            canAcceptRecommendation={canAcceptDifficultyRecommendation}
            onAcceptRecommendation={onAcceptDifficultyRecommendation}
          />
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
        
        <span className="text-2xl font-bold [color:var(--tinta-suave)]">VS</span>
        
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
        <div className="text-center py-2 rounded-[var(--raio-controlo)] border [border-color:var(--linha)]">
          <p className="[color:var(--tinta)]">
            {aiMetrics?.isThinking ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--tinta-suave)', borderTopColor: 'transparent' }}
                ></span>
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
        <div className="mt-3 p-2 rounded-[var(--raio-controlo)] border [border-color:var(--linha)]">
          <div className="text-xs flex flex-wrap gap-x-3 gap-y-1 justify-center [color:var(--tinta-suave)]">
            {aiMetrics.fromBook ? (
              <span className="font-medium [color:var(--tinta)]">📖 Livro de aberturas</span>
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
        <div className="mt-2 text-center text-xs [color:var(--ouro)]">
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
