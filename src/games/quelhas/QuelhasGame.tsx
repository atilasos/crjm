import { ThinkingTutor, useThinkingTutor } from '../../components/tutor/ThinkingTutor';
import { thinkingTurnKey } from '../../ai-core/thinking-tutor';
import { useTranslation } from '../../i18n/LanguageProvider';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIRequestV1, AIResponseV1, DifficultyLevel } from '../../ai-core';
import { clampDifficultyLevel, getDifficultyProfile , type ExtendedDifficultyLevel } from '../../ai-core/difficulty';
import { buildTutorContextItems } from '../../ai-core/tutor-context';
import { selectReviewPattern } from '../../ai-core/review-patterns';
import { GameLayout } from '../../components/GameLayout';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { PlayerInfo } from '../../components/PlayerInfo';
import { TrainingPathCard } from '../../components/TrainingPathCard';
import { HintLegend } from '../../components/tutor/HintLegend';
import { TutorContextBar } from '../../components/tutor/TutorContextBar';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { EvalChart } from '../../components/EvalChart';
import { normalizeEngineScore } from '../../ai-core/eval-trace';
import type { QuelhasState, Posicao, Celula } from './types';
import {
  criarEstadoInicial,
  colocarSegmento,
  atualizarPreview,
  getCelulasSegmento,
  isPosicaoInicioValida,
  criarSegmentoEntrePosicoes,
  getOrientacaoJogador,
  trocarOrientacoes,
  recusarTroca,
  decidirTrocaComputador,
} from './logic';
import type { GameMode, Player } from '../../types';
import {
  QuelhasAIClient,
  QUELHAS_SERVER_AI_WITH_FALLBACK_TIMEOUT_MS,
  QuelhasV1Adapter,
  mapLevelToQuelhasDifficulty,
  buildQuickReviewItems,
  INITIAL_METRICS,
  type AIDifficulty,
  type AIMetrics,
} from './ai';
import { TutorHintCard } from './components/TutorHintCard';
import { TopMovesRail } from './components/TopMovesRail';
import { searchBestMove } from './ai/engine';
import { withTimeout } from '../../utils/withTimeout';

interface QuelhasGameProps {
  onVoltar: () => void;
}

function emergencyMove(state: QuelhasState) {
  return searchBestMove(state.tabuleiro, getOrientacaoJogador(state, state.jogadorAtual), {
    timeBudgetMs: 40, maxDepth: 2, topN: 0, scoreDelta: 0,
  }).bestMove;
}

const REGRAS = [
  'Tabuleiro 10×10.',
  'O Jogador Vertical coloca segmentos VERTICAIS (mínimo 2 casas).',
  'O Jogador Horizontal coloca segmentos HORIZONTAIS (mínimo 2 casas).',
  'Começa o jogador com orientação Vertical.',
  'Clica na casa inicial e depois na casa final para colocar um segmento.',
  'Os segmentos ocupam casas livres consecutivas.',
  'Regra de troca: Após a 1.ª jogada, o jogador Horizontal pode trocar de papel.',
  'ATENÇÃO: Este jogo é MISÈRE - perde quem fizer a última jogada!',
  'Se não tiveres jogadas no teu turno, GANHAS (o adversário foi o último a jogar).',
];

function formatSegmento(segmento: QuelhasState['jogadasValidas'][number]): string {
  return `L${segmento.inicio.linha + 1} C${segmento.inicio.coluna + 1}, ${segmento.orientacao}, ${segmento.comprimento} casas`;
}

function getThreatClasses(severity: 'low' | 'medium' | 'high'): string {
  if (severity === 'high') {
    return '[border-color:var(--perigo)] [background:color-mix(in_srgb,var(--perigo)_12%,var(--painel))] [color:var(--tinta)]';
  }
  if (severity === 'medium') {
    return '[border-color:var(--ouro)] [background:color-mix(in_srgb,var(--ouro)_14%,var(--painel))] [color:var(--tinta)]';
  }
  return '[border-color:color-mix(in_srgb,var(--jogo-dominorio)_55%,var(--linha))] [background:color-mix(in_srgb,var(--jogo-dominorio)_10%,var(--painel))] [color:var(--tinta)]';
}

