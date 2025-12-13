import { QuelhasState, Celula, Posicao, Segmento, Orientacao } from './types';
import { GameMode, GameStatus, Player } from '../../types';
import { searchBestMove } from './ai/engine';

const TAMANHO_TABULEIRO = 10;
const COMPRIMENTO_MINIMO = 2;

// ============================================================================
// ESTRUTURAS PARA ANÁLISE ESTRATÉGICA (min/max, exclusivas/partilhadas)
// ============================================================================

/**
 * Um bloco (run) é uma sequência máxima de células vazias consecutivas
 * numa coluna (vertical) ou linha (horizontal).
 */
export interface Bloco {
  inicio: number;        // Índice inicial (linha para vertical, coluna para horizontal)
  comprimento: number;   // Número de células vazias consecutivas
  indiceFixo: number;    // Coluna (para vertical) ou linha (para horizontal)
  orientacao: Orientacao;
  exclusivo: boolean;    // true se nenhuma célula pertence a blocos do adversário
}

/**
 * Métricas estratégicas para um jogador.
 */
export interface MetricasJogador {
  blocos: Bloco[];
  min: number;           // Número mínimo de jogadas (= número de blocos com comprimento >= 2)
  max: number;           // Número máximo de jogadas (= soma de floor(comprimento/2) por bloco)
  minExclusivo: number;  // min considerando apenas blocos exclusivos
  maxExclusivo: number;  // max considerando apenas blocos exclusivos
  minPartilhado: number; // min considerando apenas blocos partilhados
  maxPartilhado: number; // max considerando apenas blocos partilhados
}

/**
 * Métricas completas para análise do estado do jogo.
 */
export interface MetricasCompletas {
  vertical: MetricasJogador;
  horizontal: MetricasJogador;
}

/**
 * Extrai todos os blocos (runs) de células vazias para uma dada orientação.
 */
export function extrairBlocos(tabuleiro: Celula[][], orientacao: Orientacao): Bloco[] {
  const blocos: Bloco[] = [];
  
  if (orientacao === 'vertical') {
    // Varrer colunas
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      let inicio = -1;
      for (let linha = 0; linha <= TAMANHO_TABULEIRO; linha++) {
        const vazia = linha < TAMANHO_TABULEIRO && tabuleiro[linha][coluna] === 'vazia';
        if (vazia && inicio === -1) {
          inicio = linha;
        } else if (!vazia && inicio !== -1) {
          const comprimento = linha - inicio;
          if (comprimento >= COMPRIMENTO_MINIMO) {
            blocos.push({
              inicio,
              comprimento,
              indiceFixo: coluna,
              orientacao: 'vertical',
              exclusivo: false, // será calculado depois
            });
          }
          inicio = -1;
        }
      }
    }
  } else {
    // Varrer linhas
    for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
      let inicio = -1;
      for (let coluna = 0; coluna <= TAMANHO_TABULEIRO; coluna++) {
        const vazia = coluna < TAMANHO_TABULEIRO && tabuleiro[linha][coluna] === 'vazia';
        if (vazia && inicio === -1) {
          inicio = coluna;
        } else if (!vazia && inicio !== -1) {
          const comprimento = coluna - inicio;
          if (comprimento >= COMPRIMENTO_MINIMO) {
            blocos.push({
              inicio,
              comprimento,
              indiceFixo: linha,
              orientacao: 'horizontal',
              exclusivo: false,
            });
          }
          inicio = -1;
        }
      }
    }
  }
  
  return blocos;
}

/**
 * Constrói uma máscara 10x10 indicando quais células fazem parte de
 * pelo menos um bloco jogável do adversário.
 */
function construirMascaraJogavel(blocos: Bloco[]): boolean[][] {
  const mascara: boolean[][] = Array(TAMANHO_TABULEIRO)
    .fill(null)
    .map(() => Array(TAMANHO_TABULEIRO).fill(false));
  
  for (const bloco of blocos) {
    for (let i = 0; i < bloco.comprimento; i++) {
      if (bloco.orientacao === 'vertical') {
        mascara[bloco.inicio + i][bloco.indiceFixo] = true;
      } else {
        mascara[bloco.indiceFixo][bloco.inicio + i] = true;
      }
    }
  }
  
  return mascara;
}

/**
 * Classifica blocos como exclusivos ou partilhados.
 * Um bloco é exclusivo se NENHUMA das suas células pertence a um bloco do adversário.
 */
export function classificarBlocos(
  blocosMeus: Bloco[],
  blocosAdversario: Bloco[]
): Bloco[] {
  const mascaraAdv = construirMascaraJogavel(blocosAdversario);
  
  return blocosMeus.map(bloco => {
    let exclusivo = true;
    for (let i = 0; i < bloco.comprimento && exclusivo; i++) {
      let linha: number, coluna: number;
      if (bloco.orientacao === 'vertical') {
        linha = bloco.inicio + i;
        coluna = bloco.indiceFixo;
      } else {
        linha = bloco.indiceFixo;
        coluna = bloco.inicio + i;
      }
      if (mascaraAdv[linha][coluna]) {
        exclusivo = false;
      }
    }
    return { ...bloco, exclusivo };
  });
}

/**
 * Calcula métricas (min/max total e exclusivo/partilhado) a partir de blocos classificados.
 */
export function calcularMetricasDeBlocos(blocos: Bloco[]): MetricasJogador {
  let min = 0, max = 0;
  let minExclusivo = 0, maxExclusivo = 0;
  let minPartilhado = 0, maxPartilhado = 0;
  
  for (const bloco of blocos) {
    const contribuicaoMin = 1; // Cada bloco pode ser consumido em 1 jogada (segmento máximo)
    const contribuicaoMax = Math.floor(bloco.comprimento / 2); // Máx jogadas de tamanho 2
    
    min += contribuicaoMin;
    max += contribuicaoMax;
    
    if (bloco.exclusivo) {
      minExclusivo += contribuicaoMin;
      maxExclusivo += contribuicaoMax;
    } else {
      minPartilhado += contribuicaoMin;
      maxPartilhado += contribuicaoMax;
    }
  }
  
  return {
    blocos,
    min,
    max,
    minExclusivo,
    maxExclusivo,
    minPartilhado,
    maxPartilhado,
  };
}

/**
 * Calcula métricas completas para ambos os jogadores.
 */
export function calcularMetricasCompletas(tabuleiro: Celula[][]): MetricasCompletas {
  // Extrair blocos brutos
  const blocosVerticalBrutos = extrairBlocos(tabuleiro, 'vertical');
  const blocosHorizontalBrutos = extrairBlocos(tabuleiro, 'horizontal');
  
  // Classificar como exclusivos/partilhados
  const blocosVertical = classificarBlocos(blocosVerticalBrutos, blocosHorizontalBrutos);
  const blocosHorizontal = classificarBlocos(blocosHorizontalBrutos, blocosVerticalBrutos);
  
  return {
    vertical: calcularMetricasDeBlocos(blocosVertical),
    horizontal: calcularMetricasDeBlocos(blocosHorizontal),
  };
}

/**
 * Converte um tabuleiro ASCII para formato interno.
 * '.' = vazia, '#' = ocupada
 */
