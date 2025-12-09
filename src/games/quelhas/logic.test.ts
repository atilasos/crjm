import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  getJogadasParaPeca,
  selecionarPeca,
  executarJogada,
} from "./logic";

describe("Quelhas - Tabuleiro Inicial", () => {
  test("deve criar tabuleiro 4x4", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.length).toBe(4);
    expect(tabuleiro[0].length).toBe(4);
  });

  test("jogador 1 deve ter 4 peças na linha 0", () => {
    const tabuleiro = criarTabuleiroInicial();
    const pecasJ1 = tabuleiro[0].filter(c => c?.jogador === 'jogador1');
    expect(pecasJ1.length).toBe(4);
  });

  test("jogador 2 deve ter 4 peças na linha 3", () => {
    const tabuleiro = criarTabuleiroInicial();
    const pecasJ2 = tabuleiro[3].filter(c => c?.jogador === 'jogador2');
    expect(pecasJ2.length).toBe(4);
  });

  test("peças devem ter valores de 1 a 4", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    for (let col = 0; col < 4; col++) {
      expect(tabuleiro[0][col]?.valor).toBe(col + 1);
      expect(tabuleiro[3][col]?.valor).toBe(col + 1);
    }
  });
});

describe("Quelhas - Estado Inicial", () => {
  test("jogador 1 deve começar", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadorAtual).toBe('jogador1');
  });

  test("estado deve ser 'a-jogar'", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.estado).toBe('a-jogar');
  });

  test("objetivos devem estar definidos", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.objetivoJogador1.length).toBe(4);
    expect(estado.objetivoJogador2.length).toBe(4);
  });
});

describe("Quelhas - Movimento de Peças", () => {
  test("peça com valor 1 deve mover 1 casa", () => {
    const tabuleiro = criarTabuleiroInicial();
    const jogadas = getJogadasParaPeca(tabuleiro, { linha: 0, coluna: 0 });
    
    // Peça 1 na posição (0,0) só pode mover para baixo 1 casa
    // (não pode para cima nem esquerda - fora do tabuleiro)
    // (não pode para direita - há peça lá)
    expect(jogadas.length).toBe(1);
    expect(jogadas[0]).toEqual({ linha: 1, coluna: 0 });
  });

  test("peça com valor 2 deve mover 2 casas", () => {
    const tabuleiro = criarTabuleiroInicial();
    const jogadas = getJogadasParaPeca(tabuleiro, { linha: 0, coluna: 1 });
    
    // Peça 2 na posição (0,1) pode mover:
    // - 2 casas para baixo: (2,1) - válido se vazio
    // O resto está bloqueado ou fora
    expect(jogadas.length).toBe(1);
  });

  test("não pode saltar por cima de peças", () => {
    const tabuleiro = criarTabuleiroInicial();
    // Peça 3 na posição (0,2) - precisa mover 3 casas
    // Para baixo: iria para (3,2) mas há peça do jogador 2 lá
    const jogadas = getJogadasParaPeca(tabuleiro, { linha: 0, coluna: 2 });
    
    // Não deve poder mover para baixo (destino ocupado)
    const jogadaBaixo = jogadas.find(j => j.coluna === 2 && j.linha === 3);
    expect(jogadaBaixo).toBeUndefined();
  });
});

describe("Quelhas - Seleção de Peças", () => {
  test("jogador 1 pode selecionar suas peças", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    const novoEstado = selecionarPeca(estado, { linha: 0, coluna: 0 });
    expect(novoEstado.pecaSelecionada).toEqual({ linha: 0, coluna: 0 });
  });

  test("jogador 1 não pode selecionar peças do jogador 2", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    const novoEstado = selecionarPeca(estado, { linha: 3, coluna: 0 });
    expect(novoEstado.pecaSelecionada).toBeNull();
  });
});

