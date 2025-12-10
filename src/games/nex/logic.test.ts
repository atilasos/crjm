import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  verificarVitoria,
  executarColocacao,
  executarSubstituicao,
  executarSwap,
  recusarSwap,
  podeSubstituir,
  podeColocar,
  jogadaComputador,
  selecionarTipoAcao,
  adicionarPosicaoAcao,
  isAcaoCompleta,
  executarAcao,
  cancelarAcao,
} from "./logic";
import { Celula, LADO_TABULEIRO } from "./types";

describe("Nex - Tabuleiro Inicial", () => {
  test("deve criar tabuleiro 11x11", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.length).toBe(11);
    expect(tabuleiro[0].length).toBe(11);
  });

  test("tabuleiro inicial deve estar todo vazio", () => {
    const tabuleiro = criarTabuleiroInicial();
    for (const linha of tabuleiro) {
      for (const celula of linha) {
        expect(celula).toBe('vazia');
      }
    }
  });
});

describe("Nex - Estado Inicial", () => {
  test("jogador 1 (Pretas) deve começar", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadorAtual).toBe('jogador1');
  });

  test("estado deve ser 'a-jogar'", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.estado).toBe('a-jogar');
  });

  test("swap não disponível no início", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.swapDisponivel).toBe(false);
  });

  test("primeira jogada deve estar ativa", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.primeiraJogada).toBe(true);
  });
});

describe("Nex - Verificação de Vitória", () => {
  test("vitória das pretas (conexão x=0 a x=10)", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Criar caminho de pretas da esquerda para a direita
    for (let x = 0; x < LADO_TABULEIRO; x++) {
      tabuleiro[x][5] = 'preta';
    }
    
    expect(verificarVitoria(tabuleiro, 'preta')).toBe(true);
    expect(verificarVitoria(tabuleiro, 'branca')).toBe(false);
  });

  test("vitória das brancas (conexão y=0 a y=10)", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Criar caminho de brancas de cima para baixo
    for (let y = 0; y < LADO_TABULEIRO; y++) {
      tabuleiro[5][y] = 'branca';
    }
    
    expect(verificarVitoria(tabuleiro, 'branca')).toBe(true);
    expect(verificarVitoria(tabuleiro, 'preta')).toBe(false);
  });

  test("sem vitória se caminho incompleto", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Caminho incompleto
    for (let x = 0; x < 5; x++) {
      tabuleiro[x][5] = 'preta';
    }
    
    expect(verificarVitoria(tabuleiro, 'preta')).toBe(false);
  });
});

describe("Nex - Ação de Colocação", () => {
  test("colocação deve adicionar peça própria e neutra", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    estado = executarColocacao(estado, {
      tipo: 'colocacao',
      posPropria: { x: 5, y: 5 },
      posNeutra: { x: 6, y: 5 },
    });
    
    expect(estado.tabuleiro[5][5]).toBe('preta');
    expect(estado.tabuleiro[6][5]).toBe('neutra');
    expect(estado.jogadorAtual).toBe('jogador2');
  });

  test("após primeira jogada, swap deve ficar disponível", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    estado = executarColocacao(estado, {
      tipo: 'colocacao',
      posPropria: { x: 5, y: 5 },
      posNeutra: { x: 6, y: 5 },
    });
    
    expect(estado.swapDisponivel).toBe(true);
    expect(estado.primeiraJogada).toBe(false);
  });
});

describe("Nex - Ação de Substituição", () => {
  test("substituição deve trocar neutras por próprias e própria por neutra", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Preparar tabuleiro com neutras e peça própria
    estado.tabuleiro[0][0] = 'preta';
    estado.tabuleiro[1][0] = 'neutra';
    estado.tabuleiro[2][0] = 'neutra';
    
    estado = executarSubstituicao(estado, {
      tipo: 'substituicao',
      neutrasParaProprias: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
      propriaParaNeutra: { x: 0, y: 0 },
    });
    
    expect(estado.tabuleiro[0][0]).toBe('neutra');
    expect(estado.tabuleiro[1][0]).toBe('preta');
    expect(estado.tabuleiro[2][0]).toBe('preta');
  });

  test("podeSubstituir retorna false sem neutras suficientes", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    estado.tabuleiro[0][0] = 'preta';
    estado.tabuleiro[1][0] = 'neutra'; // Apenas 1 neutra
    
    expect(podeSubstituir(estado.tabuleiro, 'jogador1')).toBe(false);
  });

  test("podeSubstituir retorna true com condições corretas", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    estado.tabuleiro[0][0] = 'preta';
    estado.tabuleiro[1][0] = 'neutra';
    estado.tabuleiro[2][0] = 'neutra';
    
    expect(podeSubstituir(estado.tabuleiro, 'jogador1')).toBe(true);
  });
});

