import { describe, expect, test } from 'bun:test';
import {
  addPlayer,
  computeStandings,
  createTournament,
  eliminatePlayer,
  exportTournament,
  importTournament,
  processMatchResult,
  reactivatePlayer,
  restartMatch,
  scheduleMatches,
  startTournament,
  suspendPlayer,
  type Tournament,
  type TournamentMatch,
} from './tournament-engine';

/** Gerador determinístico para que uma falha seja reproduzível pela seed. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function withRandom<T>(random: () => number, run: () => T): T {
  const original = Math.random;
  Math.random = random;
  try { return run(); } finally { Math.random = original; }
}

function openMatches(tournament: Tournament): TournamentMatch[] {
  return [
    ...tournament.winnersMatches,
    ...tournament.losersMatches,
    ...(tournament.grandFinal ? [tournament.grandFinal] : []),
    ...(tournament.grandFinalReset ? [tournament.grandFinalReset] : []),
  ].filter(match => match.phase !== 'finished');
}

interface Simulation {
  tournament: Tournament;
  matches: TournamentMatch[];
  /** Instante em que cada jogador começou o primeiro confronto. */
  firstStart: Map<string, number>;
  /** Maior espera de cada jogador entre ficar livre e começar o confronto seguinte. */
  longestWait: Map<string, number>;
  endTime: number;
}

/**
 * Simula um torneio em tempo contínuo: cada confronto dura entre 1 e 3
 * unidades e os confrontos acabam por ordem de duração, não por rondas.
 */
function simulate(n: number, seed: number, durations = [1, 3]): Simulation {
  const random = seeded(seed);
  return withRandom(random, () => {
    const tournament = createTournament('dominorio');
    for (let i = 0; i < n; i++) addPlayer(tournament, `P${i}`);
    expect(startTournament(tournament)).toBe(true);

    const endsAt = new Map<string, number>();
    const startedAt = new Map<string, number>();
    const freeAt = new Map<string, number>(tournament.players.map(p => [p.id, 0]));
    const firstStart = new Map<string, number>();
    const longestWait = new Map<string, number>(tournament.players.map(p => [p.id, 0]));
    let now = 0;

    const begin = (match: TournamentMatch) => {
      if (startedAt.has(match.id)) return;
      startedAt.set(match.id, now);
      endsAt.set(match.id, now + durations[0]! + random() * (durations[1]! - durations[0]!));
      for (const player of [match.player1!, match.player2!]) {
        if (!firstStart.has(player.id)) firstStart.set(player.id, now);
        longestWait.set(player.id, Math.max(longestWait.get(player.id)!, now - freeAt.get(player.id)!));
      }
    };

    for (let step = 0; step < 10 * n + 10 && tournament.phase !== 'finished'; step++) {
      const open = openMatches(tournament);
      // Sem confrontos em curso e sem campeão = bloqueio.
      expect(open.length).toBeGreaterThan(0);
      open.forEach(begin);
      const next = open.reduce((a, b) => endsAt.get(a.id)! <= endsAt.get(b.id)! ? a : b);
      now = endsAt.get(next.id)!;
      const winner = random() < 0.5 ? next.player1!.id : next.player2!.id;
      processMatchResult(tournament, next.id, winner);
      for (const player of [next.player1!, next.player2!]) freeAt.set(player.id, now);
    }

    const matches = [
      ...tournament.winnersMatches,
      ...tournament.losersMatches,
      ...(tournament.grandFinal ? [tournament.grandFinal] : []),
      ...(tournament.grandFinalReset ? [tournament.grandFinalReset] : []),
    ];
    return { tournament, matches, firstStart, longestWait, endTime: now };
  });
}

