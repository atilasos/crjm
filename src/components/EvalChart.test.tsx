import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvalChart } from './EvalChart';

describe('EvalChart (F4)', () => {
  test('marca o ponto de viragem e explica em pt-PT', () => {
    const html = renderToStaticMarkup(<EvalChart values={[0.4, 0.3, -0.5, -0.7]} humanWon={false} />);
    expect(html).toContain('data-eval-chart');
    expect(html).toContain('circle');
    expect(html).toContain('foi aí que a avaliação mais caiu');
  });

  test('sem viragem, mensagem depende do resultado', () => {
    const won = renderToStaticMarkup(<EvalChart values={[0.2, 0.3, 0.5]} humanWon={true} />);
    expect(won).toContain('jogo controlado');
    expect(won).not.toContain('circle cx');
  });

  test('não renderiza com menos de 3 amostras', () => {
    expect(renderToStaticMarkup(<EvalChart values={[0.1, 0.2]} humanWon={false} />)).toBe('');
  });
});
