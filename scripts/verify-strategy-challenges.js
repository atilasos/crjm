// Audit artifact. Run: bun run scripts/verify-strategy-challenges.js
// This reads the current catalogue and public game rules; it does not access learner data.
import { getStrategyChallenge, STRATEGY_GAMES } from '../src/server/learner-core/strategy-challenges.ts';
import * as atari from '../src/games/atari-go/logic.ts';
import * as nex from '../src/games/nex/logic.ts';
import * as domino from '../src/games/dominorio/logic.ts';
import * as quelhas from '../src/games/quelhas/logic.ts';

const check = (condition, context) => { if (!condition) throw Error(context); };
const report = [];
for (const gameId of STRATEGY_GAMES) {
  const families = new Set(); let firstCorrect = 0; let ruleChecks = 0;
  for (let variant = 0; variant < 24; variant++) {
    const { challenge: c, answer, prediction } = getStrategyChallenge(gameId, variant);
    const tag = `${gameId}:${variant}`;
    families.add(c.familyId);
    check(c.options.some(o => o.id === answer), `${tag}: missing answer`);
    check(c.predictions.some(o => o.id === prediction), `${tag}: missing prediction`);
    check(new Set(c.options.map(o => o.id)).size === c.options.length, `${tag}: duplicate options`);
    check(new Set(c.predictions.map(o => o.label)).size === c.predictions.length, `${tag}: duplicate predictions`);
    firstCorrect += Number(c.options[0].id === answer);

    if (['gatos-caes', 'dominorio', 'quelhas'].includes(gameId)) {
      // An independent closed-form result for the stated, non-interacting reserves.
      const mine = Number(c.facts[0].match(/\d+/)[0]), theirs = Number(c.facts[1].match(/\d+/)[0]);
      const first = c.facts[2].startsWith('És') ? 0 : 1;
      const moves = first === 0 ? (mine <= theirs ? 2 * mine : 2 * theirs + 1) : (theirs <= mine ? 2 * theirs : 2 * mine + 1);
      const blocked = (first + moves) % 2, winner = gameId === 'quelhas' ? blocked : 1 - blocked;
      check(answer === String(winner), `${tag}: winner`);
      check(Number(c.predictions.find(o => o.id === prediction).label) === moves, `${tag}: move count`);
      if (gameId !== 'gatos-caes') {
        // Construct separated two-cell pockets and finish a real game through its public rules.
        const q = gameId === 'quelhas'; let state = (q ? quelhas : domino).criarEstadoInicial('vs-computador');
        state.tabuleiro.forEach(line => line.fill(q ? 'ocupada' : 'ocupada-vertical'));
        for (let i = 0; i < mine + theirs; i++) {
          const r = 3 * Math.floor(i / 3), col = 3 * (i % 3), vertical = i < mine;
          state.tabuleiro[r][col] = 'vazia'; state.tabuleiro[r + (vertical ? 1 : 0)][col + (vertical ? 0 : 1)] = 'vazia';
        }
        state.jogadorAtual = first === 0 ? 'jogador1' : 'jogador2';
        if (q) { state.primeiraJogada = false; state.jogadasValidas = quelhas.calcularJogadasValidas(state.tabuleiro, first === 0 ? 'vertical' : 'horizontal'); }
        else state.jogadasValidas = domino.calcularJogadasValidas(state.tabuleiro, state.jogadorAtual);
        let plies = 0;
        while (state.estado === 'a-jogar') {
          check(state.jogadasValidas.length > 0 && plies < 20, `${tag}: stalled`);
          state = q ? quelhas.colocarSegmento(state, state.jogadasValidas[0]) : domino.colocarDomino(state, state.jogadasValidas[0]); plies++;
        }
        check(state.estado === `vitoria-jogador${winner + 1}` && plies === moves, `${tag}: rules disagree`); ruleChecks++;
      }
    } else if (gameId === 'produto') {
      // With exactly two groups and no merger, the game's score is their product.
      const a = Number(c.facts[0].match(/\d+/)[0]), b = Number(c.facts[1].match(/\d+/)[0]);
      const scores = [(a + 2) * b, a * (b + 2)], chosen = Number(answer);
      check(scores[chosen] > scores[1 - chosen], `${tag}: product choice`);
      check(Number(c.predictions.find(o => o.id === prediction).label) === scores[chosen], `${tag}: product prediction`);
    } else if (gameId === 'atari-go') {
      // Reconstruct what the pupil sees, enumerate all legal moves and verify actual captures.
      const state = atari.criarEstadoInicial('vs-computador');
      state.tabuleiro = c.diagram.rows.map(line => [...line].map(v => v === 'X' ? 'preta' : v === 'O' ? 'branca' : 'vazia'));
      const groups = atari.encontrarTodosGrupos(state.tabuleiro, 'branca'); check(groups.length === 1, `${tag}: groups`);
      state.jogadasValidas = atari.calcularJogadasValidas(state.tabuleiro, 'jogador1');
      const wins = state.jogadasValidas.filter(pos => atari.colocarPedra(state, pos).estado === 'vitoria-jogador1');
      check(answer === (wins.length > 0 ? '0' : '1'), `${tag}: capture`);
      check(Number(c.predictions.find(o => o.id === prediction).label) === groups[0].liberdades.length, `${tag}: liberties`); ruleChecks++;
    } else {
      // Nex's source board is [x][y], while diagram rows are [y][x]. Markers 1/2 are black stones.
      const state = nex.criarEstadoInicial('vs-computador'); state.primeiraJogada = false;
      const candidates = new Map();
      c.diagram.rows.forEach((line, y) => [...line].forEach((v, x) => { if (v === '1' || v === '2') candidates.set(String(Number(v) - 1), { x, y }); }));
      state.tabuleiro = Array.from({ length: 11 }, (_, x) => c.diagram.rows.map(line => ['X', '1', '2'].includes(line[x]) ? 'preta' : line[x] === 'N' ? 'neutra' : 'vazia'));
      const neutral = state.tabuleiro.flatMap((line, x) => line.flatMap((v, y) => v === 'neutra' ? [{ x, y }] : []));
      check(neutral.length === 2 && candidates.size === 2, `${tag}: markers`);
      const wins = pos => nex.executarSubstituicao(state, { tipo: 'substituicao', neutrasParaProprias: neutral, propriaParaNeutra: pos }).estado === 'vitoria-jogador1';
      const outcomes = c.options.map(o => ({ id: o.id, won: wins(candidates.get(o.id)) }));
      check(outcomes.filter(o => o.won).length === 1 && outcomes.find(o => o.id === answer).won, `${tag}: unique winner`);
      const queried = String(Number(c.prediction.match(/pedra (\d+)/)[1]) - 1);
      check(prediction === (wins(candidates.get(queried)) ? '0' : '1'), `${tag}: prediction`); ruleChecks++;
    }
  }
  report.push({ gameId, checked: 24, families: families.size, firstOptionCorrect: firstCorrect, gameRuleChecks: ruleChecks });
}
console.log(JSON.stringify({ total: 144, failures: 0, report }, null, 2));
