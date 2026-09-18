import type { GameStatus, Player } from '../../types';
export type Cor = 'azul' | 'vermelho';
export interface YState {
  tabuleiro: Record<string, Cor | null>;
  cores: Record<Player, Cor>;
  jogadorAtual: Player;
  podeTrocar: boolean;
  colocacoes: number;
  estado: GameStatus;
}

export type YMove = { type: 'place'; node: string } | { type: 'swap' };
