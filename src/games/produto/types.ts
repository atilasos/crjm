import { GameMode, Player, GameStatus } from '../../types';

// Produto - Jogo matemático de otimização de grupos
// - Tabuleiro hexagonal com 5 casas de lado (61 casas total)
// - Pontuação: P = (maior grupo) × (2.º maior grupo)
// - Se tiver menos de 2 grupos, pontuação = 0
// - Desempate: quem tiver MENOS peças no tabuleiro
// - Turno: colocar DUAS peças em casas vazias
// - IMPORTANTE: As peças podem ser de QUALQUER cor (própria ou adversária)
// - Exceção de abertura: No primeiro lance, Negras jogam apenas UMA peça
// - Fim de jogo: quando o tabuleiro estiver cheio

export type Celula = 'vazia' | 'preta' | 'branca';

// Coordenadas axiais para hexágonos (q, r)
// Usamos um sistema onde q vai de -4 a 4 e r vai de -4 a 4
// com a restrição de que |q + r| <= 4 para um hexágono de lado 5
export interface Posicao {
  q: number; // coluna axial
  r: number; // linha axial
}

export interface Grupo {
  cor: 'preta' | 'branca';
  celulas: Posicao[];
}

export interface Pontuacao {
  maiorGrupo: number;
  segundoMaiorGrupo: number;
  produto: number;
  totalPecas: number;
}

export interface JogadaDupla {
  pos1: Posicao;
  cor1: 'preta' | 'branca';
  pos2: Posicao | null; // null na primeira jogada (exceção de abertura)
  cor2: 'preta' | 'branca' | null;
}

export interface ProdutoState {
  tabuleiro: Map<string, Celula>; // Chave: "q,r"
  modo: GameMode;
  jogadorAtual: Player; // jogador1 = Pretas, jogador2 = Brancas
  estado: GameStatus;
  primeiraJogada: boolean; // Para exceção de abertura
  pontuacaoPretas: Pontuacao;
  pontuacaoBrancas: Pontuacao;
  // Estado da jogada atual (para jogadas de 2 peças)
  jogadaEmCurso: {
    pos1: Posicao | null;
    cor1: 'preta' | 'branca' | null;
  };
  casasVazias: Posicao[];
}

export const LADO_TABULEIRO = 5;

// Gerar todas as posições válidas do tabuleiro hexagonal
export function gerarPosicoesValidas(): Posicao[] {
  const posicoes: Posicao[] = [];
  const n = LADO_TABULEIRO - 1; // 4 para lado 5
  
  for (let q = -n; q <= n; q++) {
    for (let r = -n; r <= n; r++) {
      // Verificar se está dentro do hexágono
      if (Math.abs(q + r) <= n) {
        posicoes.push({ q, r });
      }
    }
  }
  
  return posicoes;
}

// Converter posição para chave string
export function posToKey(pos: Posicao): string {
  return `${pos.q},${pos.r}`;
}

// Converter chave string para posição
export function keyToPos(key: string): Posicao {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

// Total de casas no tabuleiro hexagonal de lado 5
export const TOTAL_CASAS = 61; // 3*5*4 + 1 = 61 para hexágono de lado 5

