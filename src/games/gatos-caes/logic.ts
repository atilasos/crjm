import { GatosCaesState, Celula, Posicao, CASAS_CENTRAIS } from './types';
import { GameMode, GameStatus, Player } from '../../types';

const TAMANHO_TABULEIRO = 8;

// Criar tabuleiro inicial vazio
export function criarTabuleiroInicial(): Celula[][] {
  return Array(TAMANHO_TABULEIRO)
    .fill(null)
    .map(() => Array(TAMANHO_TABULEIRO).fill('vazia'));
}

// Verificar se posição está dentro do tabuleiro
function dentroDoTabuleiro(pos: Posicao): boolean {
  return pos.linha >= 0 && pos.linha < TAMANHO_TABULEIRO && 
         pos.coluna >= 0 && pos.coluna < TAMANHO_TABULEIRO;
}

// Verificar se posição é uma casa central
function isCasaCentral(pos: Posicao): boolean {
  return CASAS_CENTRAIS.some(c => c.linha === pos.linha && c.coluna === pos.coluna);
}

// Obter vizinhos ortogonais de uma posição
function getVizinhosOrtogonais(pos: Posicao): Posicao[] {
  const vizinhos: Posicao[] = [
    { linha: pos.linha - 1, coluna: pos.coluna },
    { linha: pos.linha + 1, coluna: pos.coluna },
    { linha: pos.linha, coluna: pos.coluna - 1 },
    { linha: pos.linha, coluna: pos.coluna + 1 },
  ];
  return vizinhos.filter(dentroDoTabuleiro);
}

// Verificar se colocar uma peça numa posição viola a regra de adjacência
function violaAdjacencia(tabuleiro: Celula[][], pos: Posicao, tipoPeca: 'gato' | 'cao'): boolean {
  const tipoProibido = tipoPeca === 'gato' ? 'cao' : 'gato';
  const vizinhos = getVizinhosOrtogonais(pos);
  
  return vizinhos.some(v => tabuleiro[v.linha][v.coluna] === tipoProibido);
}

// Calcular jogadas válidas para o jogador atual
export function calcularJogadasValidas(
  tabuleiro: Celula[][], 
  jogador: Player,
  primeiroGatoColocado: boolean,
  primeiroCaoColocado: boolean
): Posicao[] {
  const jogadas: Posicao[] = [];
  const tipoPeca = jogador === 'jogador1' ? 'gato' : 'cao';

  // Primeiro Gato: só nas casas centrais
  if (jogador === 'jogador1' && !primeiroGatoColocado) {
    for (const pos of CASAS_CENTRAIS) {
      if (tabuleiro[pos.linha][pos.coluna] === 'vazia') {
        jogadas.push(pos);
      }
    }
    return jogadas;
  }

  // Primeiro Cão: fora das casas centrais, sem adjacência a gatos
  if (jogador === 'jogador2' && !primeiroCaoColocado) {
    for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
      for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
        const pos = { linha, coluna };
        if (tabuleiro[linha][coluna] === 'vazia' && 
            !isCasaCentral(pos) &&
            !violaAdjacencia(tabuleiro, pos, 'cao')) {
          jogadas.push(pos);
        }
      }
    }
    return jogadas;
  }

  // Jogadas normais: qualquer casa vazia sem violar adjacência
  for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      if (tabuleiro[linha][coluna] === 'vazia' &&
          !violaAdjacencia(tabuleiro, { linha, coluna }, tipoPeca)) {
        jogadas.push({ linha, coluna });
      }
    }
  }

  return jogadas;
}

// Criar estado inicial do jogo
export function criarEstadoInicial(modo: GameMode): GatosCaesState {
  const tabuleiro = criarTabuleiroInicial();
  const jogadasValidas = calcularJogadasValidas(tabuleiro, 'jogador1', false, false);
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: 'jogador1', // Gatos começam
    estado: 'a-jogar',
    jogadasValidas,
    primeiroGatoColocado: false,
    primeiroCaoColocado: false,
    totalGatos: 0,
    totalCaes: 0,
  };
}

// Verificar se uma jogada é válida
export function isJogadaValida(state: GatosCaesState, pos: Posicao): boolean {
  return state.jogadasValidas.some(
    j => j.linha === pos.linha && j.coluna === pos.coluna
  );
}

