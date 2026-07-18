import { useState, useEffect, useCallback, useRef } from 'react';
import { buildTutorContextItems } from '../../ai-core/tutor-context';
import { selectReviewPattern } from '../../ai-core/review-patterns';
import {
  clampDifficultyLevel,
  getDifficultyProfile,
  type ExtendedDifficultyLevel,
} from '../../ai-core/difficulty';
import { GameLayout } from '../../components/GameLayout';
import { DifficultySelector } from '../../components/DifficultySelector';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { PlayerInfo } from '../../components/PlayerInfo';
import { TrainingPathCard } from '../../components/TrainingPathCard';
import { HintLegend } from '../../components/tutor/HintLegend';
import { TutorContextBar } from '../../components/tutor/TutorContextBar';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import type { AIRequestV1, AIResponseV1, DifficultyLevel } from '../../ai-core';
import { AtariGoState, Posicao, TAMANHO_TABULEIRO } from './types';
import {
  criarEstadoInicial,
  colocarPedra,
  isJogadaValida,
  jogadaComputador,
} from './logic';
import { GameMode, Player } from '../../types';
import {
  AtariGoAIClient,
  SERVER_AI_WITH_FALLBACK_TIMEOUT_MS,
  idxToPos,
} from './ai/ai-client';
import { AtariGoV1Adapter, mapLevelToLegacyDifficulty } from './ai/v1-adapter';
import { INITIAL_METRICS, type AIDifficulty, type AIMetrics } from './ai/types';
import { withTimeout } from '../../utils/withTimeout';
import { TutorHintCard } from './components/TutorHintCard';
import { TopMovesRail } from './components/TopMovesRail';

interface AtariGoGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro 9×9 (joga-se nas interseções).',
  'Pretas jogam primeiro.',
  'Grupo: pedras da mesma cor ligadas na vertical/horizontal.',
  'Liberdade: interseção vazia ao lado de um grupo.',
  'Se um grupo ficar com 0 liberdades, é capturado e removido.',
  'Suicídio proibido (exceto se captura pedras adversárias).',
  'OBJETIVO: O primeiro a fazer QUALQUER captura VENCE!',
];

function formatMove(move: Posicao): string {
  return `(${move.linha + 1},${move.coluna + 1})`;
}

function getSuggestedAction(
  response: AIResponseV1<Posicao, AtariGoState> | null,
  hintLevel: 'H1' | 'H2' | 'H3',
): string {
  if (!response?.bestMove) {
    return 'Mantém grupos com mais de uma liberdade para evitar captura imediata.';
  }

  if (hintLevel === 'H1') {
    return 'Prioriza a jogada que aumenta as tuas liberdades e reduz as respostas locais do adversário.';
  }

  if (hintLevel === 'H2') {
    return response.criticalThreats?.[0]
      ? 'Defende primeiro o grupo mais exposto e só depois procura contra-atacar.'
      : 'Procura uma jogada que aperte o grupo rival sem deixares o teu em atari.';
  }

  return response.criticalThreats?.[0]
    ? 'Se estiveres em dúvida, começa pela interseção destacada e confirma que o adversário deixa de ter captura imediata.'
    : 'Se estiveres em dúvida, começa pela interseção destacada e verifica se ficas com mais liberdades do que antes.';
}

function resolveHintLevel(
  response: AIResponseV1<Posicao, AtariGoState> | null,
  fallback: 'H1' | 'H2' | 'H3' = 'H2',
): 'H1' | 'H2' | 'H3' {
  const suggested = response?.pedagogy?.hintLevelSuggested;
  return suggested === 'H1' || suggested === 'H2' || suggested === 'H3' ? suggested : fallback;
}

function getThreatClasses(severity: 'low' | 'medium' | 'high'): string {
  if (severity === 'high') {
    return '[border-color:color-mix(in_srgb,var(--perigo)_45%,var(--linha))] [background:color-mix(in_srgb,var(--perigo)_12%,var(--painel))] [color:var(--tinta)]';
  }

  if (severity === 'medium') {
    return '[border-color:color-mix(in_srgb,var(--ouro)_55%,var(--linha))] [background:color-mix(in_srgb,var(--ouro)_12%,var(--painel))] [color:var(--tinta)]';
  }

  return '[border-color:var(--linha)] [background:var(--painel)] [color:var(--tinta)]';
}

