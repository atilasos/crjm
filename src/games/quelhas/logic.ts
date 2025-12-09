import { QuelhasState, Celula, Posicao, Peca } from './types';
import { GameMode, GameStatus, Player } from '../../types';

const TAMANHO_TABULEIRO = 4;

// Criar tabuleiro inicial
export function criarTabuleiroInicial(): Celula[][] {
  const tabuleiro: Celula[][] = Array(TAMANHO_TABULEIRO)
    .fill(null)
    .map(() => Array(TAMANHO_TABULEIRO).fill(null));

  // Jogador 1 começa na linha 0 (cima) com peças 1,2,3,4
  for (let col = 0; col < 4; col++) {
    tabuleiro[0][col] = { jogador: 'jogador1', valor: col + 1 };
  }

  // Jogador 2 começa na linha 3 (baixo) com peças 1,2,3,4
  for (let col = 0; col < 4; col++) {
    tabuleiro[3][col] = { jogador: 'jogador2', valor: col + 1 };
  }

  return tabuleiro;
}

// Criar estado inicial do jogo
export function criarEstadoInicial(modo: GameMode): QuelhasState {
  return {
    tabuleiro: criarTabuleiroInicial(),
    modo,
    jogadorAtual: 'jogador1',
    estado: 'a-jogar',
    pecaSelecionada: null,
    jogadasValidas: [],
    objetivoJogador1: [
      { linha: 3, coluna: 0 },
      { linha: 3, coluna: 1 },
      { linha: 3, coluna: 2 },
      { linha: 3, coluna: 3 },
    ],
    objetivoJogador2: [
      { linha: 0, coluna: 0 },
      { linha: 0, coluna: 1 },
      { linha: 0, coluna: 2 },
      { linha: 0, coluna: 3 },
    ],
  };
}

// Verificar se posição está dentro do tabuleiro
function dentroDoTabuleiro(pos: Posicao): boolean {
  return pos.linha >= 0 && pos.linha < TAMANHO_TABULEIRO && 
         pos.coluna >= 0 && pos.coluna < TAMANHO_TABULEIRO;
}

// Obter jogadas válidas para uma peça
export function getJogadasParaPeca(tabuleiro: Celula[][], pos: Posicao): Posicao[] {
  const peca = tabuleiro[pos.linha][pos.coluna];
  if (!peca) return [];

  const movimentos = peca.valor;
  const jogadas: Posicao[] = [];
  
  // Direções: cima, baixo, esquerda, direita
  const direcoes = [
    { dl: -1, dc: 0 }, // cima
    { dl: 1, dc: 0 },  // baixo
    { dl: 0, dc: -1 }, // esquerda
    { dl: 0, dc: 1 },  // direita
  ];

  for (const dir of direcoes) {
    // Tentar mover exatamente 'movimentos' casas nesta direção
    let posAtual = { ...pos };
    let podeChegar = true;

    for (let i = 0; i < movimentos; i++) {
      const proximaPos: Posicao = {
        linha: posAtual.linha + dir.dl,
        coluna: posAtual.coluna + dir.dc,
      };

      if (!dentroDoTabuleiro(proximaPos)) {
        podeChegar = false;
        break;
      }

      // Nas casas intermédias, não pode haver peças
      if (i < movimentos - 1) {
        if (tabuleiro[proximaPos.linha][proximaPos.coluna] !== null) {
          podeChegar = false;
          break;
        }
      }
      // Na casa final, também não pode haver peças
      else {
        if (tabuleiro[proximaPos.linha][proximaPos.coluna] !== null) {
          podeChegar = false;
          break;
        }
      }

      posAtual = proximaPos;
    }

    if (podeChegar) {
      jogadas.push(posAtual);
    }
  }

  return jogadas;
}

// Verificar condição de vitória
function verificarVitoria(tabuleiro: Celula[][], objetivos: Posicao[], jogador: Player): boolean {
  // O jogador ganha se ocupar TODAS as casas objetivo com as suas peças
  return objetivos.every(obj => {
    const celula = tabuleiro[obj.linha][obj.coluna];
    return celula !== null && celula.jogador === jogador;
  });
}

// Selecionar uma peça
export function selecionarPeca(state: QuelhasState, pos: Posicao): QuelhasState {
  const { tabuleiro, jogadorAtual } = state;
  const celula = tabuleiro[pos.linha][pos.coluna];

  // Verificar se a peça pertence ao jogador atual
  if (!celula || celula.jogador !== jogadorAtual) {
    return { ...state, pecaSelecionada: null, jogadasValidas: [] };
  }

  const jogadasValidas = getJogadasParaPeca(tabuleiro, pos);

  return {
    ...state,
    pecaSelecionada: pos,
    jogadasValidas,
  };
}

