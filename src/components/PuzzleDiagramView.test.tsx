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

  test('as linhas hexagonais recebem deslocamento progressivo', () => {
    const ponte = PUZZLES.find((puzzle) => puzzle.id === 'nx-ponte-1')!;
    const html = renderToStaticMarkup(<PuzzleDiagramView diagram={ponte.diagram!} />);
    expect(html).toContain('margin-left:14px');
    expect(html).toContain('★');
  });
});
