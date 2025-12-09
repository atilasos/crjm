import { GameMode, Player, GameStatus } from '../../types';

// No jogo Quelhas:
// - Tabuleiro 4x4
// - Cada jogador tem 4 peças numeradas de 1 a 4
// - Jogador 1 começa com peças numa lateral, Jogador 2 na lateral oposta
// - Jogadores alternadamente movem uma das suas peças
// - Uma peça move-se exatamente tantas casas quanto o seu número (ortogonalmente)
// - Não se pode saltar por cima de outras peças
// - O objetivo é ocupar as 4 casas iniciais do adversário
// - Ganha quem primeiro ocupar todas as casas iniciais do adversário

export interface Posicao {
  linha: number;
  coluna: number;
}

export interface Peca {
  jogador: Player;
  valor: number; // 1 a 4
}

export type Celula = Peca | null;

export interface QuelhasState {
  tabuleiro: Celula[][];
  modo: GameMode;
  jogadorAtual: Player;
  estado: GameStatus;
  pecaSelecionada: Posicao | null;
  jogadasValidas: Posicao[];
  // Casas objetivo de cada jogador (onde devem chegar)
  objetivoJogador1: Posicao[]; // Linha 3 (última)
  objetivoJogador2: Posicao[]; // Linha 0 (primeira)
}

