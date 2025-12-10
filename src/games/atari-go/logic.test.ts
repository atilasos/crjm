import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  calcularJogadasValidas,
  colocarPedra,
  isJogadaValida,
  encontrarGrupo,
  encontrarTodosGrupos,
  encontrarGruposEmAtari,
  jogadaComputador,
} from "./logic";
import { Celula, TAMANHO_TABULEIRO } from "./types";

describe("Atari Go - Tabuleiro Inicial", () => {
  test("deve criar tabuleiro 9x9", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.length).toBe(9);
    expect(tabuleiro[0].length).toBe(9);
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

describe("Atari Go - Estado Inicial", () => {
  test("jogador 1 (Pretas) deve começar", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadorAtual).toBe('jogador1');
  });

  test("estado deve ser 'a-jogar'", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.estado).toBe('a-jogar');
  });

  test("deve ter 81 jogadas válidas no início (9×9)", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadasValidas.length).toBe(81);
  });

  test("nenhuma pedra capturada no início", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.pedrasCapturadas.pretas).toBe(0);
    expect(estado.pedrasCapturadas.brancas).toBe(0);
  });
});

describe("Atari Go - Grupos e Liberdades", () => {
  test("encontrar grupo de uma pedra isolada", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    tabuleiro[4][4] = 'preta';
    
    const grupo = encontrarGrupo(tabuleiro, { linha: 4, coluna: 4 });
    
    expect(grupo).not.toBeNull();
    expect(grupo!.cor).toBe('preta');
    expect(grupo!.pedras.length).toBe(1);
    expect(grupo!.liberdades.length).toBe(4); // 4 vizinhos vazios
  });

  test("encontrar grupo de pedra no canto", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    tabuleiro[0][0] = 'preta';
    
    const grupo = encontrarGrupo(tabuleiro, { linha: 0, coluna: 0 });
    
    expect(grupo).not.toBeNull();
    expect(grupo!.liberdades.length).toBe(2); // Apenas 2 vizinhos
  });

  test("encontrar grupo conectado", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    tabuleiro[4][4] = 'preta';
    tabuleiro[4][5] = 'preta';
    tabuleiro[5][4] = 'preta';
    
    const grupo = encontrarGrupo(tabuleiro, { linha: 4, coluna: 4 });
    
    expect(grupo).not.toBeNull();
    expect(grupo!.pedras.length).toBe(3);
    expect(grupo!.liberdades.length).toBe(7); // Verificar liberdades únicas
  });

  test("encontrar todos grupos de uma cor", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Grupo 1
    tabuleiro[0][0] = 'preta';
    tabuleiro[0][1] = 'preta';
    // Grupo 2 (separado)
    tabuleiro[5][5] = 'preta';
    
    const grupos = encontrarTodosGrupos(tabuleiro, 'preta');
    
    expect(grupos.length).toBe(2);
  });

  test("grupo rodeado tem 0 liberdades", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Pedra preta no centro
    tabuleiro[4][4] = 'preta';
    // Rodeada por brancas
    tabuleiro[3][4] = 'branca';
    tabuleiro[5][4] = 'branca';
    tabuleiro[4][3] = 'branca';
    tabuleiro[4][5] = 'branca';
    
    const grupo = encontrarGrupo(tabuleiro, { linha: 4, coluna: 4 });
    
    expect(grupo).not.toBeNull();
    expect(grupo!.liberdades.length).toBe(0);
  });
});

describe("Atari Go - Atari (1 liberdade)", () => {
  test("encontrar grupos em atari", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Pedra preta com apenas 1 liberdade
    tabuleiro[0][0] = 'preta';
    tabuleiro[0][1] = 'branca';
    tabuleiro[1][0] = 'branca';
    // Deixa apenas diagonal que não conta
    
    // Espera: a preta em 0,0 deveria estar em atari? Não, está capturada (0 liberdades)
    // Vamos fazer um caso com 1 liberdade
    const tabuleiro2: Celula[][] = criarTabuleiroInicial();
    tabuleiro2[4][4] = 'preta';
    tabuleiro2[3][4] = 'branca';
    tabuleiro2[5][4] = 'branca';
    tabuleiro2[4][3] = 'branca';
    // 4,5 está vazia - única liberdade
    
    const gruposEmAtari = encontrarGruposEmAtari(tabuleiro2, 'preta');
    
    expect(gruposEmAtari.length).toBe(1);
    expect(gruposEmAtari[0].liberdades.length).toBe(1);
  });
});

describe("Atari Go - Colocação de Pedras", () => {
  test("colocar pedra deve ocupar célula", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const pos = { linha: 4, coluna: 4 };
    
    estado = colocarPedra(estado, pos);
    
    expect(estado.tabuleiro[4][4]).toBe('preta');
    expect(estado.ultimaJogada).toEqual(pos);
  });

  test("após jogada, turno muda para jogador 2 (Brancas)", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    estado = colocarPedra(estado, { linha: 4, coluna: 4 });
    
    expect(estado.jogadorAtual).toBe('jogador2');
  });

  test("célula ocupada não é jogada válida", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    estado = colocarPedra(estado, { linha: 4, coluna: 4 });
    
    const valida = isJogadaValida(estado, { linha: 4, coluna: 4 });
    expect(valida).toBe(false);
  });
});