export function parseTabuleiroASCII(ascii: string): Celula[][] {
  const linhas = ascii.trim().split('\n');
  const tabuleiro: Celula[][] = [];
  
  for (let i = 0; i < TAMANHO_TABULEIRO; i++) {
    const linha: Celula[] = [];
    const linhaASCII = linhas[i] || '';
    for (let j = 0; j < TAMANHO_TABULEIRO; j++) {
      const char = linhaASCII[j] || '.';
      linha.push(char === '#' ? 'ocupada' : 'vazia');
    }
    tabuleiro.push(linha);
  }
  
  return tabuleiro;
}

// Criar tabuleiro inicial vazio
export function criarTabuleiroInicial(): Celula[][] {
  return Array(TAMANHO_TABULEIRO)
    .fill(null)
    .map(() => Array(TAMANHO_TABULEIRO).fill('vazia'));
}

// Obter orientação de um jogador a partir do estado atual
export function getOrientacaoJogador(state: QuelhasState, jogador: Player): Orientacao {
  return jogador === 'jogador1' ? state.orientacaoJogador1 : state.orientacaoJogador2;
}

// Calcular todos os segmentos válidos para uma dada orientação
export function calcularJogadasValidas(tabuleiro: Celula[][], orientacao: Orientacao): Segmento[] {
  const jogadas: Segmento[] = [];

  if (orientacao === 'vertical') {
    // Segmentos verticais: varrer colunas
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      let inicioSegmento = -1;
      
      for (let linha = 0; linha <= TAMANHO_TABULEIRO; linha++) {
        const celulaVazia = linha < TAMANHO_TABULEIRO && tabuleiro[linha][coluna] === 'vazia';
        
        if (celulaVazia && inicioSegmento === -1) {
          inicioSegmento = linha;
        } else if (!celulaVazia && inicioSegmento !== -1) {
          // Fim de sequência de células vazias
          const comprimentoMax = linha - inicioSegmento;
          
          // Gerar todos os segmentos possíveis nesta sequência
          for (let comp = COMPRIMENTO_MINIMO; comp <= comprimentoMax; comp++) {
            for (let start = inicioSegmento; start <= linha - comp; start++) {
              jogadas.push({
                inicio: { linha: start, coluna },
                comprimento: comp,
                orientacao: 'vertical',
              });
            }
          }
          inicioSegmento = -1;
        }
      }
    }
  } else {
    // Segmentos horizontais: varrer linhas
    for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
      let inicioSegmento = -1;
      
      for (let coluna = 0; coluna <= TAMANHO_TABULEIRO; coluna++) {
        const celulaVazia = coluna < TAMANHO_TABULEIRO && tabuleiro[linha][coluna] === 'vazia';
        
        if (celulaVazia && inicioSegmento === -1) {
          inicioSegmento = coluna;
        } else if (!celulaVazia && inicioSegmento !== -1) {
          // Fim de sequência de células vazias
          const comprimentoMax = coluna - inicioSegmento;
          
          // Gerar todos os segmentos possíveis nesta sequência
          for (let comp = COMPRIMENTO_MINIMO; comp <= comprimentoMax; comp++) {
            for (let start = inicioSegmento; start <= coluna - comp; start++) {
              jogadas.push({
                inicio: { linha, coluna: start },
                comprimento: comp,
                orientacao: 'horizontal',
              });
            }
          }
          inicioSegmento = -1;
        }
      }
    }
  }

  return jogadas;
}

// Criar estado inicial do jogo
export function criarEstadoInicial(modo: GameMode): QuelhasState {
  const tabuleiro = criarTabuleiroInicial();
  const jogadasValidas = calcularJogadasValidas(tabuleiro, 'vertical');
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: 'jogador1', // Jogador 1 começa (inicialmente Vertical)
    estado: 'a-jogar',
    segmentoPreview: null,
    jogadasValidas,
    primeiraJogada: true,
    // Orientações iniciais
    orientacaoJogador1: 'vertical',
    orientacaoJogador2: 'horizontal',
    // Regra de troca
    trocaDisponivel: false,
    trocaEfetuada: false,
  };
}

// Verificar se um segmento é válido
export function isSegmentoValido(state: QuelhasState, segmento: Segmento): boolean {
  return state.jogadasValidas.some(
    s => s.inicio.linha === segmento.inicio.linha &&
         s.inicio.coluna === segmento.inicio.coluna &&
         s.comprimento === segmento.comprimento &&
         s.orientacao === segmento.orientacao
  );
}

// Colocar um segmento no tabuleiro
export function colocarSegmento(state: QuelhasState, segmento: Segmento): QuelhasState {
  if (!isSegmentoValido(state, segmento)) return state;

  const novoTabuleiro = state.tabuleiro.map(linha => [...linha]);

  // Marcar células como ocupadas
  for (let i = 0; i < segmento.comprimento; i++) {
    if (segmento.orientacao === 'vertical') {
      novoTabuleiro[segmento.inicio.linha + i][segmento.inicio.coluna] = 'ocupada';
    } else {
      novoTabuleiro[segmento.inicio.linha][segmento.inicio.coluna + i] = 'ocupada';
    }
  }

  const proximoJogador: Player = state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';
  const orientacaoProximoJogador = getOrientacaoJogador(state, proximoJogador);
  
  // Calcular jogadas válidas para o próximo jogador (usando a sua orientação atual)
  const jogadasProximoJogador = calcularJogadasValidas(novoTabuleiro, orientacaoProximoJogador);

  // MISÈRE: Se o próximo jogador NÃO tem jogadas, ele GANHA
  // (porque o jogador atual foi o último a jogar e portanto perde)
  let novoEstado: GameStatus = 'a-jogar';
  if (jogadasProximoJogador.length === 0) {
    // O próximo jogador ganha porque não tem jogadas (misère)
    novoEstado = proximoJogador === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';
  }

  // Controlar a janela de troca
  let novaTrocaDisponivel = state.trocaDisponivel;
  
  // Após a primeira jogada do jogador1 (e se ainda não houve troca), ativar janela de troca
  if (state.jogadorAtual === 'jogador1' && state.primeiraJogada && !state.trocaEfetuada) {
    novaTrocaDisponivel = true;
  }
  // Após a primeira jogada do jogador2 (se a troca estava disponível mas não foi usada), desativar
  else if (state.jogadorAtual === 'jogador2' && state.trocaDisponivel && !state.trocaEfetuada) {
    novaTrocaDisponivel = false;
  }

  return {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: novoEstado,
    segmentoPreview: null,
    jogadasValidas: jogadasProximoJogador,
    primeiraJogada: false,
    trocaDisponivel: novaTrocaDisponivel,
  };
}

// Atualizar preview do segmento
export function atualizarPreview(state: QuelhasState, segmento: Segmento | null): QuelhasState {
  return { ...state, segmentoPreview: segmento };
}

