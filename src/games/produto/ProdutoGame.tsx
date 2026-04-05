import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { AIRequestV1, AIResponseV1, DifficultyLevel } from '../../ai-core';
import { buildTutorContextItems } from '../../ai-core/tutor-context';
import { GameLayout } from '../../components/GameLayout';
import { useGamification } from '../../components/gamification/GamificationProvider';
import { PlayerInfo } from '../../components/PlayerInfo';
import { TrainingPathCard } from '../../components/TrainingPathCard';
import { HintLegend } from '../../components/tutor/HintLegend';
import { TutorContextBar } from '../../components/tutor/TutorContextBar';
import { WinnerAnnouncement } from '../../components/WinnerAnnouncement';
import { gerarPosicoesValidas, posToKey, LADO_TABULEIRO } from './types';
import type { ProdutoState, Posicao, JogadaDupla } from './types';
import {
  criarEstadoInicial,
  colocarPeca,
  cancelarJogadaEmCurso,
  jogadaComputador,
} from './logic';
import type { GameMode, Player } from '../../types';
import { ProdutoAIClient, decodeMove } from './ai/ai-client';
import type { AIDifficulty } from './ai/types';
import { DIFFICULTY_PRESETS, INITIAL_METRICS } from './ai/types';
import { withTimeout } from '../../utils/withTimeout';
import { ProdutoV1Adapter } from './ai/v1-adapter';
import { TutorHintCard } from './components/TutorHintCard';
import { TopMovesRail } from './components/TopMovesRail';

interface ProdutoGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Tabuleiro hexagonal com 5 casas de lado.',
  'Em cada turno, coloca DUAS peças em casas vazias.',
  'IMPORTANTE: Podes colocar peças de QUALQUER cor (tua ou do adversário)!',
  'Exceção: Na primeira jogada, Pretas colocam apenas UMA peça.',
  'Pontuação: (maior grupo) × (2.º maior grupo).',
  'Se tiveres apenas 1 grupo, a tua pontuação é ZERO.',
  'Desempate: quem tiver menos peças no tabuleiro vence.',
  'O jogo termina quando o tabuleiro estiver cheio.',
];

function mapDifficultyToLevel(difficulty: AIDifficulty): DifficultyLevel {
  if (difficulty === 'easy') return 1;
  if (difficulty === 'medium') return 2;
  if (difficulty === 'hard') return 3;
  if (difficulty === 'very-hard') return 4;
  return 5;
}

function formatPos(pos: Posicao): string {
  return `(${pos.q},${pos.r})`;
}

function formatMove(move: JogadaDupla): string {
  const first = `${move.cor1} ${formatPos(move.pos1)}`;
  if (!move.pos2 || !move.cor2) return first;
  return `${first} + ${move.cor2} ${formatPos(move.pos2)}`;
}

function getSuggestedAction(
  response: AIResponseV1<JogadaDupla, ProdutoState> | null,
): string {
  if (!response?.bestMove) {
    return 'Compara o teu produto com o do adversário antes de escolher as duas peças.';
  }
  return `Treina a linha ${formatMove(response.bestMove)} e confirma se ficas com dois grupos úteis.`;
}

function getThreatClasses(severity: 'low' | 'medium' | 'high'): string {
  if (severity === 'high') return 'border-red-300 bg-red-50 text-red-900';
  if (severity === 'medium') return 'border-amber-300 bg-amber-50 text-amber-900';
  return 'border-slate-300 bg-slate-50 text-slate-800';
}

function normalizeHintLevel(level?: 'H0' | 'H1' | 'H2' | 'H3'): 'H1' | 'H2' | 'H3' | undefined {
  if (!level || level === 'H0') return undefined;
  return level;
}

