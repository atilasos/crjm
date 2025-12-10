import { 
  ProdutoState, Celula, Posicao, Grupo, Pontuacao, 
  gerarPosicoesValidas, posToKey, keyToPos, LADO_TABULEIRO 
} from './types';
import { GameMode, GameStatus, Player } from '../../types';

// Direções dos 6 vizinhos hexagonais (coordenadas axiais)
const DIRECOES_HEX: Posicao[] = [
  { q: 1, r: 0 },   // Este
  { q: 1, r: -1 },  // Nordeste
  { q: 0, r: -1 },  // Noroeste
  { q: -1, r: 0 },  // Oeste
  { q: -1, r: 1 },  // Sudoeste
  { q: 0, r: 1 },   // Sudeste
];

// Obter vizinhos de uma posição
function getVizinhos(pos: Posicao): Posicao[] {
  return DIRECOES_HEX.map(dir => ({
    q: pos.q + dir.q,
    r: pos.r + dir.r,
  }));
}

// Verificar se posição está dentro do tabuleiro
function dentroDoTabuleiro(pos: Posicao): boolean {
  const n = LADO_TABULEIRO - 1;
  return Math.abs(pos.q) <= n && Math.abs(pos.r) <= n && Math.abs(pos.q + pos.r) <= n;
}

// Criar tabuleiro inicial vazio
export function criarTabuleiroInicial(): Map<string, Celula> {
  const tabuleiro = new Map<string, Celula>();
  const posicoes = gerarPosicoesValidas();
  
  for (const pos of posicoes) {
    tabuleiro.set(posToKey(pos), 'vazia');
  }
  
  return tabuleiro;
}

// Encontrar todos os grupos de uma cor usando flood fill
export function encontrarGrupos(tabuleiro: Map<string, Celula>, cor: 'preta' | 'branca'): Grupo[] {
  const grupos: Grupo[] = [];
  const visitadas = new Set<string>();
  
  for (const [key, celula] of tabuleiro.entries()) {
    if (celula === cor && !visitadas.has(key)) {
      const grupo: Grupo = { cor, celulas: [] };
      const fila: string[] = [key];
      
      while (fila.length > 0) {
        const atualKey = fila.shift()!;
        if (visitadas.has(atualKey)) continue;
        
        const atualCelula = tabuleiro.get(atualKey);
        if (atualCelula !== cor) continue;
        
        visitadas.add(atualKey);
        grupo.celulas.push(keyToPos(atualKey));
        
        // Verificar vizinhos
        const pos = keyToPos(atualKey);
        for (const vizinho of getVizinhos(pos)) {
          if (dentroDoTabuleiro(vizinho)) {
            const vizinhoKey = posToKey(vizinho);
            if (!visitadas.has(vizinhoKey) && tabuleiro.get(vizinhoKey) === cor) {
              fila.push(vizinhoKey);
            }
          }
        }
      }
      
      if (grupo.celulas.length > 0) {
        grupos.push(grupo);
      }
    }
  }
  
  return grupos;
}

// Calcular pontuação de um jogador
export function calcularPontuacao(tabuleiro: Map<string, Celula>, cor: 'preta' | 'branca'): Pontuacao {
  const grupos = encontrarGrupos(tabuleiro, cor);
  
  // Contar total de peças
  let totalPecas = 0;
  for (const [, celula] of tabuleiro.entries()) {
    if (celula === cor) totalPecas++;
  }
  
  if (grupos.length < 2) {
    // Menos de 2 grupos = pontuação 0
    return {
      maiorGrupo: grupos.length > 0 ? grupos[0].celulas.length : 0,
      segundoMaiorGrupo: 0,
      produto: 0,
      totalPecas,
    };
  }
  
  // Ordenar grupos por tamanho (decrescente)
  const tamanhos = grupos.map(g => g.celulas.length).sort((a, b) => b - a);
  
  return {
    maiorGrupo: tamanhos[0],
    segundoMaiorGrupo: tamanhos[1],
    produto: tamanhos[0] * tamanhos[1],
    totalPecas,
  };
}

// Obter casas vazias
export function getCasasVazias(tabuleiro: Map<string, Celula>): Posicao[] {
  const vazias: Posicao[] = [];
  for (const [key, celula] of tabuleiro.entries()) {
    if (celula === 'vazia') {
      vazias.push(keyToPos(key));
    }
  }
  return vazias;
}