// Obter segmento a partir de uma posição clicada (tenta encontrar o menor segmento válido)
export function getSegmentoParaPosicao(state: QuelhasState, pos: Posicao): Segmento | null {
  const orientacao = getOrientacaoJogador(state, state.jogadorAtual);
  
  // Encontrar segmentos que incluem esta posição
  const segmentosPossiveis = state.jogadasValidas.filter(s => {
    if (s.orientacao !== orientacao) return false;
    
    if (orientacao === 'vertical') {
      return s.inicio.coluna === pos.coluna &&
             pos.linha >= s.inicio.linha &&
             pos.linha < s.inicio.linha + s.comprimento;
    } else {
      return s.inicio.linha === pos.linha &&
             pos.coluna >= s.inicio.coluna &&
             pos.coluna < s.inicio.coluna + s.comprimento;
    }
  });

  if (segmentosPossiveis.length === 0) return null;

  // Retornar o menor segmento que inclui esta posição
  segmentosPossiveis.sort((a, b) => a.comprimento - b.comprimento);
  return segmentosPossiveis[0];
}

// Verificar se uma posição pode ser início de um segmento válido
export function isPosicaoInicioValida(state: QuelhasState, pos: Posicao): boolean {
  const orientacao = getOrientacaoJogador(state, state.jogadorAtual);
  
  // Verificar se existe pelo menos um segmento que começa nesta posição ou que a inclui
  return state.jogadasValidas.some(s => {
    if (s.orientacao !== orientacao) return false;
    
    if (orientacao === 'vertical') {
      return s.inicio.coluna === pos.coluna &&
             pos.linha >= s.inicio.linha &&
             pos.linha < s.inicio.linha + s.comprimento;
    } else {
      return s.inicio.linha === pos.linha &&
             pos.coluna >= s.inicio.coluna &&
             pos.coluna < s.inicio.coluna + s.comprimento;
    }
  });
}

// Criar segmento entre duas posições (início e fim clicados pelo jogador)
export function criarSegmentoEntrePosicoes(
  state: QuelhasState, 
  posInicio: Posicao, 
  posFim: Posicao
): Segmento | null {
  const orientacao = getOrientacaoJogador(state, state.jogadorAtual);
  
  // Verificar alinhamento correto
  if (orientacao === 'vertical') {
    // Devem estar na mesma coluna
    if (posInicio.coluna !== posFim.coluna) return null;
    
    // Normalizar: início deve ser a linha menor
    const linhaMin = Math.min(posInicio.linha, posFim.linha);
    const linhaMax = Math.max(posInicio.linha, posFim.linha);
    const comprimento = linhaMax - linhaMin + 1;
    
    if (comprimento < COMPRIMENTO_MINIMO) return null;
    
    const segmento: Segmento = {
      inicio: { linha: linhaMin, coluna: posInicio.coluna },
      comprimento,
      orientacao: 'vertical',
    };
    
    // Verificar se é válido
    if (isSegmentoValido(state, segmento)) {
      return segmento;
    }
  } else {
    // Devem estar na mesma linha
    if (posInicio.linha !== posFim.linha) return null;
    
    // Normalizar: início deve ser a coluna menor
    const colunaMin = Math.min(posInicio.coluna, posFim.coluna);
    const colunaMax = Math.max(posInicio.coluna, posFim.coluna);
    const comprimento = colunaMax - colunaMin + 1;
    
    if (comprimento < COMPRIMENTO_MINIMO) return null;
    
    const segmento: Segmento = {
      inicio: { linha: posInicio.linha, coluna: colunaMin },
      comprimento,
      orientacao: 'horizontal',
    };
    
    // Verificar se é válido
    if (isSegmentoValido(state, segmento)) {
      return segmento;
    }
  }
  
  return null;
}

// Trocar orientações entre jogadores (regra de troca)
// A troca consome o turno de quem a anuncia e passa a vez ao adversário
export function trocarOrientacoes(state: QuelhasState): QuelhasState {
  if (!state.trocaDisponivel || state.estado !== 'a-jogar') {
    return state;
  }
  
  // Trocar orientações
  const novaOrientacaoJ1 = state.orientacaoJogador2;
  const novaOrientacaoJ2 = state.orientacaoJogador1;
  
  // A troca consome o turno: passa a vez ao adversário
  const novoJogadorAtual = state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';
  
  // Recalcular jogadas válidas para o próximo jogador com a sua nova orientação
  const orientacaoNovoJogador = novoJogadorAtual === 'jogador1' ? novaOrientacaoJ1 : novaOrientacaoJ2;
  const novasJogadasValidas = calcularJogadasValidas(state.tabuleiro, orientacaoNovoJogador);
  
  return {
    ...state,
    jogadorAtual: novoJogadorAtual,
    orientacaoJogador1: novaOrientacaoJ1,
    orientacaoJogador2: novaOrientacaoJ2,
    jogadasValidas: novasJogadasValidas,
    segmentoPreview: null,
    trocaDisponivel: false,
    trocaEfetuada: true,
  };
}

// Recusar a troca (quando o jogador horizontal decide não trocar)
export function recusarTroca(state: QuelhasState): QuelhasState {
  if (!state.trocaDisponivel) {
    return state;
  }
  
  return {
    ...state,
    trocaDisponivel: false,
  };
}

/**
 * IA decide se deve fazer a troca usando avaliação estrutural.
 * 
 * A decisão baseia-se em:
 * 1. Comparar métricas (min/max, exclusivas) para cada orientação
 * 2. Simular uma pesquisa curta para ambas opções
 * 3. Escolher a opção que dá melhor posição
 */
export function decidirTrocaComputador(state: QuelhasState): boolean {
  if (!state.trocaDisponivel) return false;
  
  // Calcular métricas para o estado atual
  const metricas = calcularMetricasCompletas(state.tabuleiro);
  
  // Se NÃO trocar: IA fica com horizontal, adversário fica com vertical
  // Se TROCAR: IA fica com vertical, adversário fica com horizontal
  // (A troca consome o turno, então após trocar é a vez do adversário jogar)
  
  // Avaliar posição se NÃO trocar (IA = horizontal)
  const jogadasHorizontal = calcularJogadasValidas(state.tabuleiro, 'horizontal');
  const jogadasVertical = calcularJogadasValidas(state.tabuleiro, 'vertical');
  
  const scoreNaoTrocar = avaliarPosicaoMisere(
    state.tabuleiro,
    'horizontal', // IA fica horizontal
    'vertical',   // Adversário fica vertical
    jogadasVertical.length,
    jogadasHorizontal.length
  );
  
  // Avaliar posição se TROCAR (IA = vertical)
  // Nota: após a troca, a vez passa para o adversário (que agora é horizontal)
  const scoreTrocar = avaliarPosicaoMisere(
    state.tabuleiro,
    'vertical',   // IA fica vertical
    'horizontal', // Adversário fica horizontal
    jogadasHorizontal.length,
    jogadasVertical.length
  );
  
  // Análise adicional baseada em métricas estruturais
  let bonusTrocar = 0;
  let bonusNaoTrocar = 0;
  
  // Se vertical tem vantagem em exclusivas, trocar é bom
  if (metricas.vertical.maxExclusivo > metricas.horizontal.maxExclusivo) {
    bonusTrocar += (metricas.vertical.maxExclusivo - metricas.horizontal.maxExclusivo) * 30;
  } else {
    bonusNaoTrocar += (metricas.horizontal.maxExclusivo - metricas.vertical.maxExclusivo) * 30;
  }
  
  // Se horizontal tem mais flexibilidade (max - min maior), é bom ficar com horizontal
  const flexV = metricas.vertical.max - metricas.vertical.min;
  const flexH = metricas.horizontal.max - metricas.horizontal.min;
  bonusNaoTrocar += (flexH - flexV) * 10;
  bonusTrocar += (flexV - flexH) * 10;
  
  // Em misère, preferimos a orientação com menos jogadas "obrigatórias" (min baixo)
  // mas mais capacidade de "guardar" (max alto, especialmente exclusivas)
  const ratioV = metricas.vertical.min > 0 ? metricas.vertical.maxExclusivo / metricas.vertical.min : 0;
  const ratioH = metricas.horizontal.min > 0 ? metricas.horizontal.maxExclusivo / metricas.horizontal.min : 0;
  
  if (ratioV > ratioH) {
    bonusTrocar += 50;
  } else if (ratioH > ratioV) {
    bonusNaoTrocar += 50;
  }
  
  // Decisão final: comparar scores totais
  const scoreFinalTrocar = scoreTrocar + bonusTrocar;
  const scoreFinalNaoTrocar = scoreNaoTrocar + bonusNaoTrocar;
  
  // Trocar só se claramente melhor (margem de 20 pontos para evitar trocas marginais)
  return scoreFinalTrocar > scoreFinalNaoTrocar + 20;
}

