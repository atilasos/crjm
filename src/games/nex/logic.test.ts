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
  getVizinhos,
} from "./logic";
import { Celula, LADO_TABULEIRO } from "./types";

describe("Nex - Vizinhos Hexagonais", () => {
  test("célula central (5,5) tem 6 vizinhos corretos", () => {
    const vizinhos = getVizinhos({ x: 5, y: 5 });
    expect(vizinhos.length).toBe(6);
    
    // Verificar que os vizinhos são os corretos
    const vizinhosEsperados = [
      { x: 6, y: 5 },  // (+1,0)
      { x: 4, y: 5 },  // (-1,0)
      { x: 5, y: 6 },  // (0,+1)
      { x: 5, y: 4 },  // (0,-1)
      { x: 6, y: 4 },  // (+1,-1)
      { x: 4, y: 6 },  // (-1,+1)
    ];
    
    for (const esperado of vizinhosEsperados) {
      expect(vizinhos).toContainEqual(esperado);
    }
  });

  test("(5,5) NÃO tem (6,6) como vizinho - (+1,+1) não é válido", () => {
    const vizinhos = getVizinhos({ x: 5, y: 5 });
    expect(vizinhos).not.toContainEqual({ x: 6, y: 6 });
  });

  test("(5,5) NÃO tem (4,4) como vizinho - (-1,-1) não é válido", () => {
    const vizinhos = getVizinhos({ x: 5, y: 5 });
    expect(vizinhos).not.toContainEqual({ x: 4, y: 4 });
  });

  test("célula de canto (0,0) tem apenas 2 vizinhos válidos", () => {
    const vizinhos = getVizinhos({ x: 0, y: 0 });
    expect(vizinhos.length).toBe(2);
    expect(vizinhos).toContainEqual({ x: 1, y: 0 });
    expect(vizinhos).toContainEqual({ x: 0, y: 1 });
  });

  test("célula de borda (0,5) tem 4 vizinhos válidos", () => {
    const vizinhos = getVizinhos({ x: 0, y: 5 });
    expect(vizinhos.length).toBe(4);
    expect(vizinhos).toContainEqual({ x: 1, y: 5 });  // (+1,0)
    expect(vizinhos).toContainEqual({ x: 0, y: 6 });  // (0,+1)
    expect(vizinhos).toContainEqual({ x: 0, y: 4 });  // (0,-1)
    expect(vizinhos).toContainEqual({ x: 1, y: 4 });  // (+1,-1)
  });
});

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
  test("vitória das pretas (conexão y=0 a y=10 - Noroeste a Sudeste)", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Criar caminho de pretas de y=0 (NW) a y=10 (SE)
    for (let y = 0; y < LADO_TABULEIRO; y++) {
      tabuleiro[5][y] = 'preta';
    }
    
    expect(verificarVitoria(tabuleiro, 'preta')).toBe(true);
    expect(verificarVitoria(tabuleiro, 'branca')).toBe(false);
  });

  test("vitória das brancas (conexão x=0 a x=10 - Sudoeste a Nordeste)", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Criar caminho de brancas de x=0 (SW) a x=10 (NE)
    for (let x = 0; x < LADO_TABULEIRO; x++) {
      tabuleiro[x][5] = 'branca';
    }
    
    expect(verificarVitoria(tabuleiro, 'branca')).toBe(true);
    expect(verificarVitoria(tabuleiro, 'preta')).toBe(false);
  });

  test("sem vitória se caminho incompleto", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Caminho incompleto para pretas (y=0 a y=10)
    for (let y = 0; y < 5; y++) {
      tabuleiro[5][y] = 'preta';
    }
    
    expect(verificarVitoria(tabuleiro, 'preta')).toBe(false);
  });

  test("vitória das pretas com caminho diagonal (usando vizinho (+1,-1))", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Caminho diagonal puro usando apenas (+1,-1)
    // Pretas conectam y=0 (NW) a y=10 (SE)
    // De (10,0) até (0,10) - diagonal perfeita
    tabuleiro[10][0] = 'preta';
    tabuleiro[9][1] = 'preta';   // vizinho via (-1,+1)
    tabuleiro[8][2] = 'preta';   // vizinho via (-1,+1)
    tabuleiro[7][3] = 'preta';   // vizinho via (-1,+1)
    tabuleiro[6][4] = 'preta';   // vizinho via (-1,+1)
    tabuleiro[5][5] = 'preta';   // vizinho via (-1,+1)
    tabuleiro[4][6] = 'preta';   // vizinho via (-1,+1)
    tabuleiro[3][7] = 'preta';   // vizinho via (-1,+1)
    tabuleiro[2][8] = 'preta';   // vizinho via (-1,+1)
    tabuleiro[1][9] = 'preta';   // vizinho via (-1,+1)
    tabuleiro[0][10] = 'preta';  // vizinho via (-1,+1)
    
    expect(verificarVitoria(tabuleiro, 'preta')).toBe(true);
  });

  test("vitória das pretas com caminho usando vizinho (-1,+1)", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Caminho que usa especificamente o vizinho (-1,+1)
    // Pretas conectam y=0 (NW) a y=10 (SE)
    // (5,0) -> (5,1) -> (5,2) -> (4,3) -> (5,3) -> (5,4) -> ... -> (5,10)
    tabuleiro[5][0] = 'preta';
    tabuleiro[5][1] = 'preta';   // (0,+1) de (5,0)
    tabuleiro[5][2] = 'preta';   // (0,+1) de (5,1)
    tabuleiro[4][3] = 'preta';   // (-1,+1) de (5,2) - testa esta direção!
    tabuleiro[5][3] = 'preta';   // (+1,0) de (4,3)
    tabuleiro[5][4] = 'preta';
    tabuleiro[5][5] = 'preta';
    tabuleiro[5][6] = 'preta';
    tabuleiro[5][7] = 'preta';
    tabuleiro[5][8] = 'preta';
    tabuleiro[5][9] = 'preta';
    tabuleiro[5][10] = 'preta';
    
    expect(verificarVitoria(tabuleiro, 'preta')).toBe(true);
  });

  test("vitória das brancas com caminho diagonal (usando vizinho (+1,-1))", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Caminho diagonal para brancas (x=0 a x=10)
    // Brancas conectam SW (x=0) a NE (x=10)
    // De (0,10) até (10,0) usando (+1,-1)
    tabuleiro[0][10] = 'branca';
    tabuleiro[1][9] = 'branca';   // vizinho via (+1,-1)
    tabuleiro[2][8] = 'branca';   // vizinho via (+1,-1)
    tabuleiro[3][7] = 'branca';   // vizinho via (+1,-1)
    tabuleiro[4][6] = 'branca';   // vizinho via (+1,-1)
    tabuleiro[5][5] = 'branca';   // vizinho via (+1,-1)
    tabuleiro[6][4] = 'branca';   // vizinho via (+1,-1)
    tabuleiro[7][3] = 'branca';   // vizinho via (+1,-1)
    tabuleiro[8][2] = 'branca';   // vizinho via (+1,-1)
    tabuleiro[9][1] = 'branca';   // vizinho via (+1,-1)
    tabuleiro[10][0] = 'branca';  // vizinho via (+1,-1)
    
    expect(verificarVitoria(tabuleiro, 'branca')).toBe(true);
  });

  test("SEM vitória se caminho usa (+1,+1) que NÃO é vizinho válido", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Este caminho tenta usar (+1,+1) como vizinho, mas NÃO é válido
    // Pretas precisam conectar y=0 a y=10
    // (0,0) -> (1,1) -> (2,2) -> ... -> (10,10) NÃO é caminho válido!
    tabuleiro[0][0] = 'preta';
    tabuleiro[1][1] = 'preta';   // (+1,+1) de (0,0) - NÃO É VIZINHO!
    tabuleiro[2][2] = 'preta';
    tabuleiro[3][3] = 'preta';
    tabuleiro[4][4] = 'preta';
    tabuleiro[5][5] = 'preta';
    tabuleiro[6][6] = 'preta';
    tabuleiro[7][7] = 'preta';
    tabuleiro[8][8] = 'preta';
    tabuleiro[9][9] = 'preta';
    tabuleiro[10][10] = 'preta';
    
    // Pretas vão de y=0 a y=10, MAS o caminho não é conexo!
    // Porque (+1,+1) não é uma direção válida de vizinho
    expect(verificarVitoria(tabuleiro, 'preta')).toBe(false);
  });

  test("SEM vitória se caminho usa (-1,-1) que NÃO é vizinho válido", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Brancas precisam conectar x=0 a x=10
    // Vamos criar um caminho quebrado
    tabuleiro[0][5] = 'branca';
    // Saltar para (2,3) usando "(-1,-1)" que não é vizinho
    tabuleiro[1][4] = 'branca';   // (+1,-1) - este É válido
    tabuleiro[2][3] = 'branca';   // (+1,-1) - este É válido
    // Agora vamos quebrar o caminho
    tabuleiro[4][3] = 'branca';   // (4,3) NÃO é vizinho de (2,3)! Salto de 2 casas em x
    tabuleiro[5][3] = 'branca';
    tabuleiro[6][3] = 'branca';
    tabuleiro[7][3] = 'branca';
    tabuleiro[8][3] = 'branca';
    tabuleiro[9][3] = 'branca';
    tabuleiro[10][3] = 'branca';
    
    // Este caminho está quebrado porque (2,3) e (4,3) não são vizinhos
    expect(verificarVitoria(tabuleiro, 'branca')).toBe(false);
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
    // Brancas conectam x=0 (SW) a x=10 (NE)
    // Caminho quase completo de x=0 a x=10
    for (let x = 0; x < LADO_TABULEIRO - 1; x++) {
      estado.tabuleiro[x][5] = 'branca';
    }
    // Falta uma peça para vencer (x=10)
    
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

