import { GameMode, Player, GameStatus } from '../../types';

// No jogo Gatos & Cães:
// - Tabuleiro 5x5
// - Jogador 1 controla os GATOS (3 peças, começam em cima)
// - Jogador 2 controla o CÃO (1 peça, começa em baixo no centro)
// - Gatos só movem para baixo (diagonal esquerda ou direita)
// - Cão move em qualquer diagonal (pode capturar gatos saltando por cima)
// - Gatos ganham se bloquearem o cão (ele não tem jogadas válidas)
// - Cão ganha se chegar à linha de topo OU se capturar todos os gatos

export type Peca = 'gato' | 'cao' | null;

export interface Posicao {
  linha: number;
  coluna: number;
}

export interface GatosCaesState {
  tabuleiro: Peca[][];
  modo: GameMode;
  jogadorAtual: Player; // jogador1 = gatos, jogador2 = cão
  estado: GameStatus;
  pecaSelecionada: Posicao | null;
  jogadasValidas: Posicao[];
  capturas: Posicao[]; // posições onde há captura disponível
  gatosRestantes: number;
}

export interface Jogada {
  origem: Posicao;
  destino: Posicao;
  captura?: Posicao; // posição do gato capturado, se houver
}

