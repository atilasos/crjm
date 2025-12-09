import { GatosCaesState, Peca, Posicao, Jogada } from './types';
import { GameMode, GameStatus, Player } from '../../types';

const TAMANHO_TABULEIRO = 5;

// Criar tabuleiro inicial
export function criarTabuleiroInicial(): Peca[][] {
  const tabuleiro: Peca[][] = Array(TAMANHO_TABULEIRO)
    .fill(null)
    .map(() => Array(TAMANHO_TABULEIRO).fill(null));

  // Gatos na primeira linha (posições 0, 2, 4 - casas escuras)
  tabuleiro[0][0] = 'gato';
  tabuleiro[0][2] = 'gato';
  tabuleiro[0][4] = 'gato';

  // Cão na última linha, centro
  tabuleiro[4][2] = 'cao';

  return tabuleiro;
}

// Criar estado inicial do jogo
export function criarEstadoInicial(modo: GameMode): GatosCaesState {
  return {
    tabuleiro: criarTabuleiroInicial(),
    modo,
    jogadorAtual: 'jogador1', // Gatos começam
    estado: 'a-jogar',
    pecaSelecionada: null,
    jogadasValidas: [],
    capturas: [],
    gatosRestantes: 3,
  };
}

// Verificar se posição está dentro do tabuleiro
function dentroDoTabuleiro(pos: Posicao): boolean {
  return pos.linha >= 0 && pos.linha < TAMANHO_TABULEIRO && 
         pos.coluna >= 0 && pos.coluna < TAMANHO_TABULEIRO;
}

// Obter jogadas válidas para um gato
function getJogadasGato(tabuleiro: Peca[][], pos: Posicao): Jogada[] {
  const jogadas: Jogada[] = [];
  
  // Gatos só se movem para baixo na diagonal
  const destinos = [
    { linha: pos.linha + 1, coluna: pos.coluna - 1 },
    { linha: pos.linha + 1, coluna: pos.coluna + 1 },
  ];

  for (const destino of destinos) {
    if (dentroDoTabuleiro(destino) && tabuleiro[destino.linha][destino.coluna] === null) {
      jogadas.push({ origem: pos, destino });
    }
  }

  return jogadas;
}

// Obter jogadas válidas para o cão (incluindo capturas)
function getJogadasCao(tabuleiro: Peca[][], pos: Posicao): Jogada[] {
  const jogadas: Jogada[] = [];
  const capturas: Jogada[] = [];
  
  // Cão move em todas as diagonais
  const direcoes = [
    { dl: -1, dc: -1 }, // cima-esquerda
    { dl: -1, dc: 1 },  // cima-direita
    { dl: 1, dc: -1 },  // baixo-esquerda
    { dl: 1, dc: 1 },   // baixo-direita
  ];

  for (const dir of direcoes) {
    const adjacente: Posicao = {
      linha: pos.linha + dir.dl,
      coluna: pos.coluna + dir.dc,
    };

    if (!dentroDoTabuleiro(adjacente)) continue;

    const pecaAdjacente = tabuleiro[adjacente.linha][adjacente.coluna];

    if (pecaAdjacente === null) {
      // Movimento simples
      jogadas.push({ origem: pos, destino: adjacente });
    } else if (pecaAdjacente === 'gato') {
      // Possível captura - verificar se casa após o gato está vazia
      const aposCaptura: Posicao = {
        linha: adjacente.linha + dir.dl,
        coluna: adjacente.coluna + dir.dc,
      };

      if (dentroDoTabuleiro(aposCaptura) && tabuleiro[aposCaptura.linha][aposCaptura.coluna] === null) {
        capturas.push({
          origem: pos,
          destino: aposCaptura,
          captura: adjacente,
        });
      }
    }
  }

  // Se há capturas, são obrigatórias (regra típica de jogos de damas)
  // Mas no Gatos & Cães original, capturas não são obrigatórias
  // Retornamos todas as jogadas
  return [...jogadas, ...capturas];
}

// Obter todas as jogadas válidas para o jogador atual
export function getJogadasValidas(state: GatosCaesState): Jogada[] {
  const { tabuleiro, jogadorAtual } = state;
  const jogadas: Jogada[] = [];

  for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      const peca = tabuleiro[linha][coluna];
      
      if (jogadorAtual === 'jogador1' && peca === 'gato') {
        jogadas.push(...getJogadasGato(tabuleiro, { linha, coluna }));
      } else if (jogadorAtual === 'jogador2' && peca === 'cao') {
        jogadas.push(...getJogadasCao(tabuleiro, { linha, coluna }));
      }
    }
  }

  return jogadas;
}

// Obter jogadas válidas para uma peça específica
export function getJogadasParaPeca(state: GatosCaesState, pos: Posicao): Posicao[] {
  const todasJogadas = getJogadasValidas(state);
  return todasJogadas
    .filter(j => j.origem.linha === pos.linha && j.origem.coluna === pos.coluna)
    .map(j => j.destino);
}

