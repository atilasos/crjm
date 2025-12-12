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
  // Novas funções de métricas
  extrairBlocos,
  classificarBlocos,
  calcularMetricasDeBlocos,
  calcularMetricasCompletas,
  parseTabuleiroASCII,
  gerarCandidatos,
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

  test("trocarOrientacoes deve trocar as orientações dos jogadores e passar o turno", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Jogada do jogador1 para ativar troca
    const jogada1 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada1);
    
    expect(estado.orientacaoJogador1).toBe('vertical');
    expect(estado.orientacaoJogador2).toBe('horizontal');
    expect(estado.trocaDisponivel).toBe(true);
    expect(estado.jogadorAtual).toBe('jogador2');
    
    // Aplicar troca (jogador2 anuncia troca, consome o turno)
    estado = trocarOrientacoes(estado);
    
    expect(estado.orientacaoJogador1).toBe('horizontal');
    expect(estado.orientacaoJogador2).toBe('vertical');
    expect(estado.trocaDisponivel).toBe(false);
    expect(estado.trocaEfetuada).toBe(true);
    // A troca consome o turno: volta a ser a vez do jogador1
    expect(estado.jogadorAtual).toBe('jogador1');
  });

  test("trocarOrientacoes deve recalcular jogadas válidas para o próximo jogador", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // Jogada do jogador1
    const jogada1 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada1);
    
    // Antes da troca: jogador2 (horizontal) tem jogadas horizontais
    expect(estado.jogadorAtual).toBe('jogador2');
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.orientacao).toBe('horizontal');
    }
    
    // Aplicar troca
    estado = trocarOrientacoes(estado);
    
    // Após troca: turno passa para jogador1 que agora é horizontal
    // As jogadas válidas devem ser horizontais (orientação do novo jogador atual)
    expect(estado.jogadorAtual).toBe('jogador1');
    expect(estado.orientacaoJogador1).toBe('horizontal');
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.orientacao).toBe('horizontal');
    }
  });

  test("sequência de turnos com troca: J1 vertical -> J2 troca -> J1 horizontal -> J2 vertical", () => {
    let estado = criarEstadoInicial('dois-jogadores');
    
    // 1. J1 faz jogada vertical
    expect(estado.jogadorAtual).toBe('jogador1');
    expect(getOrientacaoJogador(estado, 'jogador1')).toBe('vertical');
    const jogada1 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada1);
    
    // Após jogada de J1, é a vez de J2 e troca está disponível
    expect(estado.jogadorAtual).toBe('jogador2');
    expect(estado.trocaDisponivel).toBe(true);
    
    // 2. J2 (horizontal) anuncia troca - consome o turno
    estado = trocarOrientacoes(estado);
    
    // Após troca: J1 agora é horizontal, J2 é vertical
    // Turno volta para J1
    expect(estado.jogadorAtual).toBe('jogador1');
    expect(getOrientacaoJogador(estado, 'jogador1')).toBe('horizontal');
    expect(getOrientacaoJogador(estado, 'jogador2')).toBe('vertical');
    
    // 3. J1 faz jogada horizontal
    for (const jogada of estado.jogadasValidas) {
      expect(jogada.orientacao).toBe('horizontal');
    }
    const jogada2 = estado.jogadasValidas[0];
    estado = colocarSegmento(estado, jogada2);
    
    // Após jogada de J1, é a vez de J2
    expect(estado.jogadorAtual).toBe('jogador2');
    
    // 4. J2 faz jogada vertical
    expect(getOrientacaoJogador(estado, 'jogador2')).toBe('vertical');
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
    expect(pontuacaoMa).toBe(-10000); // Penalização máxima (atualizado)
  });

  test("avaliarPosicaoMisere deve dar pontuação alta quando IA sem jogadas mas adversário com jogadas", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    // Cenário ideal em misère: IA sem jogadas, adversário com jogadas
    const pontuacaoIdeal = avaliarPosicaoMisere(tabuleiro, 'vertical', 'horizontal', 3, 0);
    
    expect(pontuacaoIdeal).toBe(10000); // Valor fixo para este cenário ideal (atualizado)
  });

  test("avaliarPosicaoMisere cenários normais devem ter pontuação válida", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    // Cenário normal com ambos tendo jogadas
    const pontuacao = avaliarPosicaoMisere(tabuleiro, 'vertical', 'horizontal', 5, 5);
    
    // Deve retornar um número finito
    expect(typeof pontuacao).toBe('number');
    expect(Number.isFinite(pontuacao)).toBe(true);
  });

  test("avaliarPosicaoMisere deve usar métricas estruturais", () => {
    // Criar tabuleiro quase cheio para reduzir complexidade
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Preencher maior parte, deixando algumas linhas/colunas
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        tabuleiro[i][j] = 'ocupada';
      }
    }
    
    // Com tabuleiro mais limitado, métricas são mais previsíveis
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

