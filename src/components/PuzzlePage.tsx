import { useMemo, useState } from 'react';
import type { GameId } from '../ai-core/types';
import { evaluatePuzzleAnswer, getPuzzlesForGame } from '../ai-core/puzzles';
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
        <section data-puzzle-lab className="relative overflow-hidden rounded-[2rem] border border-amber-200 bg-[#fffaf0] shadow-[0_24px_70px_rgba(15,23,42,0.28)]">
          <div className="absolute inset-y-0 left-5 hidden w-px bg-rose-200 sm:block" aria-hidden="true" />
          <div className="border-b border-amber-200 bg-amber-100/70 px-5 py-5 sm:pl-12">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-800">Caderno de treinador</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900">Uma decisão. Uma ideia.</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">Experimenta, pede uma pista se precisares e lê a explicação antes de avançar.</p>
              </div>
              <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-amber-900 shadow-sm">
                {game.label}: {solvedCount}/3 resolvidos
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
                  className={`min-h-12 rounded-xl border px-2 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
                    candidate.id === gameId
                      ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                      : 'border-amber-200 bg-white text-slate-700 hover:border-amber-500 hover:bg-amber-50'
                  }`}
                >
                  <span className="mr-1" aria-hidden="true">{candidate.mark}</span>{candidate.label}
                </button>
              ))}
            </nav>

            <article className="mt-7 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-4xl" aria-hidden="true">{game.mark}</span>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-bold">{puzzleIndex + 1} / 3</span>
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Padrão em treino</p>
                <h3 className="mt-2 text-2xl font-black">{puzzle.title}</h3>
                <p className="mt-4 text-base leading-relaxed text-slate-200">{puzzle.prompt}</p>
                <button
                  type="button"
                  onClick={() => setUsedHint(true)}
                  className="mt-6 min-h-12 w-full rounded-xl border border-amber-300/50 bg-amber-300/10 px-4 py-3 font-bold text-amber-200 transition hover:bg-amber-300/20"
                >
                  {usedHint ? puzzle.hint : 'Pedir uma pista'}
                </button>
              </div>

              <div>
                <fieldset>
                  <legend className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Qual é a melhor leitura?</legend>
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
                          className={`min-h-12 w-full rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
                            selected
                              ? 'border-amber-600 bg-amber-100 text-slate-950 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400'
                          }`}
                        >
                          <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">{index + 1}</span>
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
                  className="mt-4 min-h-12 w-full rounded-2xl bg-amber-500 px-5 py-3 font-black text-slate-950 shadow-md transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  Confirmar resposta
                </button>

                {result && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`mt-4 rounded-2xl border p-4 ${result.correct ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-orange-300 bg-orange-50 text-orange-950'}`}
                  >
                    <p className="font-black">{result.correct ? (solved.has(puzzle.id) ? '✓ Já dominaste esta ideia' : '✓ Boa leitura') : 'Ainda não — tenta outra vez'}</p>
                    <p className="mt-1 text-sm leading-relaxed">{result.explanation}</p>
                    {result.correct && (
                      <button type="button" onClick={nextPuzzle} className="mt-3 min-h-12 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white hover:bg-emerald-800">
                        Próximo puzzle
                      </button>
                    )}
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
