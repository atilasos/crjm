import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIRequestV1, AIResponseV1, DifficultyLevel } from '../../ai-core';
import { buildTutorContextItems } from '../../ai-core/tutor-context';
import { selectReviewPattern } from '../../ai-core/review-patterns';
import { GameLayout } from '../../components/GameLayout';
import { DifficultySelector } from '../../components/DifficultySelector';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { PlayerInfo } from '../../components/PlayerInfo';
import { TrainingPathCard } from '../../components/TrainingPathCard';
import { HintLegend } from '../../components/tutor/HintLegend';
import { TutorContextBar } from '../../components/tutor/TutorContextBar';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { CASAS_CENTRAIS } from './types';
import type { GatosCaesState, Posicao } from './types';
import {
  criarEstadoInicial,
  colocarPeca,
  isJogadaValida,
} from './logic';
import type { GameMode, Player } from '../../types';
import {
  initAI,
  computeMove,
  cancelComputation,
  terminateAI,
  GatosCaesV1Adapter,
  buildQuickReviewItems,
  resolveHintLevel,
} from './ai';
import { TutorHintCard } from './components/TutorHintCard';
import { TopMovesRail } from './components/TopMovesRail';

interface GatosCaesGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro 8×8.',
  'Jogadores alternam colocando UMA peça (Gato ou Cão).',
  'Começam os Gatos.',
  'O primeiro Gato deve ser colocado numa das 4 casas centrais.',
  'O primeiro Cão deve ser colocado FORA das casas centrais.',
  'Nunca podes colocar um Gato adjacente (↑↓←→) a um Cão, nem vice-versa.',
  'Ganha quem colocar a ÚLTIMA peça.',
  'Se não tiveres casas legais no teu turno, PERDES.',
];

function formatMove(move: Posicao): string {
  return `L${move.linha + 1} C${move.coluna + 1}`;
}

function getSuggestedAction(
  response: AIResponseV1<Posicao, GatosCaesState> | null,
  hintLevel: 'H1' | 'H2' | 'H3',
): string {
  if (hintLevel === 'H1') {
    return 'Compara primeiro as casas seguras que te deixam mais do que uma resposta no próximo ciclo.';
  }

  if (hintLevel === 'H2') {
    return response?.criticalThreats?.[0]
      ? 'Resolve primeiro a zona em que podes ficar sem respostas e só depois volta ao centro.'
      : 'Procura uma casa segura que mantenha mobilidade e evite encostar cedo à cor oposta.';
  }

  return response?.bestMove
    ? 'Se estiveres indeciso, começa pela casa destacada e confirma que continuas com mais espaço útil do que o adversário.'
    : 'Escolhe a casa que te deixe mais espaço livre à volta e pelo menos uma resposta clara a seguir.';
}

function getThreatClasses(severity: 'low' | 'medium' | 'high'): string {
  if (severity === 'high') {
    return '[border-color:color-mix(in_srgb,#E05252_50%,var(--linha))] [background:color-mix(in_srgb,#E05252_12%,var(--painel))] [color:var(--tinta)]';
  }
  if (severity === 'medium') {
    return '[border-color:color-mix(in_srgb,var(--ouro)_55%,var(--linha))] [background:color-mix(in_srgb,var(--ouro)_12%,var(--painel))] [color:var(--tinta)]';
  }
  return '[border-color:color-mix(in_srgb,var(--jogo-dominorio)_45%,var(--linha))] [background:color-mix(in_srgb,var(--jogo-dominorio)_10%,var(--painel))] [color:var(--tinta)]';
}