// ============================================================================
// IA DO COMPUTADOR COM ALPHA-BETA + TRANSPOSITION TABLE
// ============================================================================

// Tempo máximo de pesquisa por jogada (ms)
const TEMPO_MAXIMO_JOGADA = 2500; // ~2.5s para deixar margem

// Cache para transposition table
interface TTEntry {
  depth: number;
  score: number;
  flag: 'exact' | 'lowerbound' | 'upperbound';
  bestMove: Segmento | null;
}

// Transposition table global (limpa-se a cada jogada para não acumular memória)
let transpositionTable: Map<string, TTEntry> = new Map();

// Killer moves e history heuristic (limpos a cada jogada)
let killerMoves: Array<[number | null, number | null]> = [];
let historyHeuristic: Map<number, number> = new Map();

function encodeMove(segmento: Segmento): number {
  const pos = segmento.inicio.linha * TAMANHO_TABULEIRO + segmento.inicio.coluna; // 0..99
  const orientBit = segmento.orientacao === 'vertical' ? 0 : 1;
  return pos | (segmento.comprimento << 7) | (orientBit << 11);
}

function sameMove(a: Segmento | null, b: Segmento | null): boolean {
  if (!a || !b) return false;
  return (
    a.inicio.linha === b.inicio.linha &&
    a.inicio.coluna === b.inicio.coluna &&
    a.comprimento === b.comprimento &&
    a.orientacao === b.orientacao
  );
}

/**
 * Gera uma chave única para o estado do tabuleiro + orientação do jogador atual.
 */
function gerarChaveTabuleiro(tabuleiro: Celula[][], orientacaoAtual: Orientacao): string {
  let key = orientacaoAtual === 'vertical' ? 'V' : 'H';
  for (let i = 0; i < TAMANHO_TABULEIRO; i++) {
    let row = 0;
    for (let j = 0; j < TAMANHO_TABULEIRO; j++) {
      if (tabuleiro[i][j] === 'ocupada') {
        row |= (1 << j);
      }
    }
    // padding fixo evita colisões por concatenação de dígitos variáveis
    key += row.toString(36).padStart(2, '0');
  }
  return key;
}

/**
 * Gera candidatos estratégicos a partir dos blocos (reduz branching factor).
 * Em vez de todas as jogadas possíveis, gera:
 * - Segmentos de tamanho 2 nas extremidades de cada bloco
 * - Segmento que consome o bloco inteiro
 * - Alguns tamanhos intermédios em posições chave
 */
export function gerarCandidatos(tabuleiro: Celula[][], orientacao: Orientacao): Segmento[] {
  const blocos = extrairBlocos(tabuleiro, orientacao);
  const candidatos: Segmento[] = [];
  const vistos = new Set<number>();

  const adicionarSeNovo = (seg: Segmento) => {
    const id = encodeMove(seg);
    if (!vistos.has(id)) {
      vistos.add(id);
      candidatos.push(seg);
    }
  };

  const gerarTudoRun = (bloco: Bloco) => {
    const { inicio, comprimento: L, indiceFixo, orientacao: ori } = bloco;
    for (let k = COMPRIMENTO_MINIMO; k <= L; k++) {
      for (let offset = 0; offset <= L - k; offset++) {
        adicionarSeNovo({
          inicio:
            ori === 'vertical'
              ? { linha: inicio + offset, coluna: indiceFixo }
              : { linha: indiceFixo, coluna: inicio + offset },
          comprimento: k,
          orientacao: ori,
        });
      }
    }
  };

  const splitScore = (L: number, offset: number, k: number): number => {
    const left = offset;
    const right = L - (offset + k);
    const leftGood = left >= 2 ? 1 : 0;
    const rightGood = right >= 2 ? 1 : 0;
    const wasted = (left === 1 ? 1 : 0) + (right === 1 ? 1 : 0);
    return 10 * (leftGood + rightGood) - 3 * wasted - Math.abs(left - right) * 0.2;
  };

  for (const bloco of blocos) {
    const { inicio, comprimento: L, indiceFixo, orientacao: ori } = bloco;

    // Runs pequenos: gerar tudo (preciso e ainda barato)
    if (L <= 6) {
      gerarTudoRun(bloco);
      continue;
    }

    // Extremidades: k=2 e k=3 em ambas as pontas
    for (const k of [2, 3]) {
      if (k > L) continue;
      adicionarSeNovo({
        inicio:
          ori === 'vertical'
            ? { linha: inicio, coluna: indiceFixo }
            : { linha: indiceFixo, coluna: inicio },
        comprimento: k,
        orientacao: ori,
      });
      adicionarSeNovo({
        inicio:
          ori === 'vertical'
            ? { linha: inicio + (L - k), coluna: indiceFixo }
            : { linha: indiceFixo, coluna: inicio + (L - k) },
        comprimento: k,
        orientacao: ori,
      });
    }

    // Longos: k=L e k=L-1 (pos 0 e pos 1)
    adicionarSeNovo({
      inicio:
        ori === 'vertical'
          ? { linha: inicio, coluna: indiceFixo }
          : { linha: indiceFixo, coluna: inicio },
      comprimento: L,
      orientacao: ori,
    });
    if (L - 1 >= 2) {
      adicionarSeNovo({
        inicio:
          ori === 'vertical'
            ? { linha: inicio, coluna: indiceFixo }
            : { linha: indiceFixo, coluna: inicio },
        comprimento: L - 1,
        orientacao: ori,
      });
      adicionarSeNovo({
        inicio:
          ori === 'vertical'
            ? { linha: inicio + 1, coluna: indiceFixo }
            : { linha: indiceFixo, coluna: inicio + 1 },
        comprimento: L - 1,
        orientacao: ori,
      });
    }

    // Split central: escolher (offset,k) em k∈{2,3,4}
    let best: { score: number; offset: number; k: number } | null = null;
    for (const k of [2, 3, 4]) {
      if (k > L) continue;
      const center = Math.floor((L - k) / 2);
      const offsets = [center - 1, center, center + 1].filter(o => o >= 0 && o <= L - k);
      for (const offset of offsets) {
        const score = splitScore(L, offset, k);
        if (!best || score > best.score) best = { score, offset, k };
      }
    }
    if (best) {
      adicionarSeNovo({
        inicio:
          ori === 'vertical'
            ? { linha: inicio + best.offset, coluna: indiceFixo }
            : { linha: indiceFixo, coluna: inicio + best.offset },
        comprimento: best.k,
        orientacao: ori,
      });
    }

    // Anti-mobilidade: amostrar posições (quartis + centro) para k=2..4
    const samples = new Set<number>([
      0,
      Math.floor(L / 4),
      Math.floor(L / 2),
      Math.floor((3 * L) / 4),
      L - 2,
    ]);
    for (const offset of samples) {
      for (const k of [2, 3, 4]) {
        if (k > L) continue;
        if (offset < 0 || offset > L - k) continue;
        adicionarSeNovo({
          inicio:
            ori === 'vertical'
              ? { linha: inicio + offset, coluna: indiceFixo }
              : { linha: indiceFixo, coluna: inicio + offset },
          comprimento: k,
          orientacao: ori,
        });
      }
    }
  }

  return candidatos;
}

