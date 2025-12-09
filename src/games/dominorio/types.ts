import { GameMode, Player, GameStatus } from '../../types';

// No jogo Dominório:
// - Tabuleiro 5x5
// - Jogadores alternadamente colocam peças de dominó (ocupam 2 casas)
// - Jogador 1 coloca dominós na HORIZONTAL
// - Jogador 2 coloca dominós na VERTICAL
// - O jogador que não conseguir colocar um dominó perde

export type Celula = 'vazia' | 'ocupada-horizontal' | 'ocupada-vertical';

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
  jogadorAtual: Player; // jogador1 = horizontal, jogador2 = vertical
  estado: GameStatus;
  dominoPreview: Domino | null;
  celulaSelecionada: Posicao | null;
  jogadasValidas: Domino[];
  dominosColocados: Domino[];
}

