import { getStrategyChallenge } from '../server/learner-core/strategy-challenges';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PUZZLES } from '../ai-core/puzzles';
import { PuzzleDiagramView } from './PuzzleDiagramView';

describe('PuzzleDiagramView', () => {
  test('renderiza pedras, destaques e casas candidatas numeradas', () => {
    const mestre = PUZZLES.find((puzzle) => puzzle.id === 'ag-mestre-defesa-1')!;
    const html = renderToStaticMarkup(<PuzzleDiagramView diagram={mestre.diagram!} />);
    expect(html).toContain('data-puzzle-diagram');
    for (const digit of ['>1<', '>2<', '>3<']) {
      expect(html).toContain(digit);
    }
    expect(html).toContain(mestre.diagram!.caption);
  });

  test('Y learning uses the championship graph and accessible stone identities', () => {
    const { challenge } = getStrategyChallenge('y', 0);
    const html = renderToStaticMarkup(<PuzzleDiagramView diagram={challenge.diagram!} />);
    expect((html.match(/<line /g) ?? []).length).toBe(252);
    expect((html.match(/class="y-node"/g) ?? []).length).toBe(93);
    expect(html).toContain('E3: Azul');
    expect(html).toContain('M1: Vermelho; Lado esquerdo, Lado direito');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('Ligações do tabuleiro (texto)');
    expect(html).toContain('D3, D4, E4, F2, F3');
  });

  test('as linhas hexagonais recebem deslocamento progressivo', () => {
    const ponte = PUZZLES.find((puzzle) => puzzle.id === 'nx-ponte-1')!;
    const html = renderToStaticMarkup(<PuzzleDiagramView diagram={ponte.diagram!} />);
    expect(html).toContain('margin-left:14px');
    expect(html).toContain('★');
  });
});
