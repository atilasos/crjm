import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIRequestV1, AIResponseV1, DifficultyLevel } from '../../ai-core';
import { getDifficultyProfile } from '../../ai-core/difficulty';
import { buildTutorContextItems } from '../../ai-core/tutor-context';
import { selectReviewPattern } from '../../ai-core/review-patterns';
import { GameLayout } from '../../components/GameLayout';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { PlayerInfo } from '../../components/PlayerInfo';
import { TrainingPathCard } from '../../components/TrainingPathCard';
import { HintLegend } from '../../components/tutor/HintLegend';
import { TutorContextBar } from '../../components/tutor/TutorContextBar';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { QuelhasState, Posicao } from './types';
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
import { GameMode, Player } from '../../types';
import {
  QuelhasAIClient,
  QuelhasV1Adapter,
  mapLevelToQuelhasDifficulty,
  buildQuickReviewItems,
  resolveHintLevel,
  INITIAL_METRICS,
  type AIDifficulty,
  type AIMetrics,
} from './ai';
import { TutorHintCard } from './components/TutorHintCard';
import { TopMovesRail } from './components/TopMovesRail';
import { withTimeout } from '../../utils/withTimeout';

interface QuelhasGameProps {
  onVoltar: () => void;
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

function getSuggestedAction(
  response: AIResponseV1<QuelhasState['jogadasValidas'][number], QuelhasState> | null,
  hintLevel: 'H1' | 'H2' | 'H3',
): string {
  if (hintLevel === 'H1') {
    return 'Compara segmentos curtos em zonas abertas e evita fechar cedo a faixa central.';
  }

  if (hintLevel === 'H2') {
    return response?.criticalThreats?.[0]
      ? 'Defende primeiro a faixa onde podes ficar preso e só depois alarga o teu plano.'
      : 'Procura um segmento que te deixe outra faixa útil disponível para a jogada seguinte.';
  }

  return response?.bestMove
    ? 'Se estiveres preso, testa primeiro o segmento destacado e confirma que ainda sobram outras faixas úteis.'
    : 'Escolhe um segmento curto e evita fechar demasiado o tabuleiro agora.';
}

export function QuelhasGame({ onVoltar }: QuelhasGameProps) {
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
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(3);
  const difficulty: AIDifficulty = mapLevelToQuelhasDifficulty(difficultyLevel);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics>(INITIAL_METRICS);
  const [aiReady, setAiReady] = useState(false);
  const [tutorResponse, setTutorResponse] =
    useState<AIResponseV1<QuelhasState['jogadasValidas'][number], QuelhasState> | null>(null);
  const [tutorHistory, setTutorHistory] = useState<
    Array<AIResponseV1<QuelhasState['jogadasValidas'][number], QuelhasState>>
  >([]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [hintLevel, setHintLevel] = useState<'H1' | 'H2' | 'H3'>('H2');
  const aiClientRef = useRef<QuelhasAIClient | null>(null);
  const tutorAdapterRef = useRef<QuelhasV1Adapter | null>(null);
  const awardedResultRef = useRef<string | null>(null);
  const [reviewRewarded, setReviewRewarded] = useState(false);

  // Inicializar cliente de IA (Worker) uma vez
  useEffect(() => {
    const client = new QuelhasAIClient({
      onMetricsUpdate: setAiMetrics,
      onReady: () => setAiReady(true),
    });
    aiClientRef.current = client;
    tutorAdapterRef.current = new QuelhasV1Adapter({ client });
    return () => {
      tutorAdapterRef.current = null;
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
      const timeBudgetMs = getDifficultyProfile(difficultyLevel).timeBudgetMs;
      const maxWaitMs = timeBudgetMs + 250;
      const timer = setTimeout(async () => {
        if (cancelled || !client) return;

        try {
          const bestMove = await withTimeout(
            client.getBestMove(state, difficulty, { timeBudgetMs }),
            maxWaitMs,
            () => client.cancel()
          );
          if (cancelled) return;
          finished = true;
          setState(prev => {
            const mv = bestMove ?? prev.jogadasValidas[0] ?? null;
            return mv ? colocarSegmento(prev, mv) : prev;
          });
        } catch (e) {
          if (e instanceof Error && e.message === 'cancelled') return;
          console.error('[QuelhasGame] AI error:', e);
          if (cancelled) return;
          finished = true;
          setState(prev => {
            const mv = prev.jogadasValidas[0] ?? null;
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
      level: difficultyLevel,
      state,
      locale: 'pt-PT',
    };

    setTutorLoading(true);

    void adapter
      .compute(request)
      .then((response) => {
        if (cancelled) return;
        setTutorResponse(response);
        setTutorHistory((prev) => [...prev.slice(-5), response]);
        setHintLevel((current) => resolveHintLevel(response, current));
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
  }, [difficultyLevel, isVezDoHumano, state]);

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

    recordGameCompleted('quelhas', humanWon);
    awardedResultRef.current = state.estado;
  }, [humanPlayer, recordGameCompleted, state.estado, state.modo]);

  // Limpar posição inicial quando muda o jogador
  useEffect(() => {
    setPosicaoInicial(null);
  }, [state.jogadorAtual]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (!isVezDoHumano()) return;
    if (state.trocaDisponivel) return; // Aguardar decisão de troca
    if (state.tabuleiro[pos.linha][pos.coluna] === 'ocupada') return;

    if (posicaoInicial === null) {
      // Primeiro clique: definir posição inicial
      if (isPosicaoInicioValida(state, pos)) {
        setPosicaoInicial(pos);
      }
    } else {
      // Segundo clique: tentar criar segmento
      const segmento = criarSegmentoEntrePosicoes(state, posicaoInicial, pos);
      if (segmento) {
        if (tutorResponse) {
          recordAdaptiveDecision('quelhas', {
            successful: tutorResponse.topMoves.some(({ move }) =>
              formatSegmento(move) === formatSegmento(segmento)
            ),
            usedHint: hintLevel === 'H3',
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
  }, [state, posicaoInicial, isVezDoHumano, tutorResponse, recordAdaptiveDecision, hintLevel]);

  const handleMouseEnter = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (!isVezDoHumano()) return;
    if (state.trocaDisponivel) return;
    if (state.tabuleiro[pos.linha][pos.coluna] === 'ocupada') return;
    
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
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    setHintLevel('H2');
    resetAdaptiveSession('quelhas');
  }, [resetAdaptiveSession, state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    aiClientRef.current?.cancel();
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
    setAiMetrics(INITIAL_METRICS);
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    setHintLevel('H2');
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    aiClientRef.current?.cancel();
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
    setPosicaoInicial(null);
    setAiMetrics(INITIAL_METRICS);
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    setHintLevel('H2');
  }, []);

  const handleChangeDifficulty = useCallback((level: DifficultyLevel) => {
    setDifficultyLevel(level);
  }, []);

  const difficultyRecommendation = getDifficultyRecommendation('quelhas', difficultyLevel);

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
  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha][coluna];
    const preview = isPreview(linha, coluna);
    const inicioSelecionado = isPosicaoInicialSelecionada(linha, coluna);
    const recommended = tutorResponse?.bestMove
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
  const criticalThreat = tutorResponse?.criticalThreats?.[0];
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
          difficultyRecommendation={difficultyRecommendation}
          canAcceptDifficultyRecommendation={state.estado !== 'a-jogar'}
          onAcceptDifficultyRecommendation={(level) => {
            setDifficultyLevel(level);
            acceptDifficultyRecommendation('quelhas');
          }}
          aiMetrics={aiMetrics}
          aiReady={aiReady}
        />
        </div>

        <div className="order-5 lg:order-none">
          <TrainingPathCard gameId="quelhas" />
        </div>

        {/* UI de decisão de troca */}
        {mostrarUiTroca && (
          <div className="order-3 lg:order-none rounded-xl border-2 p-4 [background:var(--painel)] [border-color:var(--jogo-quelhas)]">
            <p className="font-semibold text-sm mb-2 text-center [color:var(--tinta)]">
              🔄 Regra de Troca
            </p>
            <p className="text-xs mb-3 text-center [color:var(--tinta-suave)]">
              Podes trocar de papel e ficar com a jogada que o Vertical acabou de fazer.
              A troca consome a tua jogada — a seguir joga o adversário.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleTroca}
                className="px-4 py-2 text-white rounded-lg font-medium text-sm transition-[filter] [background:var(--jogo-quelhas)] hover:brightness-110"
              >
                Trocar papéis
              </button>
              <button
                onClick={handleRecusarTroca}
                className="px-4 py-2 border rounded-lg font-medium text-sm transition-colors [background:var(--painel)] [color:var(--jogo-quelhas)] [border-color:var(--linha)] hover:[border-color:var(--jogo-quelhas)]"
              >
                Manter como está
              </button>
            </div>
          </div>
        )}

        {/* Aviso Misère (objetivo) — compacto, fica acima do tabuleiro em mobile */}
        <div className="order-1 lg:order-none rounded-xl border px-3 py-2 text-center [background:color-mix(in_srgb,var(--ouro)_14%,var(--painel))] [border-color:var(--ouro)]">
          <p className="font-semibold text-sm [color:var(--tinta)]">
            ⚠️ MISÈRE: Quem fizer a última jogada PERDE!
          </p>
        </div>

        {/* Tabuleiro */}
        <div className="game-container order-2 lg:order-none">
          <div className="aspect-square max-w-lg mx-auto">
            <div 
              className="grid grid-cols-10 gap-0.5 h-full bg-gray-400 p-1 rounded-xl"
              onMouseLeave={handleMouseLeave}
            >
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((_, colunaIdx) => (
                  <button
                    key={`${linhaIdx}-${colunaIdx}`}
                    onClick={() => handleCellClick({ linha: linhaIdx, coluna: colunaIdx })}
                    onMouseEnter={() => handleMouseEnter({ linha: linhaIdx, coluna: colunaIdx })}
                    className={getCelulaClasses(linhaIdx, colunaIdx)}
                    disabled={state.tabuleiro[linhaIdx][colunaIdx] === 'ocupada'}
                  />
                ))
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex justify-center gap-6 text-sm [color:var(--tinta-suave-no-papel)]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-6 bg-pink-500 rounded"></div>
              <span>Vertical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-cyan-500 rounded"></div>
              <span>Horizontal</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm [color:var(--tinta-suave-no-papel)]">
            {state.estado === 'a-jogar' && !state.trocaDisponivel && (
              isVezDoHumano() ? (
                <>
                  {posicaoInicial ? (
                    <span className="font-medium [color:var(--jogo-quelhas)]">
                      Clica na casa final do segmento {orientacaoAtual === 'vertical' ? 'VERTICAL' : 'HORIZONTAL'}
                    </span>
                  ) : (
                    <span>
                      Clica na casa inicial do segmento {orientacaoAtual === 'vertical' ? 'VERTICAL' : 'HORIZONTAL'}
                    </span>
                  )}
                  {' '}• Jogadas disponíveis: {state.jogadasValidas.length}
                </>
              ) : (
                <span className="flex items-center justify-center gap-2 font-medium [color:var(--jogo-quelhas)]">
                  <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin [border-color:var(--jogo-quelhas)] [border-top-color:transparent]"></span>
                  IA a pensar…
                </span>
              )
            )}
            {state.trocaDisponivel && !mostrarUiTroca && (
              <span className="font-medium [color:var(--jogo-quelhas)]">
                A IA está a decidir sobre a troca de papéis...
              </span>
            )}
          </div>
        </div>

        {state.estado === 'a-jogar' && !state.trocaDisponivel && isVezDoHumano() && (
          <div className="order-6 lg:order-none space-y-3">
            <TutorContextBar items={buildTutorContextItems(tutorResponse)} />
            <HintLegend showThreat={Boolean(criticalThreat)} showAlternative />
            <TutorHintCard
              insight={
                tutorResponse?.explainText ||
                'Escolhe um segmento curto que não feche demasiado o tabuleiro já.'
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
                    Resposta mínima: {formatSegmento(criticalThreat.counterMove)}
                  </p>
                )}
              </section>
            )}
          </div>
        )}

        {state.estado !== 'a-jogar' && quickReviewItems.length > 0 && (
          <section className="order-7 lg:order-none rounded-xl border px-4 py-3 text-sm [background:var(--painel)] [border-color:color-mix(in_srgb,var(--sucesso)_45%,var(--linha))] [color:var(--tinta)]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Revisão rápida pós-jogo</p>
              <span className="rounded-full px-2 py-0.5 text-xs font-medium [background:color-mix(in_srgb,var(--sucesso)_15%,var(--painel))] [color:var(--sucesso)]">
                2-4 min
              </span>
            </div>
            <p className="mt-1 [color:var(--tinta-suave)]">
              Revê até 2 momentos e tenta repetir a alternativa mais segura.
            </p>
            <p className="mt-2 rounded-lg px-3 py-2 font-medium [background:color-mix(in_srgb,var(--sucesso)_12%,var(--painel))]">
              Cartão descoberto: {reviewPattern.title} — {reviewPattern.description}
            </p>
            <div className="mt-2 space-y-2">
              {quickReviewItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border px-3 py-2 [border-color:var(--linha)] [background:var(--fundo)]"
                >
                  <p className="font-medium [color:var(--tinta)]">{item.title}</p>
                  <p className="mt-1 [color:var(--tinta-suave)]">{item.insight}</p>
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
