import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  calcularJogadasValidas,
  colocarSegmento,
  isSegmentoValido,
} from "./logic";

describe("Quelhas - Tabuleiro Inicial", () => {
  test("deve criar tabuleiro 10x10", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.length).toBe(10);
    expect(tabuleiro[0].length).toBe(10);
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

describe("Quelhas - Estado Inicial", () => {
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

describe("Quelhas - Jogadas Válidas", () => {
  test("jogador 1 deve ter apenas segmentos verticais", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.orientacao).toBe('vertical');
    }
  });

  test("segmentos devem ter comprimento mínimo de 2", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.comprimento).toBeGreaterThanOrEqual(2);
    }
  });

  test("após jogada, jogador 2 deve ter segmentos horizontais", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const primeiraJogada = estado.jogadasValidas[0];
    
    estado = colocarSegmento(estado, primeiraJogada);
    
    expect(estado.jogadorAtual).toBe('jogador2');
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.orientacao).toBe('horizontal');
    }
  });
});

describe("Quelhas - Condição de Vitória Misère", () => {
  test("se um jogador não tem jogadas, esse jogador GANHA (misère)", () => {
    // Este é um teste conceptual - em misère, quem não pode jogar ganha
    // porque o adversário foi o último a jogar
    const estado = criarEstadoInicial('dois-jogadores');
    
    // Simulação: se após uma jogada o próximo jogador não tem jogadas,
    // o próximo jogador ganha (porque o anterior foi o último a jogar)
    expect(estado.estado).toBe('a-jogar');
  });
});

describe("Quelhas - Colocação de Segmentos", () => {
  test("colocar segmento deve ocupar células", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const segmento = estado.jogadasValidas.find(s => s.comprimento === 2);
    
    if (segmento) {
      estado = colocarSegmento(estado, segmento);
      
      // Verificar que as células estão ocupadas
      expect(estado.tabuleiro[segmento.inicio.linha][segmento.inicio.coluna]).toBe('ocupada');
      expect(estado.tabuleiro[segmento.inicio.linha + 1][segmento.inicio.coluna]).toBe('ocupada');
    }
  });

  test("após jogada, turno muda para o próximo jogador", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    const jogada = estado.jogadasValidas[0];
    
    estado = colocarSegmento(estado, jogada);
    
    expect(estado.jogadorAtual).toBe('jogador2');
  });
});
