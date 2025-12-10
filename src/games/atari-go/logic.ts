import { AtariGoState, Celula, Posicao, Grupo, TAMANHO_TABULEIRO } from './types';
import { GameMode, GameStatus, Player } from '../../types';

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

// Obter vizinhos ortogonais de uma posição
function getVizinhos(pos: Posicao): Posicao[] {
  const vizinhos: Posicao[] = [
    { linha: pos.linha - 1, coluna: pos.coluna },
    { linha: pos.linha + 1, coluna: pos.coluna },
    { linha: pos.linha, coluna: pos.coluna - 1 },
    { linha: pos.linha, coluna: pos.coluna + 1 },
  ];
  return vizinhos.filter(dentroDoTabuleiro);
}

// Obter a cor do jogador atual
function getCorJogador(jogador: Player): 'preta' | 'branca' {
  return jogador === 'jogador1' ? 'preta' : 'branca';
}

// Obter a cor do adversário
function getCorAdversario(jogador: Player): 'preta' | 'branca' {
  return jogador === 'jogador1' ? 'branca' : 'preta';
}

// Encontrar o grupo que contém uma pedra específica usando flood fill
export function encontrarGrupo(tabuleiro: Celula[][], pos: Posicao): Grupo | null {
  const cor = tabuleiro[pos.linha][pos.coluna];
  if (cor === 'vazia') return null;

  const pedras: Posicao[] = [];
  const liberdades: Posicao[] = [];
  const visitadas = new Set<string>();
  const fila: Posicao[] = [pos];

  const posKey = (p: Posicao) => `${p.linha},${p.coluna}`;

  while (fila.length > 0) {
    const atual = fila.shift()!;
    const key = posKey(atual);
    
    if (visitadas.has(key)) continue;
    visitadas.add(key);

    const celulaAtual = tabuleiro[atual.linha][atual.coluna];
    
    if (celulaAtual === cor) {
      pedras.push(atual);
      
      // Verificar vizinhos
      for (const vizinho of getVizinhos(atual)) {
        const vizinhoCelula = tabuleiro[vizinho.linha][vizinho.coluna];
        const vizinhoKey = posKey(vizinho);
        
        if (vizinhoCelula === 'vazia' && !liberdades.some(l => posKey(l) === vizinhoKey)) {
          liberdades.push(vizinho);
        } else if (vizinhoCelula === cor && !visitadas.has(vizinhoKey)) {
          fila.push(vizinho);
        }
      }
    }
  }

  return { cor: cor as 'preta' | 'branca', pedras, liberdades };
}

// Encontrar todos os grupos de uma cor
export function encontrarTodosGrupos(tabuleiro: Celula[][], cor: 'preta' | 'branca'): Grupo[] {
  const grupos: Grupo[] = [];
  const visitadas = new Set<string>();
  const posKey = (p: Posicao) => `${p.linha},${p.coluna}`;

  for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      if (tabuleiro[linha][coluna] === cor) {
        const pos = { linha, coluna };
        if (!visitadas.has(posKey(pos))) {
          const grupo = encontrarGrupo(tabuleiro, pos);
          if (grupo) {
            grupos.push(grupo);
            grupo.pedras.forEach(p => visitadas.add(posKey(p)));
          }
        }
      }
    }
  }

  return grupos;
}

// Verificar se colocar uma pedra resultaria em captura de grupos adversários
function verificarCapturas(tabuleiro: Celula[][], pos: Posicao, corJogador: 'preta' | 'branca'): Posicao[] {
  const corAdversario = corJogador === 'preta' ? 'branca' : 'preta';
  const pedrasCapturadas: Posicao[] = [];
  const verificadas = new Set<string>();
  const posKey = (p: Posicao) => `${p.linha},${p.coluna}`;

  // Simular colocação da pedra
  const tabuleiroTemp = tabuleiro.map(linha => [...linha]);
  tabuleiroTemp[pos.linha][pos.coluna] = corJogador;

  // Verificar grupos adversários adjacentes
  for (const vizinho of getVizinhos(pos)) {
    if (tabuleiroTemp[vizinho.linha][vizinho.coluna] === corAdversario) {
      if (!verificadas.has(posKey(vizinho))) {
        const grupo = encontrarGrupo(tabuleiroTemp, vizinho);
        if (grupo && grupo.liberdades.length === 0) {
          grupo.pedras.forEach(p => {
            pedrasCapturadas.push(p);
            verificadas.add(posKey(p));
          });
        }
      }
    }
  }

  return pedrasCapturadas;
}

