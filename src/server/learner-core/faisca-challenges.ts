import { criarEstadoInicial, colocarPeca, getDestino, isJogadaValida } from '../../games/faisca/logic';
import type { Casa, Distancia, Jogada } from '../../games/faisca/types';
import type { StrategySolution } from './strategy-challenges';

// Legal prefixes of the championship's worked example, followed by b3 → a3.
const EXAMPLE = ['f3', 'c3', 'c1', 'f1', 'f2', 'c2', 'c5', 'f5', 'f4', 'c4', 'a4', 'a2', 'a5', 'b5', 'b4', 'd4', 'd1', 'e1', 'b1', 'b2', 'b3', 'a3'];
const SITUATIONS = [
  { family: 'opening', prefix: 0, choices: [['a1', 'a0'], ['a1', 'b1'], ['f5', 'g5']],
    skill: 'Abrir com um destino válido', hint: 'A casa inicial é livre, mas a seta também tem de terminar dentro do tabuleiro.',
    explanation: 'Mesmo na abertura, o destino tem de estar vazio e dentro do tabuleiro. Uma seta para fora não inicia a partida.' },
  { family: 'required', prefix: 1, choices: [['a1', 'b1'], ['c3', 'f3'], ['c3', 'c1']],
    skill: 'Respeitar a casa obrigatória', hint: 'A peça anterior indica onde tens de colocar a tua. Depois verifica o destino.',
    explanation: 'A colocação tem de partir da casa obrigatória. Não podes escolher outra casa nem apontar para uma casa ocupada.' },
  { family: 'jump', prefix: 11, choices: [['a2', 'a5'], ['a2', 'a4'], ['a2', 'c2']],
    skill: 'Saltar sobre casas ocupadas', hint: 'Verifica a casa onde a seta termina. As casas intermédias não impedem o salto.',
    explanation: 'É permitido saltar sobre uma peça. O salto de distância 3 passa por uma casa ocupada e termina numa casa vazia.' },
  { family: 'occupied', prefix: 5, choices: [['c2', 'c3'], ['c2', 'f2'], ['c2', 'b2']],
    skill: 'Distinguir passagem de destino', hint: 'Uma casa ocupada pode ficar pelo caminho, mas nunca pode ser o destino.',
    explanation: 'As duas setas para casas ocupadas são inválidas. A seta para a casa vazia deixa lá a próxima colocação obrigatória.' },
  { family: 'inventory', prefix: 20, choices: [['b3', 'e3'], ['b3', 'd3'], ['b3', 'b4']],
    skill: 'Relacionar reservas e distâncias', hint: 'Consulta as reservas de quem joga. Uma seta geométrica possível pode exigir uma peça já esgotada.',
    explanation: 'Azul já gastou as cinco peças de distância 3. A jogada de distância 2 usa uma peça disponível e aponta para uma casa vazia.' },
  { family: 'terminal', prefix: 21, choices: [['a3', 'd3'], ['a3', 'a1'], ['a3', 'a4']],
    skill: 'Deixar o adversário sem resposta', hint: 'Depois de cada seta, procura destinos vazios a distâncias que o adversário ainda tem.',
    explanation: 'A seta de distância 2 deixa Azul sem destino válido com as peças que lhe restam. Vermelho vence; apontar para a outra casa vazia permite continuar.' },
] as const;

function coordinate(casa: Casa): string {
  return `${String.fromCharCode(97 + casa.coluna)}${5 - casa.linha}`;
}