// Criar estado inicial do jogo
export function criarEstadoInicial(modo: GameMode): ProdutoState {
  const tabuleiro = criarTabuleiroInicial();
  const casasVazias = getCasasVazias(tabuleiro);
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: 'jogador1', // Pretas começam
    estado: 'a-jogar',
    primeiraJogada: true,
    pontuacaoPretas: { maiorGrupo: 0, segundoMaiorGrupo: 0, produto: 0, totalPecas: 0 },
    pontuacaoBrancas: { maiorGrupo: 0, segundoMaiorGrupo: 0, produto: 0, totalPecas: 0 },
    jogadaEmCurso: { pos1: null, cor1: null },
    casasVazias,
  };
}

// Colocar uma peça (parte de uma jogada de 2 peças ou jogada única na abertura)
export function colocarPeca(
  state: ProdutoState, 
  pos: Posicao, 
  cor: 'preta' | 'branca'
): ProdutoState {
  const key = posToKey(pos);
  if (state.tabuleiro.get(key) !== 'vazia') return state;
  
  const novoTabuleiro = new Map(state.tabuleiro);
  novoTabuleiro.set(key, cor);
  
  // Se é a primeira jogada (exceção de abertura: apenas 1 peça)
  if (state.primeiraJogada) {
    const novasCasasVazias = getCasasVazias(novoTabuleiro);
    const proximoJogador: Player = 'jogador2';
    
    return {
      ...state,
      tabuleiro: novoTabuleiro,
      jogadorAtual: proximoJogador,
      primeiraJogada: false,
      pontuacaoPretas: calcularPontuacao(novoTabuleiro, 'preta'),
      pontuacaoBrancas: calcularPontuacao(novoTabuleiro, 'branca'),
      jogadaEmCurso: { pos1: null, cor1: null },
      casasVazias: novasCasasVazias,
    };
  }
  
  // Se ainda não colocou a primeira peça desta jogada
  if (state.jogadaEmCurso.pos1 === null) {
    return {
      ...state,
      tabuleiro: novoTabuleiro,
      pontuacaoPretas: calcularPontuacao(novoTabuleiro, 'preta'),
      pontuacaoBrancas: calcularPontuacao(novoTabuleiro, 'branca'),
      jogadaEmCurso: { pos1: pos, cor1: cor },
      casasVazias: getCasasVazias(novoTabuleiro),
    };
  }
  
  // Colocou a segunda peça - finalizar turno
  const novasCasasVazias = getCasasVazias(novoTabuleiro);
  const proximoJogador: Player = state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';
  
  // Verificar fim de jogo (tabuleiro cheio)
  let novoEstado: GameStatus = 'a-jogar';
  if (novasCasasVazias.length === 0) {
    novoEstado = determinarVencedor(novoTabuleiro);
  }
  
  return {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: novoEstado,
    pontuacaoPretas: calcularPontuacao(novoTabuleiro, 'preta'),
    pontuacaoBrancas: calcularPontuacao(novoTabuleiro, 'branca'),
    jogadaEmCurso: { pos1: null, cor1: null },
    casasVazias: novasCasasVazias,
  };
}

// Determinar vencedor no fim do jogo
function determinarVencedor(tabuleiro: Map<string, Celula>): GameStatus {
  const pontPretas = calcularPontuacao(tabuleiro, 'preta');
  const pontBrancas = calcularPontuacao(tabuleiro, 'branca');
  
  if (pontPretas.produto > pontBrancas.produto) {
    return 'vitoria-jogador1';
  } else if (pontBrancas.produto > pontPretas.produto) {
    return 'vitoria-jogador2';
  } else {
    // Empate no produto - desempate por menor número de peças
    if (pontPretas.totalPecas < pontBrancas.totalPecas) {
      return 'vitoria-jogador1';
    } else if (pontBrancas.totalPecas < pontPretas.totalPecas) {
      return 'vitoria-jogador2';
    } else {
      return 'empate';
    }
  }
}

// Cancelar jogada em curso (desfazer primeira peça colocada)
export function cancelarJogadaEmCurso(state: ProdutoState): ProdutoState {
  if (state.jogadaEmCurso.pos1 === null) return state;
  
  const novoTabuleiro = new Map(state.tabuleiro);
  novoTabuleiro.set(posToKey(state.jogadaEmCurso.pos1), 'vazia');
  
  return {
    ...state,
    tabuleiro: novoTabuleiro,
    pontuacaoPretas: calcularPontuacao(novoTabuleiro, 'preta'),
    pontuacaoBrancas: calcularPontuacao(novoTabuleiro, 'branca'),
    jogadaEmCurso: { pos1: null, cor1: null },
    casasVazias: getCasasVazias(novoTabuleiro),
  };
}