// Verificar se uma jogada é suicídio (proibido exceto se captura)
function isSuicidio(tabuleiro: Celula[][], pos: Posicao, corJogador: 'preta' | 'branca'): boolean {
  // Simular colocação
  const tabuleiroTemp = tabuleiro.map(linha => [...linha]);
  tabuleiroTemp[pos.linha][pos.coluna] = corJogador;

  // Verificar se captura algo (se sim, não é suicídio)
  const capturas = verificarCapturas(tabuleiro, pos, corJogador);
  if (capturas.length > 0) return false;

  // Verificar se o grupo resultante tem liberdades
  const grupo = encontrarGrupo(tabuleiroTemp, pos);
  return grupo !== null && grupo.liberdades.length === 0;
}

// Calcular jogadas válidas
export function calcularJogadasValidas(tabuleiro: Celula[][], jogador: Player): Posicao[] {
  const jogadas: Posicao[] = [];
  const corJogador = getCorJogador(jogador);

  for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      if (tabuleiro[linha][coluna] === 'vazia') {
        const pos = { linha, coluna };
        if (!isSuicidio(tabuleiro, pos, corJogador)) {
          jogadas.push(pos);
        }
      }
    }
  }

  return jogadas;
}

// Criar estado inicial do jogo
export function criarEstadoInicial(modo: GameMode): AtariGoState {
  const tabuleiro = criarTabuleiroInicial();
  const jogadasValidas = calcularJogadasValidas(tabuleiro, 'jogador1');
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: 'jogador1', // Pretas começam
    estado: 'a-jogar',
    jogadasValidas,
    ultimaJogada: null,
    pedrasCapturadas: { pretas: 0, brancas: 0 },
  };
}

// Verificar se uma jogada é válida
export function isJogadaValida(state: AtariGoState, pos: Posicao): boolean {
  return state.jogadasValidas.some(
    j => j.linha === pos.linha && j.coluna === pos.coluna
  );
}

// Colocar uma pedra no tabuleiro
export function colocarPedra(state: AtariGoState, pos: Posicao): AtariGoState {
  if (!isJogadaValida(state, pos)) return state;

  const novoTabuleiro = state.tabuleiro.map(linha => [...linha]);
  const corJogador = getCorJogador(state.jogadorAtual);
  
  // Colocar a pedra
  novoTabuleiro[pos.linha][pos.coluna] = corJogador;

  // Verificar e executar capturas
  const pedrasCapturadas = verificarCapturas(state.tabuleiro, pos, corJogador);
  
  // Remover pedras capturadas do tabuleiro
  for (const pedra of pedrasCapturadas) {
    novoTabuleiro[pedra.linha][pedra.coluna] = 'vazia';
  }

  // Atualizar contadores de capturas
  const novasCapturas = { ...state.pedrasCapturadas };
  if (pedrasCapturadas.length > 0) {
    if (corJogador === 'preta') {
      novasCapturas.brancas += pedrasCapturadas.length;
    } else {
      novasCapturas.pretas += pedrasCapturadas.length;
    }
  }

  // Verificar vitória (primeira captura)
  let novoEstado: GameStatus = 'a-jogar';
  if (pedrasCapturadas.length > 0) {
    // O jogador atual fez a primeira captura e VENCE!
    novoEstado = state.jogadorAtual === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';
  }

  const proximoJogador: Player = state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';
  
  // Se o jogo não acabou, calcular jogadas válidas para o próximo jogador
  let jogadasProximoJogador: Posicao[] = [];
  if (novoEstado === 'a-jogar') {
    jogadasProximoJogador = calcularJogadasValidas(novoTabuleiro, proximoJogador);
    
    // Se não houver jogadas válidas, o jogo empata (muito raro em Atari Go)
    if (jogadasProximoJogador.length === 0) {
      novoEstado = 'empate';
    }
  }

  return {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: novoEstado,
    jogadasValidas: jogadasProximoJogador,
    ultimaJogada: pos,
    pedrasCapturadas: novasCapturas,
  };
}

// Encontrar grupos em atari (com apenas 1 liberdade)
export function encontrarGruposEmAtari(tabuleiro: Celula[][], cor: 'preta' | 'branca'): Grupo[] {
  const grupos = encontrarTodosGrupos(tabuleiro, cor);
  return grupos.filter(g => g.liberdades.length === 1);
}