function getPostGameTurningPoint(
  history: Array<AIResponseV1<Posicao, AtariGoState>>,
): AIResponseV1<Posicao, AtariGoState>['turningPoints'][number] | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const point = history[i].turningPoints?.[0];
    if (point) return point;
  }
  return null;
}

export function AtariGoGame({ onVoltar }: AtariGoGameProps) {
  const {
    acceptDifficultyRecommendation,
    getDifficultyRecommendation,
    recordAdaptiveDecision,
    recordGameCompleted,
    recordPatternProgress,
    recordReviewCompleted,
    resetAdaptiveSession,
  } = useGamification();
  const [state, setState] = useState<AtariGoState>(() =>
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [difficultyLevel, setDifficultyLevel] = useState<ExtendedDifficultyLevel>(3);
  const adaptiveDifficultyLevel: DifficultyLevel = clampDifficultyLevel(difficultyLevel);
  const aiDifficulty: AIDifficulty = mapLevelToLegacyDifficulty(adaptiveDifficultyLevel);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics>({ ...INITIAL_METRICS });
  const [tutorResponse, setTutorResponse] =
    useState<AIResponseV1<Posicao, AtariGoState> | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorHistory, setTutorHistory] = useState<Array<AIResponseV1<Posicao, AtariGoState>>>([]);
  const [hintLevel, setHintLevel] = useState<'H1' | 'H2' | 'H3'>('H2');
  const aiRef = useRef<AtariGoAIClient | null>(null);
  const tutorAdapterRef = useRef<AtariGoV1Adapter | null>(null);
  const tutorRequestSeqRef = useRef(0);
  const awardedResultRef = useRef<string | null>(null);
  const [reviewRewarded, setReviewRewarded] = useState(false);

  useEffect(() => {
    aiRef.current = new AtariGoAIClient({
      onMetricsUpdate: m => setAiMetrics(m),
    });
    return () => aiRef.current?.terminate();
  }, []);

  useEffect(() => {
    const adapter = new AtariGoV1Adapter();
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
      setTutorLoading(false);
      return;
    }

    if (isVezDaIA) {
      setTutorLoading(false);
      return;
    }

    const requestId = `atari-tutor-${Date.now()}-${++tutorRequestSeqRef.current}`;
    const request: AIRequestV1<AtariGoState, Posicao> = {
      version: '1.0',
      requestId,
      gameId: 'atari-go',
      mode: 'tutor',
      level: adaptiveDifficultyLevel,
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
        setHintLevel((current) => resolveHintLevel(response, current));
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
    state,
    state.tabuleiro,
    state.estado,
    state.jogadorAtual,
    state.modo,
    state.pedrasCapturadas.brancas,
    state.pedrasCapturadas.pretas,
    isVezDaIA,
    difficultyLevel,
  ]);

  // Efeito para jogada do computador
  useEffect(() => {
    if (
      state.modo === 'vs-computador' &&
      state.jogadorAtual !== humanPlayer &&
      state.estado === 'a-jogar'
    ) {
      let cancelled = false;
      const client = aiRef.current;
      let finished = false;
      const timeBudgetMs = getDifficultyProfile(difficultyLevel, 'atari-go').timeBudgetMs;
      const maxWaitMs =
        difficultyLevel === 6 ? SERVER_AI_WITH_FALLBACK_TIMEOUT_MS : timeBudgetMs + 250;

      const run = async () => {
        // Pequeno delay para UX (e para permitir UI atualizar)
        await new Promise(r => setTimeout(r, 80));
        if (cancelled) return;

        try {
          const mv = client
            ? await withTimeout(client.getBestMove(state, aiDifficulty, { timeBudgetMs, level: difficultyLevel }), maxWaitMs, () => client.cancel())
            : null;
          if (cancelled) return;

          if (mv === null) {
            // fallback TS local (IA básica)
            finished = true;
            setState(prev => jogadaComputador(prev));
            return;
          }

          finished = true;
          setState(prev => {
            if (
              prev.modo !== 'vs-computador' ||
              prev.estado !== 'a-jogar' ||
              prev.jogadorAtual === humanPlayer
            ) {
              return prev;
            }
            const pos = idxToPos(mv);
            if (!isJogadaValida(prev, pos)) {
              return jogadaComputador(prev);
            }
            return colocarPedra(prev, pos);
          });
        } catch {
          if (cancelled) return;
          finished = true;
          setState(prev => jogadaComputador(prev));
        }
      };

      void run();

      return () => {
        cancelled = true;
        if (!finished) client?.cancel();
      };
    }
  }, [state, humanPlayer, aiDifficulty, difficultyLevel]);

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

    recordGameCompleted('atari-go', humanWon);
    awardedResultRef.current = state.estado;
  }, [humanPlayer, recordGameCompleted, state.estado, state.modo]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;

    if (isJogadaValida(state, pos)) {
      if (tutorResponse) {
        recordAdaptiveDecision('atari-go', {
          successful: tutorResponse.topMoves.some(({ move }) =>
            move.linha === pos.linha && move.coluna === pos.coluna
          ),
          usedHint: hintLevel === 'H3',
        });
      }
      setState(prev => colocarPedra(prev, pos));
    }
  }, [state, humanPlayer, tutorResponse, recordAdaptiveDecision, hintLevel]);

  const novoJogo = useCallback(() => {
    aiRef.current?.cancel();
    tutorAdapterRef.current?.cancel();
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setTutorResponse(null);
    setTutorLoading(false);
    setTutorHistory([]);
    setHintLevel('H2');
    resetAdaptiveSession('atari-go');
  }, [resetAdaptiveSession, state.modo]);

  const trocarModo = useCallback(() => {
    aiRef.current?.cancel();
    tutorAdapterRef.current?.cancel();
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setHumanPlayer('jogador1');
    setTutorResponse(null);
    setTutorLoading(false);
    setTutorHistory([]);
    setHintLevel('H2');
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    aiRef.current?.cancel();
    tutorAdapterRef.current?.cancel();
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
    setTutorResponse(null);
    setTutorLoading(false);
    setTutorHistory([]);
    setHintLevel('H2');
  }, []);

  // Verificar se é última jogada
  const isUltimaJogada = (linha: number, coluna: number): boolean => {
    return state.ultimaJogada !== null &&
           state.ultimaJogada.linha === linha &&
           state.ultimaJogada.coluna === coluna;
  };

  // Verificar se é jogada válida
  const isJogadaValidaPos = (linha: number, coluna: number): boolean => {
    return state.jogadasValidas.some(j => j.linha === linha && j.coluna === coluna);
  };

  // Renderizar uma interseção do tabuleiro
  const renderIntersecao = (linha: number, coluna: number) => {
    const celula = state.tabuleiro[linha][coluna];
    const ultimaJogada = isUltimaJogada(linha, coluna);
    const jogadaValida = isJogadaValidaPos(linha, coluna);
    const isVezDoHumano = state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer;
    const recommended =
      tutorResponse?.bestMove?.linha === linha && tutorResponse.bestMove.coluna === coluna;
    const threatened =
      criticalThreat?.counterMove?.linha === linha && criticalThreat.counterMove.coluna === coluna;

    // Calcular posição das linhas do grid
    const isTop = linha === 0;
    const isBottom = linha === TAMANHO_TABULEIRO - 1;
    const isLeft = coluna === 0;
    const isRight = coluna === TAMANHO_TABULEIRO - 1;

    return (
      <button
        key={`${linha}-${coluna}`}
        onClick={() => handleCellClick({ linha, coluna })}
        className={`
          relative w-full aspect-square
          ${jogadaValida && isVezDoHumano && state.estado === 'a-jogar' ? 'cursor-pointer' : 'cursor-default'}
        `}
        disabled={!jogadaValida || state.estado !== 'a-jogar'}
      >
        {/* Linhas do grid */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Linha horizontal */}
          <div
            className={`absolute h-[2px] bg-gray-800 top-1/2 -translate-y-1/2
              ${isLeft ? 'left-1/2 right-0' : isRight ? 'left-0 right-1/2' : 'left-0 right-0'}
            `}
          />
          {/* Linha vertical */}
          <div
            className={`absolute w-[2px] bg-gray-800 left-1/2 -translate-x-1/2
              ${isTop ? 'top-1/2 bottom-0' : isBottom ? 'top-0 bottom-1/2' : 'top-0 bottom-0'}
            `}
          />
        </div>

        {/* Pontos de referência (hoshi) */}
        {((linha === 2 || linha === 4 || linha === 6) && (coluna === 2 || coluna === 4 || coluna === 6)) && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-800 rounded-full z-10" />
        )}

        {/* Pedra */}
        {celula !== 'vazia' && (
          <div
            className={`
              absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-[85%] h-[85%] rounded-full z-20
              ${celula === 'preta'
                ? 'bg-gradient-to-br from-gray-700 via-gray-900 to-black shadow-lg'
                : 'bg-gradient-to-br from-white via-gray-100 to-gray-200 shadow-lg border border-gray-300'
              }
              ${ultimaJogada ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''}
            `}
          >
            {/* Brilho da pedra */}
            <div
              className={`absolute top-1 left-1 w-3 h-3 rounded-full
                ${celula === 'preta' ? 'bg-gray-600' : 'bg-white'}
                opacity-60
              `}
            />
            {/* Marcador de última jogada */}
            {ultimaJogada && (
              <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                  w-3 h-3 rounded-full
                  ${celula === 'preta' ? 'bg-white' : 'bg-black'}
                `}
              />
            )}
          </div>
        )}

        {/* Indicador de jogada válida */}
        {celula === 'vazia' && jogadaValida && isVezDoHumano && state.estado === 'a-jogar' && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-[40%] h-[40%] rounded-full bg-green-400 opacity-40 z-10
              hover:opacity-70 transition-opacity"
          />
        )}

        {celula === 'vazia' && recommended && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-[62%] h-[62%] rounded-full border-4 border-amber-400 z-10"
          />
        )}

        {celula === 'vazia' && !recommended && threatened && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              w-[62%] h-[62%] rounded-full border-4 border-rose-400 z-10"
          />
        )}
      </button>
    );
  };

  const criticalThreat = tutorResponse?.criticalThreats?.[0];
  const postGameTurningPoint = getPostGameTurningPoint(tutorHistory);
  const reviewPattern = selectReviewPattern('atari-go', tutorHistory.at(-1) ?? tutorResponse);
  const difficultyRecommendation = getDifficultyRecommendation('atari-go', adaptiveDifficultyLevel);

  return (
    <GameLayout titulo="Atari Go" regras={REGRAS} onVoltar={onVoltar}>
      <div className="flex flex-col gap-4">
        {/* Info do jogador — em mobile passa para depois do tabuleiro */}
        <div className="order-3 md:order-none">
          <PlayerInfo
            modo={state.modo}
            jogadorAtual={state.jogadorAtual}
            estado={state.estado}
            nomeJogador1="Pretas"
            nomeJogador2="Brancas"
            corJogador1="bg-gray-900"
            corJogador2="bg-gray-100"
            humanPlayer={humanPlayer}
            onChangeHumanPlayer={handleChangeHumanPlayer}
            onNovoJogo={novoJogo}
            onTrocarModo={trocarModo}
          />
        </div>

        <div className="order-4 md:order-none">
          <TrainingPathCard gameId="atari-go" />
        </div>

        {/* Aviso de vitória na primeira captura — faixa compacta acima do tabuleiro */}
        <div className="order-1 md:order-none border-2 rounded-xl p-2 md:p-3 text-center [border-color:var(--perigo)] [background:color-mix(in_srgb,var(--perigo)_10%,var(--painel))]">
          <p className="font-semibold text-sm [color:var(--tinta)]">
            ⚔️ OBJETIVO: A primeira captura VENCE o jogo!
          </p>
        </div>

        {/* Configuração da IA — em mobile passa para depois do tabuleiro */}
        {state.modo === 'vs-computador' && (
          <div className="order-5 md:order-none space-y-2">
            <DifficultySelector
              level={difficultyLevel}
              maxLevel={6}
              onChange={setDifficultyLevel}
              disabled={aiMetrics.isThinking}
              recommendation={difficultyRecommendation}
              canAcceptRecommendation={state.estado !== 'a-jogar'}
              onAcceptRecommendation={(level) => {
                setDifficultyLevel(level);
                acceptDifficultyRecommendation('atari-go');
              }}
            />
            <div className="rounded-xl border p-2 text-center text-xs [border-color:var(--linha)] [background:var(--painel)] [color:var(--tinta-suave)]">
                {aiMetrics.isThinking ? 'IA a pensar…' : 'IA pronta'}
                {' • '}
                {aiMetrics.lastEngine === 'server-nn'
                  ? 'Rede neural · GPU'
                  : aiMetrics.usedWasm
                    ? 'WASM'
                    : 'TS fallback'}
                {' • '}
                {aiMetrics.lastTimeMs.toFixed(0)}ms
            </div>
          </div>
        )}

        {/* Tabuleiro */}
        <div className="game-container order-2 md:order-none">
          <div className="aspect-square max-w-md mx-auto">
            <div
              className="w-full h-full bg-amber-200 p-4 rounded-xl shadow-inner"
              style={{
                backgroundImage: 'linear-gradient(135deg, #f5d89a 0%, #e8c76b 100%)',
              }}
            >
              <div className="grid grid-cols-9 gap-0 h-full w-full">
                {Array.from({ length: TAMANHO_TABULEIRO }, (_, linha) =>
                  Array.from({ length: TAMANHO_TABULEIRO }, (_, coluna) =>
                    renderIntersecao(linha, coluna)
                  )
                )}
              </div>
            </div>
          </div>

          {/* Legenda e estatísticas */}
          <div className="mt-4 flex flex-col items-center gap-2 text-sm [color:var(--tinta-suave-no-papel)]">
            <div className="flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-black border border-gray-600"></div>
                <span>Pretas (J1)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-white to-gray-200 border border-gray-300"></div>
                <span>Brancas (J2)</span>
              </div>
            </div>
            <div className="flex justify-center gap-4 text-xs">
              <span>Capturadas pelas Pretas: {state.pedrasCapturadas.brancas}</span>
              <span>Capturadas pelas Brancas: {state.pedrasCapturadas.pretas}</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm [color:var(--tinta-suave-no-papel)]">
            {state.estado === 'a-jogar' && (
              isVezDaIA ? (
                <span className="flex items-center justify-center gap-2 font-medium [color:var(--tinta-no-papel)]">
                  <span className="inline-block w-4 h-4 border-2 [border-color:var(--tinta-suave-no-papel)] [border-top-color:transparent] rounded-full animate-spin"></span>
                  IA a pensar…
                </span>
              ) : (
                <>
                  {state.jogadorAtual === 'jogador1'
                    ? 'Pretas: clica numa interseção para colocar uma pedra'
                    : 'Brancas: clica numa interseção para colocar uma pedra'}
                  {' '}• Jogadas disponíveis: {state.jogadasValidas.length}
                </>
              )
            )}
          </div>
        </div>

        {state.estado === 'a-jogar' && !isVezDaIA && (
          <div className="order-6 md:order-none space-y-3">
            <TutorContextBar items={buildTutorContextItems(tutorResponse)} />
            <HintLegend showThreat={Boolean(criticalThreat)} showAlternative />
            <TutorHintCard
              insight={
                tutorResponse?.explainText ||
                'Mantém a leitura local de liberdades antes de atacar.'
              }
              suggestedAction={getSuggestedAction(tutorResponse, hintLevel)}
              hintLevel={hintLevel}
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

        {state.estado !== 'a-jogar' && postGameTurningPoint && (
          <section className="order-7 md:order-none rounded-xl border px-4 py-3 text-sm [border-color:color-mix(in_srgb,var(--sucesso)_45%,var(--linha))] [background:color-mix(in_srgb,var(--sucesso)_10%,var(--painel))] [color:var(--tinta)]">
            <p className="font-semibold">Turning point pós-jogo</p>
            <p className="mt-1 [color:var(--tinta-suave)]">{postGameTurningPoint.explanation}</p>
            <p className="mt-2 rounded-lg px-3 py-2 font-medium [background:color-mix(in_srgb,var(--sucesso)_18%,var(--painel))]">
              Cartão descoberto: {reviewPattern.title} — {reviewPattern.description}
            </p>
            <p className="mt-1 font-medium">
              Jogada recomendada: {formatMove(postGameTurningPoint.bestMove ?? postGameTurningPoint.playedMove)}
            </p>
            <button
              type="button"
              disabled={reviewRewarded}
              onClick={() => {
                if (reviewRewarded) return;
                recordReviewCompleted('atari-go');
                recordPatternProgress({
                  gameId: 'atari-go', patternId: reviewPattern.id, evidence: 'seen', contextId: `review-${Date.now()}`,
                });
                setReviewRewarded(true);
              }}
              className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-[filter,opacity] [background:var(--sucesso)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
          nomeJogador1="Pretas"
          nomeJogador2="Brancas"
          humanoEhJogador1={humanPlayer === 'jogador1'}
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}
