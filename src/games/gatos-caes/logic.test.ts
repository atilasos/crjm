import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  calcularJogadasValidas,
  colocarPeca,
  isJogadaValida,
  CASAS_CENTRAIS,
} from "./logic";

describe("Gatos & Cães - Tabuleiro Inicial", () => {
  test("deve criar tabuleiro 8x8", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.length).toBe(8);
    expect(tabuleiro[0].length).toBe(8);
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

describe("Gatos & Cães - Estado Inicial", () => {
  test("jogador 1 (Gatos) deve começar", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadorAtual).toBe('jogador1');
  });

  test("estado deve ser 'a-jogar'", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.estado).toBe('a-jogar');
  });

  test("primeiro gato não foi colocado", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.primeiroGatoColocado).toBe(false);
  });

  test("primeiro cão não foi colocado", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.primeiroCaoColocado).toBe(false);
  });
});

describe("Gatos & Cães - Primeiro Gato", () => {
  test("primeiro gato só pode ser colocado nas 4 casas centrais", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    expect(estado.jogadasValidas.length).toBe(4);
    
    for (const jogada of estado.jogadasValidas) {
      const isCentral = CASAS_CENTRAIS.some(
        c => c.linha === jogada.linha && c.coluna === jogada.coluna
      );
      expect(isCentral).toBe(true);
    }
  });

  test("após colocar primeiro gato, turno passa para cães", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const jogada = estado.jogadasValidas[0];
    
    estado = colocarPeca(estado, jogada);
    
    expect(estado.jogadorAtual).toBe('jogador2');
    expect(estado.primeiroGatoColocado).toBe(true);
    expect(estado.totalGatos).toBe(1);
  });
});

describe("Gatos & Cães - Primeiro Cão", () => {
  test("primeiro cão deve ser colocado fora das casas centrais", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Colocar primeiro gato
    estado = colocarPeca(estado, estado.jogadasValidas[0]);
    
    // Verificar jogadas do cão
    for (const jogada of estado.jogadasValidas) {
      const isCentral = CASAS_CENTRAIS.some(
        c => c.linha === jogada.linha && c.coluna === jogada.coluna
      );
      expect(isCentral).toBe(false);
    }
  });

  test("primeiro cão não pode ser adjacente ao gato", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Colocar primeiro gato em (3,3)
    estado = colocarPeca(estado, { linha: 3, coluna: 3 });
    
    // Verificar que posições adjacentes ao gato não estão nas jogadas válidas
    const adjacentes = [
      { linha: 2, coluna: 3 },
      { linha: 4, coluna: 3 },
      { linha: 3, coluna: 2 },
      { linha: 3, coluna: 4 },
    ];
    
    for (const adj of adjacentes) {
      const temAdjacente = estado.jogadasValidas.some(
        j => j.linha === adj.linha && j.coluna === adj.coluna
      );
      expect(temAdjacente).toBe(false);
    }
  });
});

describe("Gatos & Cães - Regra de Adjacência", () => {
  test("gato não pode ser colocado adjacente a cão", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Colocar primeiro gato
    estado = colocarPeca(estado, { linha: 3, coluna: 3 });
    
    // Colocar primeiro cão longe do gato
    estado = colocarPeca(estado, { linha: 0, coluna: 0 });
    
    // Verificar que gato não pode ser adjacente ao cão
    const adjacentesAoCao = [
      { linha: 0, coluna: 1 },
      { linha: 1, coluna: 0 },
    ];
    
    for (const adj of adjacentesAoCao) {
      const podeColocar = estado.jogadasValidas.some(
        j => j.linha === adj.linha && j.coluna === adj.coluna
      );
      expect(podeColocar).toBe(false);
    }
  });
});

describe("Gatos & Cães - Condição de Vitória Normal Play", () => {
  test("estado inicial permite continuar a jogar", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.estado).toBe('a-jogar');
  });
});