// ========================================================================
// Monte Carlo (apenas para ordering na raiz) - determinístico por seed
// ========================================================================

function hashStringToU32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  let x = seed | 0;
  return () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

function cheapMoveScore(
  tabuleiro: Celula[][],
  jogada: Segmento,
  minhaOrientacao: Orientacao,
  orientacaoAdv: Orientacao
): number {
  const novoTab = aplicarSegmentoTabuleiro(tabuleiro, jogada);
  const jogadasAdv = calcularJogadasValidas(novoTab, orientacaoAdv);

  // Em misère, deixar o adversário sem jogadas é perder: muito mau.
  if (jogadasAdv.length === 0) return -1e9;

  const metricas = calcularMetricasCompletas(novoTab);
  const minha = minhaOrientacao === 'vertical' ? metricas.vertical : metricas.horizontal;
  const adv = minhaOrientacao === 'vertical' ? metricas.horizontal : metricas.vertical;

  let score = 0;
  score += Math.min(jogadasAdv.length, 80) * 4;
  score += (minha.maxExclusivo - adv.maxExclusivo) * 15;
  score += (minha.max - minha.min) * 3;
  score -= jogada.comprimento * 4;
  return score;
}

function rolloutWinForIA(
  tabuleiroAfterMove: Celula[][],
  orientacaoIA: Orientacao,
  orientacaoAdv: Orientacao,
  rng: () => number,
  maxPlies: number = 120
): boolean {
  let tab = tabuleiroAfterMove;
  let sideToMove: Orientacao = orientacaoAdv;
  let iaTurn = false; // após jogada IA na raiz, é a vez do adversário

  for (let ply = 0; ply < maxPlies; ply++) {
    const movesAll = calcularJogadasValidas(tab, sideToMove);
    if (movesAll.length === 0) {
      // sem jogadas => sideToMove ganha (misère)
      return iaTurn;
    }

    // Se houver demasiadas jogadas, usar subset dinâmico para acelerar playout
    let moves = movesAll;
    if (movesAll.length > 70) {
      const subset = gerarCandidatos(tab, sideToMove);
      if (subset.length > 0) moves = subset;
    }

    const idx = Math.floor(rng() * moves.length);
    const mv = moves[idx]!;
    tab = aplicarSegmentoTabuleiro(tab, mv);

    sideToMove = sideToMove === orientacaoIA ? orientacaoAdv : orientacaoIA;
    iaTurn = !iaTurn;
  }

  // Fallback por avaliação rápida se o playout não terminou
  const myMoves = calcularJogadasValidas(tab, iaTurn ? orientacaoIA : orientacaoAdv).length;
  const oppMoves = calcularJogadasValidas(tab, iaTurn ? orientacaoAdv : orientacaoIA).length;
  const evalNow = avaliarPosicaoMisere(
    tab,
    iaTurn ? orientacaoIA : orientacaoAdv,
    iaTurn ? orientacaoAdv : orientacaoIA,
    oppMoves,
    myMoves
  );
  return iaTurn ? evalNow >= 0 : evalNow < 0;
}

function monteCarloSeedHistoryRoot(
  tabuleiro: Celula[][],
  orientacaoIA: Orientacao,
  orientacaoAdv: Orientacao,
  timeBudgetMs: number,
  deadline: number
): void {
  const mcBudget = Math.max(0, Math.floor(timeBudgetMs * 0.15));
  if (mcBudget < 40) return;

  const mcDeadline = Math.min(deadline, Date.now() + mcBudget);

  const moves = gerarCandidatos(tabuleiro, orientacaoIA);
  if (moves.length <= 3) return;

  // Ordenação barata inicial
  const scored = moves.map(m => ({ m, h: cheapMoveScore(tabuleiro, m, orientacaoIA, orientacaoAdv) }));
  scored.sort((a, b) => b.h - a.h);

  const topN = Math.min(scored.length, Math.max(6, Math.min(12, Math.floor(scored.length * 0.4))));
  const top = scored.slice(0, topN);

  const seed = hashStringToU32(gerarChaveTabuleiro(tabuleiro, orientacaoIA));
  const rng = makeRng(seed);

  const wins = new Array(topN).fill(0);
  const sims = new Array(topN).fill(0);

  while (Date.now() < mcDeadline) {
    for (let i = 0; i < topN; i++) {
      if (Date.now() >= mcDeadline) break;
      const mv = top[i]!.m;
      const tabAfter = aplicarSegmentoTabuleiro(tabuleiro, mv);
      const win = rolloutWinForIA(tabAfter, orientacaoIA, orientacaoAdv, rng);
      sims[i]++;
      if (win) wins[i]++;
    }
  }

  const ranked = top.map((t, i) => {
    const rate = (wins[i]! + 1) / (sims[i]! + 2); // smoothing
    return { m: t.m, score: 1000 * rate + 0.001 * t.h };
  });
  ranked.sort((a, b) => b.score - a.score);

  // Seed do history para influenciar ordering da raiz
  for (let i = 0; i < ranked.length; i++) {
    const id = encodeMove(ranked[i]!.m);
    historyHeuristic.set(id, (historyHeuristic.get(id) || 0) + (ranked.length - i) * 5000);
  }
}

/**
 * Ordena candidatos por qualidade estimada (move ordering para alpha-beta).
 */