// Executar uma jogada
export function executarJogada(state: GatosCaesState, destino: Posicao): GatosCaesState {
  if (!state.pecaSelecionada) return state;

  const { tabuleiro, pecaSelecionada, jogadorAtual, modo } = state;
  const novoTabuleiro = tabuleiro.map(linha => [...linha]);

  // Encontrar a jogada correspondente
  const todasJogadas = getJogadasValidas(state);
  const jogada = todasJogadas.find(
    j => j.origem.linha === pecaSelecionada.linha &&
         j.origem.coluna === pecaSelecionada.coluna &&
         j.destino.linha === destino.linha &&
         j.destino.coluna === destino.coluna
  );

  if (!jogada) return state;

  // Mover a peça
  const peca = novoTabuleiro[pecaSelecionada.linha][pecaSelecionada.coluna];
  novoTabuleiro[pecaSelecionada.linha][pecaSelecionada.coluna] = null;
  novoTabuleiro[destino.linha][destino.coluna] = peca;

  // Processar captura se houver
  let gatosRestantes = state.gatosRestantes;
  if (jogada.captura) {
    novoTabuleiro[jogada.captura.linha][jogada.captura.coluna] = null;
    gatosRestantes--;
  }

  // Verificar condições de vitória
  let novoEstado: GameStatus = 'a-jogar';
  
  // Cão ganha se chegar à linha 0 (topo)
  if (peca === 'cao' && destino.linha === 0) {
    novoEstado = 'vitoria-jogador2';
  }
  
  // Cão ganha se capturar todos os gatos
  if (gatosRestantes === 0) {
    novoEstado = 'vitoria-jogador2';
  }

  // Criar novo estado
  const proximoJogador: Player = jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';
  
  let novoState: GatosCaesState = {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: novoEstado,
    pecaSelecionada: null,
    jogadasValidas: [],
    capturas: [],
    gatosRestantes,
  };

  // Verificar se os gatos bloquearam o cão (vitória dos gatos)
  if (novoEstado === 'a-jogar' && proximoJogador === 'jogador2') {
    const jogadasCao = getJogadasValidas(novoState);
    if (jogadasCao.length === 0) {
      novoState = { ...novoState, estado: 'vitoria-jogador1' };
    }
  }

  // Verificar se os gatos não têm jogadas (vitória do cão)
  if (novoEstado === 'a-jogar' && proximoJogador === 'jogador1') {
    const jogadasGatos = getJogadasValidas(novoState);
    if (jogadasGatos.length === 0) {
      novoState = { ...novoState, estado: 'vitoria-jogador2' };
    }
  }

  return novoState;
}

// Selecionar uma peça
export function selecionarPeca(state: GatosCaesState, pos: Posicao): GatosCaesState {
  const { tabuleiro, jogadorAtual } = state;
  const peca = tabuleiro[pos.linha][pos.coluna];

  // Verificar se a peça pertence ao jogador atual
  if (jogadorAtual === 'jogador1' && peca !== 'gato') return state;
  if (jogadorAtual === 'jogador2' && peca !== 'cao') return state;

  const jogadasValidas = getJogadasParaPeca(state, pos);
  
  // Identificar capturas
  const todasJogadas = getJogadasValidas(state);
  const capturas = todasJogadas
    .filter(j => j.origem.linha === pos.linha && 
                 j.origem.coluna === pos.coluna && 
                 j.captura)
    .map(j => j.destino);

  return {
    ...state,
    pecaSelecionada: pos,
    jogadasValidas,
    capturas,
  };
}

// IA do computador (joga com o cão)
export function jogadaComputador(state: GatosCaesState): GatosCaesState {
  const jogadas = getJogadasValidas(state);
  if (jogadas.length === 0) return state;

  // Prioridades da IA:
  // 1. Capturar gato se possível
  // 2. Avançar em direção ao topo
  // 3. Evitar ficar bloqueado
  
  const capturas = jogadas.filter(j => j.captura);
  if (capturas.length > 0) {
    // Escolher captura aleatória
    const jogada = capturas[Math.floor(Math.random() * capturas.length)];
    const stateComSelecao = selecionarPeca(state, jogada.origem);
    return executarJogada(stateComSelecao, jogada.destino);
  }

  // Avaliar jogadas - preferir ir para cima
  const jogadasAvaliadas = jogadas.map(jogada => {
    let pontuacao = 0;
    
    // Quanto mais para cima, melhor
    pontuacao += (TAMANHO_TABULEIRO - jogada.destino.linha) * 10;
    
    // Preferir o centro
    const distanciaCentro = Math.abs(jogada.destino.coluna - 2);
    pontuacao -= distanciaCentro;

    // Simular próximo estado para ver se fica bloqueado
    const stateComSelecao = selecionarPeca(state, jogada.origem);
    const proximoState = executarJogada(stateComSelecao, jogada.destino);
    
    // Evitar jogadas que resultam em bloqueio imediato
    const jogadasFuturas = getJogadasValidas({
      ...proximoState,
      jogadorAtual: 'jogador2'
    });
    if (jogadasFuturas.length === 0) {
      pontuacao -= 100;
    } else {
      pontuacao += jogadasFuturas.length * 2;
    }

    return { jogada, pontuacao };
  });

  // Ordenar por pontuação e adicionar aleatoriedade
  jogadasAvaliadas.sort((a, b) => b.pontuacao - a.pontuacao);
  
  // Escolher entre as melhores jogadas (top 2) aleatoriamente
  const melhores = jogadasAvaliadas.slice(0, Math.min(2, jogadasAvaliadas.length));
  const escolhida = melhores[Math.floor(Math.random() * melhores.length)].jogada;

  const stateComSelecao = selecionarPeca(state, escolhida.origem);
  return executarJogada(stateComSelecao, escolhida.destino);
}