// IA do computador para Produto
export function jogadaComputador(state: ProdutoState): ProdutoState {
  const casasVazias = state.casasVazias;
  if (casasVazias.length === 0) return state;
  
  const corJogador: 'preta' | 'branca' = state.jogadorAtual === 'jogador1' ? 'preta' : 'branca';
  const corAdversario: 'preta' | 'branca' = corJogador === 'preta' ? 'branca' : 'preta';
  
  // Se é a primeira jogada, colocar apenas 1 peça
  if (state.primeiraJogada) {
    // Preferir o centro
    const centro: Posicao = { q: 0, r: 0 };
    if (state.tabuleiro.get(posToKey(centro)) === 'vazia') {
      return colocarPeca(state, centro, corJogador);
    }
    // Senão, escolher aleatoriamente
    const posAleatoria = casasVazias[Math.floor(Math.random() * casasVazias.length)];
    return colocarPeca(state, posAleatoria, corJogador);
  }
  
  // Avaliar todas as combinações de 2 peças
  let melhorJogada: { pos1: Posicao; cor1: 'preta' | 'branca'; pos2: Posicao; cor2: 'preta' | 'branca'; pontuacao: number } | null = null;
  
  // Limitar busca para performance
  const amostraCasas = casasVazias.length > 20 
    ? casasVazias.filter((_, i) => i % Math.ceil(casasVazias.length / 20) === 0)
    : casasVazias;
  
  const cores: Array<'preta' | 'branca'> = ['preta', 'branca'];
  
  for (const pos1 of amostraCasas) {
    for (const cor1 of cores) {
      for (const pos2 of casasVazias) {
        if (posToKey(pos1) === posToKey(pos2)) continue;
        
        for (const cor2 of cores) {
          // Simular jogada
          const tabTemp = new Map(state.tabuleiro);
          tabTemp.set(posToKey(pos1), cor1);
          tabTemp.set(posToKey(pos2), cor2);
          
          const pontNossa = calcularPontuacao(tabTemp, corJogador);
          const pontAdversario = calcularPontuacao(tabTemp, corAdversario);
          
          // Pontuação: maximizar nosso produto, minimizar do adversário
          let pontuacao = pontNossa.produto - pontAdversario.produto * 1.5;
          
          // ESTRATÉGIA DE SABOTAGEM: unir grupos do adversário
          // Se conseguimos fazer o adversário ficar com apenas 1 grupo grande, é ótimo
          if (pontAdversario.produto === 0 && pontAdversario.maiorGrupo > 0) {
            pontuacao += 500; // Excelente! Adversário com score 0
          }
          
          // Bónus por ter 2 grupos equilibrados (maximiza produto)
          if (pontNossa.maiorGrupo > 0 && pontNossa.segundoMaiorGrupo > 0) {
            const equilibrio = Math.min(pontNossa.maiorGrupo, pontNossa.segundoMaiorGrupo) / 
                              Math.max(pontNossa.maiorGrupo, pontNossa.segundoMaiorGrupo);
            pontuacao += equilibrio * 50;
          }
          
          // Desempate: preferir ter menos peças próprias
          pontuacao -= pontNossa.totalPecas * 0.1;
          
          // Aleatoriedade
          pontuacao += Math.random() * 10;
          
          if (melhorJogada === null || pontuacao > melhorJogada.pontuacao) {
            melhorJogada = { pos1, cor1, pos2, cor2, pontuacao };
          }
        }
      }
    }
  }
  
  if (melhorJogada) {
    let novoState = colocarPeca(state, melhorJogada.pos1, melhorJogada.cor1);
    novoState = colocarPeca(novoState, melhorJogada.pos2, melhorJogada.cor2);
    return novoState;
  }
  
  // Fallback: jogada aleatória
  const pos1 = casasVazias[0];
  const pos2 = casasVazias[1];
  let novoState = colocarPeca(state, pos1, corJogador);
  if (pos2) {
    novoState = colocarPeca(novoState, pos2, corJogador);
  }
  return novoState;
}

// Exportar funções auxiliares para testes
export { getVizinhos, dentroDoTabuleiro };