function ordenarCandidatos(
  candidatos: Segmento[],
  tabuleiro: Celula[][],
  minhaOrientacao: Orientacao,
  orientacaoAdv: Orientacao,
  ttBestMove: Segmento | null,
  depth: number
): Segmento[] {
  const avaliados = candidatos.map(jogada => {
    let prioridade = 0;
    
    // TT best move tem prioridade máxima
    if (sameMove(ttBestMove, jogada)) {
      prioridade = 100000;
    }

    const jogadaId = encodeMove(jogada);

    // Killer moves (bons para cortes beta)
    const killers = killerMoves[depth];
    if (killers) {
      if (killers[0] === jogadaId) prioridade += 80000;
      else if (killers[1] === jogadaId) prioridade += 60000;
    }

    // History heuristic
    prioridade += (historyHeuristic.get(jogadaId) || 0);
    
    // Prioridade 3: Preferir segmentos curtos (mais controlo)
    prioridade -= jogada.comprimento * 5;
    
    // Profundidade alta: gastar um pouco mais em ordenação para pruning
    if (depth >= 6) {
      const novoTab = aplicarSegmentoTabuleiro(tabuleiro, jogada);
      const jogadasAdv = calcularJogadasValidas(novoTab, orientacaoAdv);

      // Em misère, deixar adversário sem jogadas é perder (muito mau)
      if (jogadasAdv.length === 0) {
        prioridade -= 50000;
      } else {
        prioridade += Math.min(jogadasAdv.length, 60) * 8;
      }

      // Métricas estruturais rápidas
      const metricas = calcularMetricasCompletas(novoTab);
      const minha = minhaOrientacao === 'vertical' ? metricas.vertical : metricas.horizontal;
      const adv = minhaOrientacao === 'vertical' ? metricas.horizontal : metricas.vertical;
      prioridade += (minha.maxExclusivo - adv.maxExclusivo) * 15;
    }
    
    return { jogada, prioridade };
  });
  
  avaliados.sort((a, b) => b.prioridade - a.prioridade);
  return avaliados.map(a => a.jogada);
}

/**
 * Negamax com alpha-beta pruning e transposition table.
 * Retorna pontuação do ponto de vista do jogador atual.
 */
function negamax(
  tabuleiro: Celula[][],
  orientacaoAtual: Orientacao,
  orientacaoAdv: Orientacao,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number
): { score: number; bestMove: Segmento | null } {
  // Verificar timeout
  if (Date.now() > deadline) {
    return { score: 0, bestMove: null };
  }
  
  // Lookup na transposition table
  const ttKey = gerarChaveTabuleiro(tabuleiro, orientacaoAtual);
  const ttEntry = transpositionTable.get(ttKey);
  
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'exact') {
      return { score: ttEntry.score, bestMove: ttEntry.bestMove };
    } else if (ttEntry.flag === 'lowerbound') {
      alpha = Math.max(alpha, ttEntry.score);
    } else if (ttEntry.flag === 'upperbound') {
      beta = Math.min(beta, ttEntry.score);
    }
    if (alpha >= beta) {
      return { score: ttEntry.score, bestMove: ttEntry.bestMove };
    }
  }
  
  // Gerar jogadas (dinâmico para reduzir branching, mas sem errar terminais)
  let candidatos = depth <= 2 
    ? calcularJogadasValidas(tabuleiro, orientacaoAtual) // Profundidade baixa: todas as jogadas
    : gerarCandidatos(tabuleiro, orientacaoAtual); // Profundidade alta: subset estratégico
  
  // Caso terminal: confirmar com gerador completo (para evitar falsos terminais)
  if (candidatos.length === 0 && depth > 2) {
    candidatos = calcularJogadasValidas(tabuleiro, orientacaoAtual);
  }
  if (candidatos.length === 0) {
    // Em misère, se não tenho jogadas, GANHO (adversário foi o último a jogar)
    return { score: 10000 + depth, bestMove: null }; // Bónus por profundidade (ganhar mais cedo)
  }
  
  // Profundidade 0: avaliar heuristicamente
  if (depth === 0) {
    const jogadasAdv = calcularJogadasValidas(tabuleiro, orientacaoAdv);
    const score = avaliarPosicaoMisere(
      tabuleiro,
      orientacaoAtual,
      orientacaoAdv,
      jogadasAdv.length,
      candidatos.length
    );
    return { score, bestMove: null };
  }
  
  // Ordenar candidatos para melhor pruning
  const candidatosOrdenados = ordenarCandidatos(
    candidatos, 
    tabuleiro, 
    orientacaoAtual, 
    orientacaoAdv,
    ttEntry?.bestMove || null,
    depth
  );
  
  let bestScore = -Infinity;
  let bestMove: Segmento | null = null;
  const alphaOrig = alpha;
  let flag: 'exact' | 'lowerbound' | 'upperbound' = 'upperbound';
  
  // PVS (Principal Variation Search): 1.º filho em janela total, restantes em janela nula
  let isFirst = true;
  for (const jogada of candidatosOrdenados) {
    // Aplicar jogada
    const novoTab = aplicarSegmentoTabuleiro(tabuleiro, jogada);
    
    let score: number;
    if (isFirst) {
      const resultado = negamax(
        novoTab,
        orientacaoAdv,
        orientacaoAtual,
        depth - 1,
        -beta,
        -alpha,
        deadline
      );
      score = -resultado.score;
      isFirst = false;
    } else {
      // Search com janela nula (fail-soft)
      const resultadoNarrow = negamax(
        novoTab,
        orientacaoAdv,
        orientacaoAtual,
        depth - 1,
        -alpha - 1,
        -alpha,
        deadline
      );
      score = -resultadoNarrow.score;

      // Re-search se promissor
      if (score > alpha && score < beta) {
        const resultadoWide = negamax(
          novoTab,
          orientacaoAdv,
          orientacaoAtual,
          depth - 1,
          -beta,
          -alpha,
          deadline
        );
        score = -resultadoWide.score;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = jogada;
    }
    
    alpha = Math.max(alpha, score);
    
    if (alpha >= beta) {
      // Atualizar killers/history (corte beta)
      const id = encodeMove(jogada);
      if (!killerMoves[depth]) killerMoves[depth] = [null, null];
      const [k1, k2] = killerMoves[depth];
      if (k1 !== id) killerMoves[depth] = [id, k1];
      else if (k2 !== id) killerMoves[depth] = [k1, id];
      historyHeuristic.set(id, (historyHeuristic.get(id) || 0) + depth * depth);

      flag = 'lowerbound';
      break; // Beta cutoff
    }
    
    // Verificar timeout
    if (Date.now() > deadline) {
      break;
    }
  }
  
  if (bestScore <= alphaOrig) flag = 'upperbound';
  else if (bestScore >= beta) flag = 'lowerbound';
  else flag = 'exact';
  
  // Guardar na transposition table
  transpositionTable.set(ttKey, {
    depth,
    score: bestScore,
    flag,
    bestMove,
  });
  
  return { score: bestScore, bestMove };
}

/**
 * Iterative deepening com time limit.
 */
