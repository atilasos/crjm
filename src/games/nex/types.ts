import { GameMode, Player, GameStatus } from '../../types';

// Nex - Jogo de conexão com peças neutras
// - Grelha hexagonal em formato de losango horizontal (11 casas de lado)
// - Objetivo: criar caminho contínuo ligando as duas margens designadas
//   - Preto: liga ↖ superior-esquerdo a inferior-direito ↘ (x=0 a x=10)
//   - Branco: liga ↗ superior-direito a inferior-esquerdo ↙ (y=0 a y=10)
// - Turno: escolher UMA das ações:
//   1. Colocação: 1 peça própria + 1 peça neutra em casas vazias
//   2. Substituição: trocar 2 neutras por próprias + 1 própria por neutra
// - Regra da Torta (Swap): O 2.º jogador, no primeiro lance, pode trocar de cor

export type Celula = 'vazia' | 'preta' | 'branca' | 'neutra';

// Coordenadas para tabuleiro losango
// Usamos (x, y) onde ambos vão de 0 a 10 para um tabuleiro 11x11
export interface Posicao {
  x: number;
  y: number;
}

export type TipoAcao = 'colocacao' | 'substituicao';

export interface AcaoColocacao {
  tipo: 'colocacao';
  posPropria: Posicao;
  posNeutra: Posicao;
}

export interface AcaoSubstituicao {
  tipo: 'substituicao';
  neutrasParaProprias: [Posicao, Posicao]; // 2 neutras viram próprias
  propriaParaNeutra: Posicao; // 1 própria vira neutra
}

export type Acao = AcaoColocacao | AcaoSubstituicao;

// Estado parcial de uma ação em construção (para UI)
export interface AcaoEmCurso {
  tipo: TipoAcao | null;
  // Para colocação
  posPropria: Posicao | null;
  posNeutra: Posicao | null;
  // Para substituição
  neutrasParaProprias: Posicao[];
  propriaParaNeutra: Posicao | null;
}

export interface NexState {
  tabuleiro: Celula[][];
  modo: GameMode;
  jogadorAtual: Player; // jogador1 = Pretas, jogador2 = Brancas
  estado: GameStatus;
  primeiraJogada: boolean; // Para exceção de abertura e regra de troca
  swapDisponivel: boolean; // Se o jogador pode fazer swap
  swapEfetuado: boolean;
  acaoEmCurso: AcaoEmCurso;
}

export const LADO_TABULEIRO = 11;

// Funções utilitárias
export function posToKey(pos: Posicao): string {
  return `${pos.x},${pos.y}`;
}

export function keyToPos(key: string): Posicao {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

