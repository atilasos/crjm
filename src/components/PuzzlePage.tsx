import { GAME_CATALOG, isGameAvailable, isIntegrationPreview, type BrowsableSelection, type GameCapability } from '../games/catalog';
import { useTranslation } from '../i18n/LanguageProvider';
import { useMemo, useState } from 'react';
import type { GameId } from '../ai-core/types';
import { evaluatePuzzleAnswer, getDisplayOptions, getPuzzlesForGame } from '../ai-core/puzzles';
import { evaluateDesafioGoals, getTrainingPath } from '../ai-core/training-paths';
import { Header } from './Header';
import { PuzzleDiagramView } from './PuzzleDiagramView';
import { useGamification } from './gamification/GamificationProvider';
import { StrategyPractice } from './StrategyPractice';
import { GameSelectionControl } from './GameSelectionControl';

interface PuzzlePageProps {
  onVoltar: () => void;
  selection: BrowsableSelection;
  onSelectionChange: (selection: BrowsableSelection) => void;
}

export function PuzzlePage({ onVoltar, selection, onSelectionChange }: PuzzlePageProps) {
  const { t } = useTranslation();
  const games = GAME_CATALOG.filter(game =>
    (['puzzles', 'training', 'strategy'] as const).some(capability => isGameAvailable(game, capability, isIntegrationPreview(), selection))
  );
  const { profile, levelProgress, recordPatternProgress, recordPuzzleSolved } = useGamification();
  const [gameId, setGameId] = useState<GameId>(games[0]!.id);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; explanation: string } | null>(null);

  const game = games.find(candidate => candidate.id === gameId) ?? games[0]!;
  const hasCapability = (capability: GameCapability) => (game.capabilities as readonly GameCapability[]).includes(capability);
  const path = hasCapability('training') ? getTrainingPath(gameId) : undefined;
  const puzzles = useMemo(() => hasCapability('puzzles') ? getPuzzlesForGame(gameId) : [], [gameId]);
  const puzzle = puzzles[puzzleIndex] ?? puzzles[0];
  const displayOptions = useMemo(() => puzzle ? getDisplayOptions(puzzle) : [], [puzzle]);
  const solved = new Set(profile.solvedPuzzleIds);
  const solvedCount = puzzles.filter((candidate) => solved.has(candidate.id)).length;

  const selectGame = (nextGameId: GameId) => {
    setGameId(nextGameId);
    setPuzzleIndex(0);
    setSelectedOption(null);
    setUsedHint(false);
    setResult(null);
  };

  const confirmAnswer = () => {
    if (!puzzle) return;
    const nextResult = evaluatePuzzleAnswer(puzzle, selectedOption ?? '');
    setResult(nextResult);
    if (!nextResult.correct || solved.has(puzzle.id)) return;
    // This catalogue is guided practice: its explanations are always exposed.
    // Verified solo performance is recorded separately by StrategyPractice.
    recordPuzzleSolved(gameId, puzzle.id, true);
    recordPatternProgress({
      gameId,
      patternId: puzzle.patternId,
      evidence: 'used_with_help',
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
      <Header titulo="Laboratório de Estratégias" onVoltar={onVoltar} voltarLabel={selection === 'archive' ? 'Voltar ao Arquivo' : undefined} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section data-puzzle-lab className="relative overflow-hidden rounded-xl border [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
          <div className="absolute inset-y-0 left-5 hidden w-px [background:var(--ouro)] opacity-50 sm:block" aria-hidden="true" />
          <div className="border-b px-5 py-5 sm:pl-12 [background:var(--fundo)] [border-color:var(--linha)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] [color:var(--ouro)]">{t("Caderno de treinador")}</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-black [color:var(--tinta)]">{t("Uma decisão. Uma ideia.")}</h2>
                <p className="mt-1 max-w-2xl text-sm [color:var(--tinta-suave)]">{t("Experimenta, pede uma pista se precisares e lê a explicação antes de avançar.")}</p>
              </div>
              {puzzle && <p className="rounded-full border px-4 py-2 text-sm font-bold [background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta)] [box-shadow:var(--sombra)]">
                {t(game.name)}: {t(solvedCount)}/{t(puzzles.length)}{t(" resolvidos")}</p>}
            </div>
          </div>

          <div className="p-5 sm:pl-12 sm:pr-8 sm:py-8">
            <GameSelectionControl selection={selection} onChange={onSelectionChange} />
            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label={t("Escolher jogo dos puzzles")}>
              {games.map((candidate) => (
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
                  <span className="mr-1" aria-hidden="true">{t(candidate.mark)}</span>{t(candidate.name)}
                </button>
              ))}
            </nav>

            {hasCapability('strategy') && <StrategyPractice key={gameId} gameId={gameId} />}

            {puzzle && <>
            <h3 className="mt-8 text-xl font-bold [color:var(--tinta)]">{t('Explorar ideias com explicações')}</h3>

            <article className="mt-7 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="rounded-xl border p-6 [background:var(--fundo)] [border-color:var(--linha)] [color:var(--tinta)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-4xl" aria-hidden="true">{t(game.mark)}</span>
                  <span className="rounded-full border px-3 py-1 text-xs font-bold [border-color:var(--linha)] [color:var(--tinta-suave)]">{t(puzzleIndex + 1)} / {t(puzzles.length)}</span>
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] [color:var(--ouro)]">{t("Padrão em treino")}</p>
                <h3 className="mt-2 text-2xl font-black">{t(puzzle.title)}</h3>
                <p className="mt-4 text-base leading-relaxed [color:var(--tinta-suave)]">{t(puzzle.prompt)}</p>
                {puzzle.diagram && <PuzzleDiagramView diagram={puzzle.diagram} />}
                <button
                  type="button"
                  onClick={() => setUsedHint(true)}
                  className="mt-6 min-h-12 w-full rounded-lg border px-4 py-3 font-bold transition [background:var(--painel)] [border-color:var(--ouro)] [color:var(--tinta)] hover:opacity-80"
                >
                  {t(usedHint ? puzzle.hint : 'Pedir uma pista')}
                </button>
              </div>

              <div>
                <fieldset>
                  <legend className="text-sm font-black uppercase tracking-[0.16em] [color:var(--tinta-suave)]">{t("Qual é a melhor leitura?")}</legend>
                  <div className="mt-3 space-y-3">
                    {displayOptions.map((option, index) => {
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
                          <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black [background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta-suave)]">{t(index + 1)}</span>
                          <span className="font-bold">{t(option.label)}</span>
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
                >{t("Confirmar resposta")}</button>

                {result && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`mt-4 rounded-lg border p-4 [background:var(--fundo)] [color:var(--tinta)] ${result.correct ? '[border-color:var(--sucesso)]' : '[border-color:var(--perigo)]'}`}
                  >
                    <p className={`font-black ${result.correct ? '[color:var(--sucesso)]' : '[color:var(--perigo)]'}`}>{t(result.correct ? (solved.has(puzzle.id) ? '✓ Boa leitura — ideia praticada' : '✓ Boa leitura') : 'Ainda não — tenta outra vez')}</p>
                    <p className="mt-1 text-sm leading-relaxed">{t(result.explanation)}</p>
                    {result.correct && (
                      <button type="button" onClick={nextPuzzle} className="mt-3 min-h-12 rounded-lg px-4 py-2 font-bold text-white [background:var(--sucesso)] hover:opacity-90">{t("Próximo puzzle")}</button>
                    )}
                  </div>
                )}
              </div>
            </article>
            </>}

            {path && <section data-percurso aria-label={t(`Percurso para o campeonato — ${game.name}`)} className="mt-8 rounded-xl border p-5 [background:var(--fundo)] [border-color:var(--linha)]">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] [color:var(--ouro)]">{t("Percurso para o campeonato")}</p>
                  <h3 className="mt-1 text-xl font-black [color:var(--tinta)]">{t(game.name)}{t(": quatro etapas até ao torneio")}</h3>
                </div>
                <p className="text-xs font-bold [color:var(--tinta-suave)]">{t("Vitórias registadas neste jogo: ")}{t(profile.gameProgress[gameId]?.wins ?? 0)}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {path.steps.map((step, stepIndex) => {
                  const stepPuzzles = step.puzzleIds ?? [];
                  const solvedInStep = stepPuzzles.filter((id) => solved.has(id)).length;
                  const puzzlesDone = stepPuzzles.length === 0 || solvedInStep === stepPuzzles.length;
                  const desafio = evaluateDesafioGoals(step.desafioGoals, levelProgress[gameId]);
                  const stepDone =
                    (stepPuzzles.length > 0 || desafio !== null) && puzzlesDone && (desafio?.done ?? true);
                  return (
                    <div key={step.title} className={`rounded-lg border px-3 py-3 [background:var(--painel)] ${stepDone ? '[border-color:var(--sucesso)]' : '[border-color:var(--linha)]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-black [color:var(--tinta)]">{t(stepIndex + 1)}. {t(step.title)}</p>
                        {stepPuzzles.length > 0 && (
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${solvedInStep === stepPuzzles.length ? 'text-white [background:var(--sucesso)] [border-color:var(--sucesso)]' : '[border-color:var(--linha)] [color:var(--tinta-suave)]'}`}>
                            {t(solvedInStep === stepPuzzles.length ? '✓ ' : '')}{t(solvedInStep)}/{t(stepPuzzles.length)}{t(" puzzles")}</span>
                        )}
                      </div>
                      <ul className="mt-2 space-y-1 text-xs [color:var(--tinta-suave)]">
                        {step.checkpoints.map((checkpoint) => (
                          <li key={checkpoint}>• {t(checkpoint)}</li>
                        ))}
                      </ul>
                      {step.desafio && (
                        <p className={`mt-2 text-xs font-bold ${desafio?.done ? '[color:var(--sucesso)]' : '[color:var(--ouro)]'}`}>
                          {t(desafio?.done ? '✓ ' : '')}{t("Desafio no tabuleiro: ")}{t(step.desafio)}
                        </p>
                      )}
                      {desafio && (
                        <p className="mt-1 text-xs [color:var(--tinta-suave)]">
                          {desafio.progress.map(item => t(item)).join(' · ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs [color:var(--tinta-suave)]">{t('Estas etapas registam prática e vitórias. Confirma o que aprendeste na atividade Escolhe e prevê.')}</p>
            </section>}
          </div>
        </section>
      </main>
    </div>
  );
}
