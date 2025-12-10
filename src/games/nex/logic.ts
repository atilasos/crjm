import { 
  NexState, Celula, Posicao, Acao, AcaoColocacao, AcaoSubstituicao, 
  AcaoEmCurso, TipoAcao, LADO_TABULEIRO, posToKey 
} from './types';
import { GameMode, GameStatus, Player } from '../../types';

// Direções dos 6 vizinhos hexagonais para grelha losango em coordenadas axiais
// Neste sistema (usado no rendering), os vizinhos são constantes para todas as células:
// - O tabuleiro é renderizado com: screen_x = (x+y)*scale, screen_y = (y-x)*scale
// - Isto cria um losango horizontal onde cada célula tem 6 vizinhos fixos
const DIRECOES_HEX = [
  { dx: 1, dy: 0 },   // Este (direita ao longo do eixo x)
  { dx: -1, dy: 0 },  // Oeste (esquerda ao longo do eixo x)
  { dx: 0, dy: 1 },   // Sul (baixo ao longo do eixo y)
  { dx: 0, dy: -1 },  // Norte (cima ao longo do eixo y)
  { dx: 1, dy: -1 },  // Nordeste (diagonal)
  { dx: -1, dy: 1 },  // Sudoeste (diagonal)
];

// Obter vizinhos de uma posição
function getVizinhos(pos: Posicao): Posicao[] {
  return DIRECOES_HEX
    .map(dir => ({ x: pos.x + dir.dx, y: pos.y + dir.dy }))
    .filter(p => dentroDoTabuleiro(p));
}

// Verificar se posição está dentro do tabuleiro
function dentroDoTabuleiro(pos: Posicao): boolean {
  return pos.x >= 0 && pos.x < LADO_TABULEIRO && pos.y >= 0 && pos.y < LADO_TABULEIRO;
}

// Criar tabuleiro inicial vazio
export function criarTabuleiroInicial(): Celula[][] {
  return Array(LADO_TABULEIRO)
    .fill(null)
    .map(() => Array(LADO_TABULEIRO).fill('vazia'));
}

// Criar estado inicial do jogo
export function criarEstadoInicial(modo: GameMode): NexState {
  return {
    tabuleiro: criarTabuleiroInicial(),
    modo,
    jogadorAtual: 'jogador1', // Pretas começam
    estado: 'a-jogar',
    primeiraJogada: true,
    swapDisponivel: false,
    swapEfetuado: false,
    acaoEmCurso: criarAcaoEmCursoVazia(),
  };
}

// Criar ação em curso vazia
function criarAcaoEmCursoVazia(): AcaoEmCurso {
  return {
    tipo: null,
    posPropria: null,
    posNeutra: null,
    neutrasParaProprias: [],
    propriaParaNeutra: null,
  };
}

// Obter cor do jogador
function getCorJogador(jogador: Player): 'preta' | 'branca' {
  return jogador === 'jogador1' ? 'preta' : 'branca';
}

// Verificar se jogador conectou as suas margens
// Layout do tabuleiro (losango horizontal):
//   - (0,0) está na ESQUERDA (W)
//   - (10,10) está na DIREITA (E)
//   - (10,0) está no TOPO (N)
//   - (0,10) está na BASE (S)
// Margens:
//   - y=0: borda NOROESTE (de W a N)
//   - y=10: borda SUDESTE (de S a E)
//   - x=0: borda SUDOESTE (de W a S)
//   - x=10: borda NORDESTE (de N a E)
// Segundo as regras:
//   - Preto: conecta Noroeste (y=0) a Sudeste (y=10)
//   - Branco: conecta Sudoeste (x=0) a Nordeste (x=10)
export function verificarVitoria(tabuleiro: Celula[][], cor: 'preta' | 'branca'): boolean {
  const visitadas = new Set<string>();
  
  // Determinar margens de início e fim
  let posicoesInicio: Posicao[];
  let isMargeFim: (pos: Posicao) => boolean;
  
  if (cor === 'preta') {
    // Preto: conecta Noroeste (y=0) a Sudeste (y=10)
    posicoesInicio = [];
    for (let x = 0; x < LADO_TABULEIRO; x++) {
      if (tabuleiro[x][0] === cor) {
        posicoesInicio.push({ x, y: 0 });
      }
    }
    isMargeFim = (pos) => pos.y === LADO_TABULEIRO - 1;
  } else {
    // Branco: conecta Sudoeste (x=0) a Nordeste (x=10)
    posicoesInicio = [];
    for (let y = 0; y < LADO_TABULEIRO; y++) {
      if (tabuleiro[0][y] === cor) {
        posicoesInicio.push({ x: 0, y });
      }
    }
    isMargeFim = (pos) => pos.x === LADO_TABULEIRO - 1;
  }
  
  // BFS para verificar conexão
  const fila: Posicao[] = [...posicoesInicio];
  for (const pos of posicoesInicio) {
    visitadas.add(posToKey(pos));
  }
  
  while (fila.length > 0) {
    const atual = fila.shift()!;
    
    if (isMargeFim(atual)) {
      return true; // Encontrou caminho!
    }
    
    for (const vizinho of getVizinhos(atual)) {
      const key = posToKey(vizinho);
      if (!visitadas.has(key) && tabuleiro[vizinho.x][vizinho.y] === cor) {
        visitadas.add(key);
        fila.push(vizinho);
      }
    }
  }
  
  return false;
}

