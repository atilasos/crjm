import { useState, useEffect, useCallback, useRef } from 'react';
import { GameLayout } from '../../components/GameLayout';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { PlayerInfo } from '../../components/PlayerInfo';
import { TrainingPathCard } from '../../components/TrainingPathCard';
import { HintLegend } from '../../components/tutor/HintLegend';
import { TutorContextBar } from '../../components/tutor/TutorContextBar';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import type { AIRequestV1, AIResponseV1, DifficultyLevel } from '../../ai-core';
import { getDifficultyProfile } from '../../ai-core/difficulty';
import { buildTutorContextItems } from '../../ai-core/tutor-context';
import { selectReviewPattern } from '../../ai-core/review-patterns';
import type { DominorioState, Posicao, Domino } from './types';
import {
  criarEstadoInicial,
  atualizarPreview,
  colocarDomino,
  getDominoPreview,
  jogadaComputador,
} from './logic';
import type { GameMode, Player } from '../../types';
import {
  DominorioAIClient,
  DominorioV1Adapter,
  mapLevelToLegacyDifficulty,
  type AIDifficulty,
  type AIMetrics,
  INITIAL_METRICS,
} from './ai';
import { withTimeout } from '../../utils/withTimeout';
import { TutorHintCard } from './components/TutorHintCard';
import { TopMovesRail } from './components/TopMovesRail';
import {
  buildQuickReviewItems,
  computeAdaptiveHintLevel,
  type TutorHintLevel,
} from './ai/pedagogy-mvp';

interface DominorioGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro 8×8.',
  'O Jogador Vertical coloca dominós VERTICAIS (2 casas).',
  'O Jogador Horizontal coloca dominós HORIZONTAIS (2 casas).',
  'Começa o Vertical.',
  'Cada dominó ocupa duas casas livres adjacentes.',
  'Ganha quem colocar a ÚLTIMA peça.',
  'Se não tiveres jogadas no teu turno, PERDES.',
];

function formatMove(move: Domino): string {
  const l1 = move.pos1.linha + 1;
  const c1 = move.pos1.coluna + 1;
  const l2 = move.pos2.linha + 1;
  const c2 = move.pos2.coluna + 1;
  return `(${l1},${c1})-(${l2},${c2})`;
}

function samePos(a: Posicao, b: Posicao): boolean {
  return a.linha === b.linha && a.coluna === b.coluna;
}

function sameMove(a: Domino | null, b: Domino | null): boolean {
  if (!a || !b) return false;
  return (
    (samePos(a.pos1, b.pos1) && samePos(a.pos2, b.pos2)) ||
    (samePos(a.pos1, b.pos2) && samePos(a.pos2, b.pos1))
  );
}

function getSuggestedAction(
  response: AIResponseV1<Domino, DominorioState> | null,
  hintLevel: TutorHintLevel,
): string {
  if (!response?.bestMove) {
    return 'Mantém duas zonas abertas para não ficares sem resposta.';
  }

  if (hintLevel === 'H1') {
    return 'Escolhe a opção que te deixe mais respostas simples no próximo turno.';
  }

  if (hintLevel === 'H2') {
    if (response.criticalThreats?.[0]) {
      return 'Resolve primeiro a ameaça crítica e só depois volta a abrir espaço.';
    }
    return 'Começa pela opção que te deixa pelo menos duas respostas no próximo turno.';
  }

  return 'Se estiveres perdido, compara primeiro a opção #1 com o número de respostas que te deixa no turno seguinte.';
}

function getThreatClasses(severity: 'low' | 'medium' | 'high'): string {
  if (severity === 'high') {
    return '[background:color-mix(in_srgb,#E5484D_14%,var(--painel))] [border-color:color-mix(in_srgb,#E5484D_45%,var(--linha))] [color:var(--tinta)]';
  }

  if (severity === 'medium') {
    return '[background:color-mix(in_srgb,var(--ouro)_16%,var(--painel))] [border-color:color-mix(in_srgb,var(--ouro)_50%,var(--linha))] [color:var(--tinta)]';
  }

  return '[background:var(--painel)] [border-color:var(--linha)] [color:var(--tinta)]';
}

