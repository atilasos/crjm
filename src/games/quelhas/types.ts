import { GameMode, Player, GameStatus } from '../../types';

// Quelhas - Jogo de segmentos (variante misère)
// - Tabuleiro 10×10
// - Jogador Vertical coloca segmentos verticais (comprimento ≥ 2)
// - Jogador Horizontal coloca segmentos horizontais (comprimento ≥ 2)
// - Começa o Vertical
// - MISÈRE: Perde quem realizar a última jogada válida
// - Se um jogador não tiver jogadas, GANHA (o adversário foi o último a jogar)

export type Celula = 'vazia' | 'ocupada';

export interface Posicao {
  linha: number;
  coluna: number;
}

// Um segmento é definido pela posição inicial e comprimento
export interface Segmento {
  inicio: Posicao;
  comprimento: number;
  orientacao: 'vertical' | 'horizontal';
}

export interface QuelhasState {
  tabuleiro: Celula[][];
  modo: GameMode;
  jogadorAtual: Player; // jogador1 = Vertical, jogador2 = Horizontal
  estado: GameStatus;
  segmentoPreview: Segmento | null;
  jogadasValidas: Segmento[];
  primeiraJogada: boolean; // Para regra de troca na primeira jogada do Horizontal
}