/** Mirrors change the position, never the evidence family. Solutions use public game actions. */
export function getFaiscaChallenge(variant: number): StrategySolution {
  const situation = SITUATIONS[variant % SITUATIONS.length]!;
  const reflection = Math.floor(variant / SITUATIONS.length);
  const casa = (text: string): Casa => ({
    linha: reflection & 2 ? Number(text[1]) - 1 : 5 - Number(text[1]),
    coluna: reflection & 1 ? 5 - (text.charCodeAt(0) - 97) : text.charCodeAt(0) - 97,
  });
  const move = ([from, to]: readonly [string, string]): Jogada => {
    const start = casa(from), end = casa(to);
    return { casa: start, distancia: (Math.abs(end.linha - start.linha) + Math.abs(end.coluna - start.coluna)) as Distancia,
      direcao: end.linha < start.linha ? 'cima' : end.linha > start.linha ? 'baixo' : end.coluna < start.coluna ? 'esquerda' : 'direita' };
  };
  let state = criarEstadoInicial();
  for (let i = 0; i < situation.prefix; i++) {
    const next = colocarPeca(state, move([EXAMPLE[i]!, EXAMPLE[i + 1]!]));
    if (next === state) throw new Error('invalid Faísca learning sequence');
    state = next;
  }
  const moves = situation.choices.map(move);
  const terminal = situation.family === 'terminal';
  const correct = moves.map((action, i) => ({ i, valid: isJogadaValida(state, action)
    && (!terminal || colocarPeca(state, action).estado !== 'a-jogar') })).filter(item => item.valid);
  if (correct.length !== 1) throw new Error('ambiguous Faísca challenge');
  const answer = correct[0]!.i;
  const next = colocarPeca(state, moves[answer]!);
  const target = coordinate(next.casaObrigatoria!);
  const occupied = state.tabuleiro.flatMap((row, linha) => row.flatMap((cell, coluna) => cell ? [coordinate({ linha, coluna })] : []));
  const reserve = state.reservas[state.jogadorAtual];
  const predictions = terminal
    ? ['Vermelho vence.', 'Azul vence.', 'A partida continua.']
    : [`Próxima casa: ${target}.`, `Próxima casa: ${coordinate(moves[answer]!.casa)}.`, 'A próxima colocação é livre.'];
  const options = moves.map((action, i) => ({ id: String(i), label: `De ${coordinate(action.casa)} para ${coordinate(getDestino(action))} (distância ${action.distancia})` }));
  // Change the display order without changing the stable answer identifiers.
  if (variant % 2) options.reverse();
  return {
    challenge: {
      id: `strategy-v1:faisca:${variant}`, gameId: 'faisca', familyId: `faisca:${situation.family}`,
      skill: situation.skill, prompt: 'Lê a posição de Faísca, escolhe uma seta e prevê a consequência.',
      facts: [state.jogadorAtual === 'jogador1' ? 'Jogas com Azul.' : 'Jogas com Vermelho.',
        state.casaObrigatoria ? `Casa obrigatória: ${coordinate(state.casaObrigatoria)}.` : 'A primeira colocação é livre.',
        `As tuas reservas: distância 1 = ${reserve[1]}; distância 2 = ${reserve[2]}; distância 3 = ${reserve[3]}.`,
        ...(terminal ? [`Reservas de Azul: distância 1 = ${next.reservas.jogador1[1]}; distância 2 = ${next.reservas.jogador1[2]}; distância 3 = ${next.reservas.jogador1[3]}.`] : []),
        occupied.length ? `Casas ocupadas: ${occupied.join(', ')}.` : 'O tabuleiro está vazio.'],
      question: terminal ? 'Qual destas setas termina a partida com a tua vitória?' : 'Qual destas setas é válida?', options,
      prediction: 'O que acontece depois da seta que escolheste?',
      predictions: predictions.map((label, i) => ({ id: String(i), label })).sort((a, b) => variant % 2 ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id)),
      diagram: {
        rows: state.tabuleiro.map((row, linha) => row.map((cell, coluna) => cell ? cell.jogador === 'jogador1' ? 'X' : 'O'
          : state.casaObrigatoria?.linha === linha && state.casaObrigatoria.coluna === coluna ? '*' : '.').join('')),
        caption: 'Colunas a–f da esquerda para a direita; linhas 5–1 de cima para baixo. Disco escuro = Azul; claro = Vermelho; estrela = casa obrigatória.',
      },
    },
    answer: String(answer), prediction: '0', hint: situation.hint, explanation: situation.explanation,
  };
}