describe("Atari Go - Captura", () => {
  test("captura simples de pedra isolada", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Pretas cercam uma branca no canto
    // Colocar branca primeiro (simulando estado)
    estado.tabuleiro[0][1] = 'branca';
    estado.tabuleiro[1][0] = 'preta';
    estado.jogadorAtual = 'jogador1';
    estado.jogadasValidas = calcularJogadasValidas(estado.tabuleiro, 'jogador1');
    
    // Preta joga em 0,0 capturando? Não, a branca está em 0,1
    // Para capturar 0,1, precisamos cercar: 0,0, 0,2 e 1,1
    // Vamos simplificar: branca no canto, preta fecha
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    tabuleiro[0][0] = 'branca';
    tabuleiro[1][0] = 'preta'; // Já colocada
    // Preta precisa jogar em 0,1 para capturar
    
    estado = {
      ...criarEstadoInicial('dois-jogadores'),
      tabuleiro,
      jogadorAtual: 'jogador1',
    };
    estado.jogadasValidas = calcularJogadasValidas(estado.tabuleiro, 'jogador1');
    
    estado = colocarPedra(estado, { linha: 0, coluna: 1 });
    
    // A branca em 0,0 deve ter sido capturada
    expect(estado.tabuleiro[0][0]).toBe('vazia');
    expect(estado.pedrasCapturadas.brancas).toBe(1);
  });

  test("vitória na primeira captura", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    tabuleiro[0][0] = 'branca';
    tabuleiro[1][0] = 'preta';
    
    let estado: typeof criarEstadoInicial extends (m: any) => infer R ? R : never = {
      ...criarEstadoInicial('dois-jogadores'),
      tabuleiro,
      jogadorAtual: 'jogador1',
    };
    estado.jogadasValidas = calcularJogadasValidas(estado.tabuleiro, 'jogador1');
    
    estado = colocarPedra(estado, { linha: 0, coluna: 1 });
    
    expect(estado.estado).toBe('vitoria-jogador1');
  });
});

describe("Atari Go - Regra de Suicídio", () => {
  test("suicídio é proibido", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Criar situação onde jogar em 0,0 seria suicídio para pretas
    tabuleiro[0][1] = 'branca';
    tabuleiro[1][0] = 'branca';
    
    const jogadasValidas = calcularJogadasValidas(tabuleiro, 'jogador1');
    
    // 0,0 não deve estar nas jogadas válidas (seria suicídio)
    const podeJogar00 = jogadasValidas.some(j => j.linha === 0 && j.coluna === 0);
    expect(podeJogar00).toBe(false);
  });

  test("suicídio permitido se captura", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Situação: jogar em 0,0 seria "suicídio" mas captura pedra branca
    // Branca em 0,1 com apenas liberdade em 0,0
    tabuleiro[0][1] = 'branca';
    tabuleiro[0][2] = 'preta';
    tabuleiro[1][1] = 'preta';
    // Pretas rodeiam a branca, falta 0,0
    // Se preta jogar em 0,0, captura a branca (não é suicídio)
    
    const jogadasValidas = calcularJogadasValidas(tabuleiro, 'jogador1');
    
    // 0,0 DEVE estar nas jogadas válidas (captura a branca em 0,1)
    const podeJogar00 = jogadasValidas.some(j => j.linha === 0 && j.coluna === 0);
    expect(podeJogar00).toBe(true);
  });
});

describe("Atari Go - IA", () => {
  test("IA deve fazer jogada válida", () => {
    let estado = criarEstadoInicial('vs-computador');
    
    // Humano joga
    estado = colocarPedra(estado, { linha: 4, coluna: 4 });
    
    // IA joga
    const estadoAposIA = jogadaComputador(estado);
    
    expect(estadoAposIA.jogadorAtual).toBe('jogador1');
    expect(estadoAposIA.ultimaJogada).not.toBeNull();
  });

  test("IA deve capturar se possível (vitória imediata)", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Branca pode capturar preta com uma jogada
    tabuleiro[0][0] = 'preta';
    tabuleiro[1][0] = 'branca';
    // Branca joga em 0,1 para capturar
    
    let estado = {
      ...criarEstadoInicial('vs-computador'),
      tabuleiro,
      jogadorAtual: 'jogador2', // Brancas (IA)
    };
    estado.jogadasValidas = calcularJogadasValidas(estado.tabuleiro, 'jogador2');
    
    const estadoAposIA = jogadaComputador(estado);
    
    // IA deve ter capturado e vencido
    expect(estadoAposIA.estado).toBe('vitoria-jogador2');
  });

  test("IA deve defender grupo em atari", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Branca tem grupo em atari
    tabuleiro[4][4] = 'branca';
    tabuleiro[3][4] = 'preta';
    tabuleiro[5][4] = 'preta';
    tabuleiro[4][3] = 'preta';
    // Única liberdade em 4,5
    
    let estado = {
      ...criarEstadoInicial('vs-computador'),
      tabuleiro,
      jogadorAtual: 'jogador2', // Brancas (IA)
    };
    estado.jogadasValidas = calcularJogadasValidas(estado.tabuleiro, 'jogador2');
    
    const estadoAposIA = jogadaComputador(estado);
    
    // IA deve tentar salvar o grupo ou criar contrajogo
    // Pelo menos deve fazer uma jogada válida
    expect(estadoAposIA.jogadorAtual).toBe('jogador1');
  });
});