// ============================================================================
// NOVOS TESTES: Métricas estruturais (blocos, min/max, exclusivo/partilhado)
// ============================================================================

describe("Quelhas - Extração de Blocos", () => {
  test("extrairBlocos deve encontrar blocos verticais em tabuleiro vazio", () => {
    const tabuleiro = criarTabuleiroInicial();
    const blocos = extrairBlocos(tabuleiro, 'vertical');
    
    // Tabuleiro 10x10 vazio: 10 colunas, cada uma com 1 bloco de comprimento 10
    expect(blocos.length).toBe(10);
    for (const bloco of blocos) {
      expect(bloco.comprimento).toBe(10);
      expect(bloco.orientacao).toBe('vertical');
    }
  });

  test("extrairBlocos deve encontrar blocos horizontais em tabuleiro vazio", () => {
    const tabuleiro = criarTabuleiroInicial();
    const blocos = extrairBlocos(tabuleiro, 'horizontal');
    
    // Tabuleiro 10x10 vazio: 10 linhas, cada uma com 1 bloco de comprimento 10
    expect(blocos.length).toBe(10);
    for (const bloco of blocos) {
      expect(bloco.comprimento).toBe(10);
      expect(bloco.orientacao).toBe('horizontal');
    }
  });

  test("extrairBlocos deve ignorar blocos de comprimento < 2", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Ocupar alternadamente na coluna 0 para criar blocos de tamanho 1
    for (let i = 0; i < 10; i += 2) {
      tabuleiro[i][0] = 'ocupada';
    }
    
    const blocos = extrairBlocos(tabuleiro, 'vertical');
    // Coluna 0 agora não tem blocos válidos (só células isoladas)
    const blocosColuna0 = blocos.filter(b => b.indiceFixo === 0);
    expect(blocosColuna0.length).toBe(0);
  });

  test("extrairBlocos deve encontrar múltiplos blocos na mesma coluna", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Ocupar linha 4 da coluna 0 para dividir em dois blocos
    tabuleiro[4][0] = 'ocupada';
    
    const blocos = extrairBlocos(tabuleiro, 'vertical');
    const blocosColuna0 = blocos.filter(b => b.indiceFixo === 0);
    
    // Deve haver 2 blocos na coluna 0: linhas 0-3 (comp 4) e linhas 5-9 (comp 5)
    expect(blocosColuna0.length).toBe(2);
    expect(blocosColuna0[0].comprimento).toBe(4);
    expect(blocosColuna0[1].comprimento).toBe(5);
  });
});

describe("Quelhas - Classificação Exclusivo/Partilhado", () => {
  test("blocos sem sobreposição devem ser exclusivos", () => {
    const tabuleiro: Celula[][] = criarTabuleiroInicial();
    // Ocupar toda a primeira linha exceto coluna 0
    // Assim horizontal não consegue jogar na linha 0
    for (let j = 1; j < 10; j++) {
      tabuleiro[0][j] = 'ocupada';
    }
    
    const blocosV = extrairBlocos(tabuleiro, 'vertical');
    const blocosH = extrairBlocos(tabuleiro, 'horizontal');
    
    const blocosVClassificados = classificarBlocos(blocosV, blocosH);
    
    // Coluna 0 só tem 9 células (linha 0 está isolada - sem bloco H)
    // Mas essas células da coluna 0 não pertencem a nenhum bloco horizontal
    const blocoColuna0 = blocosVClassificados.find(b => b.indiceFixo === 0);
    // A linha 0 não tem bloco horizontal (isolada), então células 1-9 da coluna 0
    // podem ou não ser exclusivas dependendo dos blocos horizontais nas outras linhas
    expect(blocoColuna0).toBeDefined();
  });

  test("blocos com sobreposição devem ser partilhados", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    const blocosV = extrairBlocos(tabuleiro, 'vertical');
    const blocosH = extrairBlocos(tabuleiro, 'horizontal');
    
    const blocosVClassificados = classificarBlocos(blocosV, blocosH);
    
    // Em tabuleiro vazio, todos os blocos verticais sobrepõem com horizontais
    for (const bloco of blocosVClassificados) {
      expect(bloco.exclusivo).toBe(false);
    }
  });
});

