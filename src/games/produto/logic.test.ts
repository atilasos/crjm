import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  encontrarGrupos,
  calcularPontuacao,
  colocarPeca,
  cancelarJogadaEmCurso,
  jogadaComputador,
  getCasasVazias,
} from "./logic";
import { gerarPosicoesValidas, posToKey, TOTAL_CASAS, Celula } from "./types";

describe("Produto - Tabuleiro Hexagonal", () => {
  test("deve gerar 61 posições válidas para hexágono de lado 5", () => {
    const posicoes = gerarPosicoesValidas();
    expect(posicoes.length).toBe(61);
  });

  test("tabuleiro inicial deve ter 61 casas vazias", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.size).toBe(61);
    
    for (const [, celula] of tabuleiro.entries()) {
      expect(celula).toBe('vazia');
    }
  });

  test("centro do tabuleiro deve existir (0,0)", () => {
    const tabuleiro = criarTabuleiroInicial();
    expect(tabuleiro.has("0,0")).toBe(true);
  });
});

describe("Produto - Estado Inicial", () => {
  test("jogador 1 (Pretas) deve começar", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.jogadorAtual).toBe('jogador1');
  });

  test("estado deve ser 'a-jogar'", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.estado).toBe('a-jogar');
  });

  test("primeira jogada deve estar ativa", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.primeiraJogada).toBe(true);
  });

  test("pontuações iniciais devem ser zero", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.pontuacaoPretas.produto).toBe(0);
    expect(estado.pontuacaoBrancas.produto).toBe(0);
  });
});

describe("Produto - Grupos e Pontuação", () => {
  test("encontrar grupo isolado", () => {
    const tabuleiro = criarTabuleiroInicial();
    tabuleiro.set("0,0", 'preta');
    
    const grupos = encontrarGrupos(tabuleiro, 'preta');
    
    expect(grupos.length).toBe(1);
    expect(grupos[0].celulas.length).toBe(1);
  });

  test("encontrar grupos conectados", () => {
    const tabuleiro = criarTabuleiroInicial();
    // Criar grupo de 3 peças conectadas
    tabuleiro.set("0,0", 'preta');
    tabuleiro.set("1,0", 'preta');  // vizinho Este
    tabuleiro.set("0,1", 'preta');  // vizinho Sudeste
    
    const grupos = encontrarGrupos(tabuleiro, 'preta');
    
    expect(grupos.length).toBe(1);
    expect(grupos[0].celulas.length).toBe(3);
  });

  test("encontrar múltiplos grupos separados", () => {
    const tabuleiro = criarTabuleiroInicial();
    // Grupo 1
    tabuleiro.set("0,0", 'preta');
    // Grupo 2 (separado)
    tabuleiro.set("3,0", 'preta');
    
    const grupos = encontrarGrupos(tabuleiro, 'preta');
    
    expect(grupos.length).toBe(2);
  });

  test("calcular pontuação com 2 grupos", () => {
    const tabuleiro = criarTabuleiroInicial();
    // Grupo 1 com 3 peças
    tabuleiro.set("0,0", 'preta');
    tabuleiro.set("1,0", 'preta');
    tabuleiro.set("0,1", 'preta');
    // Grupo 2 com 2 peças
    tabuleiro.set("3,0", 'preta');
    tabuleiro.set("4,0", 'preta');
    
    const pont = calcularPontuacao(tabuleiro, 'preta');
    
    expect(pont.maiorGrupo).toBe(3);
    expect(pont.segundoMaiorGrupo).toBe(2);
    expect(pont.produto).toBe(6); // 3 × 2
    expect(pont.totalPecas).toBe(5);
  });

  test("pontuação é 0 com apenas 1 grupo", () => {
    const tabuleiro = criarTabuleiroInicial();
    tabuleiro.set("0,0", 'preta');
    tabuleiro.set("1,0", 'preta');
    
    const pont = calcularPontuacao(tabuleiro, 'preta');
    
    expect(pont.produto).toBe(0);
    expect(pont.maiorGrupo).toBe(2);
    expect(pont.segundoMaiorGrupo).toBe(0);
  });

  test("pontuação é 0 sem peças", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    const pont = calcularPontuacao(tabuleiro, 'preta');
    
    expect(pont.produto).toBe(0);
    expect(pont.totalPecas).toBe(0);
  });
});

describe("Produto - Exceção de Abertura", () => {
  test("primeira jogada coloca apenas 1 peça", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    estado = colocarPeca(estado, { q: 0, r: 0 }, 'preta');
    
    // Turno deve ter passado para jogador 2
    expect(estado.jogadorAtual).toBe('jogador2');
    expect(estado.primeiraJogada).toBe(false);
    expect(estado.tabuleiro.get("0,0")).toBe('preta');
  });
});

