import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  calcularJogadasValidas,
  colocarDomino,
} from "./logic";

describe("Dominório - Tabuleiro Inicial", () => {
  test("deve criar tabuleiro 5x5", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.length).toBe(5);
    expect(tabuleiro[0].length).toBe(5);
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
  test("jogador 1 (horizontal) deve começar", () => {
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
  test("jogador 1 deve ter jogadas horizontais", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.orientacao).toBe('horizontal');
      // Horizontal: mesma linha, colunas adjacentes
      expect(jogada.pos1.linha).toBe(jogada.pos2.linha);
      expect(jogada.pos2.coluna - jogada.pos1.coluna).toBe(1);
    }
  });

  test("tabuleiro 5x5 vazio deve ter 20 jogadas horizontais", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    // 5 linhas × 4 posições horizontais possíveis = 20
    expect(estado.jogadasValidas.length).toBe(20);
  });
});

describe("Dominório - Colocação de Dominós", () => {
  test("colocar dominó deve ocupar 2 casas", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const jogada = estado.jogadasValidas[0];
    
    estado = colocarDomino(estado, jogada);
    
    expect(estado.tabuleiro[jogada.pos1.linha][jogada.pos1.coluna]).toBe('ocupada-horizontal');
    expect(estado.tabuleiro[jogada.pos2.linha][jogada.pos2.coluna]).toBe('ocupada-horizontal');
  });

  test("após jogada, turno muda para jogador 2", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const jogada = estado.jogadasValidas[0];
    
    estado = colocarDomino(estado, jogada);
    
    expect(estado.jogadorAtual).toBe('jogador2');
  });

  test("jogador 2 deve ter jogadas verticais", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const jogada = estado.jogadasValidas[0];
    
    estado = colocarDomino(estado, jogada);
    
    for (const j of estado.jogadasValidas) {
      expect(j.orientacao).toBe('vertical');
    }
  });
});

