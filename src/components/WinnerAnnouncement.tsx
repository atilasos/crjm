import { GameStatus, GameMode } from '../types';

interface WinnerAnnouncementProps {
  estado: GameStatus;
  modo: GameMode;
  nomeJogador1?: string;
  nomeJogador2?: string;
  humanoEhJogador1?: boolean; // Em modo vs-computador, indica qual jogador o humano controla
  onFechar: () => void;
  onNovoJogo: () => void;
}

export function WinnerAnnouncement({
  estado,
  modo,
  nomeJogador1 = 'Jogador 1',
  nomeJogador2 = 'Jogador 2',
  humanoEhJogador1 = true,
  onFechar,
  onNovoJogo,
}: WinnerAnnouncementProps) {
  if (estado === 'a-jogar') return null;

  const getNomeJogador2 = () => {
    if (modo === 'vs-computador') return 'Computador';
    return nomeJogador2;
  };

  const getConteudo = () => {
    // Em modo vs-computador, determinar se o humano ganhou ou perdeu
    if (modo === 'vs-computador') {
      const humanoGanhou = 
        (estado === 'vitoria-jogador1' && humanoEhJogador1) ||
        (estado === 'vitoria-jogador2' && !humanoEhJogador1);
      
      if (humanoGanhou) {
        return {
          emoji: '🎉',
          titulo: 'Parabéns!',
          mensagem: 'Ganhaste!',
          corFundo: 'from-yellow-400 via-orange-400 to-pink-500',
        };
      } else if (estado === 'vitoria-jogador1' || estado === 'vitoria-jogador2') {
        return {
          emoji: '🤖',
          titulo: 'Perdeste...',
          mensagem: 'O computador ganhou!',
          corFundo: 'from-blue-400 via-indigo-400 to-purple-500',
        };
      }
    }

    // Modo dois-jogadores ou outros casos
    switch (estado) {
      case 'vitoria-jogador1':
        return {
          emoji: '🎉',
          titulo: 'Parabéns!',
          mensagem: `${nomeJogador1} ganhou!`,
          corFundo: 'from-yellow-400 via-orange-400 to-pink-500',
        };
      case 'vitoria-jogador2':
        return {
          emoji: '🎉',
          titulo: 'Parabéns!',
          mensagem: `${getNomeJogador2()} ganhou!`,
          corFundo: 'from-cyan-400 via-teal-400 to-green-500',
        };
      case 'empate':
        return {
          emoji: '🤝',
          titulo: 'Empate!',
          mensagem: 'Nenhum jogador ganhou.',
          corFundo: 'from-gray-400 via-slate-400 to-zinc-500',
        };
      default:
        return null;
    }
  };

  const conteudo = getConteudo();
  if (!conteudo) return null;

  return (
    <div className="winner-announcement" onClick={onFechar}>
      <div
        className={`winner-card bg-gradient-to-br ${conteudo.corFundo}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-7xl mb-4 animate-float">{conteudo.emoji}</div>
        <h2 className="text-3xl font-bold text-white text-shadow-lg mb-2">
          {conteudo.titulo}
        </h2>
        <p className="text-xl text-white/90 mb-6">{conteudo.mensagem}</p>
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={onNovoJogo}
            className="btn bg-white text-gray-800 hover:bg-gray-100"
          >
            🔄 Jogar Novamente
          </button>
          <button
            onClick={onFechar}
            className="btn bg-white/20 text-white hover:bg-white/30"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

