import { GameMode, Player, GameStatus } from '../../types';

// Quelhas - Jogo de segmentos (variante misère)
// - Tabuleiro 10×10
// - Jogador Vertical coloca segmentos verticais (comprimento ≥ 2)
// - Jogador Horizontal coloca segmentos horizontais (comprimento ≥ 2)
// - Começa o Vertical
// - MISÈRE: Perde quem realizar a última jogada válida
// - Se um jogador não tiver jogadas, GANHA (o adversário foi o último a jogar)
// - Regra de troca: O jogador Horizontal pode, na sua primeira jogada, trocar de papel com o Vertical

export type Celula = 'vazia' | 'ocupada';

export type Orientacao = 'vertical' | 'horizontal';

export interface Posicao {
  linha: number;
  coluna: number;
}

// Um segmento é definido pela posição inicial e comprimento
export interface Segmento {
  inicio: Posicao;
  comprimento: number;
  orientacao: Orientacao;
}

export interface QuelhasState {
  tabuleiro: Celula[][];
  modo: GameMode;
  jogadorAtual: Player;
  estado: GameStatus;
  segmentoPreview: Segmento | null;
  jogadasValidas: Segmento[];
  primeiraJogada: boolean;
  // Orientações dinâmicas (podem trocar após a regra de troca)
  orientacaoJogador1: Orientacao;
  orientacaoJogador2: Orientacao;
  // Controlo da regra de troca
  trocaDisponivel: boolean; // Janela em que a troca pode ser exercida
  trocaEfetuada: boolean;   // Se a troca já foi usada neste jogo
}
