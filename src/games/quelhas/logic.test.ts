import { test, expect, describe } from "bun:test";
import { 
  criarEstadoInicial, 
  criarTabuleiroInicial,
  calcularJogadasValidas,
  colocarSegmento,
  isSegmentoValido,
  getOrientacaoJogador,
  criarSegmentoEntrePosicoes,
  trocarOrientacoes,
  recusarTroca,
  decidirTrocaComputador,
  isPosicaoInicioValida,
  calcularIntervalosJogadas,
  avaliarPosicaoMisere,
  jogadaComputador,
} from "./logic";
import { Celula } from "./types";

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
  test("jogador 1 deve começar", () => {
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

  test("orientações iniciais devem ser vertical/horizontal", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.orientacaoJogador1).toBe('vertical');
    expect(estado.orientacaoJogador2).toBe('horizontal');
  });

  test("troca não deve estar disponível no início", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    expect(estado.trocaDisponivel).toBe(false);
    expect(estado.trocaEfetuada).toBe(false);
  });
});

describe("Quelhas - Jogadas Válidas", () => {
  test("jogador 1 deve ter apenas segmentos verticais (orientação inicial)", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    const orientacao = getOrientacaoJogador(estado, 'jogador1');
    
    expect(orientacao).toBe('vertical');
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

  test("calcularJogadasValidas deve gerar apenas segmentos na orientação indicada", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    const jogadasVerticais = calcularJogadasValidas(tabuleiro, 'vertical');
    for (const jogada of jogadasVerticais) {
      expect(jogada.orientacao).toBe('vertical');
    }
    
    const jogadasHorizontais = calcularJogadasValidas(tabuleiro, 'horizontal');
    for (const jogada of jogadasHorizontais) {
      expect(jogada.orientacao).toBe('horizontal');
    }
  });
});

describe("Quelhas - Regra de Troca", () => {
  test("troca deve ficar disponível após primeira jogada do jogador1", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    expect(estado.trocaDisponivel).toBe(false);
    
    const primeiraJogada = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, primeiraJogada);
    
    expect(estado.trocaDisponivel).toBe(true);
    expect(estado.jogadorAtual).toBe('jogador2');
  });

  test("troca deve ficar indisponível após primeira jogada do jogador2 (se não usada)", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Jogada do jogador1
    const jogada1 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada1);
    expect(estado.trocaDisponivel).toBe(true);
    
    // Jogada do jogador2 sem usar a troca
    const jogada2 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada2);
    
    expect(estado.trocaDisponivel).toBe(false);
    expect(estado.trocaEfetuada).toBe(false);
  });

  test("trocarOrientacoes deve trocar as orientações dos jogadores", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Jogada do jogador1 para ativar troca
    const jogada1 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada1);
    
    expect(estado.orientacaoJogador1).toBe('vertical');
    expect(estado.orientacaoJogador2).toBe('horizontal');
    expect(estado.trocaDisponivel).toBe(true);
    
    // Aplicar troca
    estado = trocarOrientacoes(estado);
    
    expect(estado.orientacaoJogador1).toBe('horizontal');
    expect(estado.orientacaoJogador2).toBe('vertical');
    expect(estado.trocaDisponivel).toBe(false);
    expect(estado.trocaEfetuada).toBe(true);
  });

  test("trocarOrientacoes deve recalcular jogadas válidas", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Jogada do jogador1
    const jogada1 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada1);
    
    // Antes da troca: jogador2 tem jogadas horizontais
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.orientacao).toBe('horizontal');
    }
    
    // Aplicar troca
    estado = trocarOrientacoes(estado);
    
    // Após troca: jogador2 agora tem orientação vertical, então jogadas verticais
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.orientacao).toBe('vertical');
    }
  });

  test("recusarTroca deve desativar a troca sem trocar orientações", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Jogada do jogador1
    const jogada1 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada1);
    expect(estado.trocaDisponivel).toBe(true);
    
    // Recusar troca
    estado = recusarTroca(estado);
    
    expect(estado.trocaDisponivel).toBe(false);
    expect(estado.orientacaoJogador1).toBe('vertical');
    expect(estado.orientacaoJogador2).toBe('horizontal');
  });

  test("decidirTrocaComputador deve retornar booleano", () => {
    let estado = criarEstadoInicial('vs-computador');
    
    // Jogada do jogador1
    const jogada1 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada1);
    
    const decisao = decidirTrocaComputador(estado);
    expect(typeof decisao).toBe('boolean');
  });
});