export function GatosCaesGame({ onVoltar }: GatosCaesGameProps) {
  const {
    acceptDifficultyRecommendation,
    getDifficultyRecommendation,
    recordAdaptiveDecision,
    recordGameCompleted,
    recordPatternProgress,
    recordReviewCompleted,
    resetAdaptiveSession,
  } = useGamification();
  const [state, setState] = useState<GatosCaesState>(() =>
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(3);
  const [aiThinking, setAiThinking] = useState(false);
  const [tutorResponse, setTutorResponse] =
    useState<AIResponseV1<Posicao, GatosCaesState> | null>(null);
  const [tutorHistory, setTutorHistory] = useState<Array<AIResponseV1<Posicao, GatosCaesState>>>([]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [hintLevel, setHintLevel] = useState<'H1' | 'H2' | 'H3'>('H2');
  const tutorAdapterRef = useRef<GatosCaesV1Adapter | null>(null);
  const awardedResultRef = useRef<string | null>(null);
  const [reviewRewarded, setReviewRewarded] = useState(false);

  // Initialize AI on mount
  useEffect(() => {
    initAI();
    tutorAdapterRef.current = new GatosCaesV1Adapter();
    return () => {
      cancelComputation();
      terminateAI();
      tutorAdapterRef.current = null;
    };
  }, []);

  // Efeito para jogada do computador
  // Using a ref to track if AI is already computing to avoid race conditions
  const aiComputingRef = useRef(false);

  useEffect(() => {
    const shouldPlayAI =
      state.modo === 'vs-computador' &&
      state.jogadorAtual !== humanPlayer &&
      state.estado === 'a-jogar' &&
      !aiComputingRef.current;

    if (shouldPlayAI) {
      let cancelled = false;
      aiComputingRef.current = true;
      setAiThinking(true);

      const makeAIMove = async () => {
        // Small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 300));

        if (cancelled) return;

        try {
          const { move } = await computeMove(state, difficulty);

          if (cancelled) return;

          if (move) {
            setState(prev => colocarPeca(prev, move));
          }
        } catch (error) {
          console.error('[GatosCaes] AI computation error:', error);
        } finally {
          if (!cancelled) {
            aiComputingRef.current = false;
            setAiThinking(false);
          }
        }
      };

      makeAIMove();

      return () => {
        cancelled = true;
        cancelComputation();
        aiComputingRef.current = false;
        setAiThinking(false);
      };
    }
  }, [state, humanPlayer, difficulty]);

  const isVezDoHumano =
    state.estado === 'a-jogar' &&
    (state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer);

  useEffect(() => {
    if (state.modo !== 'vs-computador' || !isVezDoHumano || aiThinking || !tutorAdapterRef.current) {
      setTutorLoading(false);
      return;
    }

    let cancelled = false;
    const request: AIRequestV1<GatosCaesState, Posicao> = {
      version: '1.0',
      requestId: `gatos-tutor-${Date.now()}`,
      gameId: 'gatos-caes',
      mode: 'tutor',
      level: difficulty,
      state,
      locale: 'pt-PT',
    };

    setTutorLoading(true);

    void tutorAdapterRef.current
      .compute(request)
      .then((response) => {
        if (cancelled) return;
        setTutorResponse(response);
        setTutorHistory((prev) => [...prev.slice(-5), response]);
        setHintLevel((current) => resolveHintLevel(response, current));
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[GatosCaes] Tutor error:', error);
        }
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
  }, [aiThinking, difficulty, isVezDoHumano, state]);

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

    recordGameCompleted('gatos-caes', humanWon, state.modo === 'vs-computador' ? difficulty : undefined);
    awardedResultRef.current = state.estado;
  }, [difficulty, humanPlayer, recordGameCompleted, state.estado, state.modo]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;

    if (isJogadaValida(state, pos)) {
      if (tutorResponse) {
        const successful = tutorResponse.topMoves.some(({ move }) =>
          move.linha === pos.linha && move.coluna === pos.coluna
        );
        recordAdaptiveDecision('gatos-caes', {
          successful,
          usedHint: hintLevel === 'H3',
        });
      }
      setState(prev => colocarPeca(prev, pos));
    }
  }, [state, humanPlayer, tutorResponse, recordAdaptiveDecision, hintLevel]);

  const novoJogo = useCallback(() => {
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    setHintLevel('H2');
    resetAdaptiveSession('gatos-caes');
  }, [resetAdaptiveSession, state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setHumanPlayer('jogador1'); // Reset ao trocar modo
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    setHintLevel('H2');
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    setHintLevel('H2');
  }, []);

  // Verificar se é casa central
  const isCasaCentral = (linha: number, coluna: number): boolean => {
    return CASAS_CENTRAIS.some(c => c.linha === linha && c.coluna === coluna);
  };

  // Verificar se é jogada válida
  const isJogadaValidaPos = (linha: number, coluna: number): boolean => {
    return state.jogadasValidas.some(j => j.linha === linha && j.coluna === coluna);
  };

  const isTutorRecommended = (linha: number, coluna: number): boolean =>
    tutorResponse?.bestMove?.linha === linha && tutorResponse.bestMove.coluna === coluna;

  const isTutorThreat = (linha: number, coluna: number): boolean =>
    criticalThreat?.counterMove?.linha === linha && criticalThreat.counterMove.coluna === coluna;

  // Obter classe CSS para cada célula
  const getCelulaClasses = (linha: number, coluna: number): string => {
    const celula = state.tabuleiro[linha]?.[coluna] ?? 'vazia';
    const central = isCasaCentral(linha, coluna);
    const jogadaValida = isJogadaValidaPos(linha, coluna);
    
    let classes = 'aspect-square rounded-md flex items-center justify-center transition-all duration-200 text-3xl md:text-4xl ';
    
    // Fundo base
    if (central && celula === 'vazia') {
      classes += 'bg-amber-200 ';
    } else if (celula === 'vazia') {
      classes += 'bg-gray-100 ';
    } else {
      classes += 'bg-gray-50 ';
    }
    
    // Destacar jogadas válidas
    if (jogadaValida) {
      classes += 'ring-3 ring-green-400 bg-green-100 cursor-pointer hover:bg-green-200 ';
    } else if (celula === 'vazia') {
      classes += 'cursor-not-allowed opacity-70 ';
    }

    if (isTutorRecommended(linha, coluna)) {
      classes += 'ring-4 ring-amber-400 ring-offset-2 ring-offset-white ';
    } else if (isTutorThreat(linha, coluna)) {
      classes += 'ring-4 ring-rose-400 ring-offset-2 ring-offset-white ';
    }
    
    return classes;
  };

  const isVezDaIA =
    state.modo === 'vs-computador' &&
    state.estado === 'a-jogar' &&
    (state.jogadorAtual !== humanPlayer || aiThinking);
  const criticalThreat = tutorResponse?.criticalThreats?.[0];
  const quickReviewItems = buildQuickReviewItems(tutorHistory);
  const reviewPattern = selectReviewPattern('gatos-caes', tutorHistory.at(-1) ?? tutorResponse);
  const difficultyRecommendation = getDifficultyRecommendation('gatos-caes', difficulty);

  return (
    <GameLayout titulo="Gatos & Cães" regras={REGRAS} onVoltar={onVoltar}>
      <div className="flex flex-col gap-4">
        {/* Controlos de pré-jogo — em mobile ficam depois do tabuleiro */}
        <div className="order-2 lg:order-1 flex flex-col gap-4">
          {/* Info do jogador */}
          <PlayerInfo
            modo={state.modo}
            jogadorAtual={state.jogadorAtual}
            estado={state.estado}
            nomeJogador1="Gatos"
            nomeJogador2="Cães"
            corJogador1="bg-orange-500"
            corJogador2="bg-blue-500"
            humanPlayer={humanPlayer}
            onChangeHumanPlayer={handleChangeHumanPlayer}
            onNovoJogo={novoJogo}
            onTrocarModo={trocarModo}
          />

          <TrainingPathCard gameId="gatos-caes" />

          {/* Difficulty selector (only in vs computer mode) */}
          {state.modo === 'vs-computador' && (
            <DifficultySelector
              level={difficulty}
              onChange={setDifficulty}
              disabled={aiThinking}
              recommendation={difficultyRecommendation}
              canAcceptRecommendation={state.estado !== 'a-jogar'}
              onAcceptRecommendation={(level) => {
                setDifficulty(level);
                acceptDifficultyRecommendation('gatos-caes');
              }}
            />
          )}
        </div>

        {/* Tabuleiro — primeiro em mobile (above the fold) */}
        <div className="game-container order-1 lg:order-2">
          <div className="aspect-square max-w-md mx-auto">
            <div className="grid grid-cols-8 gap-1 h-full bg-amber-900 p-2 rounded-xl">
              {state.tabuleiro.map((linha, linhaIdx) =>
                linha.map((celula, colunaIdx) => (
                  <button
                    key={`${linhaIdx}-${colunaIdx}`}
                    onClick={() => handleCellClick({ linha: linhaIdx, coluna: colunaIdx })}
                    className={getCelulaClasses(linhaIdx, colunaIdx)}
                    disabled={!isJogadaValidaPos(linhaIdx, colunaIdx)}
                  >
                    {celula === 'gato' && (
                      <span className="drop-shadow-lg select-none">🐱</span>
                    )}
                    {celula === 'cao' && (
                      <span className="drop-shadow-lg select-none">🐶</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-col items-center gap-2 text-sm [color:var(--tinta-suave-no-papel)]">
            <div className="flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐱</span>
                <span>Gatos (J1): {state.totalGatos}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐶</span>
                <span>Cães (J2): {state.totalCaes}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 bg-amber-200 rounded border"></div>
              <span>Casas centrais (1.º Gato)</span>
            </div>
          </div>

          {/* Dica de jogada */}
          <div className="mt-2 text-center text-sm [color:var(--tinta-suave-no-papel)]">
            {state.estado === 'a-jogar' && (
              isVezDaIA ? (
                <span className="flex items-center justify-center gap-2 [color:var(--tinta-no-papel)] font-medium">
                  <span className="inline-block w-4 h-4 border-2 border-[color:var(--tinta-suave-no-papel)] border-t-transparent rounded-full animate-spin"></span>
                  IA a pensar…
                </span>
              ) : (
                <>
                  {state.jogadorAtual === 'jogador1' 
                    ? !state.primeiroGatoColocado 
                      ? 'Coloca o primeiro Gato numa casa central (amarela)' 
                      : 'Coloca um Gato (não pode ser adjacente a Cães)'
                    : !state.primeiroCaoColocado
                      ? 'Coloca o primeiro Cão fora das casas centrais'
                      : 'Coloca um Cão (não pode ser adjacente a Gatos)'}
                  {' '}• Jogadas disponíveis: {state.jogadasValidas.length}
                </>
              )
            )}
          </div>
        </div>

        {state.estado === 'a-jogar' && state.modo === 'vs-computador' && isVezDoHumano && (
          <div className="order-3 space-y-3">
            <TutorContextBar items={buildTutorContextItems(tutorResponse)} />
            <HintLegend showThreat={Boolean(criticalThreat)} showAlternative={false} />
            <TutorHintCard
              insight={
                tutorResponse?.explainText ||
                'Procura uma casa que te deixe várias respostas simples para o turno seguinte.'
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
                <p className="font-semibold">Atenção: {criticalThreat.title}</p>
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
          <section className="order-4 rounded-xl border [border-color:var(--linha)] [background:var(--painel)] px-4 py-3 text-sm [color:var(--tinta)]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Revisão rápida pós-jogo</p>
              <span className="rounded-full [background:color-mix(in_srgb,var(--ouro)_18%,transparent)] px-2 py-0.5 text-xs font-medium [color:var(--tinta)]">
                2-3 min
              </span>
            </div>
            <p className="mt-1 [color:var(--tinta-suave)]">
              Revê os momentos em que perdeste mais espaço e experimenta a alternativa sugerida.
            </p>
            <p className="mt-2 rounded-lg border [border-color:color-mix(in_srgb,var(--ouro)_45%,var(--linha))] [background:color-mix(in_srgb,var(--ouro)_12%,var(--painel))] px-3 py-2 font-medium">
              Cartão descoberto: {reviewPattern.title} — {reviewPattern.description}
            </p>
            <div className="mt-2 space-y-2">
              {quickReviewItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border [border-color:var(--linha)] [background:color-mix(in_srgb,var(--tinta)_4%,var(--painel))] px-3 py-2"
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
                recordReviewCompleted('gatos-caes');
                recordPatternProgress({
                  gameId: 'gatos-caes', patternId: reviewPattern.id, evidence: 'seen', contextId: `review-${Date.now()}`,
                });
                setReviewRewarded(true);
              }}
              className="mt-3 rounded-lg [background:var(--tinta)] px-3 py-2 text-sm font-semibold [color:var(--fundo)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
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
          nomeJogador1="Gatos"
          nomeJogador2="Cães"
          humanoEhJogador1={humanPlayer === 'jogador1'}
          onFechar={() => setMostrarVencedor(false)}
          onNovoJogo={novoJogo}
        />
      )}
    </GameLayout>
  );
}