describe("Nex - Regra de Swap", () => {
  test("swap deve trocar cores das peças", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Fazer primeira jogada
    estado = executarColocacao(estado, {
      tipo: 'colocacao',
      posPropria: { x: 5, y: 5 },
      posNeutra: { x: 6, y: 5 },
    });
    
    expect(estado.swapDisponivel).toBe(true);
    expect(estado.tabuleiro[5][5]).toBe('preta');
    
    // Executar swap
    estado = executarSwap(estado);
    
    expect(estado.tabuleiro[5][5]).toBe('branca'); // Trocou para branca
    expect(estado.swapDisponivel).toBe(false);
    expect(estado.swapEfetuado).toBe(true);
  });

  test("recusar swap deve desativar opção", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    estado = executarColocacao(estado, {
      tipo: 'colocacao',
      posPropria: { x: 5, y: 5 },
      posNeutra: { x: 6, y: 5 },
    });
    
    expect(estado.swapDisponivel).toBe(true);
    
    estado = recusarSwap(estado);
    
    expect(estado.swapDisponivel).toBe(false);
    expect(estado.swapEfetuado).toBe(false);
  });
});

describe("Nex - Construção de Ação", () => {
  test("selecionar tipo de ação", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    estado = selecionarTipoAcao(estado, 'colocacao');
    
    expect(estado.acaoEmCurso.tipo).toBe('colocacao');
  });

  test("adicionar posições para colocação", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    estado = selecionarTipoAcao(estado, 'colocacao');
    
    estado = adicionarPosicaoAcao(estado, { x: 5, y: 5 }, 'propria');
    expect(estado.acaoEmCurso.posPropria).toEqual({ x: 5, y: 5 });
    expect(isAcaoCompleta(estado.acaoEmCurso)).toBe(false);
    
    estado = adicionarPosicaoAcao(estado, { x: 6, y: 5 }, 'neutra');
    expect(estado.acaoEmCurso.posNeutra).toEqual({ x: 6, y: 5 });
    expect(isAcaoCompleta(estado.acaoEmCurso)).toBe(true);
  });

  test("executar ação completa", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    estado = selecionarTipoAcao(estado, 'colocacao');
    estado = adicionarPosicaoAcao(estado, { x: 5, y: 5 }, 'propria');
    estado = adicionarPosicaoAcao(estado, { x: 6, y: 5 }, 'neutra');
    
    estado = executarAcao(estado);
    
    expect(estado.tabuleiro[5][5]).toBe('preta');
    expect(estado.tabuleiro[6][5]).toBe('neutra');
    expect(estado.jogadorAtual).toBe('jogador2');
  });

  test("cancelar ação deve limpar estado", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    estado = selecionarTipoAcao(estado, 'colocacao');
    estado = adicionarPosicaoAcao(estado, { x: 5, y: 5 }, 'propria');
    
    estado = cancelarAcao(estado);
    
    expect(estado.acaoEmCurso.tipo).toBeNull();
    expect(estado.acaoEmCurso.posPropria).toBeNull();
  });
});

describe("Nex - IA", () => {
  test("IA deve fazer jogada válida", () => {
    let estado = criarEstadoInicial('vs-computador');
    
    // Primeira jogada do humano
    estado = executarColocacao(estado, {
      tipo: 'colocacao',
      posPropria: { x: 5, y: 5 },
      posNeutra: { x: 6, y: 5 },
    });
    
    // Recusar swap para simplificar
    estado = recusarSwap(estado);
    
    // IA joga
    const estadoAposIA = jogadaComputador(estado);
    
    // IA deve ter jogado
    expect(estadoAposIA.jogadorAtual).toBe('jogador1');
  });

  test("IA deve vencer se possível", () => {
    let estado = criarEstadoInicial('vs-computador');
    
    // Criar situação onde IA (brancas, jogador2) pode vencer
    // Caminho quase completo de y=0 a y=10
    for (let y = 0; y < LADO_TABULEIRO - 1; y++) {
      estado.tabuleiro[5][y] = 'branca';
    }
    // Falta uma peça para vencer
    
    estado.jogadorAtual = 'jogador2';
    estado.primeiraJogada = false;
    
    const estadoAposIA = jogadaComputador(estado);
    
    // IA deve ter vencido (colocou peça que completa)
    expect(estadoAposIA.estado).toBe('vitoria-jogador2');
  });
});

describe("Nex - Verificações Gerais", () => {
  test("podeColocar retorna true com tabuleiro vazio", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(podeColocar(tabuleiro)).toBe(true);
  });

  test("podeColocar retorna false com menos de 2 casas vazias", () => {
    const tabuleiro = criarTabuleiroInicial();
    // Preencher quase tudo
    for (let x = 0; x < LADO_TABULEIRO; x++) {
      for (let y = 0; y < LADO_TABULEIRO; y++) {
        tabuleiro[x][y] = 'preta';
      }
    }
    // Deixar apenas 1 vazia
    tabuleiro[0][0] = 'vazia';
    
    expect(podeColocar(tabuleiro)).toBe(false);
  });
});