// Executar ação de colocação
export function executarColocacao(state: NexState, acao: AcaoColocacao): NexState {
  const corJogador = getCorJogador(state.jogadorAtual);
  const novoTabuleiro = state.tabuleiro.map(linha => [...linha]);
  
  novoTabuleiro[acao.posPropria.x][acao.posPropria.y] = corJogador;
  novoTabuleiro[acao.posNeutra.x][acao.posNeutra.y] = 'neutra';
  
  return finalizarTurno(state, novoTabuleiro);
}

// Executar ação de substituição
export function executarSubstituicao(state: NexState, acao: AcaoSubstituicao): NexState {
  const corJogador = getCorJogador(state.jogadorAtual);
  const novoTabuleiro = state.tabuleiro.map(linha => [...linha]);
  
  // 2 neutras viram próprias
  novoTabuleiro[acao.neutrasParaProprias[0].x][acao.neutrasParaProprias[0].y] = corJogador;
  novoTabuleiro[acao.neutrasParaProprias[1].x][acao.neutrasParaProprias[1].y] = corJogador;
  
  // 1 própria vira neutra
  novoTabuleiro[acao.propriaParaNeutra.x][acao.propriaParaNeutra.y] = 'neutra';
  
  return finalizarTurno(state, novoTabuleiro);
}

// Finalizar turno após uma ação
function finalizarTurno(state: NexState, novoTabuleiro: Celula[][]): NexState {
  const corJogador = getCorJogador(state.jogadorAtual);
  
  // Verificar vitória
  let novoEstado: GameStatus = 'a-jogar';
  if (verificarVitoria(novoTabuleiro, corJogador)) {
    novoEstado = state.jogadorAtual === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';
  }
  
  const proximoJogador: Player = state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';
  
  // Ativar swap após primeira jogada das Pretas
  const novoSwapDisponivel = state.primeiraJogada && state.jogadorAtual === 'jogador1';
  
  return {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: novoEstado,
    primeiraJogada: false,
    swapDisponivel: novoSwapDisponivel,
    acaoEmCurso: criarAcaoEmCursoVazia(),
  };
}

// Executar swap (trocar de cor)
export function executarSwap(state: NexState): NexState {
  if (!state.swapDisponivel) return state;
  
  // Trocar cores de todas as peças no tabuleiro
  const novoTabuleiro = state.tabuleiro.map(linha => 
    linha.map(celula => {
      if (celula === 'preta') return 'branca';
      if (celula === 'branca') return 'preta';
      return celula;
    })
  );
  
  // Trocar também o jogador atual (fica quem era antes)
  // Na prática, o jogador 2 torna-se dono das peças pretas
  return {
    ...state,
    tabuleiro: novoTabuleiro,
    swapDisponivel: false,
    swapEfetuado: true,
    acaoEmCurso: criarAcaoEmCursoVazia(),
  };
}

// Recusar swap
export function recusarSwap(state: NexState): NexState {
  if (!state.swapDisponivel) return state;
  
  return {
    ...state,
    swapDisponivel: false,
  };
}

// Selecionar tipo de ação
export function selecionarTipoAcao(state: NexState, tipo: TipoAcao): NexState {
  return {
    ...state,
    acaoEmCurso: {
      ...criarAcaoEmCursoVazia(),
      tipo,
    },
  };
}