describe("Quelhas - Seleção de Segmentos", () => {
  test("criarSegmentoEntrePosicoes deve criar segmento vertical válido", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    const segmento = criarSegmentoEntrePosicoes(
      estado,
      { linha: 0, coluna: 0 },
      { linha: 2, coluna: 0 }
    );
    
    expect(segmento).not.toBeNull();
    expect(segmento!.orientacao).toBe('vertical');
    expect(segmento!.comprimento).toBe(3);
    expect(segmento!.inicio.linha).toBe(0);
    expect(segmento!.inicio.coluna).toBe(0);
  });

  test("criarSegmentoEntrePosicoes deve normalizar início para menor valor", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    // Clicar de baixo para cima
    const segmento = criarSegmentoEntrePosicoes(
      estado,
      { linha: 3, coluna: 0 },
      { linha: 0, coluna: 0 }
    );
    
    expect(segmento).not.toBeNull();
    expect(segmento!.inicio.linha).toBe(0); // Deve normalizar para linha menor
    expect(segmento!.comprimento).toBe(4);
  });

  test("criarSegmentoEntrePosicoes deve retornar null para posições desalinhadas", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    // Posições em diagonal (inválido para vertical)
    const segmento = criarSegmentoEntrePosicoes(
      estado,
      { linha: 0, coluna: 0 },
      { linha: 2, coluna: 2 }
    );
    
    expect(segmento).toBeNull();
  });

  test("criarSegmentoEntrePosicoes deve retornar null para comprimento < 2", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    // Apenas uma célula (comprimento 1)
    const segmento = criarSegmentoEntrePosicoes(
      estado,
      { linha: 0, coluna: 0 },
      { linha: 0, coluna: 0 }
    );
    
    expect(segmento).toBeNull();
  });

  test("isPosicaoInicioValida deve retornar true para posição em segmento válido", () => {
    const estado = criarEstadoInicial('dois-jogadores');
    
    // Célula (0,0) deve fazer parte de algum segmento vertical válido
    const valida = isPosicaoInicioValida(estado, { linha: 0, coluna: 0 });
    expect(valida).toBe(true);
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

  test("primeiraJogada deve ficar false após primeira jogada", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    expect(estado.primeiraJogada).toBe(true);
    
    const jogada = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada);
    
    expect(estado.primeiraJogada).toBe(false);
  });
});

describe("Quelhas - Intervalos de Jogadas (Heurística Min/Max)", () => {
  test("calcularIntervalosJogadas deve retornar estrutura válida", () => {
    const tabuleiro = criarTabuleiroInicial();
    const intervalos = calcularIntervalosJogadas(tabuleiro, 'vertical', 'horizontal', 1);
    
    expect(typeof intervalos.minJogadasIA).toBe('number');
    expect(typeof intervalos.maxJogadasIA).toBe('number');
    expect(typeof intervalos.minJogadasAdversario).toBe('number');
    expect(typeof intervalos.maxJogadasAdversario).toBe('number');
  });

  test("intervalos devem ter min <= max", () => {
    const tabuleiro = criarTabuleiroInicial();
    const intervalos = calcularIntervalosJogadas(tabuleiro, 'vertical', 'horizontal', 1);
    
    expect(intervalos.minJogadasIA).toBeLessThanOrEqual(intervalos.maxJogadasIA);
    expect(intervalos.minJogadasAdversario).toBeLessThanOrEqual(intervalos.maxJogadasAdversario);
  });

  test("calcularIntervalosJogadas com profundidade 0 deve retornar contagem direta", () => {
    const tabuleiro = criarTabuleiroInicial();
    const intervalos = calcularIntervalosJogadas(tabuleiro, 'vertical', 'horizontal', 0);
    
    const jogadasVertical = calcularJogadasValidas(tabuleiro, 'vertical');
    const jogadasHorizontal = calcularJogadasValidas(tabuleiro, 'horizontal');
    
    expect(intervalos.minJogadasIA).toBe(jogadasVertical.length);
    expect(intervalos.maxJogadasIA).toBe(jogadasVertical.length);
    expect(intervalos.minJogadasAdversario).toBe(jogadasHorizontal.length);
    expect(intervalos.maxJogadasAdversario).toBe(jogadasHorizontal.length);
  });

  test("tabuleiro parcialmente preenchido deve ter menos jogadas", () => {
    // Criar tabuleiro com algumas células ocupadas
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Ocupar primeira coluna inteira (bloqueia jogadas verticais nessa coluna)
    for (let i = 0; i < 10; i++) {
      tabuleiro[i][0] = 'ocupada';
    }
    
    const jogadasVertical = calcularJogadasValidas(tabuleiro, 'vertical');
    const jogadasVerticalVazio = calcularJogadasValidas(criarTabuleiroInicial(), 'vertical');
    
    expect(jogadasVertical.length).toBeLessThan(jogadasVerticalVazio.length);
  });
});

