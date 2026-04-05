import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIRequestV1, AIResponseV1, DifficultyLevel } from '../../ai-core';
import { buildTutorContextItems } from '../../ai-core/tutor-context';
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
  buildQuickReviewItems,
  resolveHintLevel,
  DIFFICULTY_PRESETS,
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

function mapDifficultyToLevel(difficulty: AIDifficulty): DifficultyLevel {
  if (difficulty === 'easy') return 2;
  if (difficulty === 'medium') return 3;
  return 5;
}

function formatSegmento(segmento: QuelhasState['jogadasValidas'][number]): string {
  return `L${segmento.inicio.linha + 1} C${segmento.inicio.coluna + 1}, ${segmento.orientacao}, ${segmento.comprimento} casas`;
}

function getThreatClasses(severity: 'low' | 'medium' | 'high'): string {
  if (severity === 'high') {
    return 'border-rose-300 bg-rose-50 text-rose-900';
  }
  if (severity === 'medium') {
    return 'border-amber-300 bg-amber-50 text-amber-900';
  }
  return 'border-sky-300 bg-sky-50 text-sky-900';
}

function getSuggestedAction(
  response: AIResponseV1<QuelhasState['jogadasValidas'][number], QuelhasState> | null,
  hintLevel: 'H1' | 'H2' | 'H3',
): string {
  if (response?.bestMove) {
    const anchor = formatSegmento(response.bestMove);
    if (hintLevel === 'H3') {
      return `Segue esta jogada: ${anchor}.`;
    }
    return `Procura um segmento parecido com ${anchor}.`;
  }

  if (hintLevel === 'H3') {
    return 'Escolhe um segmento curto e evita fechar demasiado o tabuleiro agora.';
  }

  return 'Mantém opções abertas para não ficares preso ao fim da partida.';
}

export function QuelhasGame({ onVoltar }: QuelhasGameProps) {
  const { recordGameCompleted, recordReviewCompleted } = useGamification();
  const [state, setState] = useState<QuelhasState>(() => 
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [posicaoInicial, setPosicaoInicial] = useState<Posicao | null>(null);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('hard');
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
      const maxWaitMs = DIFFICULTY_PRESETS[difficulty].timeBudgetMs + 250;
      const timer = setTimeout(async () => {
        if (cancelled || !client) return;

        try {
          const bestMove = await withTimeout(
            client.getBestMove(state, difficulty),
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
  }, [state.jogadorAtual, state.modo, state.estado, state.trocaDisponivel, humanPlayer, difficulty, state]);

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
      level: mapDifficultyToLevel(difficulty),
      state,
      timeBudgetMs: Math.min(DIFFICULTY_PRESETS[difficulty].timeBudgetMs, 5000),
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
  }, [difficulty, isVezDoHumano, state]);

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
  }, [state, posicaoInicial, isVezDoHumano]);

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
  }, [state.modo]);

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

  const handleChangeDifficulty = useCallback((d: AIDifficulty) => {
    setDifficulty(d);
  }, []);

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

  // Determinar nomes dos jogadores baseado nas orientações atuais
  const getNomeJogador = (jogador: 'jogador1' | 'jogador2') => {
    const orientacao = getOrientacaoJogador(state, jogador);
    return orientacao === 'vertical' ? 'Vertical' : 'Horizontal';
  };

  return (
    <GameLayout titulo="Quelhas" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
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
          difficulty={difficulty}
          onChangeDifficulty={handleChangeDifficulty}
          aiMetrics={aiMetrics}
          aiReady={aiReady}
        />

        <TrainingPathCard gameId="quelhas" />

        {/* UI de decisão de troca */}
        {mostrarUiTroca && (
          <div className="bg-purple-100 border-2 border-purple-400 rounded-xl p-4">
            <p className="text-purple-800 font-semibold text-sm mb-2 text-center">
              🔄 Regra de Troca
            </p>
            <p className="text-purple-700 text-xs mb-3 text-center">
              Podes trocar de papel e ficar com a jogada que o Vertical acabou de fazer.
              A troca consome a tua jogada — a seguir joga o adversário.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleTroca}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium text-sm hover:bg-purple-600 transition-colors"
              >
                Trocar papéis
              </button>
              <button
                onClick={handleRecusarTroca}
                className="px-4 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg font-medium text-sm hover:bg-purple-50 transition-colors"
              >
                Manter como está
              </button>
            </div>
          </div>
        )}

        {/* Aviso Misère */}
        <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl p-3 text-center">
          <p className="text-yellow-800 font-semibold text-sm">
            ⚠️ MISÈRE: Quem fizer a última jogada PERDE!
          </p>
        </div>

        {/* Tabuleiro */}
        <div className="game-container">
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
          <div className="mt-4 flex justify-center gap-6 text-sm text-gray-600">
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
          <div className="mt-2 text-center text-sm text-gray-500">
            {state.estado === 'a-jogar' && !state.trocaDisponivel && (
              isVezDoHumano() ? (
                <>
                  {posicaoInicial ? (
                    <span className="text-indigo-600 font-medium">
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
                <span className="flex items-center justify-center gap-2 text-indigo-600 font-medium">
                  <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                  IA a pensar…
                </span>
              )
            )}
            {state.trocaDisponivel && !mostrarUiTroca && (
              <span className="text-purple-600 font-medium">
                A IA está a decidir sobre a troca de papéis...
              </span>
            )}
          </div>
        </div>

        {state.estado === 'a-jogar' && !state.trocaDisponivel && isVezDoHumano() && (
          <div className="space-y-3">
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
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Revisão rápida pós-jogo</p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                2-4 min
              </span>
            </div>
            <p className="mt-1 text-emerald-800">
              Revê até 2 momentos e tenta repetir a alternativa mais segura.
            </p>
            <div className="mt-2 space-y-2">
              {quickReviewItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-emerald-200 bg-white/80 px-3 py-2"
                >
                  <p className="font-medium text-emerald-900">{item.title}</p>
                  <p className="mt-1 text-emerald-800">{item.insight}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={reviewRewarded}
              onClick={() => {
                if (reviewRewarded) return;
                recordReviewCompleted('quelhas');
                setReviewRewarded(true);
              }}
              className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
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
