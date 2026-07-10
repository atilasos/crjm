import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DifficultySelector } from './DifficultySelector';

describe('DifficultySelector', () => {
  test('torna os cinco níveis e o orçamento selecionado explícitos', () => {
    const html = renderToStaticMarkup(
      <DifficultySelector level={3} onChange={() => undefined} />,
    );

    for (const level of [1, 2, 3, 4, 5]) {
      expect(html).toContain(`N${level}`);
    }
    expect(html).toContain('Desafiar');
    expect(html).toContain('500 ms');
    expect(html).toContain('aria-pressed="true"');
  });

  test('mostra a recomendação sem a aplicar silenciosamente durante a partida', () => {
    const html = renderToStaticMarkup(
      <DifficultySelector
        level={3}
        onChange={() => undefined}
        recommendation={{
          currentLevel: 3,
          recommendedLevel: 4,
          direction: 'up',
          successRate: 0.8,
          reason: 'Bom desempenho.',
        }}
        canAcceptRecommendation={false}
        onAcceptRecommendation={() => undefined}
      />,
    );

    expect(html).toContain('Adaptativo:');
    expect(html).toContain('N4 disponível no fim da partida');
    expect(html).toContain('disabled=""');
  });
});