describe("Produto - Jogada Dupla", () => {
  test("jogador deve colocar 2 peças após a abertura", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Primeira jogada (apenas 1 peça)
    estado = colocarPeca(estado, { q: 0, r: 0 }, 'preta');
    expect(estado.jogadorAtual).toBe('jogador2');
    
    // Segunda jogada - primeira peça
    estado = colocarPeca(estado, { q: 1, r: 0 }, 'branca');
    expect(estado.jogadorAtual).toBe('jogador2'); // Ainda é jogador 2
    expect(estado.jogadaEmCurso.pos1).not.toBeNull();
    
    // Segunda jogada - segunda peça
    estado = colocarPeca(estado, { q: 2, r: 0 }, 'branca');
    expect(estado.jogadorAtual).toBe('jogador1'); // Agora passou para jogador 1
    expect(estado.jogadaEmCurso.pos1).toBeNull();
  });

  test("pode colocar peças de qualquer cor", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Primeira jogada
    estado = colocarPeca(estado, { q: 0, r: 0 }, 'preta');
    
    // Jogador 2 coloca uma branca e uma preta (sabotagem!)
    estado = colocarPeca(estado, { q: 1, r: 0 }, 'branca');
    estado = colocarPeca(estado, { q: 2, r: 0 }, 'preta');
    
    expect(estado.tabuleiro.get("1,0")).toBe('branca');
    expect(estado.tabuleiro.get("2,0")).toBe('preta');
  });
});

describe("Produto - Cancelar Jogada", () => {
  test("cancelar jogada em curso deve remover primeira peça", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Primeira jogada
    estado = colocarPeca(estado, { q: 0, r: 0 }, 'preta');
    
    // Jogador 2 coloca primeira peça
    estado = colocarPeca(estado, { q: 1, r: 0 }, 'branca');
    expect(estado.tabuleiro.get("1,0")).toBe('branca');
    
    // Cancelar
    estado = cancelarJogadaEmCurso(estado);
    expect(estado.tabuleiro.get("1,0")).toBe('vazia');
    expect(estado.jogadaEmCurso.pos1).toBeNull();
  });
});

describe("Produto - Sabotagem (Unificação)", () => {
  test("unir grupos do adversário reduz pontuação a 0", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    // Brancas têm 2 grupos separados
    tabuleiro.set("0,0", 'branca');
    tabuleiro.set("1,0", 'branca');
    // Grupo 2
    tabuleiro.set("3,0", 'branca');
    tabuleiro.set("4,0", 'branca');
    
    const pontAntes = calcularPontuacao(tabuleiro, 'branca');
    expect(pontAntes.produto).toBe(4); // 2 × 2
    
    // Jogador preto une os grupos colocando peças brancas no meio
    tabuleiro.set("2,0", 'branca');
    
    const pontDepois = calcularPontuacao(tabuleiro, 'branca');
    expect(pontDepois.produto).toBe(0); // Apenas 1 grupo agora
    expect(pontDepois.maiorGrupo).toBe(5);
  });
});

describe("Produto - IA", () => {
  test("IA deve fazer jogada válida na abertura", () => {
    let estado = criarEstadoInicial('vs-computador');
    
    const estadoAposIA = jogadaComputador(estado);
    
    expect(estadoAposIA.jogadorAtual).toBe('jogador2');
    expect(estadoAposIA.primeiraJogada).toBe(false);
  });

  test("IA deve fazer jogada dupla após abertura", () => {
    let estado = criarEstadoInicial('vs-computador');
    
    // Humano faz primeira jogada
    estado = colocarPeca(estado, { q: 0, r: 0 }, 'preta');
    expect(estado.jogadorAtual).toBe('jogador2');
    
    // IA joga
    const estadoAposIA = jogadaComputador(estado);
    
    // IA deve ter colocado 2 peças e passado o turno
    expect(estadoAposIA.jogadorAtual).toBe('jogador1');
    
    // Deve haver pelo menos 3 peças no tabuleiro agora
    const casasOcupadas = 61 - estadoAposIA.casasVazias.length;
    expect(casasOcupadas).toBe(3); // 1 da abertura + 2 da IA
  });
});

describe("Produto - Fim de Jogo", () => {
  test("jogo termina quando tabuleiro está cheio", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Simular preenchimento do tabuleiro
    const posicoes = gerarPosicoesValidas();
    
    // Primeira jogada
    estado = colocarPeca(estado, posicoes[0], 'preta');
    
    // Preencher resto alternando
    let idx = 1;
    while (estado.casasVazias.length > 0 && estado.estado === 'a-jogar') {
      const pos = estado.casasVazias[0];
      const cor: 'preta' | 'branca' = idx % 4 < 2 ? 'preta' : 'branca';
      estado = colocarPeca(estado, pos, cor);
      idx++;
    }
    
    // Jogo deve ter terminado
    expect(['vitoria-jogador1', 'vitoria-jogador2', 'empate']).toContain(estado.estado);
  });
});