export function QuelhasGame({ onVoltar }: QuelhasGameProps) {
  const { t, msg } = useTranslation();
  const {
    acceptDifficultyRecommendation,
    getDifficultyRecommendation,
    recordAdaptiveDecision,
    recordGameCompleted,
    recordPatternProgress,
    recordReviewCompleted,
    resetAdaptiveSession,
  } = useGamification();
  const [state, setState] = useState<QuelhasState>(() =>
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [posicaoInicial, setPosicaoInicial] = useState<Posicao | null>(null);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [difficultyLevel, setDifficultyLevel] = useState<ExtendedDifficultyLevel>(3);
  // O contrato clássico (presets, tutor V1) trabalha em 1..5; o nível 6 usa o caminho servidor.
  const difficulty: AIDifficulty = mapLevelToQuelhasDifficulty(clampDifficultyLevel(difficultyLevel));
  const [aiMetrics, setAiMetrics] = useState<AIMetrics>(INITIAL_METRICS);
  // F4: uma amostra de avaliação por «vez» da IA (perspetiva do humano)
  const [evalTrace, setEvalTrace] = useState<number[]>([]);
  const wasThinkingRef = useRef(false);
  const [aiReady, setAiReady] = useState(false);
  const [tutorResponse, setTutorResponse] =
    useState<AIResponseV1<QuelhasState['jogadasValidas'][number], QuelhasState> | null>(null);
  const [tutorHistory, setTutorHistory] = useState<
    Array<AIResponseV1<QuelhasState['jogadasValidas'][number], QuelhasState>>
  >([]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const tutorTurn = thinkingTurnKey(state, humanPlayer, difficultyLevel);
  const thinking = useThinkingTutor(tutorTurn);
  const hintLevel = 'H3' as const;
  const [tutorPosition, setTutorPosition] = useState<string | null>(null);
  const showTutorSolution = thinking.showSolution && tutorPosition === tutorTurn && !tutorLoading
    && state.modo === 'vs-computador' && state.estado === 'a-jogar' && state.jogadorAtual === humanPlayer;
  const aiClientRef = useRef<QuelhasAIClient | null>(null);
  const tutorAdapterRef = useRef<QuelhasV1Adapter | null>(null);
  const awardedResultRef = useRef<string | null>(null);
  const [reviewRewarded, setReviewRewarded] = useState(false);

  // Inicializar cliente de IA (Worker) uma vez
  useEffect(() => {
    const client = new QuelhasAIClient({
      onMetricsUpdate: (m) => {
        if (wasThinkingRef.current && !m.isThinking && typeof m.lastScore === 'number') {
          setEvalTrace((prev) => [...prev, normalizeEngineScore(m.lastScore)]);
        }
        wasThinkingRef.current = m.isThinking;
        setAiMetrics(m);
      },
      onReady: () => setAiReady(true),
    });
    aiClientRef.current = client;
    // The tutor owns its worker: its cancelled search cannot queue ahead of the opponent.
    const tutor = new QuelhasV1Adapter();
    tutorAdapterRef.current = tutor;
    return () => {
      tutorAdapterRef.current = null;
      tutor.terminate();
      client.terminate();
    };
  }, []);

  // Verificar se é a vez do humano jogar
  const isVezDoHumano = useCallback(() => {
    if (state.modo === 'dois-jogadores') return true;
    return state.jogadorAtual === humanPlayer;
  }, [state.modo, state.jogadorAtual, humanPlayer]);

  // Efeito para a IA decidir sobre a troca (se for ela a controlar o Horizontal)
  useEffect(() => {
    if (state.modo !== 'vs-computador') return;
    if (
      state.trocaDisponivel &&
      state.estado === 'a-jogar' &&
      state.jogadorAtual !== humanPlayer &&
      getOrientacaoJogador(state, state.jogadorAtual) === 'horizontal'
    ) {
      const timer = setTimeout(() => {
        const deveTrocar = decidirTrocaComputador(state);
        if (deveTrocar) {
          setState(prev => trocarOrientacoes(prev));
        } else {
          setState(prev => recusarTroca(prev));
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.trocaDisponivel, state.modo, state.estado, state.jogadorAtual, state, humanPlayer]);

  // Efeito para jogada do computador
  useEffect(() => {
    if (state.modo !== 'vs-computador') return;
    if (state.estado !== 'a-jogar') return;
    if (state.trocaDisponivel) return; // Aguardar decisão de troca primeiro

    const isVezDaIA = state.jogadorAtual !== humanPlayer;

    if (isVezDaIA && aiClientRef.current) {
      let cancelled = false;
      let finished = false;
      const client = aiClientRef.current;
      const timeBudgetMs = getDifficultyProfile(difficultyLevel, 'quelhas').timeBudgetMs;
      const maxWaitMs =
        difficultyLevel === 6 ? QUELHAS_SERVER_AI_WITH_FALLBACK_TIMEOUT_MS : timeBudgetMs + 250;
      const timer = setTimeout(async () => {
        if (cancelled || !client) return;

        try {
          const bestMove = await withTimeout(
            difficultyLevel === 6
              ? client.getBestMoveN6(state, { timeBudgetMs })
              : client.getBestMove(state, difficulty, { timeBudgetMs }),
            maxWaitMs,
            () => client.cancel()
          );
          if (cancelled) return;
          finished = true;
          setState(prev => {
            const mv = bestMove ?? emergencyMove(prev);
            return mv ? colocarSegmento(prev, mv) : prev;
          });
        } catch (e) {
          if (e instanceof Error && e.message === 'cancelled') return;
          console.error('[QuelhasGame] AI error:', e);
          if (cancelled) return;
          finished = true;
          setState(prev => {
            const mv = emergencyMove(prev);
            return mv ? colocarSegmento(prev, mv) : prev;
          });
        }
      }, 200);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        if (!finished) client?.cancel();
      };
    }
  }, [state.jogadorAtual, state.modo, state.estado, state.trocaDisponivel, humanPlayer, difficulty, difficultyLevel, state]);

  useEffect(() => {
    if (state.modo !== 'vs-computador') {
      setTutorLoading(false);
      return;
    }
    if (state.estado !== 'a-jogar' || state.trocaDisponivel || !isVezDoHumano()) {
      setTutorLoading(false);
      return;
    }
    if (!tutorAdapterRef.current) {
      return;
    }

    let cancelled = false;
    const adapter = tutorAdapterRef.current;
    const request: AIRequestV1<QuelhasState, QuelhasState['jogadasValidas'][number]> = {
      version: '1.0',
      requestId: `quelhas-tutor-${Date.now()}`,
      gameId: 'quelhas',
      mode: 'tutor',
      level: clampDifficultyLevel(difficultyLevel),
      state,
      locale: 'pt-PT',
    };

    setTutorLoading(true);

    void adapter
      .compute(request)
      .then((response) => {
        if (cancelled) return;
        setTutorResponse(response);
        setTutorPosition(tutorTurn);
        setTutorHistory((prev) => [...prev.slice(-5), response]);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[QuelhasGame] Tutor error:', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTutorLoading(false);
        }
      });

    return () => {
      cancelled = true;
      adapter.cancel();
    };
  }, [difficultyLevel, isVezDoHumano, tutorTurn]);

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

    recordGameCompleted('quelhas', humanWon, state.modo === 'vs-computador' ? difficultyLevel : undefined);
    awardedResultRef.current = state.estado;
  }, [difficultyLevel, humanPlayer, recordGameCompleted, state.estado, state.modo]);

  // Limpar posição inicial quando muda o jogador
  useEffect(() => {
    setPosicaoInicial(null);
  }, [state.jogadorAtual]);

  const handleCellClick = useCallback((pos: Posicao, celula: Celula) => {
    if (state.estado !== 'a-jogar') return;
    if (!isVezDoHumano()) return;
    if (state.trocaDisponivel) return; // Aguardar decisão de troca
    if (celula === 'ocupada') return;

    if (posicaoInicial === null) {
      // Primeiro clique: definir posição inicial
      if (isPosicaoInicioValida(state, pos)) {
        setPosicaoInicial(pos);
      }
    } else {
      // Segundo clique: tentar criar segmento
      const segmento = criarSegmentoEntrePosicoes(state, posicaoInicial, pos);
      if (segmento) {
        if (tutorResponse && tutorPosition === tutorTurn && !tutorLoading && state.modo === 'vs-computador') {
          recordAdaptiveDecision('quelhas', {
            successful: tutorResponse.topMoves.some(({ move }) =>
              formatSegmento(move) === formatSegmento(segmento)
            ),
            usedHint: thinking.usedHint,
          });
        }
        setState(prev => colocarSegmento(prev, segmento));
        setPosicaoInicial(null);
      } else {
        // Segmento inválido, tentar usar esta posição como novo início
        if (isPosicaoInicioValida(state, pos)) {
          setPosicaoInicial(pos);
        } else {
          setPosicaoInicial(null);
        }
      }
    }
  }, [state, posicaoInicial, isVezDoHumano, tutorResponse, recordAdaptiveDecision, thinking.usedHint, tutorPosition, tutorTurn, tutorLoading]);

  const handleMouseEnter = useCallback((pos: Posicao, celula: Celula) => {
    if (state.estado !== 'a-jogar') return;
    if (!isVezDoHumano()) return;
    if (state.trocaDisponivel) return;
    if (celula === 'ocupada') return;

    if (posicaoInicial) {
      // Mostrar preview do segmento entre posição inicial e atual
      const segmento = criarSegmentoEntrePosicoes(state, posicaoInicial, pos);
      setState(prev => atualizarPreview(prev, segmento));
    }
  }, [state, posicaoInicial, isVezDoHumano]);

  const handleMouseLeave = useCallback(() => {
    if (state.estado !== 'a-jogar') return;
    if (!isVezDoHumano()) return;
    if (state.trocaDisponivel) return;
    if (!state.segmentoPreview) return;
    setState(prev => ({ ...prev, segmentoPreview: null }));
  }, [state.estado, state.trocaDisponivel, state.segmentoPreview, isVezDoHumano]);

  const novoJogo = useCallback(() => {
    aiClientRef.current?.cancel();
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
    setAiMetrics(INITIAL_METRICS);
    setEvalTrace([]);
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    thinking.reset();
    resetAdaptiveSession('quelhas');
  }, [resetAdaptiveSession, state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    aiClientRef.current?.cancel();
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
    setAiMetrics(INITIAL_METRICS);
    setEvalTrace([]);
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    thinking.reset();
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    aiClientRef.current?.cancel();
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
    setAiMetrics(INITIAL_METRICS);
    setEvalTrace([]);
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    thinking.reset();
  }, []);

  const handleChangeDifficulty = useCallback((level: ExtendedDifficultyLevel) => {
    setDifficultyLevel(level);
  }, []);

  const difficultyRecommendation = getDifficultyRecommendation('quelhas', clampDifficultyLevel(difficultyLevel));

  const handleTroca = useCallback(() => {
    setState(prev => trocarOrientacoes(prev));
  }, []);

  const handleRecusarTroca = useCallback(() => {
    setState(prev => recusarTroca(prev));
  }, []);

  // Verificar se uma célula faz parte do preview
  const isPreview = (linha: number, coluna: number): boolean => {
    if (!state.segmentoPreview) return false;
    const celulas = getCelulasSegmento(state.segmentoPreview);
    return celulas.some(c => c.linha === linha && c.coluna === coluna);
  };

  // Verificar se uma célula é a posição inicial selecionada
  const isPosicaoInicialSelecionada = (linha: number, coluna: number): boolean => {
    return posicaoInicial !== null &&
           posicaoInicial.linha === linha &&
           posicaoInicial.coluna === coluna;
  };

  // Obter a orientação atual do jogador
  const orientacaoAtual = getOrientacaoJogador(state, state.jogadorAtual);

  // Obter classe CSS para cada célula
  const getCelulaClasses = (linha: number, coluna: number, celula: Celula): string => {
    const preview = isPreview(linha, coluna);
    const inicioSelecionado = isPosicaoInicialSelecionada(linha, coluna);
    const recommended = showTutorSolution && tutorResponse?.bestMove
      ? getCelulasSegmento(tutorResponse.bestMove).some((cell) => cell.linha === linha && cell.coluna === coluna)
      : false;
    const threatened = criticalThreat?.counterMove
      ? getCelulasSegmento(criticalThreat.counterMove).some((cell) => cell.linha === linha && cell.coluna === coluna)
      : false;

    let classes = 'aspect-square rounded-sm flex items-center justify-center transition-all duration-150 text-xs font-bold ';

    if (celula === 'ocupada') {
      classes += 'bg-indigo-600';
    } else if (inicioSelecionado) {
      classes += orientacaoAtual === 'vertical'
        ? 'bg-pink-500 ring-2 ring-pink-300 cursor-pointer scale-110'
        : 'bg-cyan-500 ring-2 ring-cyan-300 cursor-pointer scale-110';
    } else if (preview) {
      classes += orientacaoAtual === 'vertical'
        ? 'bg-pink-400 ring-2 ring-pink-300 cursor-pointer'
        : 'bg-cyan-400 ring-2 ring-cyan-300 cursor-pointer';
    } else {
      classes += 'bg-gray-200 hover:bg-gray-300 cursor-pointer';
    }

    if (recommended) {
      classes += ' ring-4 ring-amber-400 ring-offset-1 ring-offset-white ';
    } else if (threatened) {
      classes += ' ring-4 ring-rose-400 ring-offset-1 ring-offset-white ';
    }

    return classes;
  };

  const mostrarUiTroca =
    state.trocaDisponivel &&
    state.estado === 'a-jogar' &&
    getOrientacaoJogador(state, state.jogadorAtual) === 'horizontal' &&
    (state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer);
  const criticalThreat = showTutorSolution ? tutorResponse?.criticalThreats?.[0] : undefined;
  const quickReviewItems = buildQuickReviewItems(tutorHistory);
  const reviewPattern = selectReviewPattern('quelhas', tutorHistory.at(-1) ?? tutorResponse);

  // Determinar nomes dos jogadores baseado nas orientações atuais
  const getNomeJogador = (jogador: 'jogador1' | 'jogador2') => {
    const orientacao = getOrientacaoJogador(state, jogador);
    return orientacao === 'vertical' ? 'Vertical' : 'Horizontal';
  };

  return (
    <GameLayout titulo="Quelhas" regras={REGRAS} onVoltar={onVoltar}>
      <div className="flex flex-col gap-4">
        {/* Info do jogador — em mobile passa para depois do tabuleiro */}
        <div className="order-4 lg:order-none">
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1={getNomeJogador('jogador1')}
          nomeJogador2={getNomeJogador('jogador2')}
          corJogador1={state.orientacaoJogador1 === 'vertical' ? 'bg-pink-500' : 'bg-cyan-500'}
          corJogador2={state.orientacaoJogador2 === 'vertical' ? 'bg-pink-500' : 'bg-cyan-500'}
          humanPlayer={humanPlayer}
          onChangeHumanPlayer={handleChangeHumanPlayer}
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
          difficulty={difficultyLevel}
          onChangeDifficulty={handleChangeDifficulty}
          maxDifficultyLevel={6}
          difficultyRecommendation={difficultyRecommendation}
          canAcceptDifficultyRecommendation={state.estado !== 'a-jogar'}
          onAcceptDifficultyRecommendation={(level) => {
            setDifficultyLevel(level);
            acceptDifficultyRecommendation('quelhas');
          }}
          aiMetrics={aiMetrics}
          aiReady={aiReady}
        />
        {state.modo === 'vs-computador' && difficultyLevel === 6 && (
          <div className="mt-2 rounded-xl border p-2 text-center text-xs [border-color:var(--linha)] [background:var(--painel)] [color:var(--tinta-suave)]">
            {t(aiMetrics.isThinking ? 'IA a pensar…' : 'IA pronta')}
            {t(' • ')}
            {t(aiMetrics.lastEngine === 'server-nn'
              ? 'Rede neural · GPU'
              : aiMetrics.lastEngine === 'exact-endgame'
                ? 'Final resolvido'
                : aiMetrics.lastEngine === 'rust-wasm'
                  ? 'N5 local (WASM)'
                  : 'N5 local')}
          </div>
        )}
        {state.modo === 'vs-computador' && state.estado !== 'a-jogar' && (
          <EvalChart
            values={evalTrace}
            humanWon={
              (state.estado === 'vitoria-jogador1' && humanPlayer === 'jogador1') ||
              (state.estado === 'vitoria-jogador2' && humanPlayer === 'jogador2')
            }
          />
        )}
        </div>

        <div className="order-5 lg:order-none">
          <TrainingPathCard gameId="quelhas" />
        </div>

        {/* UI de decisão de troca */}
        {mostrarUiTroca && (
          <div className="order-3 lg:order-none rounded-xl border-2 p-4 [background:var(--painel)] [border-color:var(--jogo-quelhas)]">
            <p className="font-semibold text-sm mb-2 text-center [color:var(--tinta)]">{t("🔄 Regra de Troca")}</p>
            <p className="text-xs mb-3 text-center [color:var(--tinta-suave)]">{t("Podes trocar de papel e ficar com a jogada que o Vertical acabou de fazer. A troca consome a tua jogada — a seguir joga o adversário.")}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleTroca}
                className="px-4 py-2 text-white rounded-lg font-medium text-sm transition-[filter] [background:var(--jogo-quelhas)] hover:brightness-110"
              >{t("Trocar papéis")}</button>
              <button
                onClick={handleRecusarTroca}
                className="px-4 py-2 border rounded-lg font-medium text-sm transition-colors [background:var(--painel)] [color:var(--jogo-quelhas)] [border-color:var(--linha)] hover:[border-color:var(--jogo-quelhas)]"
              >{t("Manter como está")}</button>
            </div>
          </div>
        )}

        {/* Aviso Misère (objetivo) — compacto, fica acima do tabuleiro em mobile */}
        <div className="order-1 lg:order-none rounded-xl border px-3 py-2 text-center [background:color-mix(in_srgb,var(--ouro)_14%,var(--painel))] [border-color:var(--ouro)]">
          <p className="font-semibold text-sm [color:var(--tinta)]">{t("⚠️ MISÈRE: Quem fizer a última jogada PERDE!")}</p>
        </div>

        {/* Tabuleiro */}
        <div className="game-container order-2 lg:order-none">
          <div className="aspect-square max-w-lg mx-auto">
            <div
              className="grid grid-cols-10 gap-0.5 h-full bg-gray-400 p-1 rounded-xl"
              onMouseLeave={handleMouseLeave}
            >
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((celula, colunaIdx) => (
                  <button
                    key={`${linhaIdx}-${colunaIdx}`}
                    onClick={() => handleCellClick({ linha: linhaIdx, coluna: colunaIdx }, celula)}
                    onMouseEnter={() => handleMouseEnter({ linha: linhaIdx, coluna: colunaIdx }, celula)}
                    className={getCelulaClasses(linhaIdx, colunaIdx, celula)}
                    disabled={celula === 'ocupada'}
                  />
                ))
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex justify-center gap-6 text-sm [color:var(--tinta-suave-no-papel)]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-6 bg-pink-500 rounded"></div>
              <span>{t("Vertical")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-cyan-500 rounded"></div>
              <span>{t("Horizontal")}</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm [color:var(--tinta-suave-no-papel)]">
            {state.estado === 'a-jogar' && !state.trocaDisponivel && (
              isVezDoHumano() ? (
                <>
                  {posicaoInicial ? (
                    <span className="font-medium [color:var(--jogo-quelhas)]">{t("Clica na casa final do segmento ")}{t(orientacaoAtual === 'vertical' ? 'VERTICAL' : 'HORIZONTAL')}
                    </span>
                  ) : (
                    <span>{t("Clica na casa inicial do segmento ")}{t(orientacaoAtual === 'vertical' ? 'VERTICAL' : 'HORIZONTAL')}
                    </span>
                  )}
                  {t(' ')}{msg("• Segmentos possíveis agora: {0}", [state.jogadasValidas.length])}
                </>
              ) : (
                <span className="flex items-center justify-center gap-2 font-medium [color:var(--jogo-quelhas)]">
                  <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin [border-color:var(--jogo-quelhas)] [border-top-color:transparent]"></span>{t("IA a pensar…")}</span>
              )
            )}
            {state.trocaDisponivel && !mostrarUiTroca && (
              <span className="font-medium [color:var(--jogo-quelhas)]">{t("A IA está a decidir sobre a troca de papéis...")}</span>
            )}
          </div>
        </div>

        {state.estado === 'a-jogar' && !state.trocaDisponivel && isVezDoHumano() && (
          <div className="order-6 lg:order-none space-y-3">
            <ThinkingTutor gameId="quelhas" tutor={thinking} solutionReady={showTutorSolution}>
              {showTutorSolution && <>
                <TutorContextBar items={buildTutorContextItems(tutorResponse)} />
                <HintLegend showThreat={Boolean(criticalThreat)} showAlternative={false} />
                <TutorHintCard
                  insight={
                    tutorResponse?.explainText ||
                    'Compara segmentos de comprimentos diferentes e prevê quem ficará sem jogadas primeiro.'
                  }
                  suggestedAction="Compara segmentos de comprimentos diferentes e prevê quem ficará sem jogadas primeiro."
                  hintLevel={hintLevel}
                  errorCode={tutorResponse?.pedagogy?.errorCode}
                  isLoading={tutorLoading}
                />

                <TopMovesRail moves={tutorResponse?.topMoves ?? []} isLoading={tutorLoading} />

                {criticalThreat && (
                  <section
                    className={`rounded-xl border px-4 py-3 text-sm ${getThreatClasses(criticalThreat.severity)}`}
                  >
                    <p className="font-semibold">{t("Ameaça crítica: ")}{t(criticalThreat.title)}</p>
                    <p className="mt-1">{t(criticalThreat.description)}</p>
                    {criticalThreat.counterMove && (
                      <p className="mt-1 font-medium">{t("Resposta mínima: ")}{t(formatSegmento(criticalThreat.counterMove))}
                      </p>
                    )}
                  </section>
                )}
              </>}
            </ThinkingTutor>
          </div>
        )}

        {state.estado !== 'a-jogar' && quickReviewItems.length > 0 && (
          <section className="order-7 lg:order-none rounded-xl border px-4 py-3 text-sm [background:var(--painel)] [border-color:color-mix(in_srgb,var(--sucesso)_45%,var(--linha))] [color:var(--tinta)]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{t("Revisão rápida pós-jogo")}</p>
              <span className="rounded-full px-2 py-0.5 text-xs font-medium [background:color-mix(in_srgb,var(--sucesso)_15%,var(--painel))] [color:var(--sucesso)]">{t("2-4 min")}</span>
            </div>
            <p className="mt-1 [color:var(--tinta-suave)]">{t("Revê até 2 momentos e tenta repetir a alternativa mais segura.")}</p>
            <p className="mt-2 rounded-lg px-3 py-2 font-medium [background:color-mix(in_srgb,var(--sucesso)_12%,var(--painel))]">{t("Cartão descoberto: ")}{t(reviewPattern.title)} — {t(reviewPattern.description)}
            </p>
            <div className="mt-2 space-y-2">
              {quickReviewItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border px-3 py-2 [border-color:var(--linha)] [background:var(--fundo)]"
                >
                  <p className="font-medium [color:var(--tinta)]">{t(item.title)}</p>
                  <p className="mt-1 [color:var(--tinta-suave)]">{t(item.insight)}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={reviewRewarded}
              onClick={() => {
                if (reviewRewarded) return;
                recordReviewCompleted('quelhas');
                recordPatternProgress({
                  gameId: 'quelhas', patternId: reviewPattern.id, evidence: 'seen', contextId: `review-${Date.now()}`,
                });
                setReviewRewarded(true);
              }}
              className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-[filter] [background:var(--sucesso)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t(reviewRewarded ? 'Revisão registada' : 'Marcar revisão concluída (+10 XP)')}
            </button>
          </section>
        )}
      </div>

      {/* Anúncio de vencedor */}
      {mostrarVencedor && (
        <WinnerAnnouncement
          estado={state.estado}
          modo={state.modo}
          nomeJogador1={getNomeJogador('jogador1')}
          nomeJogador2={getNomeJogador('jogador2')}
          humanoEhJogador1={humanPlayer === 'jogador1'}
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}