// Adicionar posição à ação em curso
export function adicionarPosicaoAcao(state: NexState, pos: Posicao, tipoSelecao: 'propria' | 'neutra'): NexState {
  const acao = state.acaoEmCurso;
  
  if (acao.tipo === 'colocacao') {
    if (tipoSelecao === 'propria' && acao.posPropria === null) {
      return {
        ...state,
        acaoEmCurso: { ...acao, posPropria: pos },
      };
    } else if (tipoSelecao === 'neutra' && acao.posNeutra === null) {
      return {
        ...state,
        acaoEmCurso: { ...acao, posNeutra: pos },
      };
    }
  } else if (acao.tipo === 'substituicao') {
    if (tipoSelecao === 'neutra' && acao.neutrasParaProprias.length < 2) {
      return {
        ...state,
        acaoEmCurso: { 
          ...acao, 
          neutrasParaProprias: [...acao.neutrasParaProprias, pos] 
        },
      };
    } else if (tipoSelecao === 'propria' && acao.propriaParaNeutra === null) {
      return {
        ...state,
        acaoEmCurso: { ...acao, propriaParaNeutra: pos },
      };
    }
  }
  
  return state;
}

// Verificar se ação em curso está completa
export function isAcaoCompleta(acao: AcaoEmCurso): boolean {
  if (acao.tipo === 'colocacao') {
    return acao.posPropria !== null && acao.posNeutra !== null;
  } else if (acao.tipo === 'substituicao') {
    return acao.neutrasParaProprias.length === 2 && acao.propriaParaNeutra !== null;
  }
  return false;
}

// Converter ação em curso para Acao
export function converterAcaoEmCurso(acao: AcaoEmCurso): Acao | null {
  if (!isAcaoCompleta(acao)) return null;
  
  if (acao.tipo === 'colocacao') {
    return {
      tipo: 'colocacao',
      posPropria: acao.posPropria!,
      posNeutra: acao.posNeutra!,
    };
  } else if (acao.tipo === 'substituicao') {
    return {
      tipo: 'substituicao',
      neutrasParaProprias: [acao.neutrasParaProprias[0], acao.neutrasParaProprias[1]],
      propriaParaNeutra: acao.propriaParaNeutra!,
    };
  }
  
  return null;
}

// Executar ação completa
export function executarAcao(state: NexState): NexState {
  const acao = converterAcaoEmCurso(state.acaoEmCurso);
  if (!acao) return state;
  
  if (acao.tipo === 'colocacao') {
    return executarColocacao(state, acao);
  } else {
    return executarSubstituicao(state, acao);
  }
}

// Cancelar ação em curso
export function cancelarAcao(state: NexState): NexState {
  return {
    ...state,
    acaoEmCurso: criarAcaoEmCursoVazia(),
  };
}

// Verificar se substituição é possível (existem 2+ neutras e 1+ próprias)
export function podeSubstituir(tabuleiro: Celula[][], jogador: Player): boolean {
  const corJogador = getCorJogador(jogador);
  let numNeutras = 0;
  let numProprias = 0;
  
  for (let x = 0; x < LADO_TABULEIRO; x++) {
    for (let y = 0; y < LADO_TABULEIRO; y++) {
      if (tabuleiro[x][y] === 'neutra') numNeutras++;
      if (tabuleiro[x][y] === corJogador) numProprias++;
    }
  }
  
  return numNeutras >= 2 && numProprias >= 1;
}

// Contar casas vazias
function contarCasasVazias(tabuleiro: Celula[][]): number {
  let count = 0;
  for (let x = 0; x < LADO_TABULEIRO; x++) {
    for (let y = 0; y < LADO_TABULEIRO; y++) {
      if (tabuleiro[x][y] === 'vazia') count++;
    }
  }
  return count;
}

// Verificar se colocação é possível (2+ casas vazias)
export function podeColocar(tabuleiro: Celula[][]): boolean {
  return contarCasasVazias(tabuleiro) >= 2;
}

