import { QuelhasState, Celula, Posicao, Segmento, Orientacao } from './types';
import { GameMode, GameStatus, Player } from '../../types';

const TAMANHO_TABULEIRO = 10;
const COMPRIMENTO_MINIMO = 2;

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

// IA decide se deve fazer a troca (baseado na avaliação da posição)
export function decidirTrocaComputador(state: QuelhasState): boolean {
  if (!state.trocaDisponivel) return false;
  
  // Avaliar a posição atual
  // Se o jogador que fez a primeira jogada (vertical inicial) deixou uma posição boa,
  // vale a pena trocar para ficar com essa posição
  
  // Contar jogadas disponíveis para cada orientação
  const jogadasVertical = calcularJogadasValidas(state.tabuleiro, 'vertical');
  const jogadasHorizontal = calcularJogadasValidas(state.tabuleiro, 'horizontal');
  
  // Em misère, queremos ter MENOS opções de jogo no final
  // Se vertical tem menos jogadas, pode ser melhor ficar com vertical
  // A heurística simples: se a diferença é significativa, trocar
  
  const diferencaJogadas = jogadasHorizontal.length - jogadasVertical.length;
  
  // Se horizontal tem mais jogadas que vertical (>= 5 de diferença), considerar trocar
  // Isto porque em misère ter mais jogadas pode ser desvantajoso
  // Adicionamos aleatoriedade para não ser previsível
  const limiarTroca = 3 + Math.random() * 4; // Entre 3 e 7
  
  return diferencaJogadas >= limiarTroca;
}

// IA do computador (misère)
// Estratégia: tentar forçar o adversário a ser o último a jogar
// Utiliza heurística baseada em intervalos min/max de jogadas futuras
export function jogadaComputador(state: QuelhasState): QuelhasState {
  const jogadas = state.jogadasValidas;
  if (jogadas.length === 0) return state;

  // Obter orientações dos jogadores
  const minhaOrientacao = getOrientacaoJogador(state, state.jogadorAtual);
  const orientacaoAdversario = getOrientacaoJogador(
    state, 
    state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1'
  );

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

    // Contar jogadas imediatas de cada lado após esta jogada
    const jogadasAdversario = calcularJogadasValidas(novoTabuleiro, orientacaoAdversario);
    const minhasJogadasFuturas = calcularJogadasValidas(novoTabuleiro, minhaOrientacao);

    // Usar nova heurística baseada em intervalos min/max
    let pontuacao = avaliarPosicaoMisere(
      novoTabuleiro,
      minhaOrientacao,
      orientacaoAdversario,
      jogadasAdversario.length,
      minhasJogadasFuturas.length
    );

    // Factores adicionais de controlo tático:
    
    // 1. Preferir segmentos mais curtos (dão mais controlo sobre o jogo)
    pontuacao -= jogada.comprimento * 2;
    
    // 2. Preferir jogar em zonas mais preenchidas (força o adversário a regiões limitadas)
    const densidadeLocal = calcularDensidadeLocal(novoTabuleiro, jogada);
    pontuacao += densidadeLocal * 2;

    // 3. Considerar se estamos perto do fim do jogo
    const totalJogadasRestantes = minhasJogadasFuturas.length + jogadasAdversario.length;
    if (totalJogadasRestantes <= 10) {
      // Fase final: dar mais peso à diferença de jogadas
      // Em misère, queremos ter menos jogadas que o adversário
      pontuacao += (jogadasAdversario.length - minhasJogadasFuturas.length) * 5;
      
      // Se conseguimos deixar exatamente 1 jogada para o adversário e 0 para nós
      if (minhasJogadasFuturas.length === 0 && jogadasAdversario.length === 1) {
        pontuacao += 300; // Situação quase ideal em misère
      }
    }

    // 4. Evitar deixar grandes blocos vazios que beneficiam o adversário
    // Calcular fragmentação - preferir estados mais fragmentados para limitar adversário
    if (totalJogadasRestantes > 10) {
      // Analisar distribuição das jogadas do adversário
      const colunasUsadas = new Set(jogadasAdversario.map(j => 
        j.orientacao === 'vertical' ? j.inicio.coluna : j.inicio.linha
      ));
      const fragmentacao = colunasUsadas.size;
      pontuacao += fragmentacao * 1.5; // Mais fragmentado = adversário tem menos flexibilidade
    }

    // Adicionar pequena aleatoriedade para não ser previsível
    pontuacao += Math.random() * 3;

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

// Avaliar posição após uma jogada usando intervalos min/max
// Retorna pontuação: maior = melhor para IA (em misère)
export function avaliarPosicaoMisere(
  tabuleiroAposJogada: Celula[][],
  orientacaoIA: Orientacao,
  orientacaoAdversario: Orientacao,
  jogadasImediatasAdv: number,
  jogadasImediatasIA: number
): number {
  // Em misère, queremos que o adversário seja o último a jogar
  // Portanto: bom para IA ter poucas jogadas, adversário ter pelo menos 1

  if (jogadasImediatasAdv === 0) {
    // Péssimo! Adversário não tem jogadas = IA foi o último a jogar = IA perde
    return -1000;
  }

  if (jogadasImediatasIA === 0 && jogadasImediatasAdv > 0) {
    // Excelente! IA não tem mais jogadas mas adversário tem = Adversário será último
    return 800;
  }

  // Calcular intervalos para análise mais profunda
  const intervalos = calcularIntervalosJogadas(
    tabuleiroAposJogada,
    orientacaoIA,
    orientacaoAdversario,
    1
  );

  let pontuacao = 0;

  // ESTRATÉGIA MISÈRE:
  // 1. Preferir estados onde o mínimo de jogadas da IA é pequeno
  //    (possibiitamos ficar sem jogadas)
  pontuacao -= intervalos.minJogadasIA * 3;

  // 2. Preferir estados onde o adversário tem garantia de pelo menos 1 jogada
  //    (ele será forçado a jogar)
  if (intervalos.minJogadasAdversario > 0) {
    pontuacao += intervalos.minJogadasAdversario * 5;
  } else {
    // Risco: existe cenário onde adversário fica sem jogadas (mau para nós)
    pontuacao -= 50;
  }

  // 3. Diferença entre máximo do adversário e mínimo da IA
  //    Quanto maior esta diferença, mais provável que adversário jogue por último
  pontuacao += (intervalos.maxJogadasAdversario - intervalos.minJogadasIA) * 4;

  // 4. Penalizar estados onde IA tem muitas jogadas obrigatórias
  //    (intervalos apertados = menos controlo)
  const rangeIA = intervalos.maxJogadasIA - intervalos.minJogadasIA;
  pontuacao += rangeIA * 2; // Mais range = mais controlo

  // 5. Bónus se conseguimos forçar paridade favorável
  //    Em jogos finais, queremos número ímpar de jogadas totais restantes
  //    para o adversário (ele joga a última)
  const totalMinRestante = intervalos.minJogadasIA + intervalos.minJogadasAdversario;
  if (totalMinRestante <= 5 && totalMinRestante > 0) {
    // Jogo está a acabar - verificar paridade
    // Se minJogadasIA é 0 e minJogadasAdversario > 0, é ideal
    if (intervalos.minJogadasIA === 0 && intervalos.minJogadasAdversario > 0) {
      pontuacao += 200;
    }
  }

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