function iterativeDeepening(
  tabuleiro: Celula[][],
  orientacaoIA: Orientacao,
  orientacaoAdv: Orientacao,
  tempoLimiteMs: number
): Segmento | null {
  const deadline = Date.now() + tempoLimiteMs;
  
  // Limpar transposition table
  transpositionTable = new Map();
  killerMoves = [];
  historyHeuristic = new Map();

  // Monte Carlo ordering (apenas raiz) para melhorar ordering sem substituir αβ
  monteCarloSeedHistoryRoot(tabuleiro, orientacaoIA, orientacaoAdv, tempoLimiteMs, deadline);
  
  let melhorJogada: Segmento | null = null;
  let melhorScore = -Infinity;
  let window = 80; // janela de aspiração inicial
  
  // Começar com profundidade baixa e ir aumentando
  for (let depth = 1; depth <= 20; depth++) {
    if (Date.now() > deadline) break;
    
    // Aspiration window após o 1.º resultado estável
    const alpha = depth === 1 ? -Infinity : melhorScore - window;
    const beta = depth === 1 ? Infinity : melhorScore + window;
    let resultado = negamax(tabuleiro, orientacaoIA, orientacaoAdv, depth, alpha, beta, deadline);

    // Falhou janela: re-pesquisar com janela total e alargar
    if (Date.now() <= deadline && depth > 1 && (resultado.score <= alpha || resultado.score >= beta)) {
      window = Math.min(800, window * 2);
      resultado = negamax(tabuleiro, orientacaoIA, orientacaoAdv, depth, -Infinity, Infinity, deadline);
    } else if (depth > 1) {
      window = Math.max(40, Math.floor(window * 0.75));
    }
    
    // Se completou a pesquisa nesta profundidade, atualizar melhor jogada
    if (resultado.bestMove && Date.now() <= deadline) {
      melhorJogada = resultado.bestMove;
      melhorScore = resultado.score;
      
      // Se encontrou vitória garantida, parar
      if (melhorScore >= 9000) {
        break;
      }
    }
    
    // Se está a demorar muito, parar
    if (Date.now() > deadline - 100) {
      break;
    }
  }
  
  return melhorJogada;
}

export function escolherMelhorJogadaIA(
  tabuleiro: Celula[][],
  orientacaoIA: Orientacao,
  orientacaoAdv: Orientacao,
  tempoLimiteMs: number = TEMPO_MAXIMO_JOGADA
): Segmento | null {
  // Engine mais rápido (bitboard + TT persistente), inspirado no Dominório
  const result = searchBestMove(tabuleiro, orientacaoIA, {
    timeBudgetMs: tempoLimiteMs,
    maxDepth: 18,
    topN: 0,
    scoreDelta: 0,
  });
  return result.bestMove;
}

/**
 * IA do computador (misère) - versão forte com alpha-beta search.
 */
export function jogadaComputador(state: QuelhasState): QuelhasState {
  const jogadas = state.jogadasValidas;
  if (jogadas.length === 0) return state;

  const minhaOrientacao = getOrientacaoJogador(state, state.jogadorAtual);
  const orientacaoAdversario = getOrientacaoJogador(
    state, 
    state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1'
  );

  // Se só há uma jogada, jogar imediatamente
  if (jogadas.length === 1) {
    return colocarSegmento(state, jogadas[0]);
  }

  const melhorJogada = escolherMelhorJogadaIA(
    state.tabuleiro,
    minhaOrientacao,
    orientacaoAdversario
  );

  // Fallback: se por algum motivo não encontrou jogada, usar a primeira válida
  if (!melhorJogada) {
    // Fallback heurístico rápido
    const candidatos = gerarCandidatos(state.tabuleiro, minhaOrientacao);
    const jogadaFallback = candidatos.length > 0 ? candidatos[0] : jogadas[0];
    return colocarSegmento(state, jogadaFallback);
  }

  return colocarSegmento(state, melhorJogada);
}

// Calcular densidade de células ocupadas perto de um segmento
function calcularDensidadeLocal(tabuleiro: Celula[][], segmento: Segmento): number {
  let ocupadas = 0;
  const raio = 2;

  for (let i = 0; i < segmento.comprimento; i++) {
    let linha: number, coluna: number;
    if (segmento.orientacao === 'vertical') {
      linha = segmento.inicio.linha + i;
      coluna = segmento.inicio.coluna;
    } else {
      linha = segmento.inicio.linha;
      coluna = segmento.inicio.coluna + i;
    }

    for (let dl = -raio; dl <= raio; dl++) {
      for (let dc = -raio; dc <= raio; dc++) {
        const nl = linha + dl;
        const nc = coluna + dc;
        if (nl >= 0 && nl < TAMANHO_TABULEIRO && nc >= 0 && nc < TAMANHO_TABULEIRO) {
          if (tabuleiro[nl][nc] === 'ocupada') {
            ocupadas++;
          }
        }
      }
    }
  }

  return ocupadas;
}

// Estrutura para intervalos de jogadas (min/max)
export interface IntervalosJogadas {
  minJogadasIA: number;
  maxJogadasIA: number;
  minJogadasAdversario: number;
  maxJogadasAdversario: number;
}

// Aplicar um segmento a um tabuleiro (sem criar novo estado completo)
function aplicarSegmentoTabuleiro(tabuleiro: Celula[][], segmento: Segmento): Celula[][] {
  const novoTabuleiro = tabuleiro.map(linha => [...linha]);
  for (let i = 0; i < segmento.comprimento; i++) {
    if (segmento.orientacao === 'vertical') {
      novoTabuleiro[segmento.inicio.linha + i][segmento.inicio.coluna] = 'ocupada';
    } else {
      novoTabuleiro[segmento.inicio.linha][segmento.inicio.coluna + i] = 'ocupada';
    }
  }
  return novoTabuleiro;
}

// Calcular intervalos de jogadas futuras (min/max) para cada jogador
// Usa lookahead de 1-2 níveis para estimar cenários
export function calcularIntervalosJogadas(
  tabuleiro: Celula[][],
  orientacaoIA: Orientacao,
  orientacaoAdversario: Orientacao,
  profundidade: number = 1
): IntervalosJogadas {
  const jogadasIA = calcularJogadasValidas(tabuleiro, orientacaoIA);
  const jogadasAdversario = calcularJogadasValidas(tabuleiro, orientacaoAdversario);

  if (profundidade === 0 || jogadasIA.length === 0) {
    // Caso base: retornar contagem atual
    return {
      minJogadasIA: jogadasIA.length,
      maxJogadasIA: jogadasIA.length,
      minJogadasAdversario: jogadasAdversario.length,
      maxJogadasAdversario: jogadasAdversario.length,
    };
  }

  // Calcular min/max olhando para as respostas possíveis do adversário
  let minJogadasIAFuturas = Infinity;
  let maxJogadasIAFuturas = 0;
  let minJogadasAdvFuturas = Infinity;
  let maxJogadasAdvFuturas = 0;

  // Limitar número de jogadas a analisar para performance
  const jogadasAmostra = jogadasIA.length > 20 
    ? jogadasIA.filter((_, i) => i % Math.ceil(jogadasIA.length / 20) === 0)
    : jogadasIA;

  for (const jogadaIA of jogadasAmostra) {
    const tabAposIA = aplicarSegmentoTabuleiro(tabuleiro, jogadaIA);
    const jogadasAdvAposIA = calcularJogadasValidas(tabAposIA, orientacaoAdversario);

    if (jogadasAdvAposIA.length === 0) {
      // Adversário não tem jogadas - este é o pior caso para IA em misère
      // (IA seria o último a jogar)
      minJogadasAdvFuturas = Math.min(minJogadasAdvFuturas, 0);
      maxJogadasAdvFuturas = Math.max(maxJogadasAdvFuturas, 0);
      // IA não jogará mais porque o jogo acaba
      minJogadasIAFuturas = Math.min(minJogadasIAFuturas, 0);
      continue;
    }

    // Analisar respostas do adversário (amostra)
    const jogadasAdvAmostra = jogadasAdvAposIA.length > 10
      ? jogadasAdvAposIA.filter((_, i) => i % Math.ceil(jogadasAdvAposIA.length / 10) === 0)
      : jogadasAdvAposIA;

    for (const jogadaAdv of jogadasAdvAmostra) {
      const tabAposAdv = aplicarSegmentoTabuleiro(tabAposIA, jogadaAdv);
      const jogadasIAFuturas = calcularJogadasValidas(tabAposAdv, orientacaoIA);
      const jogadasAdvFuturas = calcularJogadasValidas(tabAposAdv, orientacaoAdversario);

      minJogadasIAFuturas = Math.min(minJogadasIAFuturas, jogadasIAFuturas.length);
      maxJogadasIAFuturas = Math.max(maxJogadasIAFuturas, jogadasIAFuturas.length);
      minJogadasAdvFuturas = Math.min(minJogadasAdvFuturas, jogadasAdvFuturas.length);
      maxJogadasAdvFuturas = Math.max(maxJogadasAdvFuturas, jogadasAdvFuturas.length);
    }
  }

  // Se não houve análise, usar valores atuais
  if (minJogadasIAFuturas === Infinity) minJogadasIAFuturas = jogadasIA.length;
  if (maxJogadasIAFuturas === 0) maxJogadasIAFuturas = jogadasIA.length;
  if (minJogadasAdvFuturas === Infinity) minJogadasAdvFuturas = jogadasAdversario.length;
  if (maxJogadasAdvFuturas === 0) maxJogadasAdvFuturas = jogadasAdversario.length;

  return {
    minJogadasIA: minJogadasIAFuturas,
    maxJogadasIA: maxJogadasIAFuturas,
    minJogadasAdversario: minJogadasAdvFuturas,
    maxJogadasAdversario: maxJogadasAdvFuturas,
  };
}