// Calcular distância mínima para conectar (heurística para IA)
function calcularDistanciaMinima(tabuleiro: Celula[][], cor: 'preta' | 'branca'): number {
  // Usar BFS com custo para encontrar caminho mínimo
  // Custo 0 para própria cor, 1 para vazia/neutra, infinito para adversário
  
  const custos = new Map<string, number>();
  const visitadas = new Set<string>();
  
  // Determinar margens
  let posicoesInicio: Posicao[];
  let isMargeFim: (pos: Posicao) => boolean;
  
  if (cor === 'preta') {
    posicoesInicio = [];
    for (let y = 0; y < LADO_TABULEIRO; y++) {
      posicoesInicio.push({ x: 0, y });
    }
    isMargeFim = (pos) => pos.x === LADO_TABULEIRO - 1;
  } else {
    posicoesInicio = [];
    for (let x = 0; x < LADO_TABULEIRO; x++) {
      posicoesInicio.push({ x, y: 0 });
    }
    isMargeFim = (pos) => pos.y === LADO_TABULEIRO - 1;
  }
  
  // Inicializar com posições de início
  const fila: Array<{ pos: Posicao; custo: number }> = [];
  for (const pos of posicoesInicio) {
    const celula = tabuleiro[pos.x][pos.y];
    let custoInicial = 0;
    if (celula === cor) custoInicial = 0;
    else if (celula === 'vazia' || celula === 'neutra') custoInicial = 1;
    else custoInicial = 100; // Adversário
    
    custos.set(posToKey(pos), custoInicial);
    fila.push({ pos, custo: custoInicial });
  }
  
  // Ordenar por custo
  fila.sort((a, b) => a.custo - b.custo);
  
  while (fila.length > 0) {
    const { pos, custo } = fila.shift()!;
    const key = posToKey(pos);
    
    if (visitadas.has(key)) continue;
    visitadas.add(key);
    
    if (isMargeFim(pos)) {
      return custo;
    }
    
    for (const vizinho of getVizinhos(pos)) {
      const vizinhoKey = posToKey(vizinho);
      if (visitadas.has(vizinhoKey)) continue;
      
      const celula = tabuleiro[vizinho.x][vizinho.y];
      let custoPasso = 0;
      if (celula === cor) custoPasso = 0;
      else if (celula === 'vazia' || celula === 'neutra') custoPasso = 1;
      else custoPasso = 100;
      
      const novoCusto = custo + custoPasso;
      const custoAtual = custos.get(vizinhoKey) ?? Infinity;
      
      if (novoCusto < custoAtual) {
        custos.set(vizinhoKey, novoCusto);
        fila.push({ pos: vizinho, custo: novoCusto });
        fila.sort((a, b) => a.custo - b.custo);
      }
    }
  }
  
  return Infinity;
}

