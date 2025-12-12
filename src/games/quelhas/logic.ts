import { QuelhasState, Celula, Posicao, Segmento, Orientacao } from './types';
import { GameMode, GameStatus, Player } from '../../types';

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
    key += row.toString(36);
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
  const vistos = new Set<string>();
  
  const adicionarSeNovo = (seg: Segmento) => {
    const key = `${seg.inicio.linha},${seg.inicio.coluna},${seg.comprimento}`;
    if (!vistos.has(key)) {
      vistos.add(key);
      candidatos.push(seg);
    }
  };
  
  for (const bloco of blocos) {
    const { inicio, comprimento, indiceFixo, orientacao: ori } = bloco;
    
    // 1. Segmento mínimo (tamanho 2) no início do bloco
    adicionarSeNovo({
      inicio: ori === 'vertical' 
        ? { linha: inicio, coluna: indiceFixo }
        : { linha: indiceFixo, coluna: inicio },
      comprimento: 2,
      orientacao: ori,
    });
    
    // 2. Segmento mínimo (tamanho 2) no fim do bloco
    if (comprimento >= 4) {
      adicionarSeNovo({
        inicio: ori === 'vertical'
          ? { linha: inicio + comprimento - 2, coluna: indiceFixo }
          : { linha: indiceFixo, coluna: inicio + comprimento - 2 },
        comprimento: 2,
        orientacao: ori,
      });
    }
    
    // 3. Segmento que consome o bloco inteiro
    adicionarSeNovo({
      inicio: ori === 'vertical'
        ? { linha: inicio, coluna: indiceFixo }
        : { linha: indiceFixo, coluna: inicio },
      comprimento,
      orientacao: ori,
    });
    
    // 4. Segmento de tamanho 3 se bloco >= 5 (meio termo)
    if (comprimento >= 5) {
      adicionarSeNovo({
        inicio: ori === 'vertical'
          ? { linha: inicio, coluna: indiceFixo }
          : { linha: indiceFixo, coluna: inicio },
        comprimento: 3,
        orientacao: ori,
      });
    }
    
    // 5. Segmento central (tamanho 2) para blocos grandes
    if (comprimento >= 6) {
      const meio = Math.floor(comprimento / 2) - 1;
      adicionarSeNovo({
        inicio: ori === 'vertical'
          ? { linha: inicio + meio, coluna: indiceFixo }
          : { linha: indiceFixo, coluna: inicio + meio },
        comprimento: 2,
        orientacao: ori,
      });
    }
  }
  
  return candidatos;
}

/**
 * Ordena candidatos por qualidade estimada (move ordering para alpha-beta).
 */
function ordenarCandidatos(
  candidatos: Segmento[],
  tabuleiro: Celula[][],
  minhaOrientacao: Orientacao,
  orientacaoAdv: Orientacao,
  ttBestMove: Segmento | null
): Segmento[] {
  const avaliados = candidatos.map(jogada => {
    let prioridade = 0;
    
    // TT best move tem prioridade máxima
    if (ttBestMove && 
        jogada.inicio.linha === ttBestMove.inicio.linha &&
        jogada.inicio.coluna === ttBestMove.inicio.coluna &&
        jogada.comprimento === ttBestMove.comprimento) {
      prioridade = 100000;
    }
    
    // Simular jogada rapidamente
    const novoTab = aplicarSegmentoTabuleiro(tabuleiro, jogada);
    const jogadasAdv = calcularJogadasValidas(novoTab, orientacaoAdv);
    
    // Prioridade 1: Não deixar adversário sem jogadas (isso nos faz perder)
    if (jogadasAdv.length === 0) {
      prioridade -= 50000; // Muito mau
    }
    
    // Prioridade 2: Preferir jogadas que deixam adversário com jogadas
    prioridade += jogadasAdv.length * 10;
    
    // Prioridade 3: Preferir segmentos curtos (mais controlo)
    prioridade -= jogada.comprimento * 5;
    
    // Prioridade 4: Avaliar métricas estruturais rapidamente
    const metricas = calcularMetricasCompletas(novoTab);
    const minha = minhaOrientacao === 'vertical' ? metricas.vertical : metricas.horizontal;
    const adv = minhaOrientacao === 'vertical' ? metricas.horizontal : metricas.vertical;
    
    // Bónus por vantagem em exclusivas
    prioridade += (minha.maxExclusivo - adv.maxExclusivo) * 20;
    
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
  
  // Gerar jogadas
  const candidatos = depth <= 2 
    ? calcularJogadasValidas(tabuleiro, orientacaoAtual) // Profundidade baixa: todas as jogadas
    : gerarCandidatos(tabuleiro, orientacaoAtual); // Profundidade alta: só candidatos estratégicos
  
  // Caso terminal: sem jogadas
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
    ttEntry?.bestMove || null
  );
  
  let bestScore = -Infinity;
  let bestMove: Segmento | null = null;
  let flag: 'exact' | 'lowerbound' | 'upperbound' = 'upperbound';
  
  for (const jogada of candidatosOrdenados) {
    // Aplicar jogada
    const novoTab = aplicarSegmentoTabuleiro(tabuleiro, jogada);
    
    // Verificar se adversário tem jogadas
    const jogadasAdvApos = calcularJogadasValidas(novoTab, orientacaoAdv);
    
    let score: number;
    if (jogadasAdvApos.length === 0) {
      // PÉSSIMO em misère: adversário não tem jogadas = EU fui o último = EU PERCO
      score = -10000 - depth;
    } else {
      // Recursão (negamax: negar o score do adversário)
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
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = jogada;
    }
    
    alpha = Math.max(alpha, score);
    
    if (alpha >= beta) {
      flag = 'lowerbound';
      break; // Beta cutoff
    }
    
    // Verificar timeout
    if (Date.now() > deadline) {
      break;
    }
  }
  
  if (bestScore <= alpha) {
    flag = 'upperbound';
  } else if (bestScore >= beta) {
    flag = 'lowerbound';
  } else {
    flag = 'exact';
  }
  
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
  
  let melhorJogada: Segmento | null = null;
  let melhorScore = -Infinity;
  
  // Começar com profundidade baixa e ir aumentando
  for (let depth = 1; depth <= 20; depth++) {
    if (Date.now() > deadline) break;
    
    const resultado = negamax(
      tabuleiro,
      orientacaoIA,
      orientacaoAdv,
      depth,
      -Infinity,
      Infinity,
      deadline
    );
    
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

  // Usar iterative deepening para encontrar a melhor jogada
  const melhorJogada = iterativeDeepening(
    state.tabuleiro,
    minhaOrientacao,
    orientacaoAdversario,
    TEMPO_MAXIMO_JOGADA
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
