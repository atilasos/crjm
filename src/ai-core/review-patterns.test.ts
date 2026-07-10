import { describe, expect, test } from 'bun:test';
import { selectReviewPattern } from './review-patterns';

describe('selectReviewPattern', () => {
  test('provides a concrete starter card for every game', () => {
    expect(selectReviewPattern('gatos-caes').id).toBe('gatos-caes:centro');
    expect(selectReviewPattern('dominorio').id).toBe('dominorio:paridade');
    expect(selectReviewPattern('quelhas').id).toBe('quelhas:misere-final');
    expect(selectReviewPattern('produto').id).toBe('produto:equilibrio');
    expect(selectReviewPattern('atari-go').id).toBe('atari-go:atari');
    expect(selectReviewPattern('nex').id).toBe('nex:ponte');
  });

  test('uses tutor evidence to choose a more specific card', () => {
    expect(selectReviewPattern('dominorio', { explainText: 'Este corredor força as próximas peças.' }).id)
      .toBe('dominorio:corredor');
    expect(selectReviewPattern('produto', { explainText: 'A melhor defesa é a fusão dos grupos adversários.' }).id)
      .toBe('produto:fusao-adversaria');
    expect(selectReviewPattern('nex', { criticalThreats: [{}, {}, {}] }).id)
      .toBe('nex:tripla-ameaca');
    expect(selectReviewPattern('atari-go', { turningPoints: [{ patternId: 'TP-ATARI-DEFENSE' }] }).id)
      .toBe('atari-go:atari');
  });
});
