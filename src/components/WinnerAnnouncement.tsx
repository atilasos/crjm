import { useEffect, useRef } from 'react';
import type { GameStatus, GameMode } from '../types';

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
  const botaoPrimarioRef = useRef<HTMLButtonElement>(null);
  const visivel = estado !== 'a-jogar';

  // Foco inicial no botão primário e Escape para fechar
  useEffect(() => {
    if (!visivel) return;
    botaoPrimarioRef.current?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [visivel, onFechar]);

  if (!visivel) return null;

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
        };
      } else if (estado === 'vitoria-jogador1' || estado === 'vitoria-jogador2') {
        return {
          emoji: '🤖',
          titulo: 'Perdeste...',
          mensagem: 'O computador ganhou!',
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
        };
      case 'vitoria-jogador2':
        return {
          emoji: '🎉',
          titulo: 'Parabéns!',
          mensagem: `${getNomeJogador2()} ganhou!`,
        };
      case 'empate':
        return {
          emoji: '🤝',
          titulo: 'Empate!',
          mensagem: 'Nenhum jogador ganhou.',
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="winner-titulo"
        aria-describedby="winner-mensagem"
        className="winner-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-6xl" aria-hidden="true">{conteudo.emoji}</div>
        <h2
          id="winner-titulo"
          className="mb-2 text-3xl font-bold [color:var(--tinta)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {conteudo.titulo}
        </h2>
        <p id="winner-mensagem" className="mb-6 text-xl [color:var(--tinta-suave)]">
          {conteudo.mensagem}
        </p>

        <div className="flex justify-center gap-3">
          <button
            ref={botaoPrimarioRef}
            onClick={onNovoJogo}
            className="btn btn-primary"
          >
            Jogar Novamente
          </button>
          <button
            onClick={onFechar}
            className="btn btn-secondary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
