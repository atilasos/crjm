// Tipos comuns para os jogos matemáticos

export type GameMode = 'vs-computador' | 'dois-jogadores';

export type Player = 'jogador1' | 'jogador2';

export type GameStatus = 'a-jogar' | 'vitoria-jogador1' | 'vitoria-jogador2' | 'empate';

export interface GameState {
  modo: GameMode;
  jogadorAtual: Player;
  estado: GameStatus;
}

// Gatos & Cães
export type GatosCaesPeca = 'gato' | 'cao' | null;

export interface GatosCaesState extends GameState {
  tabuleiro: GatosCaesPeca[][];
  pecaSelecionada: { linha: number; coluna: number } | null;
  jogadasValidas: { linha: number; coluna: number }[];
}

// Dominório
export type DominorioCelula = 'vazia' | 'horizontal' | 'vertical';

export interface DominorioState extends GameState {
  tabuleiro: DominorioCelula[][];
  dominoPreview: { linha: number; coluna: number; orientacao: 'horizontal' | 'vertical' } | null;
}

// Quelhas
export type QuelhasCelula = number | null; // número da peça ou null se vazio

export interface QuelhasState extends GameState {
  tabuleiro: QuelhasCelula[][];
  pecaSelecionada: { linha: number; coluna: number } | null;
  jogadasValidas: { linha: number; coluna: number }[];
  pecasJogador1: number[];
  pecasJogador2: number[];
}

