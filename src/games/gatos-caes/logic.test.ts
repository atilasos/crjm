import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  getJogadasValidas,
  selecionarPeca,
  executarJogada,
} from "./logic";

describe("Gatos & Cães - Tabuleiro Inicial", () => {
  test("deve criar tabuleiro 5x5", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.length).toBe(5);
    expect(tabuleiro[0].length).toBe(5);
  });

  test("deve ter 3 gatos na primeira linha", () => {
    const tabuleiro = criarTabuleiroInicial();
    const gatos = tabuleiro[0].filter(c => c === 'gato');
    expect(gatos.length).toBe(3);
  });

  test("deve ter 1 cão na última linha", () => {
    const tabuleiro = criarTabuleiroInicial();
    const caes = tabuleiro[4].filter(c => c === 'cao');
    expect(caes.length).toBe(1);
  });

  test("cão deve estar no centro", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro[4][2]).toBe('cao');
  });
});

describe("Gatos & Cães - Estado Inicial", () => {
  test("jogador 1 (gatos) deve começar", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadorAtual).toBe('jogador1');
  });

  test("estado deve ser 'a-jogar'", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.estado).toBe('a-jogar');
  });

  test("deve ter 3 gatos restantes", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.gatosRestantes).toBe(3);
  });
});

describe("Gatos & Cães - Jogadas Válidas", () => {
  test("gatos devem ter jogadas no início", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    const jogadas = getJogadasValidas(estado);
    expect(jogadas.length).toBeGreaterThan(0);
  });

  test("gatos só movem para baixo na diagonal", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    const jogadas = getJogadasValidas(estado);
    
    // Todas as jogadas devem ir para linha maior (para baixo)
    for (const jogada of jogadas) {
      expect(jogada.destino.linha).toBeGreaterThan(jogada.origem.linha);
    }
  });
});

describe("Gatos & Cães - Seleção de Peças", () => {
  test("jogador 1 pode selecionar gato", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    const novoEstado = selecionarPeca(estado, { linha: 0, coluna: 0 });
    expect(novoEstado.pecaSelecionada).toEqual({ linha: 0, coluna: 0 });
  });

  test("jogador 1 não pode selecionar cão", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    const novoEstado = selecionarPeca(estado, { linha: 4, coluna: 2 });
    expect(novoEstado.pecaSelecionada).toBeNull();
  });
});

