import { describe, expect, test } from 'bun:test';
import {
  claimMissionReward,
  createInitialProfile,
  getMissionProgress,
  recordGameCompletion,
  recordPatternProgress,
  recordPuzzleSolved,
  recordReviewCompletion,
} from './learner-gamification';

const NOW = new Date('2026-07-10T10:00:00Z');

describe('pedagogical gamification', () => {
  test('keeps reflection worth more than the victory bonus', () => {
    const base = createInitialProfile();
    base.achievements.first_game = { unlockedAt: NOW.toISOString() };
    base.achievements.first_win = { unlockedAt: NOW.toISOString() };
    base.achievements.first_review = { unlockedAt: NOW.toISOString() };

    const afterLoss = recordGameCompletion(base, 'dominorio', { won: false, now: NOW }).profile;
    const afterWin = recordGameCompletion(base, 'dominorio', { won: true, now: NOW }).profile;
    const afterReview = recordReviewCompletion(base, 'dominorio', NOW).profile;

    expect(afterLoss.totalXp - base.totalXp).toBe(10);
    expect(afterWin.totalXp - afterLoss.totalXp).toBe(8);
    expect(afterReview.totalXp - base.totalXp).toBe(10);
  });

  test('does not award a game-specific achievement without evidence of its pattern', () => {
    const afterProductGame = recordGameCompletion(createInitialProfile(), 'produto', {
      won: false,
      now: NOW,
    }).profile;
    const afterNexGame = recordGameCompletion(createInitialProfile(), 'nex', {
      won: false,
      now: NOW,
    }).profile;

    expect(afterProductGame.achievements.balanced_builder).toBeUndefined();
    expect(afterNexGame.achievements.bridge_builder).toBeUndefined();
  });

  test('awards a puzzle once and records concrete learning activity', () => {
    const result = recordPuzzleSolved(createInitialProfile(), 'atari-go', NOW, {
      puzzleId: 'ag-atari-1',
      usedHint: false,
    });

    expect(result.profile.recentEvents.at(-1)).toMatchObject({
      type: 'puzzle_solved',
      gameId: 'atari-go',
      puzzleId: 'ag-atari-1',
      usedHint: false,
    });
    expect(result.profile.achievements.first_puzzle).toBeDefined();
    expect(result.profile.gameProgress['atari-go'].strategy).toBeGreaterThan(0);
    expect(result.profile.totalXp).toBe(31); // 6 puzzle + 10 onboarding + 15 resolução sem pista
  });

  test('does not award XP twice for the same puzzle', () => {
    const first = recordPuzzleSolved(createInitialProfile(), 'nex', NOW, {
      puzzleId: 'nx-ponte-1',
      usedHint: true,
    });
    const duplicate = recordPuzzleSolved(first.profile, 'nex', new Date('2026-07-10T10:05:00Z'), {
      puzzleId: 'nx-ponte-1',
      usedHint: false,
    });

    expect(first.awarded).toBe(true);
    expect(duplicate.awarded).toBe(false);
    expect(duplicate.profile).toBe(first.profile);
    expect(duplicate.profile.totalXp).toBe(first.profile.totalXp);
  });

  test('uses one automatic streak shield per UTC week', () => {
    let profile = createInitialProfile();
    profile = recordGameCompletion(profile, 'dominorio', {
      won: false,
      now: new Date('2026-07-06T10:00:00Z'),
    }).profile;
    profile = recordGameCompletion(profile, 'dominorio', {
      won: false,
      now: new Date('2026-07-08T10:00:00Z'),
    }).profile;

    expect(profile.streakDays).toBe(2);
    expect(profile.streakShieldWeeks).toEqual(['2026-07-06']);

    profile = recordGameCompletion(profile, 'dominorio', {
      won: false,
      now: new Date('2026-07-10T10:00:00Z'),
    }).profile;
    expect(profile.streakDays).toBe(1);
    expect(profile.streakShieldWeeks).toEqual(['2026-07-06']);
  });

  test('progresses a pattern monotonically and requires three distinct solo contexts for mastery', () => {
    let profile = createInitialProfile();
    profile = recordPatternProgress(profile, {
      gameId: 'dominorio',
      patternId: 'dominorio:corte',
      evidence: 'seen',
      contextId: 'review-a',
      now: NOW,
    }).profile;
    expect(profile.patterns['dominorio:corte']?.state).toBe('seen');

    profile = recordPatternProgress(profile, {
      gameId: 'dominorio',
      patternId: 'dominorio:corte',
      evidence: 'used_alone',
      contextId: 'game-a',
      now: NOW,
    }).profile;
    expect(profile.patterns['dominorio:corte']?.state).toBe('used_alone');

    for (const contextId of ['game-b', 'game-c']) {
      profile = recordPatternProgress(profile, {
        gameId: 'dominorio',
        patternId: 'dominorio:corte',
        evidence: 'used_alone',
        contextId,
        now: NOW,
      }).profile;
    }

    expect(profile.patterns['dominorio:corte']).toMatchObject({
      state: 'mastered',
      soloContextIds: ['game-a', 'game-b', 'game-c'],
    });

    const afterWeakerEvidence = recordPatternProgress(profile, {
      gameId: 'dominorio',
      patternId: 'dominorio:corte',
      evidence: 'used_with_help',
      contextId: 'review-b',
      now: NOW,
    }).profile;
    expect(afterWeakerEvidence.patterns['dominorio:corte']?.state).toBe('mastered');
  });

  test('unlocks a pattern achievement only after independent use', () => {
    const afterSeen = recordPatternProgress(createInitialProfile(), {
      gameId: 'produto',
      patternId: 'produto:equilibrio',
      evidence: 'seen',
      contextId: 'review-a',
      now: NOW,
    }).profile;
    expect(afterSeen.achievements.balanced_builder).toBeUndefined();

    const afterUse = recordPatternProgress(afterSeen, {
      gameId: 'produto',
      patternId: 'produto:equilibrio',
      evidence: 'used_alone',
      contextId: 'game-a',
      now: NOW,
    }).profile;
    expect(afterUse.achievements.balanced_builder).toBeDefined();
  });

  test('unlocks the complete game-specific catalog from independent pattern evidence', () => {
    let profile = createInitialProfile();
    const evidence = [
      ['gatos-caes', 'gatos-caes:centro', 'center_keeper'],
      ['gatos-caes', 'gatos-caes:jogada-garantida', 'block_master'],
      ['dominorio', 'dominorio:paridade', 'parity_guardian'],
      ['dominorio', 'dominorio:corredor', 'last_move_master'],
      ['dominorio', 'dominorio:espelhamento', 'opening_reader'],
      ['quelhas', 'quelhas:misere-final', 'misere_mind'],
      ['quelhas', 'quelhas:isolamento-forcado', 'endgame_architect'],
      ['produto', 'produto:equilibrio', 'balanced_builder'],
      ['produto', 'produto:fusao-adversaria', 'elegant_saboteur'],
      ['atari-go', 'atari-go:atari', 'atari_hunter'],
      ['atari-go', 'atari-go:double-atari', 'double_atari'],
      ['atari-go', 'atari-go:ladder', 'ladder_spotter'],
      ['nex', 'nex:ponte', 'bridge_builder'],
      ['nex', 'nex:tripla-ameaca', 'triple_threat'],
    ] as const;

    for (const [gameId, patternId, achievementId] of evidence) {
      profile = recordPatternProgress(profile, {
        gameId,
        patternId,
        evidence: 'used_alone',
        contextId: `puzzle:${patternId}`,
        now: NOW,
      }).profile;
      expect(profile.achievements[achievementId]).toBeDefined();
    }
  });

  test('provides evidence-backed paths for every transversal learning achievement', () => {
    let profile = createInitialProfile();
    profile = recordGameCompletion(profile, 'atari-go', { won: false, now: NOW }).profile;
    profile = recordGameCompletion(profile, 'atari-go', {
      won: true,
      now: new Date('2026-07-10T10:05:00Z'),
    }).profile;
    profile = recordPuzzleSolved(profile, 'atari-go', new Date('2026-07-10T10:10:00Z'), {
      puzzleId: 'ag-atari-1',
      usedHint: false,
    }).profile;
    profile = recordPuzzleSolved(profile, 'atari-go', new Date('2026-07-10T10:11:00Z'), {
      puzzleId: 'ag-escada-1',
      usedHint: true,
    }).profile;
    profile = recordPatternProgress(profile, {
      gameId: 'atari-go', patternId: 'atari-go:atari', evidence: 'used_with_help', contextId: 'hint-a', now: NOW,
    }).profile;
    for (const contextId of ['solo-a', 'solo-b', 'solo-c']) {
      profile = recordPatternProgress(profile, {
        gameId: 'atari-go', patternId: 'atari-go:atari', evidence: 'used_alone', contextId, now: NOW,
      }).profile;
    }

    expect(profile.achievements.comeback_win).toBeDefined();
    expect(profile.achievements.explain_move).toBeDefined();
    expect(profile.achievements.after_hint_recovery).toBeDefined();
    expect(profile.achievements.top3_move).toBeDefined();
    expect(profile.achievements.improvement_streak).toBeDefined();
  });

  test('derives all eight individual missions from activity evidence', () => {
    let profile = createInitialProfile();
    for (const gameId of ['dominorio', 'produto'] as const) {
      profile = recordGameCompletion(profile, gameId, { won: true, now: NOW }).profile;
    }
    for (let index = 0; index < 5; index += 1) {
      profile = recordReviewCompletion(profile, 'dominorio', new Date(NOW.getTime() + index * 1000)).profile;
    }
    for (const [index, puzzleId] of ['do-paridade-1', 'do-corte-1'].entries()) {
      profile = recordPuzzleSolved(profile, 'dominorio', new Date(NOW.getTime() + index * 2000), {
        puzzleId,
        usedHint: false,
      }).profile;
    }
    for (const [index, patternId] of ['dominorio:paridade', 'dominorio:corte', 'dominorio:corredor'].entries()) {
      profile = recordPatternProgress(profile, {
        gameId: 'dominorio',
        patternId,
        evidence: 'used_alone',
        contextId: `mission-${index}`,
        now: NOW,
      }).profile;
    }

    const missions = getMissionProgress(profile, NOW);
    expect(missions.map((mission) => mission.id)).toEqual([
      'daily-play-2',
      'daily-review-1',
      'daily-puzzle-2',
      'daily-hints-2',
      'weekly-review-5',
      'weekly-two-game-wins',
      'weekly-three-patterns',
      'weekly-strategy-up',
    ]);
    expect(missions.every((mission) => mission.completed)).toBe(true);
  });

  test('claims a completed mission reward at most once per period', () => {
    let profile = createInitialProfile();
    profile.achievements.first_review = { unlockedAt: NOW.toISOString() };
    profile = recordReviewCompletion(profile, 'dominorio', NOW).profile;
    const beforeClaim = profile.totalXp;

    const first = claimMissionReward(profile, 'daily-review-1', NOW);
    const duplicate = claimMissionReward(first.profile, 'daily-review-1', NOW);

    expect(first.claimed).toBe(true);
    expect(first.profile.totalXp - beforeClaim).toBe(8);
    expect(
      first.profile.missionClaims['daily-review-1:2026-07-10'],
    ).toBeDefined();
    expect(getMissionProgress(first.profile, NOW).find((mission) => mission.id === 'daily-review-1')?.claimed).toBe(true);
    expect(duplicate.claimed).toBe(false);
    expect(duplicate.profile.totalXp).toBe(first.profile.totalXp);
  });
});
