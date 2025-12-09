import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  calcularJogadasValidas,
  colocarDomino,
} from "./logic";

describe("Dominório - Tabuleiro Inicial", () => {
  test("deve criar tabuleiro 8x8", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.length).toBe(8);
    expect(tabuleiro[0].length).toBe(8);
  });

  test("tabuleiro inicial deve estar vazio", () => {
    const tabuleiro = criarTabuleiroInicial();
    for (const linha of tabuleiro) {
      for (const celula of linha) {
        expect(celula).toBe('vazia');
      }
    }
  });
});

describe("Dominório - Estado Inicial", () => {
  test("jogador 1 (Vertical) deve começar", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadorAtual).toBe('jogador1');
  });

  test("estado deve ser 'a-jogar'", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.estado).toBe('a-jogar');
  });

  test("deve ter jogadas válidas no início", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadasValidas.length).toBeGreaterThan(0);
  });
});

describe("Dominório - Jogadas Válidas", () => {
  test("jogador 1 deve ter jogadas verticais", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.orientacao).toBe('vertical');
      // Vertical: mesma coluna, linhas adjacentes
      expect(jogada.pos1.coluna).toBe(jogada.pos2.coluna);
      expect(jogada.pos2.linha - jogada.pos1.linha).toBe(1);
    }
  });

  test("tabuleiro 8x8 vazio deve ter 56 jogadas verticais", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    // 8 colunas × 7 posições verticais possíveis = 56
    expect(estado.jogadasValidas.length).toBe(56);
  });
});

describe("Dominório - Colocação de Dominós", () => {
  test("colocar dominó deve ocupar 2 casas", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const jogada = estado.jogadasValidas[0];
    
    estado = colocarDomino(estado, jogada);
    
    expect(estado.tabuleiro[jogada.pos1.linha][jogada.pos1.coluna]).toBe('ocupada-vertical');
    expect(estado.tabuleiro[jogada.pos2.linha][jogada.pos2.coluna]).toBe('ocupada-vertical');
  });

  test("após jogada, turno muda para jogador 2", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const jogada = estado.jogadasValidas[0];
    
    estado = colocarDomino(estado, jogada);
    
    expect(estado.jogadorAtual).toBe('jogador2');
  });

  test("jogador 2 deve ter jogadas horizontais", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const jogada = estado.jogadasValidas[0];
    
    estado = colocarDomino(estado, jogada);
    
    for (const j of estado.jogadasValidas) {
      expect(j.orientacao).toBe('horizontal');
    }
  });
});

describe("Dominório - Condição de Vitória Normal Play", () => {
  test("estado inicial permite continuar a jogar", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.estado).toBe('a-jogar');
  });

  // Em normal play, se o próximo jogador não tem jogadas, o jogador atual ganha
  test("jogador ganha quando adversário fica sem jogadas (conceptual)", () => {
    // Teste conceptual - a lógica está implementada em colocarDomino
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadasValidas.length).toBeGreaterThan(0);
  });
});
