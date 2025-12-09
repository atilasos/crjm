import { GameMode, Player, GameStatus } from '../../types';

// Gatos & Cães - Jogo de colocação (normal play - último a jogar ganha)
// - Tabuleiro 8×8
// - Jogadores alternam colocando UMA peça (Gato ou Cão)
// - Começam os Gatos
// - Primeiro Gato deve ser colocado nas 4 casas centrais (3,3), (3,4), (4,3), (4,4)
// - Primeiro Cão deve ser colocado FORA da zona central
// - Nunca pode haver Gato ortogonalmente adjacente a Cão
// - NORMAL PLAY: Ganha quem realizar a última jogada válida
// - Se um jogador não tiver casas legais, PERDE

export type Celula = 'vazia' | 'gato' | 'cao';

export interface Posicao {
  linha: number;
  coluna: number;
}

export interface GatosCaesState {
  tabuleiro: Celula[][];
  modo: GameMode;
  jogadorAtual: Player; // jogador1 = Gatos, jogador2 = Cães
  estado: GameStatus;
  jogadasValidas: Posicao[];
  primeiroGatoColocado: boolean;
  primeiroCaoColocado: boolean;
  totalGatos: number;
  totalCaes: number;
}

// Casas centrais (índices 0-based para tabuleiro 8x8)
export const CASAS_CENTRAIS: Posicao[] = [
  { linha: 3, coluna: 3 },
  { linha: 3, coluna: 4 },
  { linha: 4, coluna: 3 },
  { linha: 4, coluna: 4 },
];