// Executar uma jogada
export function executarJogada(state: QuelhasState, destino: Posicao): QuelhasState {
  const { pecaSelecionada, tabuleiro, jogadorAtual, jogadasValidas } = state;
  
  if (!pecaSelecionada) return state;

  // Verificar se é uma jogada válida
  const jogadaValida = jogadasValidas.some(
    j => j.linha === destino.linha && j.coluna === destino.coluna
  );
  
  if (!jogadaValida) return state;

  // Criar novo tabuleiro
  const novoTabuleiro = tabuleiro.map(linha => [...linha]);
  
  // Mover a peça
  const peca = novoTabuleiro[pecaSelecionada.linha][pecaSelecionada.coluna];
  novoTabuleiro[pecaSelecionada.linha][pecaSelecionada.coluna] = null;
  novoTabuleiro[destino.linha][destino.coluna] = peca;

  // Verificar vitória
  let novoEstado: GameStatus = 'a-jogar';
  
  if (jogadorAtual === 'jogador1') {
    if (verificarVitoria(novoTabuleiro, state.objetivoJogador1, 'jogador1')) {
      novoEstado = 'vitoria-jogador1';
    }
  } else {
    if (verificarVitoria(novoTabuleiro, state.objetivoJogador2, 'jogador2')) {
      novoEstado = 'vitoria-jogador2';
    }
  }

  const proximoJogador: Player = jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';

  return {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: novoEstado,
    pecaSelecionada: null,
    jogadasValidas: [],
  };
}

// Verificar se um jogador tem alguma jogada válida
function temJogadasValidas(tabuleiro: Celula[][], jogador: Player): boolean {
  for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      const celula = tabuleiro[linha][coluna];
      if (celula && celula.jogador === jogador) {
        const jogadas = getJogadasParaPeca(tabuleiro, { linha, coluna });
        if (jogadas.length > 0) return true;
      }
    }
  }
  return false;
}

// Obter todas as peças de um jogador com as suas jogadas
function getPecasComJogadas(tabuleiro: Celula[][], jogador: Player): Array<{ pos: Posicao; peca: Peca; jogadas: Posicao[] }> {
  const resultado: Array<{ pos: Posicao; peca: Peca; jogadas: Posicao[] }> = [];
  
  for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      const celula = tabuleiro[linha][coluna];
      if (celula && celula.jogador === jogador) {
        const jogadas = getJogadasParaPeca(tabuleiro, { linha, coluna });
        if (jogadas.length > 0) {
          resultado.push({
            pos: { linha, coluna },
            peca: celula,
            jogadas,
          });
        }
      }
    }
  }
  
  return resultado;
}

// IA do computador
export function jogadaComputador(state: QuelhasState): QuelhasState {
  const { tabuleiro, jogadorAtual, objetivoJogador2 } = state;
  
  const pecasComJogadas = getPecasComJogadas(tabuleiro, jogadorAtual);
  if (pecasComJogadas.length === 0) return state;

  // Avaliar todas as jogadas possíveis
  const todasJogadas: Array<{ pos: Posicao; destino: Posicao; pontuacao: number }> = [];

  for (const { pos, jogadas } of pecasComJogadas) {
    for (const destino of jogadas) {
      let pontuacao = 0;
      
      // Prioridade: avançar em direção ao objetivo (linha 0 para jogador2)
      // Quanto mais perto de linha 0, melhor para jogador2
      const distanciaObjetivo = destino.linha; // Para jogador2, linha 0 é o objetivo
      pontuacao -= distanciaObjetivo * 10;
      
      // Verificar se o destino é uma casa objetivo
      const ehObjetivo = objetivoJogador2.some(
        obj => obj.linha === destino.linha && obj.coluna === destino.coluna
      );
      if (ehObjetivo) {
        pontuacao += 50;
      }
      
      // Preferir manter peças juntas (defesa)
      const peçasVizinhas = contarPecasVizinhas(tabuleiro, destino, jogadorAtual);
      pontuacao += peçasVizinhas * 2;

      // Adicionar alguma aleatoriedade
      pontuacao += Math.random() * 5;

      todasJogadas.push({ pos, destino, pontuacao });
    }
  }

  if (todasJogadas.length === 0) return state;

  // Ordenar por pontuação
  todasJogadas.sort((a, b) => b.pontuacao - a.pontuacao);
  
  // Escolher a melhor jogada
  const melhorJogada = todasJogadas[0];

  // Executar a jogada
  const stateComSelecao = selecionarPeca(state, melhorJogada.pos);
  return executarJogada(stateComSelecao, melhorJogada.destino);
}

// Contar peças vizinhas do mesmo jogador
function contarPecasVizinhas(tabuleiro: Celula[][], pos: Posicao, jogador: Player): number {
  let count = 0;
  const vizinhos = [
    { linha: pos.linha - 1, coluna: pos.coluna },
    { linha: pos.linha + 1, coluna: pos.coluna },
    { linha: pos.linha, coluna: pos.coluna - 1 },
    { linha: pos.linha, coluna: pos.coluna + 1 },
  ];
  
  for (const v of vizinhos) {
    if (dentroDoTabuleiro(v)) {
      const celula = tabuleiro[v.linha][v.coluna];
      if (celula && celula.jogador === jogador) {
        count++;
      }
    }
  }
  
  return count;
}

