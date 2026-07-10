import { describe, expect, test } from 'bun:test';
import {
  createAdaptiveEvidence,
  recordAdaptiveDecision,
  recommendDifficulty,
} from './adaptive-difficulty';

describe('recommendDifficulty', () => {
  test('acumula apenas evidência pedagógica mínima da sessão', () => {
    const first = recordAdaptiveDecision(createAdaptiveEvidence(), {
      successful: true,
      usedHint: true,
    });
    const second = recordAdaptiveDecision(first, {
      successful: false,
      repeatedError: true,
    });

    expect(second).toEqual({
      criticalDecisions: 2,
      successfulCriticalDecisions: 1,
      hintsUsed: 1,
      repeatedErrors: 1,
      frustrationSignals: 0,
      changedThisSession: false,
    });
  });

  test('mantém o nível dentro da zona-alvo de 40–60%', () => {
    const result = recommendDifficulty(3, {
      criticalDecisions: 10,
      successfulCriticalDecisions: 5,
      hintsUsed: 1,
      repeatedErrors: 0,
    });

    expect(result.recommendedLevel).toBe(3);
    expect(result.direction).toBe('keep');
  });

  test('sobe apenas um nível quando o desafio está fácil e não houve ajuda', () => {
    const result = recommendDifficulty(2, {
      criticalDecisions: 10,
      successfulCriticalDecisions: 8,
      hintsUsed: 0,
      repeatedErrors: 0,
    });

    expect(result.recommendedLevel).toBe(3);
    expect(result.direction).toBe('up');
  });

  test('não sobe quando o sucesso dependeu de pistas', () => {
    const result = recommendDifficulty(3, {
      criticalDecisions: 10,
      successfulCriticalDecisions: 8,
      hintsUsed: 3,
      repeatedErrors: 0,
    });

    expect(result.recommendedLevel).toBe(3);
  });

  test('desce apenas um nível quando o desafio está demasiado difícil', () => {
    const result = recommendDifficulty(4, {
      criticalDecisions: 10,
      successfulCriticalDecisions: 2,
      hintsUsed: 2,
      repeatedErrors: 1,
    });

    expect(result.recommendedLevel).toBe(3);
    expect(result.direction).toBe('down');
  });

  test('um sinal de frustração recomenda apoio adicional', () => {
    const result = recommendDifficulty(3, {
      criticalDecisions: 6,
      successfulCriticalDecisions: 4,
      hintsUsed: 1,
      repeatedErrors: 0,
      frustrationSignals: 1,
    });

    expect(result.recommendedLevel).toBe(2);
  });

  test('não muda uma segunda vez na mesma sessão', () => {
    const result = recommendDifficulty(2, {
      criticalDecisions: 10,
      successfulCriticalDecisions: 10,
      hintsUsed: 0,
      repeatedErrors: 0,
      changedThisSession: true,
    });

    expect(result.recommendedLevel).toBe(2);
    expect(result.direction).toBe('keep');
  });

  test('espera por evidência suficiente e respeita os limites N1–N5', () => {
    expect(recommendDifficulty(3, {
      criticalDecisions: 3,
      successfulCriticalDecisions: 3,
      hintsUsed: 0,
      repeatedErrors: 0,
    }).recommendedLevel).toBe(3);

    expect(recommendDifficulty(5, {
      criticalDecisions: 10,
      successfulCriticalDecisions: 10,
      hintsUsed: 0,
      repeatedErrors: 0,
    }).recommendedLevel).toBe(5);

    expect(recommendDifficulty(1, {
      criticalDecisions: 10,
      successfulCriticalDecisions: 0,
      hintsUsed: 0,
      repeatedErrors: 3,
    }).recommendedLevel).toBe(1);
  });
});