describe('Dupla eliminação dinâmica — propriedades', () => {
  test('termina sempre, para 2 a 40 jogadores, com qualquer ordem de resultados', () => {
    for (let n = 2; n <= 40; n++) {
      for (let seed = 1; seed <= 25; seed++) {
        const { tournament, matches } = simulate(n, n * 1000 + seed);
        expect(tournament.phase).toBe('finished');
        expect(tournament.championId).toBeTruthy();

        // Cada confronto produz uma derrota: 2n−2 confrontos, ou 2n−1 com reset da final.
        const total = matches.filter(m => m.phase === 'finished').length;
        expect(total === 2 * n - 2 || total === 2 * n - 1).toBe(true);
        expect(total === 2 * n - 1).toBe(tournament.grandFinalReset !== null);

        for (const player of tournament.players) {
          const played = matches.filter(m => m.player1?.id === player.id || m.player2?.id === player.id);
          const lost = played.filter(m => m.winnerId && m.winnerId !== player.id).length;
          if (player.id === tournament.championId) {
            expect(lost).toBeLessThanOrEqual(1);
          } else {
            // Ninguém sai sem duas derrotas, e ninguém soma mais do que duas.
            expect(lost).toBe(2);
            expect(player.losses).toBe(2);
            expect(player.status).toBe('eliminated');
          }
          expect(played.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  test('winners só junta jogadores do mesmo nível e invictos', () => {
    for (const n of [5, 6, 9, 13, 17, 23, 31]) {
      const { matches } = simulate(n, 77 + n);
      const winners = matches.filter(m => m.bracket === 'winners' && m.round < 999);
      // Numa chave de n jogadores há n−1 vitórias na winners: todos menos o campeão perdem lá uma vez.
      expect(winners.length).toBe(n - 1);
      // O nível (ronda) nunca excede ⌈log2 n⌉.
      for (const match of winners) expect(match.round).toBeLessThanOrEqual(Math.ceil(Math.log2(n)));
    }
  });

  test('ninguém espera mais do que um confronto pelo primeiro jogo', () => {
    for (let n = 2; n <= 40; n++) {
      const { firstStart } = simulate(n, 4242 + n);
      expect(firstStart.size).toBe(n);
      // Quem fica de fora na 1.ª ronda (n ímpar) joga contra o primeiro vencedor.
      for (const start of firstStart.values()) expect(start).toBeLessThanOrEqual(3);
    }
  });

  test('17 jogadores (o caso real): todos jogam e a classificação fica completa', () => {
    const { tournament, firstStart } = simulate(17, 20261123);
    expect(tournament.phase).toBe('finished');
    expect(firstStart.size).toBe(17);
    const standings = computeStandings(tournament);
    expect(standings[0]!.playerId).toBe(tournament.championId!);
    expect(new Set(standings.map(s => s.rank)).size).toBe(17);
  });
});

describe('Dupla eliminação dinâmica — situações de aula', () => {
  test('jogador desligado não é emparelhado; ao voltar, entra logo', () => {
    withRandom(seeded(3), () => {
      const tournament = createTournament('faisca');
      const [a, b, c] = ['Ana', 'Beto', 'Cris'].map(name => addPlayer(tournament, name)!);
      c!.isConnected = false;
      startTournament(tournament);
      expect(openMatches(tournament)).toHaveLength(1);
      const match = openMatches(tournament)[0]!;
      expect([match.player1!.id, match.player2!.id].sort()).toEqual([a!.id, b!.id].sort());

      reactivatePlayer(tournament, c!.id, 'socket');
      // Cris ficou com isenção no nível 1; volta a estar ligado e espera pelo vencedor.
      expect(scheduleMatches(tournament)).toHaveLength(0);
      processMatchResult(tournament, match.id, a!.id);
      const next = openMatches(tournament).find(m => m.bracket === 'winners')!;
      expect([next.player1!.id, next.player2!.id].sort()).toEqual([a!.id, c!.id].sort());
    });
  });

  test('eliminar no painel não soma derrotas nem bloqueia a chave', () => {
    for (let seed = 1; seed <= 30; seed++) {
      withRandom(seeded(seed), () => {
        const tournament = createTournament('dominorio');
        for (let i = 0; i < 9; i++) addPlayer(tournament, `P${i}`);
        startTournament(tournament);
        const random = seeded(seed * 7);
        let eliminated = 0;
        for (let step = 0; step < 100 && tournament.phase !== 'finished'; step++) {
          const open = openMatches(tournament);
          expect(open.length).toBeGreaterThan(0);
          const match = open[Math.floor(random() * open.length)]!;
          if (eliminated < 2 && random() < 0.25) {
            // Professor elimina um jogador a meio de um confronto.
            const target = random() < 0.5 ? match.player1! : match.player2!;
            const result = eliminatePlayer(tournament, target.id);
            expect(result.endedMatches.map(m => m.id)).toEqual([match.id]);
            eliminated++;
            continue;
          }
          processMatchResult(tournament, match.id, random() < 0.5 ? match.player1!.id : match.player2!.id);
        }
        expect(tournament.phase).toBe('finished');
        for (const player of tournament.players) expect(player.losses).toBeLessThanOrEqual(2);
      });
    }
  });

  test('eliminar um jogador livre desbloqueia o adversário que esperava por ele', () => {
    withRandom(seeded(11), () => {
      const tournament = createTournament('dominorio');
      const players = ['A', 'B', 'C', 'D'].map(name => addPlayer(tournament, name)!);
      players[3]!.isConnected = false; // ausente desde o início
      startTournament(tournament);
      const first = openMatches(tournament)[0]!;
      processMatchResult(tournament, first.id, first.player1!.id);
      // O ausente bloqueia; o professor elimina-o e a chave segue.
      const result = eliminatePlayer(tournament, players[3]!.id);
      expect(result.newMatches.length).toBeGreaterThan(0);
      for (let step = 0; step < 20 && tournament.phase !== 'finished'; step++) {
        const match = openMatches(tournament)[0]!;
        processMatchResult(tournament, match.id, match.player1!.id);
      }
      expect(tournament.phase).toBe('finished');
    });
  });

  test('desligar a meio pausa o confronto; o eliminado continua eliminado ao desligar', () => {
    withRandom(seeded(5), () => {
      const tournament = createTournament('dominorio');
      const [a, b] = ['A', 'B'].map(name => addPlayer(tournament, name)!);
      startTournament(tournament);
      const match = openMatches(tournament)[0]!;
      expect(suspendPlayer(tournament, a!.id).pausedMatchId).toBe(match.id);
      expect(match.isPaused).toBe(true);
      reactivatePlayer(tournament, a!.id, 'socket');
      processMatchResult(tournament, match.id, a!.id);
      const final = tournament.grandFinal!;
      processMatchResult(tournament, final.id, a!.id);
      suspendPlayer(tournament, b!.id);
      expect(b!.status).toBe('eliminated');
    });
  });

  test('aluno desligado durante todo o torneio não sobe por isenções; eliminá-lo desbloqueia (17 alunos)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      withRandom(seeded(seed), () => {
        const tournament = createTournament('dominorio');
        const players = Array.from({ length: 17 }, (_, i) => addPlayer(tournament, `P${i}`)!);
        const absent = players[seed % 17]!;
        absent.isConnected = false;
        startTournament(tournament);
        for (let step = 0; step < 100; step++) {
          const open = openMatches(tournament);
          if (open.length === 0) break;
          const match = open[0]!;
          processMatchResult(tournament, match.id, match.player1!.id);
        }
        // Sem jogar, nunca sobe: fica no nível 1 e é ele que segura a chave.
        expect(absent.byes).toBe(0);
        expect(absent.winnersLevel).toBe(1);
        expect(tournament.phase).toBe('running');
        expect(openMatches(tournament)).toHaveLength(0);
        // O professor elimina o ausente e o torneio vai até ao fim.
        eliminatePlayer(tournament, absent.id);
        for (let step = 0; step < 100 && tournament.phase !== 'finished'; step++) {
          const match = openMatches(tournament)[0]!;
          expect(match).toBeDefined();
          processMatchResult(tournament, match.id, match.player2!.id);
        }
        expect(tournament.phase).toBe('finished');
      });
    }
  });

  test('a final só é criada com os dois finalistas ligados', () => {
    withRandom(seeded(21), () => {
      const tournament = createTournament('dominorio');
      const [a, b] = ['A', 'B'].map(name => addPlayer(tournament, name)!);
      startTournament(tournament);
      const first = openMatches(tournament)[0]!;
      suspendPlayer(tournament, a!.id);
      reactivatePlayer(tournament, a!.id, 'socket');
      processMatchResult(tournament, first.id, a!.id);
      expect(tournament.grandFinal).not.toBeNull();

      const other = createTournament('dominorio');
      const [c, d] = ['C', 'D'].map(name => addPlayer(other, name)!);
      startTournament(other);
      const match = openMatches(other)[0]!;
      // D desliga durante o confronto; o confronto termina por resultado normal.
      suspendPlayer(other, d!.id);
      processMatchResult(other, match.id, c!.id);
      expect(other.grandFinal).toBeNull();
      // A referência ao confronto terminado foi limpa: ao voltar não há nada para retomar.
      expect(d!.suspendedMatchId).toBeNull();
      expect(reactivatePlayer(other, d!.id, 'socket').resumedMatchId).toBeNull();
      expect(scheduleMatches(other)).toHaveLength(1);
      expect(other.grandFinal).not.toBeNull();
    });
  });

  test('pausa limpa o «pronto» de um jogo por começar; reiniciar mantém a pausa com alguém desligado; falta fica registada', () => {
    withRandom(seeded(8), () => {
      const tournament = createTournament('dominorio');
      for (const name of ['A', 'B', 'C']) addPlayer(tournament, name);
      startTournament(tournament);
      const match = openMatches(tournament)[0]!;
      match.player1Ready = true;
      const p1 = tournament.playerById.get(match.player1!.id)!;
      const p2 = tournament.playerById.get(match.player2!.id)!;
      suspendPlayer(tournament, p2.id);
      expect(match.isPaused).toBe(true);
      expect(match.player1Ready).toBe(false);
      expect(restartMatch(tournament, match.id).success).toBe(true);
      expect(match.isPaused).toBe(true);
      expect(match.pausedByPlayerId).toBe(p2.id);
      const result = eliminatePlayer(tournament, p2.id);
      expect(result.endedMatches[0]!.result).toBe('forfeit');
      expect(result.endedMatches[0]!.winnerId).toBe(p1.id);
    });
  });

  test('eliminar fora de um torneio a decorrer não altera nada', () => {
    const tournament = createTournament('dominorio');
    const a = addPlayer(tournament, 'A')!;
    addPlayer(tournament, 'B');
    expect(eliminatePlayer(tournament, a.id).endedMatches).toHaveLength(0);
    expect(a.status).toBe('active');
    expect(a.eliminationOrder).toBeNull();
  });

  test('exportar a meio e importar retoma o torneio até ao fim', () => {
    for (const n of [5, 8, 17]) {
      withRandom(seeded(n), () => {
        let tournament = createTournament('dominorio');
        for (let i = 0; i < n; i++) addPlayer(tournament, `P${i}`);
        startTournament(tournament);
        for (let step = 0; step < n; step++) {
          const match = openMatches(tournament)[0]!;
          processMatchResult(tournament, match.id, match.player2!.id);
        }
        const exported = JSON.parse(JSON.stringify(exportTournament(tournament)));
        tournament = importTournament(exported);
        for (const player of tournament.players) {
          if (player.status !== 'eliminated') reactivatePlayer(tournament, player.id, 'socket');
        }
        scheduleMatches(tournament);
        for (let step = 0; step < 4 * n && tournament.phase !== 'finished'; step++) {
          const match = openMatches(tournament)[0]!;
          expect(match).toBeDefined();
          processMatchResult(tournament, match.id, match.player1!.id);
        }
        expect(tournament.phase).toBe('finished');
      });
    }
  });

  test('o export é compacto: sem tabuleiros de confrontos terminados nem dados de ligação', () => {
    const { tournament } = simulate(17, 99);
    const exported = exportTournament(tournament);
    const json = JSON.stringify(exported);
    expect(json).not.toContain('socketId');
    expect(json).not.toContain('isConnected');
    for (const match of [...exported.winnersMatches, ...exported.losersMatches]) {
      expect(match.phase).toBe('finished');
      expect('gameState' in match).toBe(false);
    }
  });
});