// IA do computador para Atari Go
export function jogadaComputador(state: AtariGoState): AtariGoState {
  const jogadas = state.jogadasValidas;
  if (jogadas.length === 0) return state;

  const corJogador = getCorJogador(state.jogadorAtual);
  const corAdversario = getCorAdversario(state.jogadorAtual);

  // Avaliar cada jogada
  const jogadasAvaliadas = jogadas.map(jogada => {
    let pontuacao = 0;

    // 1. PRIORIDADE MÁXIMA: Verificar se esta jogada captura (vitória imediata!)
    const capturas = verificarCapturas(state.tabuleiro, jogada, corJogador);
    if (capturas.length > 0) {
      pontuacao = 10000; // Vitória garantida
      return { jogada, pontuacao };
    }

    // 2. ALTA PRIORIDADE: Verificar se algum grupo nosso está em atari
    const gruposNossosEmAtari = encontrarGruposEmAtari(state.tabuleiro, corJogador);
    for (const grupo of gruposNossosEmAtari) {
      // Se esta jogada é adjacente ao grupo e aumenta liberdades, é boa
      const tabuleiroTemp = state.tabuleiro.map(linha => [...linha]);
      tabuleiroTemp[jogada.linha][jogada.coluna] = corJogador;
      const grupoAtualizado = encontrarGrupo(tabuleiroTemp, grupo.pedras[0]);
      
      if (grupoAtualizado && grupoAtualizado.liberdades.length > 1) {
        // Esta jogada salva um grupo em atari
        pontuacao += 500;
      }
    }

    // 3. ALTA PRIORIDADE: Colocar grupos adversários em atari
    const tabuleiroSimulado = state.tabuleiro.map(linha => [...linha]);
    tabuleiroSimulado[jogada.linha][jogada.coluna] = corJogador;
    const gruposAdversariosEmAtari = encontrarGruposEmAtari(tabuleiroSimulado, corAdversario);
    pontuacao += gruposAdversariosEmAtari.length * 200;

    // 4. Maximizar liberdades dos nossos grupos
    const grupoNovo = encontrarGrupo(tabuleiroSimulado, jogada);
    if (grupoNovo) {
      pontuacao += grupoNovo.liberdades.length * 10;
    }

    // 5. Minimizar liberdades dos grupos adversários
    const gruposAdversarios = encontrarTodosGrupos(tabuleiroSimulado, corAdversario);
    for (const grupo of gruposAdversarios) {
      // Menos liberdades do adversário = melhor
      pontuacao += (4 - grupo.liberdades.length) * 5;
    }

    // 6. Preferir centro no início do jogo
    const centro = TAMANHO_TABULEIRO / 2;
    const distanciaCentro = Math.abs(jogada.linha - centro) + Math.abs(jogada.coluna - centro);
    pontuacao -= distanciaCentro * 2;

    // 7. Conectividade: preferir jogar adjacente às próprias pedras
    for (const vizinho of getVizinhos(jogada)) {
      if (state.tabuleiro[vizinho.linha][vizinho.coluna] === corJogador) {
        pontuacao += 15;
      }
    }

    // 8. Evitar formas más (triângulo vazio, etc.) - simplificado
    // Penalizar jogadas que criam formas ineficientes
    let vizinhosVazios = 0;
    let vizinhosAmigos = 0;
    for (const vizinho of getVizinhos(jogada)) {
      if (state.tabuleiro[vizinho.linha][vizinho.coluna] === 'vazia') {
        vizinhosVazios++;
      } else if (state.tabuleiro[vizinho.linha][vizinho.coluna] === corJogador) {
        vizinhosAmigos++;
      }
    }
    // Triângulo vazio: muitos vizinhos amigos mas poucos vazios
    if (vizinhosAmigos >= 2 && vizinhosVazios <= 1) {
      pontuacao -= 20;
    }

    // Adicionar aleatoriedade
    pontuacao += Math.random() * 5;

    return { jogada, pontuacao };
  });

  // Ordenar por pontuação
  jogadasAvaliadas.sort((a, b) => b.pontuacao - a.pontuacao);

  // Escolher a melhor jogada
  const melhorJogada = jogadasAvaliadas[0].jogada;

  return colocarPedra(state, melhorJogada);
}

