import type { GameStatus, Player } from '../../types';

export type Distancia = 1 | 2 | 3;
export type Direcao = 'cima' | 'direita' | 'baixo' | 'esquerda';
export interface Casa { linha: number; coluna: number }
export interface Jogada { casa: Casa; distancia: Distancia; direcao: Direcao }
export interface Peca { jogador: Player; distancia: Distancia; direcao: Direcao }
export interface FaiscaState {
  tabuleiro: (Peca | null)[][];
  reservas: Record<Player, Record<Distancia, number>>;
  jogadorAtual: Player;
  casaObrigatoria: Casa | null;
  estado: GameStatus;
}
