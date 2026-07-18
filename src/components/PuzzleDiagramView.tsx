import type { PuzzleDiagram } from '../ai-core/puzzles';

interface PuzzleDiagramViewProps {
  diagram: PuzzleDiagram;
}

function cellContent(symbol: string) {
  switch (symbol) {
    case 'X':
      return <span className="block h-4 w-4 rounded-full [background:var(--tinta)]" aria-hidden="true" />;
    case 'O':
      return <span className="block h-4 w-4 rounded-full border-2 [background:var(--papel)] [border-color:var(--tinta)]" aria-hidden="true" />;
    case 'N':
      return <span className="block h-4 w-4 rounded-full opacity-50 [background:var(--tinta-suave)]" aria-hidden="true" />;
    case '*':
      return <span className="text-sm font-black leading-none [color:var(--ouro)]" aria-hidden="true">★</span>;
    default:
      return null;
  }
}

export function PuzzleDiagramView({ diagram }: PuzzleDiagramViewProps) {
  return (
    <figure className="mt-5" data-puzzle-diagram>
      <div className="inline-block rounded-lg border p-2 [background:var(--papel)] [border-color:var(--linha)]">
        {diagram.rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex"
            style={diagram.hexOffset ? { marginLeft: `${rowIndex * 14}px` } : undefined}
          >
            {[...row].map((symbol, colIndex) => (
              <span
                key={colIndex}
                className={`flex h-7 w-7 items-center justify-center ${
                  symbol === '#'
                    ? 'opacity-0'
                    : 'border [background:var(--fundo)] [border-color:var(--linha)]'
                }`}
              >
                {cellContent(symbol)}
              </span>
            ))}
          </div>
        ))}
      </div>
      <figcaption className="mt-2 max-w-xs text-xs leading-relaxed [color:var(--tinta-suave)]">
        {diagram.caption}
      </figcaption>
    </figure>
  );
}