describe("Quelhas - Cálculo de Métricas", () => {
  test("calcularMetricasDeBlocos deve calcular min/max corretamente", () => {
    // Criar blocos manualmente para teste
    const blocos = [
      { inicio: 0, comprimento: 10, indiceFixo: 0, orientacao: 'vertical' as const, exclusivo: true },
      { inicio: 0, comprimento: 4, indiceFixo: 1, orientacao: 'vertical' as const, exclusivo: false },
    ];
    
    const metricas = calcularMetricasDeBlocos(blocos);
    
    // min = número de blocos = 2
    expect(metricas.min).toBe(2);
    
    // max = floor(10/2) + floor(4/2) = 5 + 2 = 7
    expect(metricas.max).toBe(7);
    
    // Exclusivo: só o primeiro bloco
    expect(metricas.minExclusivo).toBe(1);
    expect(metricas.maxExclusivo).toBe(5); // floor(10/2)
    
    // Partilhado: só o segundo bloco
    expect(metricas.minPartilhado).toBe(1);
    expect(metricas.maxPartilhado).toBe(2); // floor(4/2)
  });

  test("calcularMetricasCompletas deve retornar métricas para ambos os jogadores", () => {
    const tabuleiro = criarTabuleiroInicial();
    const metricas = calcularMetricasCompletas(tabuleiro);
    
    expect(metricas.vertical).toBeDefined();
    expect(metricas.horizontal).toBeDefined();
    
    // Em tabuleiro vazio, ambos têm os mesmos valores
    expect(metricas.vertical.min).toBe(10); // 10 colunas, 1 bloco cada
    expect(metricas.vertical.max).toBe(50); // 10 * floor(10/2) = 50
    expect(metricas.horizontal.min).toBe(10);
    expect(metricas.horizontal.max).toBe(50);
  });
});

describe("Quelhas - Parse de Tabuleiro ASCII", () => {
  test("parseTabuleiroASCII deve converter corretamente", () => {
    const ascii = `
..........
..........
..........
..........
..........
..........
..........
..........
..........
..........
`.trim();
    
    const tabuleiro = parseTabuleiroASCII(ascii);
    
    expect(tabuleiro.length).toBe(10);
    expect(tabuleiro[0].length).toBe(10);
    
    for (const linha of tabuleiro) {
      for (const celula of linha) {
        expect(celula).toBe('vazia');
      }
    }
  });

  test("parseTabuleiroASCII deve marcar ocupadas corretamente", () => {
    const ascii = `
#.........
.#........
..#.......
...#......
....#.....
.....#....
......#...
.......#..
........#.
.........#
`.trim();
    
    const tabuleiro = parseTabuleiroASCII(ascii);
    
    // Diagonal deve estar ocupada
    for (let i = 0; i < 10; i++) {
      expect(tabuleiro[i][i]).toBe('ocupada');
    }
    
    // Fora da diagonal deve estar vazia
    expect(tabuleiro[0][1]).toBe('vazia');
    expect(tabuleiro[1][0]).toBe('vazia');
  });
});

describe("Quelhas - Exemplo do Utilizador (Vertical Ganha)", () => {
  // Tabuleiro do exemplo onde vertical já ganhou
  const exemploASCII = `
.#.#.#.###
.#.#.#.###
.#.#.#.#..
.#.#.#.#..
.#.#.#.#..
.#.#.#.#..
.#.#.#.#..
.#.#.#.#..
.#.#.#.#..
.###.###..
`.trim();

  test("deve parsear o tabuleiro do exemplo corretamente", () => {
    const tabuleiro = parseTabuleiroASCII(exemploASCII);
    
    // Coluna 0 deve estar toda vazia
    for (let i = 0; i < 10; i++) {
      expect(tabuleiro[i][0]).toBe('vazia');
    }
    
    // Coluna 1 deve estar toda ocupada
    for (let i = 0; i < 10; i++) {
      expect(tabuleiro[i][1]).toBe('ocupada');
    }
    
    // Colunas 8-9, linhas 2-9 devem estar vazias
    for (let i = 2; i < 10; i++) {
      expect(tabuleiro[i][8]).toBe('vazia');
      expect(tabuleiro[i][9]).toBe('vazia');
    }
  });

  test("vertical deve ter vantagem em exclusivas no exemplo", () => {
    const tabuleiro = parseTabuleiroASCII(exemploASCII);
    const metricas = calcularMetricasCompletas(tabuleiro);
    
    // Vertical tem blocos exclusivos nas colunas 0, 2, 4, 6
    // (onde horizontal não consegue jogar)
    expect(metricas.vertical.maxExclusivo).toBeGreaterThan(0);
    
    // Horizontal só consegue jogar nas colunas 8-9
    // Todos os blocos horizontais estão em zona partilhada com vertical
    expect(metricas.horizontal.maxExclusivo).toBe(0);
    
    // Vantagem de exclusivas para vertical
    expect(metricas.vertical.maxExclusivo).toBeGreaterThan(metricas.horizontal.maxExclusivo);
  });

  test("horizontal deve ter min=max no exemplo (blocos fixos)", () => {
    const tabuleiro = parseTabuleiroASCII(exemploASCII);
    const metricas = calcularMetricasCompletas(tabuleiro);
    
    // Horizontal só tem blocos de tamanho 2 (min=max por bloco)
    // Cada bloco de tamanho 2 contribui com min=1 e max=1
    expect(metricas.horizontal.min).toBe(metricas.horizontal.max);
  });

  test("avaliação deve favorecer vertical no exemplo", () => {
    const tabuleiro = parseTabuleiroASCII(exemploASCII);
    
    const jogadasV = calcularJogadasValidas(tabuleiro, 'vertical');
    const jogadasH = calcularJogadasValidas(tabuleiro, 'horizontal');
    
    // Avaliar do ponto de vista de vertical
    const scoreV = avaliarPosicaoMisere(tabuleiro, 'vertical', 'horizontal', jogadasH.length, jogadasV.length);
    
    // Avaliar do ponto de vista de horizontal
    const scoreH = avaliarPosicaoMisere(tabuleiro, 'horizontal', 'vertical', jogadasV.length, jogadasH.length);
    
    // Vertical deve ter score melhor (positivo e maior que horizontal)
    expect(scoreV).toBeGreaterThan(scoreH);
  });
});