export function ProdutoGame({ onVoltar }: ProdutoGameProps) {
  const { recordGameCompleted } = useGamification();
  const [state, setState] = useState<ProdutoState>(() =>
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [corSelecionada, setCorSelecionada] = useState<'preta' | 'branca'>('preta');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('hard');
  const [aiMetrics, setAiMetrics] = useState(() => ({ ...INITIAL_METRICS }));
  const [tutorResponse, setTutorResponse] =
    useState<AIResponseV1<JogadaDupla, ProdutoState> | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const aiClientRef = useMemo(() => new ProdutoAIClient({ onMetricsUpdate: setAiMetrics }), []);
  const tutorAdapterRef = useMemo(() => new ProdutoV1Adapter(), []);
  const awardedResultRef = useRef<string | null>(null);

  // Gerar posições do tabuleiro uma vez
  const posicoes = useMemo(() => gerarPosicoesValidas(), []);

  // Efeito para jogada do computador
  useEffect(() => {
    if (
      state.modo === 'vs-computador' &&
      state.jogadorAtual !== humanPlayer &&
      state.estado === 'a-jogar'
    ) {
      let cancelled = false;
      let finished = false;
      const maxWaitMs = DIFFICULTY_PRESETS[aiDifficulty].timeMs + 250;
      const timer = setTimeout(() => {
        void (async () => {
          try {
            const move = await withTimeout(
              aiClientRef.getBestMove(state, aiDifficulty),
              maxWaitMs,
              () => aiClientRef.cancel()
            );
            if (cancelled) return;

            if (!move) {
              finished = true;
              setState(prev => jogadaComputador(prev));
              return;
            }

            const decoded = decodeMove(move, aiClientRef.idxToPos);
            if (!decoded) {
              finished = true;
              setState(prev => jogadaComputador(prev));
              return;
            }

            finished = true;
            setState(prev => {
              let st = colocarPeca(prev, decoded.pos1, decoded.cor1);
              if (decoded.pos2 && decoded.cor2) {
                st = colocarPeca(st, decoded.pos2, decoded.cor2);
              }
              return st;
            });
          } catch (e) {
            if (cancelled) return;
            if (e instanceof Error && e.message === 'cancelled') return;
            finished = true;
            setState(prev => jogadaComputador(prev));
          }
        })();
      }, 250);
      return () => {
        cancelled = true;
        clearTimeout(timer);
        if (!finished) aiClientRef.cancel();
      };
    }
  }, [state, humanPlayer, aiDifficulty, aiClientRef]);

  // Mostrar anúncio de vencedor quando o jogo termina
  useEffect(() => {
    if (state.estado !== 'a-jogar') {
      setMostrarVencedor(true);
    }
  }, [state.estado]);

  useEffect(() => {
    if (state.estado === 'a-jogar') {
      awardedResultRef.current = null;
      return;
    }
    if (awardedResultRef.current === state.estado) return;

    const humanWon =
      state.modo === 'vs-computador' &&
      ((state.estado === 'vitoria-jogador1' && humanPlayer === 'jogador1') ||
        (state.estado === 'vitoria-jogador2' && humanPlayer === 'jogador2'));

    recordGameCompleted('produto', humanWon);
    awardedResultRef.current = state.estado;
  }, [humanPlayer, recordGameCompleted, state.estado, state.modo]);

  // Atualizar cor selecionada baseado no jogador atual
  useEffect(() => {
    setCorSelecionada(state.jogadorAtual === 'jogador1' ? 'preta' : 'branca');
  }, [state.jogadorAtual]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;
    if (state.tabuleiro[posToKey(pos)] !== 'vazia') return;

    setState(prev => colocarPeca(prev, pos, corSelecionada));
  }, [state, humanPlayer, corSelecionada]);

  const handleCancelar = useCallback(() => {
    setState(prev => cancelarJogadaEmCurso(prev));
  }, []);

  const novoJogo = useCallback(() => {
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setTutorResponse(null);
  }, [state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setHumanPlayer('jogador1');
    setTutorResponse(null);
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
    setTutorResponse(null);
  }, []);

  useEffect(() => {
    return () => aiClientRef.terminate();
  }, [aiClientRef]);

  useEffect(() => {
    return () => tutorAdapterRef.terminate();
  }, [tutorAdapterRef]);

  useEffect(() => {
    if (state.modo !== 'vs-computador' || state.estado !== 'a-jogar' || state.jogadorAtual !== humanPlayer) {
      setTutorLoading(false);
      return;
    }

    let cancelled = false;
    const request: AIRequestV1<ProdutoState, JogadaDupla> = {
      version: '1.0',
      requestId: `produto-tutor-${Date.now()}`,
      gameId: 'produto',
      mode: 'tutor',
      level: mapDifficultyToLevel(aiDifficulty),
      state,
      locale: 'pt-PT',
    };

    setTutorLoading(true);

    void tutorAdapterRef
      .compute(request)
      .then((response) => {
        if (!cancelled) {
          setTutorResponse(response);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[ProdutoGame] Tutor error:', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTutorLoading(false);
        }
      });

    return () => {
      cancelled = true;
      tutorAdapterRef.cancel();
    };
  }, [aiDifficulty, humanPlayer, state, tutorAdapterRef]);

  // Converter coordenadas axiais para posição no ecrã (pointy-top orientation)
  const hexToPixel = (q: number, r: number, size: number) => {
    const x = size * Math.sqrt(3) * (q + r / 2);
    const y = size * (3 / 2) * r;
    return { x, y };
  };

  // Calcular bounding box do tabuleiro
  const boundingBox = useMemo(() => {
    const size = 28; // Tamanho base do hexágono
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const pos of posicoes) {
      const { x, y } = hexToPixel(pos.q, pos.r, size);
      minX = Math.min(minX, x - size);
      maxX = Math.max(maxX, x + size);
      minY = Math.min(minY, y - size);
      maxY = Math.max(maxY, y + size);
    }

    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [posicoes]);

  // Renderizar hexágono
  const renderHex = (pos: Posicao) => {
    const size = 28;
    const { x, y } = hexToPixel(pos.q, pos.r, size);
    const key = posToKey(pos);
    const celula = state.tabuleiro[key];
    const isVezDoHumano = state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer;
    const isPrimeiraJogadaEmCurso = state.jogadaEmCurso.pos1 !== null &&
      state.jogadaEmCurso.pos1.q === pos.q && state.jogadaEmCurso.pos1.r === pos.r;

    // Pontos do hexágono (pointy-top: vértice no topo)
    const pontos = [];
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 90); // -90 para começar do topo
      pontos.push(`${x + size * Math.cos(angle) - boundingBox.minX},${y + size * Math.sin(angle) - boundingBox.minY}`);
    }

    const isVazia = celula === 'vazia';
    const podeCelula = isVazia && state.estado === 'a-jogar' && isVezDoHumano;
    const isRecommended =
      tutorResponse?.bestMove &&
      (posToKey(tutorResponse.bestMove.pos1) === key ||
        (tutorResponse.bestMove.pos2 && posToKey(tutorResponse.bestMove.pos2) === key));
    const threatMove = criticalThreat?.counterMove;
    const isThreat =
      threatMove &&
      (posToKey(threatMove.pos1) === key ||
        (threatMove.pos2 && posToKey(threatMove.pos2) === key));

    return (
      <g key={key} onClick={() => podeCelula && handleCellClick(pos)} style={{ cursor: podeCelula ? 'pointer' : 'default' }}>
        <polygon
          points={pontos.join(' ')}
          fill={celula === 'vazia' ? '#f5f5f5' : celula === 'preta' ? '#1f2937' : '#f9fafb'}
          stroke={isRecommended ? '#f59e0b' : isThreat ? '#f43f5e' : isPrimeiraJogadaEmCurso ? '#10b981' : '#9ca3af'}
          strokeWidth={isRecommended || isThreat ? 4 : isPrimeiraJogadaEmCurso ? 3 : 1.5}
          className={podeCelula ? 'hover:fill-gray-200 transition-colors' : ''}
        />
        {celula !== 'vazia' && (
          <circle
            cx={x - boundingBox.minX}
            cy={y - boundingBox.minY}
            r={size * 0.6}
            fill={celula === 'preta' ? 'url(#gradPreta)' : 'url(#gradBranca)'}
            stroke={celula === 'preta' ? '#000' : '#6366f1'}
            strokeWidth={celula === 'preta' ? 1 : 2}
            filter={celula === 'branca' ? 'url(#shadowBranca)' : undefined}
          />
        )}
      </g>
    );
  };

  // Verificar quantas peças faltam na jogada atual
  const pecasFaltam = state.primeiraJogada ? 1 : (state.jogadaEmCurso.pos1 === null ? 2 : 1);

  const isVezDaIA =
    state.modo === 'vs-computador' &&
    state.estado === 'a-jogar' &&
    state.jogadorAtual !== humanPlayer;
  const criticalThreat = tutorResponse?.criticalThreats?.[0];

  return (
    <GameLayout titulo="Produto" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1="Pretas"
          nomeJogador2="Brancas"
          corJogador1="bg-gray-900"
          corJogador2="bg-gray-200"
          humanPlayer={humanPlayer}
          onChangeHumanPlayer={handleChangeHumanPlayer}
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        <TrainingPathCard gameId="produto" />

        {/* Configuração de IA (só no modo vs-computador) */}
        {state.modo === 'vs-computador' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-blue-900">Dificuldade (IA)</label>
              <select
                className="text-sm rounded-lg border border-blue-200 bg-white px-2 py-1"
                value={aiDifficulty}
                onChange={e => setAiDifficulty(e.target.value as AIDifficulty)}
              >
                <option value="easy">Fácil</option>
                <option value="medium">Médio</option>
                <option value="hard">Difícil</option>
                <option value="very-hard">Muito difícil</option>
                <option value="max">Máximo</option>
              </select>
            </div>
            <div className="text-xs text-blue-900/80 flex items-center justify-between">
              <span>{aiMetrics.isThinking ? 'A pensar…' : 'Pronto'}</span>
              <span>{aiMetrics.usedWasm ? `WASM (${aiMetrics.lastTimeMs.toFixed(0)}ms)` : 'Fallback'}</span>
            </div>
          </div>
        )}

        {state.estado === 'a-jogar' && state.modo === 'vs-computador' && state.jogadorAtual === humanPlayer && (
          <div className="space-y-3">
            <TutorContextBar items={buildTutorContextItems(tutorResponse)} />
            <HintLegend showThreat={Boolean(criticalThreat)} showAlternative />
            <TutorHintCard
              insight={
                tutorResponse?.explainText ??
                'Procura duas peças que criem grupos teus e, se possível, prejudiquem o produto adversário.'
              }
              suggestedAction={getSuggestedAction(tutorResponse)}
              hintLevel={normalizeHintLevel(tutorResponse?.pedagogy?.hintLevelSuggested)}
              errorCode={tutorResponse?.pedagogy?.errorCode}
              isLoading={tutorLoading}
            />
            <TopMovesRail moves={tutorResponse?.topMoves ?? []} isLoading={tutorLoading} />
            {criticalThreat && (
              <section className={`rounded-xl border px-4 py-3 text-sm ${getThreatClasses(criticalThreat.severity)}`}>
                <p className="font-semibold">Ameaça crítica: {criticalThreat.title}</p>
                <p className="mt-1">{criticalThreat.description}</p>
                {criticalThreat.counterMove && (
                  <p className="mt-1 font-medium">Resposta mínima: {formatMove(criticalThreat.counterMove)}</p>
                )}
              </section>
            )}
          </div>
        )}

        {/* Painel de pontuação */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 text-white rounded-xl p-3 text-center">
            <div className="text-xs opacity-75 mb-1">Pretas</div>
            <div className="text-2xl font-bold">{state.pontuacaoPretas.produto}</div>
            <div className="text-xs opacity-75">
              {state.pontuacaoPretas.maiorGrupo} × {state.pontuacaoPretas.segundoMaiorGrupo}
            </div>
            <div className="text-xs opacity-50 mt-1">
              {state.pontuacaoPretas.totalPecas} peças
            </div>
          </div>
          <div className="bg-gray-100 text-gray-900 rounded-xl p-3 text-center border-2 border-gray-300">
            <div className="text-xs opacity-75 mb-1">Brancas</div>
            <div className="text-2xl font-bold">{state.pontuacaoBrancas.produto}</div>
            <div className="text-xs opacity-75">
              {state.pontuacaoBrancas.maiorGrupo} × {state.pontuacaoBrancas.segundoMaiorGrupo}
            </div>
            <div className="text-xs opacity-50 mt-1">
              {state.pontuacaoBrancas.totalPecas} peças
            </div>
          </div>
        </div>

        {/* Seletor de cor (só se não é primeira jogada) */}
        {!state.primeiraJogada && state.estado === 'a-jogar' &&
          (state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer) && (
            <div className="bg-purple-100 border-2 border-purple-400 rounded-xl p-3">
              <p className="text-purple-800 text-sm mb-2 text-center font-medium">
                Cor da peça a colocar ({pecasFaltam} peça{pecasFaltam > 1 ? 's' : ''} restante{pecasFaltam > 1 ? 's' : ''}):
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setCorSelecionada('preta')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${corSelecionada === 'preta'
                      ? 'bg-gray-900 text-white ring-2 ring-purple-400'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <div className="w-4 h-4 rounded-full bg-gray-900 border border-gray-600"></div>
                  Preta
                </button>
                <button
                  onClick={() => setCorSelecionada('branca')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${corSelecionada === 'branca'
                      ? 'bg-indigo-50 text-gray-900 ring-2 ring-purple-400 border border-indigo-300'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-200 border-2 border-indigo-400"></div>
                  Branca
                </button>
              </div>
              {state.jogadaEmCurso.pos1 !== null && (
                <div className="mt-2 flex justify-center">
                  <button
                    onClick={handleCancelar}
                    className="text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Cancelar primeira peça
                  </button>
                </div>
              )}
            </div>
          )}

        {/* Tabuleiro hexagonal */}
        <div className="game-container">
          <div className="flex justify-center">
            <svg
              width={Math.min(boundingBox.width + 20, 400)}
              height={Math.min(boundingBox.height + 20, 400)}
              viewBox={`-10 -10 ${boundingBox.width + 20} ${boundingBox.height + 20}`}
              className="max-w-full"
            >
              <defs>
                <linearGradient id="gradPreta" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#374151" />
                  <stop offset="100%" stopColor="#111827" />
                </linearGradient>
                <linearGradient id="gradBranca" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f0f4ff" />
                  <stop offset="50%" stopColor="#e0e7ff" />
                  <stop offset="100%" stopColor="#c7d2fe" />
                </linearGradient>
                <filter id="shadowBranca" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#6366f1" floodOpacity="0.4" />
                </filter>
              </defs>
              {posicoes.map(pos => renderHex(pos))}
            </svg>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-gray-600"></div>
              <span>Pretas (J1)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-200 border-2 border-indigo-400 shadow-sm shadow-indigo-300"></div>
              <span>Brancas (J2)</span>
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
                  {state.primeiraJogada
                    ? 'Pretas: coloca a primeira peça (apenas 1 nesta jogada)'
                    : `${state.jogadorAtual === 'jogador1' ? 'Pretas' : 'Brancas'}: coloca ${pecasFaltam} peça${pecasFaltam > 1 ? 's' : ''}`
                  }
                  {' '}• Casas livres: {state.casasVazias.length}
                </>
              )
            )}
          </div>

          {/* Dica de estratégia */}
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800 text-center">
            <strong>Dica:</strong> Podes colocar peças do adversário para unir os grupos dele e reduzir a pontuação a 0!
          </div>
        </div>
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
