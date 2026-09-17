import { GAME_CATALOG } from '../../games/catalog';
import type { GameId } from '../../ai-core/types';
import type { StrategyChallenge, StrategyOption } from '../../types/strategy-practice';
import { criarEstadoInicial as createAtari, encontrarGrupo } from '../../games/atari-go/logic';
import { criarEstadoInicial as createNex, executarSubstituicao } from '../../games/nex/logic';

export const STRATEGY_GAMES: GameId[] = GAME_CATALOG.filter(game => (game.capabilities as readonly string[]).includes('strategy')).map(game => game.id);
export const CHALLENGES_PER_GAME = 24;

export interface StrategySolution {
  challenge: StrategyChallenge;
  answer: string;
  prediction: string;
  hint: string;
  explanation: string;
}

function options(values: string[], offset: number): StrategyOption[] {
  const items = values.map((label, i) => ({ id: String(i), label }));
  let seed = Math.imul(offset + 1, 0x45d9f3b);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  const split = (seed >>> 0) % items.length;
  return [...items.slice(split), ...items.slice(0, split)];
}

/** Small, explicit situations; not claims that one heuristic solves the whole game. */
export function getStrategyChallenge(gameId: GameId, variant: number): StrategySolution {
  if (!STRATEGY_GAMES.includes(gameId) || !Number.isInteger(variant) || variant < 0 || variant >= CHALLENGES_PER_GAME) {
    throw new Error('invalid strategy challenge');
  }
  const id = `strategy-v1:${gameId}:${variant}`;
  if (gameId === 'gatos-caes' || gameId === 'dominorio' || gameId === 'quelhas') {
    const mine = 1 + variant % 4;
    const theirs = 1 + Math.floor(variant / 4) % 3;
    const first = variant < 12 ? 0 : 1;
    const remaining = [mine, theirs];
    let current = first;
    let moves = 0;
    while (remaining[current]! > 0) {
      remaining[current]!--;
      moves++;
      current = 1 - current;
    }
    const misere = gameId === 'quelhas';
    const winner = misere ? current : 1 - current;
    const reserve = gameId === 'gatos-caes' ? 'casas exclusivas' : 'jogadas exclusivas';
    const rule = misere ? 'Perde quem faz a última jogada.' : 'Perde quem fica sem jogada no seu turno.';
    return {
      challenge: {
        id, gameId, familyId: `reserves:${first}:${Math.sign(mine - theirs)}`, skill: misere ? 'Ler um final misère' : 'Contar reservas no final',
        prompt: gameId === 'quelhas'
          ? 'Restam apenas bolsas separadas de duas casas. Cada bolsa permite uma única jogada, exclusiva de uma orientação.'
          : 'Restam apenas reservas seguras e separadas. Jogar numa não bloqueia nenhuma outra. Cada jogador gasta uma reserva por turno.',
        facts: [`Tu: ${mine} ${reserve}.`, `Adversário: ${theirs} ${reserve}.`, first === 0 ? 'És tu a começar.' : 'Começa o adversário.', rule],
        question: 'Quem vence com estas reservas?', options: options(['Tu', 'Adversário'], variant),
        prediction: 'Quantas jogadas são feitas até a partida terminar?',
        predictions: options([String(moves), String(moves + 1), String(Math.max(0, moves - 1))], variant + 1),
      },
      answer: String(winner), prediction: '0',
      hint: 'Alterna os turnos e risca uma reserva de cada vez. Para quando o jogador da vez não tiver jogada.',
      explanation: `A sequência termina após ${moves} jogadas. ${current === 0 ? 'Tu ficas' : 'O adversário fica'} sem jogada no seu turno. ${rule}`,
    };
  }
  if (gameId === 'produto') {
    const a = 2 + variant % 4;
    const b = a + 1 + Math.floor(variant / 4);
    const reversed = variant % 2 === 0;
    const sizes = reversed ? [a, b] : [b, a];
    const products = [(sizes[0]! + 2) * sizes[1]!, sizes[0]! * (sizes[1]! + 2)];
    const best = products[0]! > products[1]! ? 0 : 1;
    return {
      challenge: {
        id, gameId, familyId: `product:${b - a}`, skill: 'Comparar o produto dos grupos',
        prompt: 'Tens exatamente dois grupos separados. Podes acrescentar as duas peças a um deles, sem juntar grupos. Compara só estas duas opções.',
        facts: [`Grupo A: ${sizes[0]} peças.`, `Grupo B: ${sizes[1]} peças.`],
        question: 'Qual destas opções dá maior pontuação?',
        options: options(['Acrescentar duas peças ao grupo A', 'Acrescentar duas peças ao grupo B'], variant),
        prediction: 'Qual será a tua pontuação depois dessa escolha?',
        predictions: options([String(products[best]), String(products[1 - best]), String(a * b)], variant + 1),
      },
      answer: String(best), prediction: '0',
      hint: 'Calcula as duas multiplicações. Acrescentar peças ao grupo menor pode aumentar mais o produto.',
      explanation: `Grupo A: ${sizes[0]! + 2} × ${sizes[1]} = ${products[0]}. Grupo B: ${sizes[0]} × ${sizes[1]! + 2} = ${products[1]}. A melhor destas duas opções dá ${products[best]} pontos.`,
    };
  }
  if (gameId === 'atari-go') {
    const state = createAtari('vs-computador');
    const row = 2 + Math.floor(variant / 12);
    const col = 2 + Math.floor(variant / 12);
    const shapeId = Math.floor(variant / 3) % 4;
    const shapes = [[[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0], [1, 1]]];
    const shape = shapes[shapeId]!;
    for (const [dr, dc] of shape) state.tabuleiro[row + dr!]![col + dc!] = 'branca';
    const boundary = new Map<string, [number, number]>();
    for (const [dr, dc] of shape) {
      for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const r = row + dr! + dy!, c = col + dc! + dx!;
        if (state.tabuleiro[r]![c] === 'vazia') boundary.set(`${r},${c}`, [r, c]);
      }
    }
    const open = 1 + variant % 3;
    [...boundary.values()].slice(open).forEach(([r, c]) => { state.tabuleiro[r]![c] = 'preta'; });
    const liberties = encontrarGrupo(state.tabuleiro, { linha: row, coluna: col })!.liberdades.length;
    const rows = state.tabuleiro.map(line => line.map(cell => cell === 'preta' ? 'X' : cell === 'branca' ? 'O' : '.').join(''));
    return {
      challenge: {
        id, gameId, familyId: `liberties:${shapeId}:${liberties}`, skill: 'Contar liberdades antes de atacar',
        prompt: 'Posição de treino: jogam as pretas. Observa o único grupo branco e conta as interseções vazias em contacto direto com ele.', facts: [],
        question: 'É possível capturar já este grupo com uma única pedra?',
        options: options(['Sim', 'Não'], variant),
        prediction: 'Quantas liberdades tem agora o grupo branco?',
        predictions: options(['1', '2', '3'], variant + 1),
        diagram: { rows, caption: 'Pretas: discos escuros. Brancas: discos claros. As diagonais não são liberdades.' },
      },
      answer: liberties === 1 ? '0' : '1', prediction: String(liberties - 1),
      hint: 'Conta cada interseção vazia ao lado do grupo uma só vez. Uma diagonal não conta.',
      explanation: `O grupo tem ${liberties} liberdades. ${liberties === 1 ? 'Ocupar a única liberdade captura o grupo e termina a partida.' : 'Uma pedra só ocupa uma dessas liberdades; ainda sobram liberdades e este grupo não é capturado já.'}`,
    };
  }
  const state = createNex('vs-computador');
  state.primeiraJogada = false;
  const x = 2 + Math.floor(variant / 8);
  const gap1 = 1 + variant % 4;
  const gap2 = 6 + Math.floor(variant / 4) % 2;
  for (let y = 0; y < 11; y++) state.tabuleiro[x]![y] = y === gap1 || y === gap2 ? 'neutra' : 'preta';
  const family = variant % 3;
  let safe = { x: x + 3, y: 2 + variant % 4 };
  let cut = { x, y: 9 };
  if (family === 1) safe = { x: x + 1, y: 4 };
  if (family === 2) {
    state.tabuleiro[x + 1]![8] = 'preta';
    state.tabuleiro[x + 1]![9] = 'preta';
    safe = { x, y: 9 };
    cut = { x, y: 5 };
  } else state.tabuleiro[safe.x]![safe.y] = 'preta';
  const choices = variant % 2 ? [safe, cut] : [cut, safe];
  const winning = choices.map(pos => executarSubstituicao(state, {
    tipo: 'substituicao', neutrasParaProprias: [{ x, y: gap1 }, { x, y: gap2 }], propriaParaNeutra: pos,
  }).estado === 'vitoria-jogador1');
  const correct = winning.indexOf(true);
  if (correct < 0 || winning.filter(Boolean).length !== 1) throw new Error('ambiguous Nex challenge');
  return {
    challenge: {
      id, gameId, familyId: `nex:${family}`, skill: 'Completar uma substituição sem cortar a ligação',
      prompt: 'Posição de treino: jogam as pretas, que ligam y=0 a y=10. Converte as duas neutras em pretas e escolhe qual das tuas pedras passará a neutra.',
      facts: [`As duas neutras estão em (${x}, ${gap1}) e (${x}, ${gap2}).`],
      question: 'Que pedra passas a neutra para vencer nesta ação?',
      options: choices.map((_pos, i) => ({ id: String(i), label: `Pedra ${i + 1}` })),
      prediction: `Se passares a pedra ${choices.findIndex(pos => pos.x === x && pos.y === 9) + 1} a neutra, depois de converter as duas neutras em pretas, fica uma ligação preta completa?`,
      predictions: options(['Sim, a ligação fica completa', 'Não, falta uma casa', 'As peças neutras contam como pretas'], variant),
      diagram: {
        rows: Array.from({ length: 11 }, (_, y) => state.tabuleiro.map((line, column) => {
          const candidate = choices.findIndex(pos => pos.x === column && pos.y === y);
          return candidate >= 0 ? String(candidate + 1) : line[y] === 'preta' ? 'X' : line[y] === 'neutra' ? 'N' : '.';
        }).join('')),
        caption: 'As pedras 1 e 2 são pretas. Cinzento = neutra. Liga o topo à base. Podes deslizar o diagrama para ver todas as casas.',
        hexOffset: true,
      },
    },
    answer: String(correct), prediction: family === 2 ? '0' : '1',
    hint: 'Confirma os três efeitos da substituição. A pedra que retiras da tua cor também pode cortar o caminho.',
    explanation: `Passar a pedra ${correct + 1} a neutra conserva um caminho preto do topo à base. Retirar a pedra ${2 - correct} corta a ligação. A ligação foi verificada pelas regras do jogo.`,
  };
}
