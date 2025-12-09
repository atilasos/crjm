import { QuelhasState, Celula, Posicao, Segmento } from './types';
import { GameMode, GameStatus, Player } from '../../types';

const TAMANHO_TABULEIRO = 10;
const COMPRIMENTO_MINIMO = 2;

// Criar tabuleiro inicial vazio
export function criarTabuleiroInicial(): Celula[][] {
  return Array(TAMANHO_TABULEIRO)
    .fill(null)
    .map(() => Array(TAMANHO_TABULEIRO).fill('vazia'));
}

// Obter orientação do jogador
function getOrientacao(jogador: Player): 'vertical' | 'horizontal' {
  return jogador === 'jogador1' ? 'vertical' : 'horizontal';
}

// Calcular todos os segmentos válidos para o jogador atual
export function calcularJogadasValidas(tabuleiro: Celula[][], jogador: Player): Segmento[] {
  const orientacao = getOrientacao(jogador);
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
  const jogadasValidas = calcularJogadasValidas(tabuleiro, 'jogador1');
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: 'jogador1', // Vertical começa
    estado: 'a-jogar',
    segmentoPreview: null,
    jogadasValidas,
    primeiraJogada: true,
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
  
  // Calcular jogadas válidas para o próximo jogador
  const jogadasProximoJogador = calcularJogadasValidas(novoTabuleiro, proximoJogador);

  // MISÈRE: Se o próximo jogador NÃO tem jogadas, ele GANHA
  // (porque o jogador atual foi o último a jogar e portanto perde)
  let novoEstado: GameStatus = 'a-jogar';
  if (jogadasProximoJogador.length === 0) {
    // O próximo jogador ganha porque não tem jogadas (misère)
    novoEstado = proximoJogador === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';
  }

  return {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: novoEstado,
    segmentoPreview: null,
    jogadasValidas: jogadasProximoJogador,
    primeiraJogada: false,
  };
}

// Atualizar preview do segmento
export function atualizarPreview(state: QuelhasState, segmento: Segmento | null): QuelhasState {
  return { ...state, segmentoPreview: segmento };
}

// Obter segmento a partir de uma posição clicada (tenta encontrar o menor segmento válido)
export function getSegmentoParaPosicao(state: QuelhasState, pos: Posicao): Segmento | null {
  const orientacao = getOrientacao(state.jogadorAtual);
  
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

// IA do computador (misère)
// Estratégia: tentar forçar o adversário a ser o último a jogar
export function jogadaComputador(state: QuelhasState): QuelhasState {
  const jogadas = state.jogadasValidas;
  if (jogadas.length === 0) return state;

  // Avaliar cada jogada
  const jogadasAvaliadas = jogadas.map(jogada => {
    // Simular a jogada
    const novoTabuleiro = state.tabuleiro.map(linha => [...linha]);
    for (let i = 0; i < jogada.comprimento; i++) {
      if (jogada.orientacao === 'vertical') {
        novoTabuleiro[jogada.inicio.linha + i][jogada.inicio.coluna] = 'ocupada';
      } else {
        novoTabuleiro[jogada.inicio.linha][jogada.inicio.coluna + i] = 'ocupada';
      }
    }

    // Contar jogadas de cada lado após esta jogada
    const jogadasAdversario = calcularJogadasValidas(novoTabuleiro, 
      state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1');
    const minhasJogadasFuturas = calcularJogadasValidas(novoTabuleiro, state.jogadorAtual);

    let pontuacao = 0;

    // MISÈRE: Queremos que o adversário seja o último a jogar
    // Se o adversário ficar sem jogadas, nós perdemos (ele ganha)
    if (jogadasAdversario.length === 0) {
      // Péssimo! Nós seríamos o último a jogar
      pontuacao = -1000;
    } else if (minhasJogadasFuturas.length === 0 && jogadasAdversario.length > 0) {
      // Bom! Adversário será forçado a continuar a jogar
      pontuacao = 500;
    } else {
      // Heurística misère: preferir ter MENOS jogadas que o adversário
      // (para ele ser forçado a fazer o último movimento)
      pontuacao = jogadasAdversario.length - minhasJogadasFuturas.length;
      
      // Preferir segmentos mais curtos (dão mais controlo)
      pontuacao -= jogada.comprimento * 2;
      
      // Preferir jogar em zonas mais preenchidas (força o adversário)
      const densidadeLocal = calcularDensidadeLocal(novoTabuleiro, jogada);
      pontuacao += densidadeLocal * 3;
    }

    // Adicionar pequena aleatoriedade
    pontuacao += Math.random() * 5;

    return { jogada, pontuacao };
  });

  // Ordenar por pontuação
  jogadasAvaliadas.sort((a, b) => b.pontuacao - a.pontuacao);

  // Escolher a melhor jogada
  const melhorJogada = jogadasAvaliadas[0].jogada;

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