// Colocar uma peça no tabuleiro
export function colocarPeca(state: GatosCaesState, pos: Posicao): GatosCaesState {
  if (!isJogadaValida(state, pos)) return state;

  const novoTabuleiro = state.tabuleiro.map(linha => [...linha]);
  const tipoPeca = state.jogadorAtual === 'jogador1' ? 'gato' : 'cao';
  
  novoTabuleiro[pos.linha][pos.coluna] = tipoPeca;

  const novosPrimeiroGato = state.jogadorAtual === 'jogador1' ? true : state.primeiroGatoColocado;
  const novosPrimeiroCao = state.jogadorAtual === 'jogador2' ? true : state.primeiroCaoColocado;
  const novosGatos = tipoPeca === 'gato' ? state.totalGatos + 1 : state.totalGatos;
  const novosCaes = tipoPeca === 'cao' ? state.totalCaes + 1 : state.totalCaes;

  const proximoJogador: Player = state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';

  // Calcular jogadas válidas para o próximo jogador
  const jogadasProximoJogador = calcularJogadasValidas(
    novoTabuleiro, 
    proximoJogador,
    novosPrimeiroGato,
    novosPrimeiroCao
  );

  // NORMAL PLAY: Se o próximo jogador NÃO tem jogadas, ele PERDE
  // (o jogador atual foi o último a jogar e portanto ganha)
  let novoEstado: GameStatus = 'a-jogar';
  if (jogadasProximoJogador.length === 0) {
    // O jogador atual ganha porque fez a última jogada
    novoEstado = state.jogadorAtual === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';
  }

  return {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: novoEstado,
    jogadasValidas: jogadasProximoJogador,
    primeiroGatoColocado: novosPrimeiroGato,
    primeiroCaoColocado: novosPrimeiroCao,
    totalGatos: novosGatos,
    totalCaes: novosCaes,
  };
}

// IA do computador (normal play - quer ser o último a jogar)
export function jogadaComputador(state: GatosCaesState): GatosCaesState {
  const jogadas = state.jogadasValidas;
  if (jogadas.length === 0) return state;

  const tipoPeca = state.jogadorAtual === 'jogador1' ? 'gato' : 'cao';

  // Avaliar cada jogada
  const jogadasAvaliadas = jogadas.map(jogada => {
    // Simular a jogada
    const novoTabuleiro = state.tabuleiro.map(linha => [...linha]);
    novoTabuleiro[jogada.linha][jogada.coluna] = tipoPeca;

    const novosPrimeiroGato = state.jogadorAtual === 'jogador1' ? true : state.primeiroGatoColocado;
    const novosPrimeiroCao = state.jogadorAtual === 'jogador2' ? true : state.primeiroCaoColocado;

    // Contar jogadas de cada lado após esta jogada
    const jogadasAdversario = calcularJogadasValidas(
      novoTabuleiro, 
      state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1',
      novosPrimeiroGato,
      novosPrimeiroCao
    );
    const minhasJogadasFuturas = calcularJogadasValidas(
      novoTabuleiro, 
      state.jogadorAtual,
      novosPrimeiroGato,
      novosPrimeiroCao
    );

    let pontuacao = 0;

    // NORMAL PLAY: Queremos ser o último a jogar
    if (jogadasAdversario.length === 0) {
      // Excelente! Nós ganhamos
      pontuacao = 1000;
    } else if (minhasJogadasFuturas.length === 0 && jogadasAdversario.length > 0) {
      // Péssimo! Podemos perder
      pontuacao = -500;
    } else {
      // Heurística: maximizar nossas jogadas, minimizar as do adversário
      pontuacao = minhasJogadasFuturas.length - jogadasAdversario.length * 1.5;
      
      // Preferir centro no início do jogo
      const distanciaCentro = Math.abs(jogada.linha - 3.5) + Math.abs(jogada.coluna - 3.5);
      if (state.totalGatos + state.totalCaes < 10) {
        pontuacao -= distanciaCentro * 0.5;
      }
      
      // Penalizar posições que bloqueiam muitas casas
      const casasBloqueadas = contarCasasBloqueadas(novoTabuleiro, jogada, tipoPeca);
      pontuacao -= casasBloqueadas * 0.3;
    }

    // Adicionar pequena aleatoriedade
    pontuacao += Math.random() * 3;

    return { jogada, pontuacao };
  });

  // Ordenar por pontuação
  jogadasAvaliadas.sort((a, b) => b.pontuacao - a.pontuacao);

  // Escolher a melhor jogada
  const melhorJogada = jogadasAvaliadas[0].jogada;

  return colocarPeca(state, melhorJogada);
}

// Contar quantas casas ficam bloqueadas (não podem receber nenhuma peça) ao redor de uma posição
function contarCasasBloqueadas(tabuleiro: Celula[][], pos: Posicao, tipoPeca: 'gato' | 'cao'): number {
  const vizinhos = getVizinhosOrtogonais(pos);
  let bloqueadas = 0;
  
  for (const v of vizinhos) {
    if (tabuleiro[v.linha][v.coluna] === 'vazia') {
      // Verificar se esta casa vazia agora fica bloqueada para o tipo oposto
      const tipoOposto = tipoPeca === 'gato' ? 'cao' : 'gato';
      // Como acabámos de colocar uma peça, a casa vizinha fica bloqueada para o tipo oposto
      bloqueadas++;
    }
  }
  
  return bloqueadas;
}

// Exportar CASAS_CENTRAIS para uso no componente
export { CASAS_CENTRAIS };
