import { Player, GameMode, GameStatus } from '../types';

interface PlayerInfoProps {
  modo: GameMode;
  jogadorAtual: Player;
  estado: GameStatus;
  nomeJogador1?: string;
  nomeJogador2?: string;
  corJogador1?: string;
  corJogador2?: string;
  onNovoJogo: () => void;
  onTrocarModo: () => void;
}

export function PlayerInfo({
  modo,
  jogadorAtual,
  estado,
  nomeJogador1 = 'Jogador 1',
  nomeJogador2 = 'Jogador 2',
  corJogador1 = 'bg-pink-500',
  corJogador2 = 'bg-cyan-500',
  onNovoJogo,
  onTrocarModo,
}: PlayerInfoProps) {
  const jogoTerminado = estado !== 'a-jogar';
  
  const getNomeJogador2 = () => {
    if (modo === 'vs-computador') return 'Computador';
    return nomeJogador2;
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

      {/* Indicadores de jogador */}
      <div className="flex justify-around items-center gap-4 mb-4">
        <div
          className={`player-indicator ${corJogador1} text-white ${
            jogadorAtual === 'jogador1' && !jogoTerminado ? 'active' : ''
          }`}
        >
          <span className="text-lg">👤</span>
          <span>{nomeJogador1}</span>
        </div>
        
        <span className="text-2xl font-bold text-gray-400">VS</span>
        
        <div
          className={`player-indicator ${corJogador2} text-white ${
            jogadorAtual === 'jogador2' && !jogoTerminado ? 'active' : ''
          }`}
        >
          <span className="text-lg">{modo === 'vs-computador' ? '🤖' : '👤'}</span>
          <span>{getNomeJogador2()}</span>
        </div>
      </div>

      {/* Estado do jogo */}
      {!jogoTerminado && (
        <div className="text-center py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
          <p className="text-gray-700">
            Vez de: <span className="font-bold">{jogadorAtual === 'jogador1' ? nomeJogador1 : getNomeJogador2()}</span>
          </p>
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

