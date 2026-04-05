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
import { LADO_TABULEIRO, posToKey } from './types';
import type { NexState, Posicao, TipoAcao } from './types';
import { 
  criarEstadoInicial, 
  executarColocacao,
  executarSubstituicao,
  executarSwap,
  recusarSwap,
  selecionarTipoAcao,
  adicionarPosicaoAcao,
  isAcaoCompleta,
  executarAcao,
  cancelarAcao,
  podeSubstituir,
  podeColocar,
  getCorJogador,
  jogadaComputador,
} from './logic';
import type { GameMode, Player } from '../../types';
import { NexAIClient, type AIDifficulty, type AIMetrics, DIFFICULTY_PRESETS, INITIAL_METRICS } from './ai';
import { withTimeout } from '../../utils/withTimeout';
import type { NexAiAction } from './ai/types';
import { NexV1Adapter } from './ai/v1-adapter';
import { TutorHintCard } from './components/TutorHintCard';
import { TopMovesRail } from './components/TopMovesRail';

interface NexGameProps {
  onVoltar: () => void;
}

const REGRAS = [
  'Grelha hexagonal em losango (11×11 casas).',
  'Pretas: ligam os lados ↖ superior-esquerdo e inferior-direito ↘',
  'Brancas: ligam os lados ↗ superior-direito e inferior-esquerdo ↙',
  'Em cada turno, escolhe UMA ação:',
  '• Colocação: 1 peça própria + 1 neutra (cinzenta)',
  '• Substituição: 2 neutras→próprias + 1 própria→neutra',
  'Regra da Torta: Após 1.ª jogada, Brancas podem trocar de cor.',
  'Ganha quem conectar primeiro as suas duas margens!',
];

function mapDifficultyToLevel(difficulty: AIDifficulty): DifficultyLevel {
  if (difficulty === 'easy') return 1;
  if (difficulty === 'medium') return 2;
  if (difficulty === 'hard') return 3;
  return 5;
}

function formatPos(pos: Posicao): string {
  return `(${pos.x + 1},${pos.y + 1})`;
}

function formatAction(action: NexAiAction): string {
  if (action.type === 'swap') return 'fazer swap';
  if (action.type === 'recusar_swap') return 'recusar swap';
  if (action.type === 'substituir') {
    return `substituir ${formatPos(action.n1)} + ${formatPos(action.n2)} / ${formatPos(action.sacrifice)}`;
  }
  return `colocar própria em ${formatPos(action.own)} e neutra em ${formatPos(action.neutral)}`;
}

function getSuggestedAction(
  response: AIResponseV1<NexAiAction, NexState> | null,
): string {
  if (!response?.bestMove) {
    return 'Compara a tua distância de ligação com a do adversário antes de agir.';
  }
  return `Treina a linha ${formatAction(response.bestMove)}.`;
}

function getThreatClasses(severity: 'low' | 'medium' | 'high'): string {
  if (severity === 'high') return 'border-red-300 bg-red-50 text-red-900';
  if (severity === 'medium') return 'border-amber-300 bg-amber-50 text-amber-900';
  return 'border-slate-300 bg-slate-50 text-slate-800';
}

function actionTouchesPos(action: NexAiAction | undefined | null, pos: Posicao): boolean {
  if (!action) return false;
  if (action.type === 'swap' || action.type === 'recusar_swap') return false;
  if (action.type === 'colocar') {
    return (action.own.x === pos.x && action.own.y === pos.y) || (action.neutral.x === pos.x && action.neutral.y === pos.y);
  }
  return (
    (action.n1.x === pos.x && action.n1.y === pos.y) ||
    (action.n2.x === pos.x && action.n2.y === pos.y) ||
    (action.sacrifice.x === pos.x && action.sacrifice.y === pos.y)
  );
}

function normalizeHintLevel(level?: 'H0' | 'H1' | 'H2' | 'H3'): 'H1' | 'H2' | 'H3' | undefined {
  if (!level || level === 'H0') return undefined;
  return level;
}