/**
 * Avaliação estratégica para misère usando métricas de blocos exclusivos/partilhados.
 * 
 * PRINCÍPIO CHAVE (do exemplo do utilizador):
 * - Se eu tenho blocos exclusivos e o adversário não tem (ou tem poucos),
 *   posso "guardar" jogadas exclusivas e forçar o adversário a jogar nas partilhadas.
 * - Assim controlo o "tempo" e obrigo o adversário a ser o último a jogar.
 * 
 * @returns Pontuação: maior = melhor para IA (em misère)
 */
export function avaliarPosicaoMisere(
  tabuleiroAposJogada: Celula[][],
  orientacaoIA: Orientacao,
  orientacaoAdversario: Orientacao,
  jogadasImediatasAdv: number,
  jogadasImediatasIA: number
): number {
  // Casos terminais imediatos
  if (jogadasImediatasAdv === 0) {
    // PÉSSIMO: Adversário não tem jogadas = IA foi o último a jogar = IA PERDE
    return -10000;
  }

  if (jogadasImediatasIA === 0 && jogadasImediatasAdv > 0) {
    // EXCELENTE: IA não tem jogadas mas adversário tem = Adversário será último = IA GANHA
    return 10000;
  }

  // Calcular métricas estruturais
  const metricas = calcularMetricasCompletas(tabuleiroAposJogada);
  const minha = orientacaoIA === 'vertical' ? metricas.vertical : metricas.horizontal;
  const adv = orientacaoIA === 'vertical' ? metricas.horizontal : metricas.vertical;

  let pontuacao = 0;

  // ========== ESTRATÉGIA MISÈRE COM EXCLUSIVAS/PARTILHADAS ==========

  // 1. RESERVA EXCLUSIVA: Bónus enorme por ter blocos exclusivos que o adversário não tem
  //    Isto dá "tempo" - posso forçar adversário a jogar nas partilhadas enquanto guardo as minhas
  const vantagemExclusiva = minha.maxExclusivo - adv.maxExclusivo;
  pontuacao += vantagemExclusiva * 50;

  // 2. FIXIDEZ DO ADVERSÁRIO: Se adversário tem min ≈ max, ele não tem flexibilidade
  //    Isto é BOM para nós - cada jogada dele é "obrigatória"
  const flexibilidadeAdv = adv.max - adv.min;
  const flexibilidadeIA = minha.max - minha.min;
  pontuacao += (flexibilidadeIA - flexibilidadeAdv) * 15;

  // 3. GARANTIA DE JOGADAS DO ADVERSÁRIO: Queremos que ele TENHA de jogar
  //    Bónus se o mínimo de jogadas do adversário é > 0
  if (adv.min > 0) {
    pontuacao += adv.min * 30;
  }

  // 4. CONTROLO DE TEMPO: Se tenho mais jogadas exclusivas que o adversário tem total,
  //    posso "acompanhar" cada jogada dele e ainda sobrar minhas exclusivas
  if (minha.maxExclusivo >= adv.max && minha.maxExclusivo > 0) {
    // Posição dominante: posso forçar adversário a esgotar primeiro
    pontuacao += 200;
    
    // Bónus adicional pela margem de controlo
    const margem = minha.maxExclusivo - adv.max;
    pontuacao += margem * 25;
  }

  // 5. FASE FINAL: Quando poucas jogadas restam, calcular paridade exacta
  const totalMin = minha.min + adv.min;
  const totalMax = minha.max + adv.max;
  
  if (totalMax <= 10) {
    // Estamos perto do fim - análise mais fina
    
    // Se adversário tem blocos só partilhados e eu tenho exclusivos,
    // cada jogada dele nas partilhadas posso "responder" nas minhas exclusivas
    if (adv.minExclusivo === 0 && minha.minExclusivo > 0) {
      // Situação ideal: adversário só joga em zonas onde eu também posso jogar,
      // mas eu tenho reservas onde só eu jogo
      pontuacao += 150;
    }
    
    // Paridade: Em misère, queremos que o adversário faça a última jogada
    // Se total de jogadas restantes (assumindo ambos jogam minimamente) é tal que
    // o adversário joga por último, é bom
    // Nota: jogadas alternadas, IA joga agora, portanto se (advMin) é ímpar após nossa jogada...
    // Simplificação: preferir estados onde advMin > minhaMin
    if (adv.min > minha.min) {
      pontuacao += (adv.min - minha.min) * 40;
    }
  }

  // 6. PENALIZAR JOGADAS PRÓPRIAS DEMAIS (em misère, muitas jogadas = mau)
  //    Mas só se não temos controlo via exclusivas
  if (minha.maxExclusivo <= adv.max) {
    pontuacao -= minha.min * 10;
  }

  // 7. PREFERIR FRAGMENTAÇÃO DO ADVERSÁRIO
  //    Adversário com mais blocos pequenos (min alto, max baixo) tem menos flexibilidade
  const eficienciaAdv = adv.min > 0 ? adv.max / adv.min : 0;
  const eficienciaIA = minha.min > 0 ? minha.max / minha.min : 0;
  pontuacao += (eficienciaIA - eficienciaAdv) * 10;

  return pontuacao;
}

// Obter células de um segmento
export function getCelulasSegmento(segmento: Segmento): Posicao[] {
  const celulas: Posicao[] = [];
  for (let i = 0; i < segmento.comprimento; i++) {
    if (segmento.orientacao === 'vertical') {
      celulas.push({ linha: segmento.inicio.linha + i, coluna: segmento.inicio.coluna });
    } else {
      celulas.push({ linha: segmento.inicio.linha, coluna: segmento.inicio.coluna + i });
    }
  }
  return celulas;
}