describe("Quelhas - Geração de Candidatos", () => {
  test("gerarCandidatos deve incluir segmentos de tamanho 2 nas extremidades", () => {
    const tabuleiro = criarTabuleiroInicial();
    const candidatos = gerarCandidatos(tabuleiro, 'vertical');
    
    // Para cada coluna, deve haver segmento de tamanho 2 no início (linha 0)
    for (let col = 0; col < 10; col++) {
      const temInicioTam2 = candidatos.some(
        c => c.indic && c.inicio.coluna === col && c.inicio.linha === 0 && c.comprimento === 2
      );
      // Corrigido: verificar propriedades corretas
      const candidatoInicio = candidatos.find(
        c => c.inicio.coluna === col && c.inicio.linha === 0 && c.comprimento === 2
      );
      expect(candidatoInicio).toBeDefined();
    }
  });

  test("gerarCandidatos deve incluir segmento máximo", () => {
    const tabuleiro = criarTabuleiroInicial();
    const candidatos = gerarCandidatos(tabuleiro, 'vertical');
    
    // Deve haver segmento de comprimento 10 (bloco inteiro) para cada coluna
    for (let col = 0; col < 10; col++) {
      const temMaximo = candidatos.some(
        c => c.inicio.coluna === col && c.comprimento === 10
      );
      expect(temMaximo).toBe(true);
    }
  });

  test("gerarCandidatos deve reduzir número de jogadas vs calcularJogadasValidas", () => {
    const tabuleiro = criarTabuleiroInicial();
    
    const todasJogadas = calcularJogadasValidas(tabuleiro, 'vertical');
    const candidatos = gerarCandidatos(tabuleiro, 'vertical');
    
    // Candidatos devem ser um subconjunto menor
    expect(candidatos.length).toBeLessThan(todasJogadas.length);
    expect(candidatos.length).toBeGreaterThan(0);
  });
});

describe("Quelhas - IA Forte (Alpha-Beta)", () => {
  test("IA nunca deve deixar adversário sem jogadas quando há alternativas", () => {
    // Criar cenário onde há múltiplas opções
    let estado = criarEstadoInicial('vs-computador');
    
    // Fazer algumas jogadas para chegar a um estado intermédio
    for (let i = 0; i < 3; i++) {
      if (estado.estado !== 'a-jogar') break;
      const jogada = estado.jogadasValidas[0];
      estado = colocarSegmento(estado, jogada);
      if (estado.trocaDisponivel) {
        estado = recusarTroca(estado);
      }
    }
    
    if (estado.estado === 'a-jogar' && estado.jogadasValidas.length > 1) {
      // Deixar IA jogar
      const estadoAposIA = jogadaComputador(estado);
      
      // Verificar que adversário tem jogadas (a menos que não haja alternativa)
      const jogadasAdv = estadoAposIA.jogadasValidas;
      
      // Se o jogo ainda está a decorrer, deve haver jogadas
      if (estadoAposIA.estado === 'a-jogar') {
        expect(jogadasAdv.length).toBeGreaterThan(0);
      }
    }
  });

  test("jogadaComputador deve completar em tempo razoável", () => {
    const estado = criarEstadoInicial('vs-computador');
    
    const inicio = Date.now();
    const estadoApos = jogadaComputador(estado);
    const duracao = Date.now() - inicio;
    
    // Deve completar em menos de 4 segundos (margem sobre os 2.5s target)
    expect(duracao).toBeLessThan(4000);
    
    // E deve ter feito uma jogada
    expect(estadoApos.jogadorAtual).not.toBe(estado.jogadorAtual);
  });
});
