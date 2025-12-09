import { Player, GameMode, GameStatus } from '../types';

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
}: PlayerInfoProps) {
  const jogoTerminado = estado !== 'a-jogar';
  
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
            Vez de: <span className="font-bold">{getNomeJogador(jogadorAtual)}</span>
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