export function NexGame({ onVoltar }: NexGameProps) {
  const { recordGameCompleted } = useGamification();
  const [state, setState] = useState<NexState>(() => 
    criarEstadoInicial('vs-computador')
  );
  const [mostrarVencedor, setMostrarVencedor] = useState(false);
  const [humanPlayer, setHumanPlayer] = useState<Player>('jogador1');
  const [tipoSelecao, setTipoSelecao] = useState<'propria' | 'neutra'>('propria');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [aiMetrics, setAiMetrics] = useState<AIMetrics>(INITIAL_METRICS);
  const [aiReady, setAiReady] = useState(false);
  const [tutorResponse, setTutorResponse] =
    useState<AIResponseV1<NexAiAction, NexState> | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const aiClientRef = useRef<NexAIClient | null>(null);
  const tutorAdapterRef = useRef<NexV1Adapter | null>(null);
  const awardedResultRef = useRef<string | null>(null);
  
  // Estado para pan/drag do tabuleiro
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boardDraggableRef = useRef<HTMLDivElement>(null);

  // Initialize AI client
  useEffect(() => {
    const client = new NexAIClient({
      onMetricsUpdate: setAiMetrics,
      onReady: () => setAiReady(true),
    });
    aiClientRef.current = client;
    return () => client.terminate();
  }, []);

  useEffect(() => {
    const adapter = new NexV1Adapter();
    tutorAdapterRef.current = adapter;
    return () => adapter.terminate();
  }, []);

  const aplicarAcaoIA = useCallback((prev: NexState, action: any): NexState => {
    if (!action || typeof action !== 'object') return jogadaComputador(prev);
    if (action.type === 'swap') return executarSwap(prev);
    if (action.type === 'recusar_swap') return recusarSwap(prev);
    if (action.type === 'colocar') {
      return executarColocacao(prev, { tipo: 'colocacao', posPropria: action.own, posNeutra: action.neutral });
    }
    if (action.type === 'substituir') {
      return executarSubstituicao(prev, {
        tipo: 'substituicao',
        neutrasParaProprias: [action.n1, action.n2],
        propriaParaNeutra: action.sacrifice,
      });
    }
    return jogadaComputador(prev);
  }, []);

  // Efeito para jogada do computador
  useEffect(() => {
    if (
      state.modo === 'vs-computador' && 
      state.jogadorAtual !== humanPlayer && 
      state.estado === 'a-jogar' &&
      !state.swapDisponivel && // Esperar decisão de swap
      aiClientRef.current
    ) {
      let cancelled = false;
      let finished = false;
      const client = aiClientRef.current;
      const maxWaitMs = DIFFICULTY_PRESETS[aiDifficulty].timeMs + 250;
      const timer = setTimeout(async () => {
        if (cancelled || !client) return;
        try {
          const action = await withTimeout(
            client.getBestAction(state, aiDifficulty),
            maxWaitMs,
            () => client.cancel()
          );
          if (cancelled) return;
          finished = true;
          setState(prev => (action ? aplicarAcaoIA(prev, action) : jogadaComputador(prev)));
        } catch (e) {
          console.error('[NexGame] AI error:', e);
          if (cancelled) return;
          finished = true;
          setState(prev => jogadaComputador(prev));
        }
      }, 350);
      return () => {
        cancelled = true;
        clearTimeout(timer);
        if (!finished) client?.cancel();
      };
    }
  }, [state.jogadorAtual, state.modo, state.estado, state.swapDisponivel, humanPlayer, aiDifficulty, state, aplicarAcaoIA]);

  // Efeito para IA decidir swap
  useEffect(() => {
    if (
      state.modo === 'vs-computador' && 
      state.swapDisponivel &&
      state.jogadorAtual !== humanPlayer &&
      aiClientRef.current
    ) {
      let cancelled = false;
      let finished = false;
      const client = aiClientRef.current;
      const maxWaitMs = DIFFICULTY_PRESETS[aiDifficulty].timeMs + 250;
      const timer = setTimeout(async () => {
        if (cancelled || !client) return;
        try {
          const action = await withTimeout(
            client.getBestAction(state, aiDifficulty),
            maxWaitMs,
            () => client.cancel()
          );
          if (cancelled) return;
          finished = true;
          setState(prev => (action ? aplicarAcaoIA(prev, action) : jogadaComputador(prev)));
        } catch (e) {
          console.error('[NexGame] AI swap error:', e);
          if (cancelled) return;
          finished = true;
          setState(prev => jogadaComputador(prev));
        }
      }, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
        if (!finished) client?.cancel();
      };
    }
  }, [state.swapDisponivel, state.modo, state.jogadorAtual, humanPlayer, aiDifficulty, state, aplicarAcaoIA]);

  useEffect(() => {
    if (!tutorAdapterRef.current) return;
    if (state.modo !== 'vs-computador' || state.estado !== 'a-jogar' || state.jogadorAtual !== humanPlayer) {
      setTutorLoading(false);
      return;
    }

    let cancelled = false;
    const adapter = tutorAdapterRef.current;
    const request: AIRequestV1<NexState, NexAiAction> = {
      version: '1.0',
      requestId: `nex-tutor-${Date.now()}`,
      gameId: 'nex',
      mode: 'tutor',
      level: mapDifficultyToLevel(aiDifficulty),
      state,
      locale: 'pt-PT',
    };

    setTutorLoading(true);

    void adapter
      .compute(request)
      .then((response) => {
        if (!cancelled) {
          setTutorResponse(response);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[NexGame] Tutor error:', error);
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
  }, [aiDifficulty, humanPlayer, state]);

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

    recordGameCompleted('nex', humanWon);
    awardedResultRef.current = state.estado;
  }, [humanPlayer, recordGameCompleted, state.estado, state.modo]);

  const handleCellClick = useCallback((pos: Posicao) => {
    if (state.estado !== 'a-jogar') return;
    if (state.modo === 'vs-computador' && state.jogadorAtual !== humanPlayer) return;
    if (state.swapDisponivel) return; // Deve decidir swap primeiro
    
    const celula = state.tabuleiro[pos.x][pos.y];
    const acao = state.acaoEmCurso;
    const corJogador = getCorJogador(state, state.jogadorAtual);
    
    // Se não há tipo de ação selecionado, selecionar colocação por defeito
    if (acao.tipo === null) {
      setState(prev => selecionarTipoAcao(prev, 'colocacao'));
      return;
    }
    
    if (acao.tipo === 'colocacao') {
      if (celula !== 'vazia') return;
      
      setState(prev => adicionarPosicaoAcao(prev, pos, tipoSelecao));
    } else if (acao.tipo === 'substituicao') {
      if (tipoSelecao === 'neutra' && celula === 'neutra') {
        setState(prev => adicionarPosicaoAcao(prev, pos, 'neutra'));
      } else if (tipoSelecao === 'propria' && celula === corJogador) {
        setState(prev => adicionarPosicaoAcao(prev, pos, 'propria'));
      }
    }
  }, [state, humanPlayer, tipoSelecao]);

  // Executar ação quando completa
  useEffect(() => {
    if (isAcaoCompleta(state.acaoEmCurso)) {
      const timer = setTimeout(() => {
        setState(prev => executarAcao(prev));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state.acaoEmCurso]);

  const handleSelectTipoAcao = useCallback((tipo: TipoAcao) => {
    setState(prev => selecionarTipoAcao(prev, tipo));
    setTipoSelecao(tipo === 'colocacao' ? 'propria' : 'neutra');
  }, []);

  const handleCancelar = useCallback(() => {
    setState(prev => cancelarAcao(prev));
    setTipoSelecao('propria');
  }, []);

  const handleSwap = useCallback(() => {
    setState(prev => executarSwap(prev));
  }, []);

  const handleRecusarSwap = useCallback(() => {
    setState(prev => recusarSwap(prev));
  }, []);

  const novoJogo = useCallback(() => {
    aiClientRef.current?.cancel();
    setState(criarEstadoInicial(state.modo));
    setMostrarVencedor(false);
    setAiMetrics(INITIAL_METRICS);
    setTutorResponse(null);
  }, [state.modo]);

  const trocarModo = useCallback(() => {
    const novoModo: GameMode = state.modo === 'vs-computador' ? 'dois-jogadores' : 'vs-computador';
    aiClientRef.current?.cancel();
    setState(criarEstadoInicial(novoModo));
    setMostrarVencedor(false);
    setHumanPlayer('jogador1');
    setAiMetrics(INITIAL_METRICS);
    setTutorResponse(null);
  }, [state.modo]);

  const handleChangeHumanPlayer = useCallback((player: Player) => {
    aiClientRef.current?.cancel();
    setHumanPlayer(player);
    setState(criarEstadoInicial('vs-computador'));
    setMostrarVencedor(false);
    setAiMetrics(INITIAL_METRICS);
    setTutorResponse(null);
  }, []);

  // Handlers para pan/drag do tabuleiro
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Só permitir drag se não estiver clicando diretamente em uma célula
    const target = e.target as SVGElement;
    if (target.tagName === 'polygon' || target.closest('polygon')) {
      return;
    }
    // Verificar se é clique no SVG ou no container
    if (target.tagName === 'svg' || target.tagName === 'DIV') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    // Só aplicar pan se o movimento for significativo (evitar interferir com cliques)
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setPanOffset({
        x: deltaX,
        y: deltaY,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Só permitir drag se não estiver tocando diretamente em uma célula
    const target = e.target as SVGElement;
    if (target.tagName === 'polygon' || target.closest('polygon')) {
      return;
    }
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - panOffset.x, 
        y: e.touches[0].clientY - panOffset.y 
      });
    }
  }, [panOffset]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const target = e.target as SVGElement;
    // Se estiver sobre uma célula, não fazer pan
    if (target.tagName === 'polygon' || target.closest('polygon')) {
      return;
    }
    e.preventDefault();
    setPanOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Adicionar listeners nativos para touch events com passive: false
  useEffect(() => {
    const draggable = boardDraggableRef.current;
    if (!draggable) return;

    const touchStartHandler = (e: TouchEvent) => {
      handleTouchStart(e);
    };

    const touchMoveHandler = (e: TouchEvent) => {
      handleTouchMove(e);
    };

    const touchEndHandler = () => {
      handleTouchEnd();
    };

    // Adicionar listeners com passive: false para touchmove permitir preventDefault
    draggable.addEventListener('touchstart', touchStartHandler, { passive: true });
    draggable.addEventListener('touchmove', touchMoveHandler, { passive: false });
    draggable.addEventListener('touchend', touchEndHandler, { passive: true });

    return () => {
      draggable.removeEventListener('touchstart', touchStartHandler);
      draggable.removeEventListener('touchmove', touchMoveHandler);
      draggable.removeEventListener('touchend', touchEndHandler);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Reset pan quando necessário
  const resetPan = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Verificar se uma posição está selecionada na ação em curso
  const isPosicaoSelecionada = (pos: Posicao): boolean => {
    const acao = state.acaoEmCurso;
    if (acao.tipo === 'colocacao') {
      return (acao.posPropria !== null && posToKey(acao.posPropria) === posToKey(pos)) ||
             (acao.posNeutra !== null && posToKey(acao.posNeutra) === posToKey(pos));
    } else if (acao.tipo === 'substituicao') {
      return acao.neutrasParaProprias.some(p => posToKey(p) === posToKey(pos)) ||
             (acao.propriaParaNeutra !== null && posToKey(acao.propriaParaNeutra) === posToKey(pos));
    }
    return false;
  };

  // Constantes para hexágonos (flat-top após rotação)
  const HEX_SIZE = 16; // Raio do hexágono
  const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;  // Largura do hexágono
  const HEX_HEIGHT = 2 * HEX_SIZE;  // Altura do hexágono
  
  // Calcular posição do hexágono no layout LOSANGO HORIZONTAL
  // Rotação de 90° do layout anterior para corresponder ao tabuleiro físico
  // - (0,0) está na ESQUERDA do losango
  // - (10,10) está na DIREITA do losango
  // - (10,0) está no TOPO
  // - (0,10) está na BASE
  const getHexPosition = (row: number, col: number) => {
    // Rotação 90°: trocar os eixos
    const x = (row + col) * HEX_HEIGHT * 0.75;
    const y = (row - col) * HEX_WIDTH / 2;
    return { x, y };
  };
  
  // Gerar pontos para hexágono flat-top (aresta no topo, após rotação 90°)
  const hexPoints = (cx: number, cy: number, size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      // Flat-top: começar da aresta direita (0°)
      const angle = (Math.PI / 3) * i;
      const px = cx + size * Math.cos(angle);
      const py = cy + size * Math.sin(angle);
      points.push(`${px},${py}`);
    }
    return points.join(' ');
  };

  // Calcular dimensões totais do tabuleiro (horizontal)
  const calcularDimensoesTabuleiro = () => {
    // Para o layout diamante horizontal:
    // x varia de 0 a 20 * HEX_HEIGHT * 0.75
    // y varia de -10 * HEX_WIDTH/2 a +10 * HEX_WIDTH/2
    const xRange = (LADO_TABULEIRO * 2 - 1) * HEX_HEIGHT * 0.75;
    const yRange = LADO_TABULEIRO * HEX_WIDTH;
    return { 
      width: xRange + HEX_SIZE * 4,
      height: yRange + HEX_SIZE * 4,
      centerY: yRange / 2 + HEX_SIZE * 2  // Centro vertical
    };
  };

  const dimensoes = calcularDimensoesTabuleiro();

  const isVezDoHumano = state.modo === 'dois-jogadores' || state.jogadorAtual === humanPlayer;
  const podeFazerColocacao = podeColocar(state.tabuleiro);
  const podeFazerSubstituicao = podeSubstituir(state.tabuleiro, state.jogadorAtual, state.swapEfetuado);
  const criticalThreat = tutorResponse?.criticalThreats?.[0];

  // Determinar o que está em falta na ação
  const getInstrucaoAcao = () => {
    const acao = state.acaoEmCurso;
    if (acao.tipo === 'colocacao') {
      if (acao.posPropria === null) return 'Clica numa casa vazia para a peça própria';
      if (acao.posNeutra === null) return 'Clica noutra casa vazia para a peça neutra';
      return 'A executar...';
    } else if (acao.tipo === 'substituicao') {
      if (acao.neutrasParaProprias.length < 2) {
        return `Seleciona ${2 - acao.neutrasParaProprias.length} peça(s) neutra(s) para converter`;
      }
      if (acao.propriaParaNeutra === null) return 'Seleciona uma peça própria para converter em neutra';
      return 'A executar...';
    }
    return 'Seleciona o tipo de ação';
  };

  return (
    <GameLayout titulo="Nex" regras={REGRAS} onVoltar={onVoltar}>
      <div className="space-y-4">
        {/* Info do jogador */}
        <PlayerInfo
          modo={state.modo}
          jogadorAtual={state.jogadorAtual}
          estado={state.estado}
          nomeJogador1={state.swapEfetuado ? "Brancas (↗↙)" : "Pretas (↖↘)"}
          nomeJogador2={state.swapEfetuado ? "Pretas (↖↘)" : "Brancas (↗↙)"}
          corJogador1={state.swapEfetuado ? "bg-gray-200" : "bg-gray-900"}
          corJogador2={state.swapEfetuado ? "bg-gray-900" : "bg-gray-200"}
          humanPlayer={humanPlayer}
          onChangeHumanPlayer={handleChangeHumanPlayer}
          onNovoJogo={novoJogo}
          onTrocarModo={trocarModo}
        />

        <TrainingPathCard gameId="nex" />

        {state.estado === 'a-jogar' && state.modo === 'vs-computador' && state.jogadorAtual === humanPlayer && (
          <div className="space-y-3">
            <TutorContextBar items={buildTutorContextItems(tutorResponse)} />
            <HintLegend showThreat={Boolean(criticalThreat)} showAlternative />
            <TutorHintCard
              insight={
                tutorResponse?.explainText ??
                'Compara a tua distância de ligação com a do adversário e usa a neutra como bloqueio ativo.'
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
                  <p className="mt-1 font-medium">Resposta mínima: {formatAction(criticalThreat.counterMove)}</p>
                )}
              </section>
            )}
          </div>
        )}

        {/* Configuração de IA (só no modo vs-computador) */}
        {state.modo === 'vs-computador' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-blue-900">Dificuldade (IA)</label>
              <select
                className="text-sm rounded-lg border border-blue-200 bg-white px-2 py-1"
                value={aiDifficulty}
                onChange={e => {
                  aiClientRef.current?.cancel();
                  setAiDifficulty(e.target.value as AIDifficulty);
                }}
              >
                <option value="easy">Fácil</option>
                <option value="medium">Médio</option>
                <option value="hard">Difícil</option>
                <option value="master">Master</option>
              </select>
            </div>
            <div className="text-xs text-blue-900/80 flex items-center justify-between">
              <span>{aiMetrics.isThinking ? 'A pensar…' : 'Pronto'}</span>
              <span>
                {aiReady ? (aiMetrics.usedWasm ? `WASM (${aiMetrics.lastTimeMs.toFixed(0)}ms)` : 'Fallback') : 'A carregar…'}
              </span>
            </div>
          </div>
        )}

        {/* Indicador de IA a decidir (evitar parecer bloqueado) */}
        {state.modo === 'vs-computador' && state.estado === 'a-jogar' && !isVezDoHumano && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
            <span className="flex items-center justify-center gap-2 text-indigo-700 font-medium text-sm">
              <span className="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
              {state.swapDisponivel ? 'IA a decidir sobre o swap…' : 'IA a pensar…'}
            </span>
          </div>
        )}

        {/* Swap disponível */}
        {state.swapDisponivel && isVezDoHumano && (
          <div className="bg-purple-100 border-2 border-purple-400 rounded-xl p-4">
            <p className="text-purple-800 font-semibold text-sm mb-2 text-center">
              🔄 Regra da Torta (Swap)
            </p>
            <p className="text-purple-700 text-xs mb-3 text-center">
              Podes trocar de cor e ficar com a posição das Pretas!
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleSwap}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium text-sm hover:bg-purple-600 transition-colors"
              >
                Trocar cores
              </button>
              <button
                onClick={handleRecusarSwap}
                className="px-4 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg font-medium text-sm hover:bg-purple-50 transition-colors"
              >
                Manter
              </button>
            </div>
          </div>
        )}

        {/* Seleção de ação */}
        {!state.swapDisponivel && state.estado === 'a-jogar' && isVezDoHumano && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3">
            <div className="flex justify-center gap-3 mb-2">
              <button
                onClick={() => handleSelectTipoAcao('colocacao')}
                disabled={!podeFazerColocacao}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  state.acaoEmCurso.tipo === 'colocacao'
                    ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                    : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                } ${!podeFazerColocacao ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Colocação
              </button>
              <button
                onClick={() => handleSelectTipoAcao('substituicao')}
                disabled={!podeFazerSubstituicao}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  state.acaoEmCurso.tipo === 'substituicao'
                    ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                    : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                } ${!podeFazerSubstituicao ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Substituição
              </button>
              {state.acaoEmCurso.tipo !== null && (
                <button
                  onClick={handleCancelar}
                  className="px-3 py-2 text-red-600 hover:text-red-800 text-sm underline"
                >
                  Cancelar
                </button>
              )}
            </div>
            
            {state.acaoEmCurso.tipo !== null && (
              <div className="text-center">
                <p className="text-blue-700 text-sm">{getInstrucaoAcao()}</p>
                
                {/* Seletor propria/neutra para colocação */}
                {state.acaoEmCurso.tipo === 'colocacao' && (
                  <div className="flex justify-center gap-2 mt-2">
                    <button
                      onClick={() => setTipoSelecao('propria')}
                      className={`px-2 py-1 rounded text-xs ${
                        tipoSelecao === 'propria' 
                          ? 'bg-gray-800 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Própria
                    </button>
                    <button
                      onClick={() => setTipoSelecao('neutra')}
                      className={`px-2 py-1 rounded text-xs ${
                        tipoSelecao === 'neutra' 
                          ? 'bg-gray-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Neutra
                    </button>
                  </div>
                )}
                
                {/* Seletor para substituição */}
                {state.acaoEmCurso.tipo === 'substituicao' && (
                  <div className="flex justify-center gap-2 mt-2">
                    <button
                      onClick={() => setTipoSelecao('neutra')}
                      className={`px-2 py-1 rounded text-xs ${
                        tipoSelecao === 'neutra' 
                          ? 'bg-gray-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Neutras→Próprias
                    </button>
                    <button
                      onClick={() => setTipoSelecao('propria')}
                      className={`px-2 py-1 rounded text-xs ${
                        tipoSelecao === 'propria' 
                          ? 'bg-gray-800 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Própria→Neutra
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tabuleiro Hexagonal em Losango */}
        <div className="game-container">
          <div className="relative">
            {/* Botão para resetar pan (apenas visível quando há offset) */}
            {(panOffset.x !== 0 || panOffset.y !== 0) && (
              <button
                onClick={resetPan}
                className="absolute top-2 right-2 z-10 px-3 py-1 bg-blue-500 text-white text-xs rounded-lg shadow-md hover:bg-blue-600 transition-colors"
                title="Reposicionar tabuleiro"
              >
                ↺ Reposicionar
              </button>
            )}
            
            {/* Container com overflow e pan */}
            <div 
              ref={boardContainerRef}
              className="overflow-auto"
              style={{ 
                maxHeight: '70vh',
                cursor: isDragging ? 'grabbing' : 'default',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x pan-y',
                // Garantir que o scroll funciona em todos os dispositivos
                overscrollBehavior: 'contain'
              }}
            >
              <div 
                ref={boardDraggableRef}
                className="relative inline-block p-12"
                style={{
                  transform: panOffset.x !== 0 || panOffset.y !== 0 
                    ? `translate(${panOffset.x}px, ${panOffset.y}px)` 
                    : 'none',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Indicadores de canto - fora do tabuleiro, nos cantos da área */}
                {/* Pretas: superior-esquerdo e inferior-direito */}
                <div className="absolute top-0 left-0 w-7 h-7 rounded-full bg-gray-800 z-10"></div>
                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-gray-800 z-10"></div>
                {/* Brancas: superior-direito e inferior-esquerdo */}
                <div className="absolute top-0 right-0 w-7 h-7 rounded-full bg-white border-2 border-gray-800 z-10"></div>
                <div className="absolute bottom-0 left-0 w-7 h-7 rounded-full bg-white border-2 border-gray-800 z-10"></div>
                
                <svg 
                  width={dimensoes.width} 
                  height={dimensoes.height}
                  viewBox={`${-HEX_SIZE * 2} ${-dimensoes.centerY} ${dimensoes.width} ${dimensoes.height}`}
                  className="block"
                >
                
                {/* Hexágonos do tabuleiro */}
                {Array.from({ length: LADO_TABULEIRO }, (_, row) => (
                  Array.from({ length: LADO_TABULEIRO }, (_, col) => {
                    const pos = getHexPosition(row, col);
                    const cx = pos.x;
                    const cy = pos.y;
                    
                    // Note: tabuleiro usa [col][row] (x, y)
                    const celula = state.tabuleiro[col][row];
                    const posicao = { x: col, y: row };
                    const selecionada = isPosicaoSelecionada(posicao);
                    const recomendada = actionTouchesPos(tutorResponse?.bestMove, posicao);
                    const ameacada = actionTouchesPos(criticalThreat?.counterMove, posicao);
                    
                    // Determinar cor de preenchimento
                    let fill = '#fef3c7'; // amber-100 - vazia
                    let stroke = '#92400e'; // amber-800
                    let strokeWidth = 1;
                    
                    if (celula === 'preta') {
                      fill = '#1f2937'; // gray-800
                      stroke = '#111827';
                    } else if (celula === 'branca') {
                      fill = '#ffffff';
                      stroke = '#6b7280';
                    } else if (celula === 'neutra') {
                      fill = '#9ca3af'; // gray-400
                      stroke = '#6b7280';
                    }

                    if (recomendada) {
                      stroke = '#f59e0b';
                      strokeWidth = 3;
                    } else if (ameacada) {
                      stroke = '#f43f5e';
                      strokeWidth = 3;
                    }
                    
                    return (
                      <g key={`${col}-${row}`}>
                        {/* Hexágono principal */}
                        <polygon
                          points={hexPoints(cx, cy, HEX_SIZE - 1)}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleCellClick(posicao)}
                        />
                        
                        {/* Indicador de seleção */}
                        {selecionada && (
                          <polygon
                            points={hexPoints(cx, cy, HEX_SIZE + 2)}
                            fill="none"
                            stroke="#4ade80"
                            strokeWidth={3}
                          />
                        )}
                      </g>
                    );
                  })
                ))}
                
                </svg>
              </div>
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gray-900"></div>
              <span>Pretas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-white border-2 border-gray-300"></div>
              <span>Brancas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gray-400"></div>
              <span>Neutra</span>
            </div>
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