// IA do computador para Nex
export function jogadaComputador(state: NexState): NexState {
  const corJogador = getCorJogador(state.jogadorAtual);
  const corAdversario = corJogador === 'preta' ? 'branca' : 'preta';
  
  // Se swap disponível, decidir se deve fazer
  if (state.swapDisponivel) {
    // Avaliar posição após swap
    const distMinhaAtual = calcularDistanciaMinima(state.tabuleiro, corJogador);
    const distAdvAtual = calcularDistanciaMinima(state.tabuleiro, corAdversario);
    
    // Se adversário está mais perto de vencer, fazer swap
    if (distAdvAtual < distMinhaAtual - 1) {
      return executarSwap(state);
    }
    return recusarSwap(state);
  }
  
  // Avaliar se colocação ou substituição é melhor
  let melhorAcao: Acao | null = null;
  let melhorPontuacao = -Infinity;
  
  // Recolher todas as posições vazias
  const vazias: Posicao[] = [];
  for (let x = 0; x < LADO_TABULEIRO; x++) {
    for (let y = 0; y < LADO_TABULEIRO; y++) {
      if (state.tabuleiro[x][y] === 'vazia') {
        vazias.push({ x, y });
      }
    }
  }
  
  // PRIORIDADE MÁXIMA: Verificar se há jogada vencedora imediata
  if (podeColocar(state.tabuleiro)) {
    for (const posPropria of vazias) {
      // Simular colocação apenas da peça própria para verificar vitória
      const tabTemp = state.tabuleiro.map(l => [...l]);
      tabTemp[posPropria.x][posPropria.y] = corJogador;
      
      if (verificarVitoria(tabTemp, corJogador)) {
        // Encontrar qualquer posição vazia para a neutra
        for (const posNeutra of vazias) {
          if (posToKey(posPropria) !== posToKey(posNeutra)) {
            return executarColocacao(state, {
              tipo: 'colocacao',
              posPropria,
              posNeutra,
            });
          }
        }
      }
    }
  }
  
  // Avaliar colocações (com amostragem para performance)
  if (podeColocar(state.tabuleiro)) {
    // Amostrar para performance
    const amostra = vazias.length > 15 
      ? vazias.filter((_, i) => i % Math.ceil(vazias.length / 15) === 0)
      : vazias;
    
    for (const posPropria of amostra) {
      for (const posNeutra of vazias) {
        if (posToKey(posPropria) === posToKey(posNeutra)) continue;
        
        // Simular
        const tabTemp = state.tabuleiro.map(l => [...l]);
        tabTemp[posPropria.x][posPropria.y] = corJogador;
        tabTemp[posNeutra.x][posNeutra.y] = 'neutra';
        
        const distMinha = calcularDistanciaMinima(tabTemp, corJogador);
        const distAdv = calcularDistanciaMinima(tabTemp, corAdversario);
        
        let pontuacao = (distAdv - distMinha) * 10;
        
        // Bónus por jogar no centro no início
        const centro = LADO_TABULEIRO / 2;
        const distCentro = Math.abs(posPropria.x - centro) + Math.abs(posPropria.y - centro);
        pontuacao -= distCentro * 0.5;
        
        // Usar neutra para bloquear adversário
        const distAdvAntesNeutra = calcularDistanciaMinima(state.tabuleiro, corAdversario);
        if (distAdv > distAdvAntesNeutra) {
          pontuacao += 5; // Bom bloqueio
        }
        
        pontuacao += Math.random() * 2;
        
        if (pontuacao > melhorPontuacao) {
          melhorPontuacao = pontuacao;
          melhorAcao = { tipo: 'colocacao', posPropria, posNeutra };
        }
      }
    }
  }
  
  // Avaliar substituições (se disponível e melhor que colocação)
  if (podeSubstituir(state.tabuleiro, state.jogadorAtual) && melhorPontuacao < 9000) {
    const neutras: Posicao[] = [];
    const proprias: Posicao[] = [];
    
    for (let x = 0; x < LADO_TABULEIRO; x++) {
      for (let y = 0; y < LADO_TABULEIRO; y++) {
        if (state.tabuleiro[x][y] === 'neutra') neutras.push({ x, y });
        if (state.tabuleiro[x][y] === corJogador) proprias.push({ x, y });
      }
    }
    
    // Amostrar combinações
    for (let i = 0; i < Math.min(neutras.length, 10); i++) {
      for (let j = i + 1; j < Math.min(neutras.length, 10); j++) {
        for (const propria of proprias.slice(0, 5)) {
          const n1 = neutras[i];
          const n2 = neutras[j];
          
          // Simular
          const tabTemp = state.tabuleiro.map(l => [...l]);
          tabTemp[n1.x][n1.y] = corJogador;
          tabTemp[n2.x][n2.y] = corJogador;
          tabTemp[propria.x][propria.y] = 'neutra';
          
          // Verificar vitória
          if (verificarVitoria(tabTemp, corJogador)) {
            return executarSubstituicao(state, {
              tipo: 'substituicao',
              neutrasParaProprias: [n1, n2],
              propriaParaNeutra: propria,
            });
          }
          
          const distMinha = calcularDistanciaMinima(tabTemp, corJogador);
          const distAdv = calcularDistanciaMinima(tabTemp, corAdversario);
          
          let pontuacao = (distAdv - distMinha) * 10 - 2; // Penalidade pequena vs colocação
          pontuacao += Math.random() * 2;
          
          if (pontuacao > melhorPontuacao) {
            melhorPontuacao = pontuacao;
            melhorAcao = {
              tipo: 'substituicao',
              neutrasParaProprias: [n1, n2],
              propriaParaNeutra: propria,
            };
          }
        }
      }
    }
  }
  
  // Executar melhor ação
  if (melhorAcao) {
    if (melhorAcao.tipo === 'colocacao') {
      return executarColocacao(state, melhorAcao);
    } else {
      return executarSubstituicao(state, melhorAcao);
    }
  }
  
  // Fallback: colocação aleatória (usando o array vazias já calculado)
  if (vazias.length >= 2) {
    return executarColocacao(state, {
      tipo: 'colocacao',
      posPropria: vazias[0],
      posNeutra: vazias[1],
    });
  }
  
  return state;
}

// Exportar para testes
export { getVizinhos, dentroDoTabuleiro, calcularDistanciaMinima };

