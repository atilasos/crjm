import { useMemo, useState } from 'react';
import type { GameId } from '../ai-core/types';
import { evaluatePuzzleAnswer, getPuzzlesForGame } from '../ai-core/puzzles';
import { getTrainingPath } from '../ai-core/training-paths';
import { Header } from './Header';
import { useGamification } from './gamification/GamificationProvider';

interface PuzzlePageProps {
  onVoltar: () => void;
}

const GAMES: Array<{ id: GameId; label: string; mark: string }> = [
  { id: 'gatos-caes', label: 'Gatos & Cães', mark: '🐱' },
  { id: 'dominorio', label: 'Dominório', mark: '🁓' },
  { id: 'quelhas', label: 'Quelhas', mark: '▮' },
  { id: 'produto', label: 'Produto', mark: '×' },
  { id: 'atari-go', label: 'Atari Go', mark: '●' },
  { id: 'nex', label: 'Nex', mark: '⬡' },
];

export function PuzzlePage({ onVoltar }: PuzzlePageProps) {
  const { profile, recordPatternProgress, recordPuzzleSolved } = useGamification();
  const [gameId, setGameId] = useState<GameId>('gatos-caes');
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; explanation: string } | null>(null);

  const puzzles = useMemo(() => getPuzzlesForGame(gameId), [gameId]);
  const puzzle = puzzles[puzzleIndex] ?? puzzles[0]!;
  const solved = new Set(profile.solvedPuzzleIds);
  const solvedCount = puzzles.filter((candidate) => solved.has(candidate.id)).length;
  const game = GAMES.find((candidate) => candidate.id === gameId) ?? GAMES[0]!;

  const selectGame = (nextGameId: GameId) => {
    setGameId(nextGameId);
    setPuzzleIndex(0);
    setSelectedOption(null);
    setUsedHint(false);
    setResult(null);
  };

  const confirmAnswer = () => {
    const nextResult = evaluatePuzzleAnswer(puzzle, selectedOption ?? '');
    setResult(nextResult);
    if (!nextResult.correct || solved.has(puzzle.id)) return;
    recordPuzzleSolved(gameId, puzzle.id, usedHint);
    recordPatternProgress({
      gameId,
      patternId: puzzle.patternId,
      evidence: usedHint ? 'used_with_help' : 'used_alone',
      contextId: `puzzle:${puzzle.id}`,
    });
  };

  const nextPuzzle = () => {
    setPuzzleIndex((current) => (current + 1) % puzzles.length);
    setSelectedOption(null);
    setUsedHint(false);
    setResult(null);
  };

  return (
    <div className="min-h-screen">
      <Header titulo="Laboratório de Estratégias" onVoltar={onVoltar} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section data-puzzle-lab className="relative overflow-hidden rounded-xl border [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
          <div className="absolute inset-y-0 left-5 hidden w-px [background:var(--ouro)] opacity-50 sm:block" aria-hidden="true" />
          <div className="border-b px-5 py-5 sm:pl-12 [background:var(--fundo)] [border-color:var(--linha)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] [color:var(--ouro)]">Caderno de treinador</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-black [color:var(--tinta)]">Uma decisão. Uma ideia.</h2>
                <p className="mt-1 max-w-2xl text-sm [color:var(--tinta-suave)]">Experimenta, pede uma pista se precisares e lê a explicação antes de avançar.</p>
              </div>
              <p className="rounded-full border px-4 py-2 text-sm font-bold [background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta)] [box-shadow:var(--sombra)]">
                {game.label}: {solvedCount}/{puzzles.length} resolvidos
              </p>
            </div>
          </div>

          <div className="p-5 sm:pl-12 sm:pr-8 sm:py-8">
            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Escolher jogo dos puzzles">
              {GAMES.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => selectGame(candidate.id)}
                  aria-pressed={candidate.id === gameId}
                  className={`min-h-12 rounded-lg border px-2 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ouro)] ${
                    candidate.id === gameId
                      ? '[background:var(--tinta)] [border-color:var(--tinta)] [color:var(--fundo)]'
                      : '[background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta-suave)] hover:[border-color:var(--ouro)] hover:[color:var(--tinta)]'
                  }`}
                >
                  <span className="mr-1" aria-hidden="true">{candidate.mark}</span>{candidate.label}
                </button>
              ))}
            </nav>

            <article className="mt-7 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="rounded-xl border p-6 [background:var(--fundo)] [border-color:var(--linha)] [color:var(--tinta)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-4xl" aria-hidden="true">{game.mark}</span>
                  <span className="rounded-full border px-3 py-1 text-xs font-bold [border-color:var(--linha)] [color:var(--tinta-suave)]">{puzzleIndex + 1} / {puzzles.length}</span>
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] [color:var(--ouro)]">Padrão em treino</p>
                <h3 className="mt-2 text-2xl font-black">{puzzle.title}</h3>
                <p className="mt-4 text-base leading-relaxed [color:var(--tinta-suave)]">{puzzle.prompt}</p>
                <button
                  type="button"
                  onClick={() => setUsedHint(true)}
                  className="mt-6 min-h-12 w-full rounded-lg border px-4 py-3 font-bold transition [background:var(--painel)] [border-color:var(--ouro)] [color:var(--tinta)] hover:opacity-80"
                >
                  {usedHint ? puzzle.hint : 'Pedir uma pista'}
                </button>
              </div>

              <div>
                <fieldset>
                  <legend className="text-sm font-black uppercase tracking-[0.16em] [color:var(--tinta-suave)]">Qual é a melhor leitura?</legend>
                  <div className="mt-3 space-y-3">
                    {puzzle.options.map((option, index) => {
                      const selected = selectedOption === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          data-puzzle-option={option.id}
                          onClick={() => {
                            setSelectedOption(option.id);
                            setResult(null);
                          }}
                          aria-pressed={selected}
                          className={`min-h-12 w-full rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ouro)] ${
                            selected
                              ? '[background:var(--fundo)] [border-color:var(--ouro)] [color:var(--tinta)] ring-1 ring-[var(--ouro)]'
                              : '[background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta)] hover:[border-color:var(--ouro)]'
                          }`}
                        >
                          <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black [background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta-suave)]">{index + 1}</span>
                          <span className="font-bold">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <button
                  type="button"
                  onClick={confirmAnswer}
                  disabled={!selectedOption}
                  className="mt-4 min-h-12 w-full rounded-lg px-5 py-3 font-black transition [background:var(--tinta)] [color:var(--fundo)] [box-shadow:var(--sombra)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-100 disabled:[background:var(--linha)] disabled:[color:var(--tinta-suave)]"
                >
                  Confirmar resposta
                </button>

                {result && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`mt-4 rounded-lg border p-4 [background:var(--fundo)] [color:var(--tinta)] ${result.correct ? '[border-color:var(--sucesso)]' : '[border-color:var(--perigo)]'}`}
                  >
                    <p className={`font-black ${result.correct ? '[color:var(--sucesso)]' : '[color:var(--perigo)]'}`}>{result.correct ? (solved.has(puzzle.id) ? '✓ Já dominaste esta ideia' : '✓ Boa leitura') : 'Ainda não — tenta outra vez'}</p>
                    <p className="mt-1 text-sm leading-relaxed">{result.explanation}</p>
                    {result.correct && (
                      <button type="button" onClick={nextPuzzle} className="mt-3 min-h-12 rounded-lg px-4 py-2 font-bold text-white [background:var(--sucesso)] hover:opacity-90">
                        Próximo puzzle
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>

            <section data-percurso aria-label={`Percurso para o campeonato — ${game.label}`} className="mt-8 rounded-xl border p-5 [background:var(--fundo)] [border-color:var(--linha)]">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] [color:var(--ouro)]">Percurso para o campeonato</p>
                  <h3 className="mt-1 text-xl font-black [color:var(--tinta)]">{game.label}: quatro etapas até ao torneio</h3>
                </div>
                <p className="text-xs font-bold [color:var(--tinta-suave)]">
                  Vitórias registadas neste jogo: {profile.gameProgress[gameId]?.wins ?? 0}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {getTrainingPath(gameId).steps.map((step, stepIndex) => {
                  const stepPuzzles = step.puzzleIds ?? [];
                  const solvedInStep = stepPuzzles.filter((id) => solved.has(id)).length;
                  const puzzlesDone = stepPuzzles.length > 0 && solvedInStep === stepPuzzles.length;
                  return (
                    <div key={step.title} className={`rounded-lg border px-3 py-3 [background:var(--painel)] ${puzzlesDone ? '[border-color:var(--sucesso)]' : '[border-color:var(--linha)]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-black [color:var(--tinta)]">{stepIndex + 1}. {step.title}</p>
                        {stepPuzzles.length > 0 && (
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${puzzlesDone ? 'text-white [background:var(--sucesso)] [border-color:var(--sucesso)]' : '[border-color:var(--linha)] [color:var(--tinta-suave)]'}`}>
                            {puzzlesDone ? '✓ ' : ''}{solvedInStep}/{stepPuzzles.length} puzzles
                          </span>
                        )}
                      </div>
                      <ul className="mt-2 space-y-1 text-xs [color:var(--tinta-suave)]">
                        {step.checkpoints.map((checkpoint) => (
                          <li key={checkpoint}>• {checkpoint}</li>
                        ))}
                      </ul>
                      {step.desafio && (
                        <p className="mt-2 text-xs font-bold [color:var(--ouro)]">Desafio no tabuleiro: {step.desafio}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs [color:var(--tinta-suave)]">
                Os puzzles contam automaticamente; os desafios contra o computador jogam-se na página de cada jogo.
              </p>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
