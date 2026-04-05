import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIRequestV1, AIResponseV1 } from '../../ai-core';
import { buildTutorContextItems } from '../../ai-core/tutor-context';
import { GameLayout } from '../../components/GameLayout';
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
  if (response?.bestMove) {
    if (hintLevel === 'H3') {
      return `Segue primeiro a casa ${formatMove(response.bestMove)}.`;
    }
    return `Procura uma casa parecida com ${formatMove(response.bestMove)}.`;
  }

  if (hintLevel === 'H3') {
    return 'Escolhe uma casa que te deixe mais espaço livre à volta.';
  }

  return 'Evita encostar cedo ao adversário para não perderes mobilidade.';
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

export function GatosCaesGame({ onVoltar }: GatosCaesGameProps) {
  const { recordGameCompleted, recordReviewCompleted } = useGamification();
  const [state, setState] = useState<GatosCaesState>(() =>
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [difficulty, setDifficulty] = useState(3);
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
      level: Math.max(1, Math.min(5, difficulty)) as 1 | 2 | 3 | 4 | 5,
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

    recordGameCompleted('gatos-caes', humanWon);
    awardedResultRef.current = state.estado;
  }, [humanPlayer, recordGameCompleted, state.estado, state.modo]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;

    if (isJogadaValida(state, pos)) {
      setState(prev => colocarPeca(prev, pos));
    }
  }, [state, humanPlayer]);

  const novoJogo = useCallback(() => {
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setTutorResponse(null);
    setTutorHistory([]);
    setTutorLoading(false);
    setHintLevel('H2');
  }, [state.modo]);

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

  return (
    <GameLayout titulo="Gatos & Cães" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
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
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="text-gray-600">Dificuldade:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  disabled={aiThinking}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    difficulty === level
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } ${aiThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {level}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {difficulty === 1 && '(Fácil)'}
              {difficulty === 2 && '(Normal)'}
              {difficulty === 3 && '(Difícil)'}
              {difficulty === 4 && '(Muito Difícil)'}
              {difficulty === 5 && '(Mestre)'}
            </span>
          </div>
        )}

        {/* Tabuleiro */}
        <div className="game-container">
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
          <div className="mt-4 flex flex-col items-center gap-2 text-sm text-gray-600">
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
          <div className="mt-2 text-center text-sm text-gray-500">
            {state.estado === 'a-jogar' && (
              isVezDaIA ? (
                <span className="flex items-center justify-center gap-2 text-indigo-600 font-medium">
                  <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
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
          <div className="space-y-3">
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
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Revisão rápida pós-jogo</p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                2-3 min
              </span>
            </div>
            <p className="mt-1 text-emerald-800">
              Revê os momentos em que perdeste mais espaço e experimenta a alternativa sugerida.
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
                recordReviewCompleted('gatos-caes');
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