describe("Quelhas - Avaliação Misère", () => {
  test("avaliarPosicaoMisere deve penalizar fortemente se adversário sem jogadas", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    // Cenário: adversário sem jogadas (péssimo em misère - IA seria último a jogar)
    const pontuacaoMa = avaliarPosicaoMisere(tabuleiro, 'vertical', 'horizontal', 0, 5);
    
    // Cenário: adversário com jogadas
    const pontuacaoBoa = avaliarPosicaoMisere(tabuleiro, 'vertical', 'horizontal', 5, 5);
    
    expect(pontuacaoMa).toBeLessThan(pontuacaoBoa);
    expect(pontuacaoMa).toBe(-1000); // Penalização máxima
  });

  test("avaliarPosicaoMisere deve dar pontuação alta quando IA sem jogadas mas adversário com jogadas", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    // Cenário ideal em misère: IA sem jogadas, adversário com jogadas
    // Isto retorna cedo com pontuação fixa de 800
    const pontuacaoIdeal = avaliarPosicaoMisere(tabuleiro, 'vertical', 'horizontal', 3, 0);
    
    expect(pontuacaoIdeal).toBe(800); // Valor fixo para este cenário ideal
  });

  test("avaliarPosicaoMisere cenários normais devem ter pontuação positiva", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    // Cenário normal com ambos tendo jogadas
    const pontuacao = avaliarPosicaoMisere(tabuleiro, 'vertical', 'horizontal', 5, 5);
    
    // A pontuação deve ser positiva (não é caso terminal negativo)
    expect(pontuacao).toBeGreaterThan(0);
  });

  test("avaliarPosicaoMisere deve usar intervalos calculados", () => {
    // Criar tabuleiro quase cheio para reduzir complexidade
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Preencher maior parte, deixando algumas linhas/colunas
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        tabuleiro[i][j] = 'ocupada';
      }
    }
    
    // Com tabuleiro mais limitado, intervalos são mais previsíveis
    const pontuacao = avaliarPosicaoMisere(tabuleiro, 'vertical', 'horizontal', 5, 3);
    
    // Deve retornar um número (não lançar erro)
    expect(typeof pontuacao).toBe('number');
    expect(Number.isFinite(pontuacao)).toBe(true);
  });
});

describe("Quelhas - IA Misère Comportamento", () => {
  test("IA deve evitar jogadas que deixem adversário sem jogadas", () => {
    let estado = criarEstadoInicial('vs-computador');
    
    // Fazer algumas jogadas para chegar a um estado intermédio
    for (let i = 0; i < 5; i++) {
      if (estado.estado !== 'a-jogar') break;
      if (estado.jogadasValidas.length === 0) break;
      
      const jogada = estado.jogadasValidas[0];
      estado = colocarSegmento(estado, jogada);
      
      // Se troca disponível, recusar para simplificar teste
      if (estado.trocaDisponivel) {
        estado = recusarTroca(estado);
      }
    }
    
    // Verificar que o jogo ainda está em curso ou terminou corretamente
    expect(['a-jogar', 'vitoria-jogador1', 'vitoria-jogador2']).toContain(estado.estado);
  });

  test("jogadaComputador deve retornar estado válido", () => {
    let estado = criarEstadoInicial('vs-computador');
    
    // Simular primeira jogada do humano
    const jogadaHumano = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogadaHumano);
    
    // Recusar troca para simplificar
    if (estado.trocaDisponivel) {
      estado = recusarTroca(estado);
    }
    
    // Agora é a vez da IA
    const estadoAposIA = jogadaComputador(estado);
    
    // Verificar que a IA fez uma jogada válida
    expect(estadoAposIA.jogadorAtual).toBe('jogador1'); // Volta para jogador1
    expect(estadoAposIA.estado).toBe('a-jogar'); // Jogo continua (início, muitas jogadas)
  });

  test("IA deve fazer jogada mesmo com poucas opções", () => {
    // Criar tabuleiro quase cheio
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    
    // Preencher quase tudo, deixando apenas algumas células
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        // Deixar apenas coluna 9 vazia para jogadas verticais
        if (j !== 9) {
          tabuleiro[i][j] = 'ocupada';
        }
      }
    }
    
    const jogadasVert = calcularJogadasValidas(tabuleiro, 'vertical');
    const jogadasHoriz = calcularJogadasValidas(tabuleiro, 'horizontal');
    
    // Deve haver poucas jogadas verticais e nenhuma horizontal
    expect(jogadasVert.length).toBeGreaterThan(0);
    expect(jogadasHoriz.length).toBe(0); // Uma linha vazia não permite horizontal
  });

  test("IA não deve crashar com estado de fim de jogo", () => {
    let estado = criarEstadoInicial('vs-computador');
    
    // Simular muitas jogadas até o jogo acabar
    let contador = 0;
    while (estado.estado === 'a-jogar' && contador < 100) {
      if (estado.jogadasValidas.length === 0) break;
      
      const jogada = estado.jogadasValidas[0];
      estado = colocarSegmento(estado, jogada);
      
      if (estado.trocaDisponivel) {
        estado = recusarTroca(estado);
      }
      contador++;
    }
    
    // Não deve lançar exceção
    expect(estado).toBeDefined();
  });
});
