import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { GamificationProvider } from './gamification/GamificationProvider';
import { PuzzlePage } from './PuzzlePage';

describe('PuzzlePage', () => {
  test('apresenta um laboratório acessível com seis jogos e três respostas', () => {
    const html = renderToStaticMarkup(
      <GamificationProvider>
        <PuzzlePage onVoltar={() => undefined} />
      </GamificationProvider>,
    );

    expect(html).toContain('Laboratório de Estratégias');
    for (const label of ['Gatos &amp; Cães', 'Dominório', 'Quelhas', 'Produto', 'Atari Go', 'Nex']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('Pedir uma pista');
    expect((html.match(/data-puzzle-option=/g) ?? [])).toHaveLength(3);
    expect(html).toContain('min-h-12');
    expect(html).toContain('0/3 resolvidos');
  });
});
