import { GameMode, Player, GameStatus } from '../../types';

// Dominório - Jogo de dominós (normal play - último a jogar ganha)
// - Tabuleiro 8×8
// - Jogador Vertical coloca dominós verticais (2 casas)
// - Jogador Horizontal coloca dominós horizontais (2 casas)
// - Começa o Vertical
// - NORMAL PLAY: Ganha quem colocar a última peça
// - Se um jogador não tiver jogadas, PERDE (o adversário ganhou)

export type Celula = 'vazia' | 'ocupada-vertical' | 'ocupada-horizontal';

export interface Posicao {
  linha: number;
  coluna: number;
}

export interface Domino {
  pos1: Posicao;
  pos2: Posicao;
  orientacao: 'horizontal' | 'vertical';
}

export interface DominorioState {
  tabuleiro: Celula[][];
  modo: GameMode;
  jogadorAtual: Player; // jogador1 = Vertical, jogador2 = Horizontal
  estado: GameStatus;
  dominoPreview: Domino | null;
  jogadasValidas: Domino[];
  dominosColocados: Domino[];
}
