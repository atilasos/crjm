import { GameMode, Player, GameStatus } from '../../types';

// Atari Go (Capture Go) - Variante simplificada do Go
// - Tabuleiro 9×9 (joga-se nas interseções)
// - Pretas jogam primeiro
// - Objetivo: ser o primeiro a efetuar QUALQUER captura
// - Grupo: conjunto de peças da mesma cor ligadas ortogonalmente
// - Liberdade: interseção vazia adjacente a um grupo
// - Captura: quando um grupo fica com 0 liberdades, é removido
// - Suicídio: proibido colocar peça onde o grupo resultante fica sem liberdades,
//   EXCETO se essa jogada captura peças adversárias

export type Celula = 'vazia' | 'preta' | 'branca';

export interface Posicao {
  linha: number;
  coluna: number;
}

export interface Grupo {
  cor: 'preta' | 'branca';
  pedras: Posicao[];
  liberdades: Posicao[];
}

export interface AtariGoState {
  tabuleiro: Celula[][];
  modo: GameMode;
  jogadorAtual: Player; // jogador1 = Pretas, jogador2 = Brancas
  estado: GameStatus;
  jogadasValidas: Posicao[];
  ultimaJogada: Posicao | null;
  pedrasCapturadas: {
    pretas: number; // pedras pretas capturadas (pelo branco)
    brancas: number; // pedras brancas capturadas (pelo preto)
  };
}

export const TAMANHO_TABULEIRO = 9;