function isPartOfDomino(move: Domino | null | undefined, linha: number, coluna: number): boolean {
  if (!move) return false;
  return (
    (move.pos1.linha === linha && move.pos1.coluna === coluna) ||
    (move.pos2.linha === linha && move.pos2.coluna === coluna)
  );
}

export function DominorioGame({ onVoltar }: DominorioGameProps) {
  const {
    acceptDifficultyRecommendation,
    getDifficultyRecommendation,
    recordAdaptiveDecision,
    recordGameCompleted,
    recordPatternProgress,
    recordReviewCompleted,
    resetAdaptiveSession,
  } = useGamification();
  const [state, setState] = useState<DominorioState>(() =>
    criarEstadoInicial('vs-computador'),
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(3);
  const difficulty: AIDifficulty = mapLevelToLegacyDifficulty(difficultyLevel);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics>(INITIAL_METRICS);
  const [aiReady, setAiReady] = useState(false);
  const [tutorResponse, setTutorResponse] =
    useState<AIResponseV1<Domino, DominorioState> | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [hintLevel, setHintLevel] = useState<TutorHintLevel>('H2');
  const [tutorHistory, setTutorHistory] = useState<AIResponseV1<Domino, DominorioState>[]>([]);

  // AI client ref (persistent across renders)
  const aiClientRef = useRef<DominorioAIClient | null>(null);
  const tutorAdapterRef = useRef<DominorioV1Adapter | null>(null);
  const tutorRequestSeqRef = useRef(0);
  const previousMoveCountRef = useRef(0);
  const lastSuggestedMoveRef = useRef<Domino | null>(null);
  const hintSignalsRef = useRef({
    struggleStreak: 0,
    stableStreak: 0,
    h3Streak: 0,
  });
  const awardedResultRef = useRef<string | null>(null);
  const [reviewRewarded, setReviewRewarded] = useState(false);

  // Initialize AI client
  useEffect(() => {
    const client = new DominorioAIClient({
      onMetricsUpdate: setAiMetrics,
      onReady: () => setAiReady(true),
    });
    aiClientRef.current = client;

    return () => {
      client.terminate();
    };
  }, []);

  useEffect(() => {
    const adapter = new DominorioV1Adapter();
    tutorAdapterRef.current = adapter;

    return () => {
      adapter.terminate();
    };
  }, []);

  const isVezDaIA =
    state.modo === 'vs-computador' &&
    state.estado === 'a-jogar' &&
    state.jogadorAtual !== humanPlayer;

  useEffect(() => {
    if (!tutorAdapterRef.current) return;

    if (state.estado !== 'a-jogar') {
      // Mantém último payload para facilitar futura revisão pós-jogo (F1.3+).
      setTutorLoading(false);
      return;
    }

    if (isVezDaIA) {
      setTutorLoading(false);
      return;
    }

    const requestId = `dom-tutor-${Date.now()}-${++tutorRequestSeqRef.current}`;
    const request: AIRequestV1<DominorioState, Domino> = {
      version: '1.0',
      requestId,
      gameId: 'dominorio',
      mode: 'tutor',
      level: difficultyLevel,
      state,
      locale: 'pt-PT',
    };

    let cancelled = false;
    setTutorLoading(true);

    tutorAdapterRef.current
      .compute(request)
      .then((response) => {
        if (cancelled) return;
        setTutorResponse(response);
        setTutorHistory((prev) => [...prev.slice(-11), response]);
        setHintLevel((currentLevel) => {
          const next = computeAdaptiveHintLevel(response, currentLevel, hintSignalsRef.current);
          hintSignalsRef.current.h3Streak = next === 'H3' ? hintSignalsRef.current.h3Streak + 1 : 0;
          return next;
        });
        lastSuggestedMoveRef.current = response.bestMove;
      })
      .catch(() => {
        if (cancelled) return;
        setTutorResponse(null);
      })
      .finally(() => {
        if (!cancelled) {
          setTutorLoading(false);
        }
      });

    return () => {
      cancelled = true;
      tutorAdapterRef.current?.cancel();
    };
  }, [
    state.tabuleiro,
    state.jogadorAtual,
    state.estado,
    state.modo,
    state.dominosColocados.length,
    difficulty,
    isVezDaIA,
    state,
  ]);

  useEffect(() => {
    const currentCount = state.dominosColocados.length;
    if (currentCount <= previousMoveCountRef.current) {
      previousMoveCountRef.current = currentCount;
      return;
    }

    const lastMove = state.dominosColocados[currentCount - 1];
    const humanOrientation = humanPlayer === 'jogador1' ? 'vertical' : 'horizontal';
    const playedByHuman = lastMove?.orientacao === humanOrientation;

    if (playedByHuman) {
      const followedSuggestion = sameMove(lastSuggestedMoveRef.current, lastMove);
      if (followedSuggestion) {
        hintSignalsRef.current.stableStreak += 1;
        hintSignalsRef.current.struggleStreak = 0;
      } else {
        hintSignalsRef.current.struggleStreak += 1;
        hintSignalsRef.current.stableStreak = 0;
      }
    }

    previousMoveCountRef.current = currentCount;
  }, [state.dominosColocados, humanPlayer]);

  // Efeito para jogada do computador (usando AI Worker)
  useEffect(() => {
    if (
      state.modo === 'vs-computador' &&
      state.jogadorAtual !== humanPlayer &&
      state.estado === 'a-jogar' &&
      aiClientRef.current
    ) {
      let cancelled = false;
      let finished = false;
      const client = aiClientRef.current;
      const timeBudgetMs = getDifficultyProfile(difficultyLevel).timeBudgetMs;
      const maxWaitMs = timeBudgetMs + 250;

      // Small delay for UX
      const timer = setTimeout(async () => {
        if (cancelled || !client) return;

        try {
          const move = await withTimeout(
            client.getBestMove(state, difficulty, { timeBudgetMs }),
            maxWaitMs,
            () => client.cancel(),
          );

          if (cancelled) return;

          finished = true;
          setState((prev) => (move ? colocarDomino(prev, move) : jogadaComputador(prev)));
        } catch (e) {
          if (e instanceof Error && e.message === 'cancelled') return;
          console.error('[DominorioGame] AI error:', e);
          if (cancelled) return;
          finished = true;
          setState((prev) => jogadaComputador(prev));
        }
      }, 200);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        if (!finished) client?.cancel();
      };
    }
  }, [state.jogadorAtual, state.modo, state.estado, humanPlayer, difficulty, state]);

  // Mostrar anúncio de vencedor quando o jogo termina
  useEffect(() => {
    if (state.estado !== 'a-jogar') {
      setMostrarVencedor(true);
    }
  }, [state.estado]);

  useEffect(() => {
    if (state.estado === 'a-jogar') {
      awardedResultRef.current = null;
      setReviewRewarded(false);
      return;
    }
    if (awardedResultRef.current === state.estado) return;

    const humanWon =
      state.modo === 'vs-computador' &&
      ((state.estado === 'vitoria-jogador1' && humanPlayer === 'jogador1') ||
        (state.estado === 'vitoria-jogador2' && humanPlayer === 'jogador2'));

    recordGameCompleted('dominorio', humanWon);
    awardedResultRef.current = state.estado;
  }, [humanPlayer, recordGameCompleted, state.estado, state.modo]);

  const handleMouseEnter = useCallback(
    (pos: Posicao) => {
      if (state.estado !== 'a-jogar') return;
      if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;
      setState((prev) => atualizarPreview(prev, pos));
    },
    [state.estado, state.modo, state.jogadorAtual, humanPlayer],
  );

  const handleMouseLeave = useCallback(() => {
    setState((prev) => ({ ...prev, dominoPreview: null }));
  }, []);

  const handleCellClick = useCallback(
    (pos: Posicao) => {
      if (state.estado !== 'a-jogar') return;
      if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;

      const preview = getDominoPreview(state, pos);
      if (preview) {
        if (tutorResponse) {
          const successful = tutorResponse.topMoves.some(({ move }) => sameMove(move, preview));
          recordAdaptiveDecision('dominorio', {
            successful,
            usedHint: hintLevel === 'H3',
            repeatedError: !successful && hintSignalsRef.current.struggleStreak > 0,
          });
        }
        setState((prev) => colocarDomino(prev, preview));
      }
    },
    [state, humanPlayer, tutorResponse, recordAdaptiveDecision, hintLevel],
  );

  const novoJogo = useCallback(() => {
    // Cancel any pending AI search
    aiClientRef.current?.cancel();
    tutorAdapterRef.current?.cancel();
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setAiMetrics(INITIAL_METRICS);
    setTutorResponse(null);
    setTutorLoading(false);
    setHintLevel('H2');
    setTutorHistory([]);
    previousMoveCountRef.current = 0;
    lastSuggestedMoveRef.current = null;
    hintSignalsRef.current = { struggleStreak: 0, stableStreak: 0, h3Streak: 0 };
    resetAdaptiveSession('dominorio');
  }, [resetAdaptiveSession, state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode =
      state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    // Cancel any pending AI search
    aiClientRef.current?.cancel();
    tutorAdapterRef.current?.cancel();
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setHumanPlayer('jogador1'); // Reset ao trocar modo
    setAiMetrics(INITIAL_METRICS);
    setTutorResponse(null);
    setTutorLoading(false);
    setHintLevel('H2');
    setTutorHistory([]);
    previousMoveCountRef.current = 0;
    lastSuggestedMoveRef.current = null;
    hintSignalsRef.current = { struggleStreak: 0, stableStreak: 0, h3Streak: 0 };
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    // Cancel any pending AI search
    aiClientRef.current?.cancel();
    tutorAdapterRef.current?.cancel();
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
    setAiMetrics(INITIAL_METRICS);
    setTutorResponse(null);
    setTutorLoading(false);
    setHintLevel('H2');
    setTutorHistory([]);
    previousMoveCountRef.current = 0;
    lastSuggestedMoveRef.current = null;
    hintSignalsRef.current = { struggleStreak: 0, stableStreak: 0, h3Streak: 0 };
  }, []);

  const handleChangeDifficulty = useCallback((newDifficulty: DifficultyLevel) => {
    setDifficultyLevel(newDifficulty);
  }, []);

  const difficultyRecommendation = getDifficultyRecommendation('dominorio', difficultyLevel);

  // Verificar se uma célula faz parte do preview
  const isPreview = (linha: number, coluna: number): boolean => {
    if (!state.dominoPreview) return false;
    const { pos1, pos2 } = state.dominoPreview;
    return (
      (pos1.linha === linha && pos1.coluna === coluna) ||
      (pos2.linha === linha && pos2.coluna === coluna)
    );
  };

  // Obter cor da célula
  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha]?.[coluna] ?? 'vazia';
    const preview = isPreview(linha, coluna);
    const recommended = tutorResponse?.bestMove && isPartOfDomino(tutorResponse.bestMove, linha, coluna);
    const threatMove = criticalThreat?.counterMove;
    const threatened = threatMove && isPartOfDomino(threatMove, linha, coluna);

    let classes =
      'aspect-square rounded-md flex items-center justify-center transition-all duration-150 ';

    if (celula === 'vazia') {
      if (preview) {
        classes +=
          state.jogadorAtual === 'jogador1'
            ? 'bg-pink-400 ring-2 ring-pink-300'
            : 'bg-cyan-400 ring-2 ring-cyan-300';
      } else {
        classes += 'bg-gray-100 hover:bg-gray-200 cursor-pointer';
      }
    } else if (celula === 'ocupada-vertical') {
      classes += 'bg-pink-500';
    } else {
      classes += 'bg-cyan-500';
    }

    if (recommended) {
      classes += ' ring-4 ring-amber-400 ring-offset-2 ring-offset-white ';
    } else if (threatened) {
      classes += ' ring-4 ring-rose-400 ring-offset-2 ring-offset-white ';
    }

    return classes;
  };

  const criticalThreat = tutorResponse?.criticalThreats?.[0];
  const quickReviewItems = buildQuickReviewItems(tutorHistory);
  const reviewPattern = selectReviewPattern('dominorio', tutorHistory.at(-1) ?? tutorResponse);

  return (
    <GameLayout titulo="Dominório" regras={REGRAS} onVoltar={onVoltar}>
      {/* Em mobile o tabuleiro vem primeiro (order-*); em lg mantém-se a ordem original */}
      <div className="flex flex-col gap-4">
        {/* Info do jogador (controlos de pré-jogo: modo, cor, dificuldade) */}
        <div className="order-2 lg:order-1">
          <PlayerInfo
            modo={state.modo}
            jogadorAtual={state.jogadorAtual}
            estado={state.estado}
            nomeJogador1="Vertical"
            nomeJogador2="Horizontal"
            corJogador1="bg-pink-500"
            corJogador2="bg-cyan-500"
            humanPlayer={humanPlayer}
            onChangeHumanPlayer={handleChangeHumanPlayer}
            onNovoJogo={novoJogo}
            onTrocarModo={trocarModo}
            // AI props
            difficulty={difficultyLevel}
            onChangeDifficulty={handleChangeDifficulty}
            difficultyRecommendation={difficultyRecommendation}
            canAcceptDifficultyRecommendation={state.estado !== 'a-jogar'}
            onAcceptDifficultyRecommendation={(level) => {
              setDifficultyLevel(level);
              acceptDifficultyRecommendation('dominorio');
            }}
            aiMetrics={aiMetrics}
            aiReady={aiReady}
          />
        </div>

        {/* Caminho de evolução (pré-jogo) */}
        <div className="order-3 lg:order-2">
          <TrainingPathCard gameId="dominorio" />
        </div>

        {/* Tabuleiro — primeiro em mobile para ficar above the fold */}
        <div className="game-container order-1 lg:order-3">
          <div className="aspect-square max-w-md mx-auto">
            <div
              className="grid grid-cols-8 gap-1 h-full bg-emerald-800 p-2 rounded-xl"
              onMouseLeave={handleMouseLeave}
            >
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((_, colunaIdx) => (
                  <button
                    key={`${linhaIdx}-${colunaIdx}`}
                    onClick={() => handleCellClick({ linha: linhaIdx, coluna: colunaIdx })}
                    onMouseEnter={() => handleMouseEnter({ linha: linhaIdx, coluna: colunaIdx })}
                    className={getCelulaClasses(linhaIdx, colunaIdx)}
                  >
                    {/* Ponto do dominó */}
                    {(state.tabuleiro[linhaIdx]?.[colunaIdx] ?? 'vazia') !== 'vazia' && (
                      <div className="w-2 h-2 rounded-full bg-white/50"></div>
                    )}
                  </button>
                )),
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex justify-center gap-6 text-sm [color:var(--tinta-suave-no-papel)]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-8 bg-pink-500 rounded"></div>
              <span>Vertical (J1)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 bg-cyan-500 rounded"></div>
              <span>Horizontal (J2)</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm [color:var(--tinta-suave-no-papel)]">
            {state.estado === 'a-jogar' &&
              (isVezDaIA ? (
                <span className="flex items-center justify-center gap-2 font-medium [color:var(--jogo-dominorio)]">
                  <span className="inline-block w-4 h-4 border-2 [border-color:var(--jogo-dominorio)] border-t-transparent rounded-full animate-spin"></span>
                  IA a pensar…
                </span>
              ) : (
                <>
                  {state.jogadorAtual === 'jogador1'
                    ? 'Clica para colocar um dominó VERTICAL'
                    : 'Clica para colocar um dominó HORIZONTAL'}{' '}
                  • Jogadas disponíveis: {state.jogadasValidas.length}
                </>
              ))}
          </div>
        </div>

        {state.estado === 'a-jogar' && !isVezDaIA && (
          <div className="space-y-3 order-4">
            <TutorContextBar items={buildTutorContextItems(tutorResponse)} />
            <HintLegend showThreat={Boolean(criticalThreat)} showAlternative />
            <TutorHintCard
              insight={
                tutorResponse?.explainText ||
                'Mantém a posição equilibrada e evita reduzir demasiado as opções.'
              }
              suggestedAction={getSuggestedAction(tutorResponse, hintLevel)}
              hintLevel={hintLevel}
              errorCode={tutorResponse?.pedagogy?.errorCode}
              isLoading={tutorLoading}
            />

            <TopMovesRail moves={tutorResponse?.topMoves ?? []} isLoading={tutorLoading} />

            {criticalThreat && (
              <section
                className={`rounded-xl border px-4 py-3 text-sm ${getThreatClasses(criticalThreat.severity)}`}
              >
                <p className="font-semibold">Ameaça crítica: {criticalThreat.title}</p>
                <p className="mt-1">{criticalThreat.description}</p>
                {criticalThreat.counterMove && (
                  <p className="mt-1 font-medium">
                    Resposta mínima: {formatMove(criticalThreat.counterMove)}
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {state.estado !== 'a-jogar' && quickReviewItems.length > 0 && (
          <section className="rounded-xl border px-4 py-3 text-sm order-5 [background:var(--painel)] [border-color:color-mix(in_srgb,var(--jogo-produto)_35%,var(--linha))] [color:var(--tinta)]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Revisão rápida pós-jogo</p>
              <span className="rounded-full px-2 py-0.5 text-xs font-medium [background:color-mix(in_srgb,var(--jogo-produto)_18%,var(--painel))] [color:var(--tinta)]">
                2-4 min
              </span>
            </div>
            <p className="mt-1 [color:var(--tinta-suave)]">
              Revê até 2 momentos e tenta repetir a melhor alternativa.
            </p>
            <p className="mt-2 rounded-lg px-3 py-2 font-medium [background:color-mix(in_srgb,var(--jogo-produto)_12%,var(--painel))]">
              Cartão descoberto: {reviewPattern.title} — {reviewPattern.description}
            </p>
            <div className="mt-2 space-y-2">
              {quickReviewItems.map((item) => (
                <div key={item.title} className="rounded-lg border px-3 py-2 [border-color:var(--linha)] [background:var(--fundo)]">
                  <p className="font-semibold [color:var(--tinta)]">{item.title}</p>
                  <p className="mt-1 [color:var(--tinta-suave)]">{item.insight}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={reviewRewarded}
              onClick={() => {
                if (reviewRewarded) return;
                recordReviewCompleted('dominorio');
                recordPatternProgress({
                  gameId: 'dominorio', patternId: reviewPattern.id, evidence: 'seen', contextId: `review-${Date.now()}`,
                });
                setReviewRewarded(true);
              }}
              className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors [background:var(--jogo-produto)] hover:[background:color-mix(in_srgb,var(--jogo-produto)_85%,black)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reviewRewarded ? 'Revisão registada' : 'Marcar revisão concluída (+10 XP)'}
            </button>
          </section>
        )}
      </div>

      {/* Anúncio de vencedor */}
      {mostrarVencedor && (
        <WinnerAnnouncement
          estado={state.estado}
          modo={state.modo}
          nomeJogador1="Vertical"
          nomeJogador2="Horizontal"
          humanoEhJogador1={humanPlayer === 'jogador1'}
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}
