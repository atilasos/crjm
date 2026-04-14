import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Header } from './Header';
import {
  createTournamentClient,
  tournamentStateFromUpdate,
  fromNetworkGameState,
  type TournamentClient,
  type ConnectionStatus,
  type ServerMessage,
  type GameId,
  type TournamentState,
  type Match,
  type TournamentStateUpdateMessage,
  GAME_NAMES,
  // Boards
  GatosCaesBoard,
  DominorioBoard,
  QuelhasBoard,
  ProdutoBoard,
  AtariGoBoard,
  NexBoard,
  toNetworkProdutoMove,
  toNetworkAtariGoMove,
  toNetworkNexMove,
} from '../tournament';

// Tipos dos jogos
import type { GatosCaesState, Posicao as GatosCaesPosicao } from '../games/gatos-caes/types';
import type { DominorioState, Domino } from '../games/dominorio/types';
import type { QuelhasState, Segmento as QuelhasSegmento } from '../games/quelhas/types';
import type { ProdutoState, JogadaDupla } from '../games/produto/types';
import type { AtariGoState, Posicao as AtariGoPosicao } from '../games/atari-go/types';
import type { NexState, Acao as NexAcao } from '../games/nex/types';
import { DEFAULT_TOURNAMENT_SERVER_URL, PRESET_TOURNAMENT_SERVERS } from '../tournament/server-config';

interface CampeonatoPageProps {
  onVoltar: () => void;
}

type Phase = 'connect' | 'lobby' | 'match' | 'finished';

interface LogEntry {
  id: number;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

/** Estado de jogo de um match para espectadores */
interface SpectatorMatchState {
  matchId: string;
  gameNumber: number;
  gameState: unknown;
  bracket: string;
  round: number;
  player1Name: string;
  player2Name: string;
  score: { player1Wins: number; player2Wins: number };
  whoseTurn: 'player1' | 'player2' | null;
}

/** Info básica de jogos activos para lista de selecção */
interface ActiveGameInfo {
  matchId: string;
  bracket: string;
  round: number;
  player1Name: string;
  player2Name: string;
  score: { player1Wins: number; player2Wins: number };
  gameNumber: number;
}

// Normaliza o formato de TournamentState vindo do servidor/mocks:
// - Suporta tanto o formato "novo" (CLIENT-INTEGRATION_NEW) como o formato antigo
//   usado atualmente pelo servidor Bun (campo `id` em vez de `tournamentId`,
//   players sem flags de online, etc.).
function normalizeTournamentState(raw: any | null | undefined): TournamentState | null {
  if (!raw) return null;

  // Heurística: se já tiver `tournamentId` ou `championName`, assumimos formato novo
  const isNewFormat = 'tournamentId' in raw || 'championName' in raw;
  if (isNewFormat) {
    return raw as TournamentState;
  }

  // Formato antigo: campos como `id`, sem `championName` e sem flags de online
  const players = Array.isArray(raw.players)
    ? raw.players.map((p: any) => ({
      id: p.id,
      name: p.name,
      classId: p.classId,
      isOnline: true,
      isBot: p.isBot ?? false,
    }))
    : [];

  const championId: string | null = raw.championId ?? null;
  const championPlayer = players.find((p: { id: string }) => p.id === championId) ?? null;

  return {
    tournamentId: raw.id ?? raw.tournamentId ?? 'unknown',
    gameId: raw.gameId as GameId,
    phase: raw.phase ?? 'registration',
    players,
    winnersMatches: raw.winnersMatches ?? [],
    losersMatches: raw.losersMatches ?? [],
    grandFinal: raw.grandFinal ?? null,
    grandFinalReset: raw.grandFinalReset ?? null,
    championId,
    championName: championPlayer ? championPlayer.name : null,
  };
}

export function CampeonatoPage({ onVoltar }: CampeonatoPageProps) {
  // Estado de conexão
  const [serverUrl, setServerUrl] = useState(DEFAULT_TOURNAMENT_SERVER_URL);
  const [useMockServer, setUseMockServer] = useState(false); // Default to real server with preset
  const [playerName, setPlayerName] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedGame, setSelectedGame] = useState<GameId>('gatos-caes');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectionCode, setReconnectionCode] = useState<string | null>(null);
  const [reconnectionCodeInput, setReconnectionCodeInput] = useState('');

  // Estado do torneio
  const [phase, setPhase] = useState<Phase>('connect');
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [myRole, setMyRole] = useState<'player1' | 'player2' | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<GameId | null>(null);

  // Estado do jogo dentro do match (novo protocolo não inclui isto no Match)
  const [currentGameNumber, setCurrentGameNumber] = useState(1);
  const [matchScore, setMatchScore] = useState<{ player1Wins: number; player2Wins: number }>({ player1Wins: 0, player2Wins: 0 });

  // Estado para anúncio de fim de partida individual
  const [gameJustEnded, setGameJustEnded] = useState(false);
  const [lastGameWinnerId, setLastGameWinnerId] = useState<string | null>(null);
  const [lastGameWinnerRole, setLastGameWinnerRole] = useState<'player1' | 'player2' | null>(null);

  // Estado do jogo atual
  const [gameState, setGameState] = useState<
    GatosCaesState | DominorioState | QuelhasState | ProdutoState | AtariGoState | NexState | null
  >(null);

  // Estado do modo espectador
  const [activeGames, setActiveGames] = useState<ActiveGameInfo[]>([]);
  const [spectatorMatchStates, setSpectatorMatchStates] = useState<Map<string, SpectatorMatchState>>(new Map());
  const [selectedSpectateMatchId, setSelectedSpectateMatchId] = useState<string | null>(null);

  // Log de eventos
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Cliente de torneio
  const clientRef = useRef<TournamentClient | null>(null);

  // Refs para handlers - evita recriar o cliente quando o estado muda
  const playerIdRef = useRef<string | null>(null);
  const currentGameIdRef = useRef<GameId | null>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: logIdRef.current++,
      timestamp: new Date(),
      message,
      type,
    };
    setLogs(prev => [...prev.slice(-50), entry]);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Mantém as refs sincronizadas com o estado
  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    currentGameIdRef.current = currentGameId;
  }, [currentGameId]);

  // Handler de mensagens que usa refs em vez de estado diretamente
  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'welcome':
        setPlayerId(message.playerId);
        // Guardar código de reconexão
        if (message.reconnectionCode) {
          setReconnectionCode(message.reconnectionCode);
        }
        // Aceita tanto o formato antigo (message.tournamentState.id, ...) como o novo
        {
          const rawState = (message as any).tournamentState ?? null;
          const normalized = normalizeTournamentState(rawState);
          if (normalized) {
            setTournamentState(normalized);
            setCurrentGameId(normalized.gameId);
          }
        }
        setPhase('lobby');
        addLog('Inscrito no campeonato!', 'success');
        break;

      case 'tournament_state_update': {
        // Pode vir em dois formatos:
        // - Novo: campos flat (TournamentStateUpdateMessage)
        // - Antigo: { type: 'tournament_state_update', tournamentState: {...} }
        let newState: TournamentState | null = null;

        const anyMsg = message as any;
        if (anyMsg.tournamentState) {
          // Formato antigo do servidor Bun
          newState = normalizeTournamentState(anyMsg.tournamentState);
        } else {
          // Formato novo (mock / futuros servidores)
          newState = tournamentStateFromUpdate(message as TournamentStateUpdateMessage);
        }

        if (!newState) {
          break;
        }
        setTournamentState(newState);
        break;
      }

      case 'match_assigned':
        setCurrentMatch(message.match);
        setMyRole(message.yourRole);
        // Usar o número do jogo e score do match (importante para reconexões!)
        setCurrentGameNumber(message.match.currentGame || 1);
        setMatchScore(message.match.score || { player1Wins: 0, player2Wins: 0 });
        setPhase('match');
        // Limpar modo espectador quando recebemos um match
        setSelectedSpectateMatchId(null);
        // Novo protocolo inclui opponentName directamente
        addLog(`Confronto atribuído: Tu vs ${message.opponentName}`, 'success');
        break;

      case 'game_start': {
        setIsMyTurn(message.youStart);
        setCurrentGameNumber(message.gameNumber);
        // Reset do estado de fim de partida
        setGameJustEnded(false);
        setLastGameWinnerId(null);
        setLastGameWinnerRole(null);
        // Atualiza myRole se fornecido (novo protocolo)
        if (message.yourRole) {
          setMyRole(message.yourRole);
        }
        // Garante que o match atual passa para fase 'playing' quando o jogo começa
        setCurrentMatch(prev =>
          prev
            ? {
              ...prev,
              phase: 'playing',
            }
            : prev
        );
        // Converte estado de rede para local se necessário
        const gameIdForConversion = currentGameIdRef.current || 'gatos-caes';
        try {
          const localInitialState = fromNetworkGameState(gameIdForConversion, message.initialState);
          setGameState(localInitialState as any);
        } catch {
          // Fallback: assume que já está no formato local
          setGameState(message.initialState as any);
        }
        addLog(
          `Jogo ${message.gameNumber} começou! ${message.youStart ? 'É a tua vez!' : 'Aguarda a jogada do adversário.'}`,
          'info'
        );
        break;
      }

      case 'game_state_update': {
        setIsMyTurn(message.yourTurn);
        // Converte estado de rede para local se necessário
        const gameIdForUpdate = currentGameIdRef.current || 'gatos-caes';
        try {
          const localState = fromNetworkGameState(gameIdForUpdate, message.gameState);
          setGameState(localState as any);
        } catch {
          // Fallback: assume que já está no formato local
          setGameState(message.gameState as any);
        }
        break;
      }

      case 'game_end': {
        // Converte estado de rede para local se necessário
        const gameIdForEnd = currentGameIdRef.current || 'gatos-caes';
        try {
          const localFinalState = fromNetworkGameState(gameIdForEnd, message.finalState);
          setGameState(localFinalState as any);
        } catch {
          // Fallback: assume que já está no formato local
          setGameState(message.finalState as any);
        }
        // Novo protocolo inclui matchScore
        if (message.matchScore) {
          setMatchScore(message.matchScore);
        }

        // Ativar estado de anúncio de fim de partida
        setGameJustEnded(true);
        setLastGameWinnerId(message.winnerId);
        setLastGameWinnerRole(message.winnerRole);

        // Atualizar fase do match para waiting (preparar próxima partida)
        setCurrentMatch(prev =>
          prev
            ? {
              ...prev,
              phase: 'waiting',
            }
            : prev
        );

        addLog(`Jogo ${message.gameNumber} terminou!`, 'info');
        break;
      }

      case 'match_end':
        setCurrentMatch(null);
        setMyRole(null);
        setGameState(null);
        setCurrentGameNumber(1);
        setMatchScore({ player1Wins: 0, player2Wins: 0 });
        setGameJustEnded(false);
        setLastGameWinnerId(null);
        setLastGameWinnerRole(null);
        if (message.youWon) {
          addLog(`🎉 Ganhaste o confronto! ${message.finalScore.player1Wins}-${message.finalScore.player2Wins}`, 'success');
        } else {
          addLog(`Perdeste o confronto. ${message.finalScore.player1Wins}-${message.finalScore.player2Wins}`, 'warning');
        }
        // Novo protocolo usa eliminatedFromTournament
        if (message.eliminatedFromTournament) {
          addLog('Foste eliminado do campeonato.', 'error');
          setPhase('finished');
        } else {
          // Jogador continua no torneio - volta ao lobby para esperar próximo match
          // (pode ir para Winners ou Losers bracket dependendo do resultado)
          if (!message.youWon) {
            addLog('Vais para a Losers Bracket. Uma derrota e estás eliminado!', 'warning');
          }
          // Voltar ao lobby para ver o painel de espera/espectador
          setPhase('lobby');
        }
        break;

      case 'tournament_end':
        setPhase('finished');
        // Usa a ref para obter o playerId atual
        const currentPlayerId = playerIdRef.current;
        const isChampion = message.championId === currentPlayerId;
        addLog(
          isChampion
            ? '🏆 PARABÉNS! És o CAMPEÃO!'
            : `O campeonato terminou. Campeão: ${message.championName}`,
          isChampion ? 'success' : 'info'
        );
        break;

      case 'error':
        addLog(`Erro: ${message.message}`, 'error');
        break;

      case 'info':
        addLog(message.message, 'info');
        break;
        
      case 'active_games_list':
        // Atualiza lista de jogos activos para modo espectador
        setActiveGames((message as any).games || []);
        break;
        
      case 'spectator_game_state': {
        // Atualiza estado de jogo para espectadores
        const specMsg = message as any;
        setSpectatorMatchStates(prev => {
          const newMap = new Map(prev);
          newMap.set(specMsg.matchId, {
            matchId: specMsg.matchId,
            gameNumber: specMsg.gameNumber,
            gameState: specMsg.gameState,
            bracket: specMsg.bracket,
            round: specMsg.round,
            player1Name: specMsg.player1Name,
            player2Name: specMsg.player2Name,
            score: specMsg.score,
            whoseTurn: specMsg.whoseTurn,
          });
          return newMap;
        });
        break;
      }
    }
  }, [addLog]); // Removido playerId das dependências - usa ref em vez disso

  // Configura os handlers do cliente - chamado uma vez no mount
  useEffect(() => {
    // Cleanup no unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  const handleConnect = async () => {
    if (!playerName.trim()) {
      addLog('Introduz o teu nome!', 'error');
      return;
    }

    if (!useMockServer && !serverUrl.trim()) {
      addLog('Introduz o endereço do servidor!', 'error');
      return;
    }

    // Limpa cliente anterior se existir
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    // Cria novo cliente com as configurações atuais
    const effectiveUrl = useMockServer ? 'mock' : serverUrl;
    const client = createTournamentClient(effectiveUrl);
    clientRef.current = client;

    // Configura handlers
    client.setEventHandlers({
      onConnectionStatusChange: (status, error) => {
        setConnectionStatus(status);
        setConnectionError(error ?? null);
        if (status === 'connected') {
          addLog(useMockServer ? 'Modo de teste iniciado!' : 'Ligado ao servidor!', 'success');
        } else if (status === 'error') {
          addLog(`Erro de ligação: ${error}`, 'error');
        } else if (status === 'disconnected') {
          // Só volta ao ecrã de connect se não estiver já lá
          addLog('Desligado do servidor.', 'warning');
        }
      },
      onMessage: handleServerMessage,
    });

    try {
      await client.connect(effectiveUrl);
      client.send({
        type: 'join_tournament',
        gameId: selectedGame,
        playerName: playerName.trim(),
        classId: classId.trim() || undefined,
      });
    } catch {
      addLog('Falha ao ligar ao servidor.', 'error');
    }
  };

  const handleRejoin = async () => {
    if (!reconnectionCodeInput.trim() || reconnectionCodeInput.length !== 6) {
      addLog('Introduz um código de reconexão válido (6 caracteres)!', 'error');
      return;
    }

    if (!serverUrl.trim()) {
      addLog('Introduz o endereço do servidor!', 'error');
      return;
    }

    // Limpa cliente anterior se existir
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    // Cria novo cliente
    const client = createTournamentClient(serverUrl);
    clientRef.current = client;

    // Configura handlers
    client.setEventHandlers({
      onConnectionStatusChange: (status, error) => {
        setConnectionStatus(status);
        setConnectionError(error ?? null);
        if (status === 'connected') {
          addLog('Ligado ao servidor!', 'success');
        } else if (status === 'error') {
          addLog(`Erro de ligação: ${error}`, 'error');
        } else if (status === 'disconnected') {
          addLog('Desligado do servidor.', 'warning');
        }
      },
      onMessage: handleServerMessage,
    });

    try {
      addLog(`A reconectar com código ${reconnectionCodeInput}...`, 'info');
      await client.rejoin(serverUrl, reconnectionCodeInput);
    } catch {
      addLog('Falha ao reconectar ao servidor.', 'error');
    }
  };

  const handleReadyForMatch = () => {
    if (!currentMatch || !clientRef.current) return;
    clientRef.current.send({
      type: 'ready_for_match',
      matchId: currentMatch.id,
    });
    addLog('Estás pronto! A aguardar...', 'info');
  };

  const handleMove = (move: unknown) => {
    if (!currentMatch || !clientRef.current || !isMyTurn) return;

    // Ignorar previews (usados apenas para visualização, não são jogadas reais)
    if (move && typeof move === 'object' && (move as any).isPreview) return;

    // Converter para formato de rede se necessário
    let networkMove = move;
    if (currentGameId === 'produto' && move) {
      // No ProdutoBoard do CampeonatoPage, o move pode ser pos1 ou pos2
      // Mas o toNetworkProdutoMove espera a jogada completa (JogadaDupla).
      // Se move tiver q e r ou pos {q, r} (formato local do ProdutoBoard), 
      // mandamos no formato de rede esperado pelo servidor.

      const anyMove = move as any;
      const pPos = anyMove.pos || (typeof anyMove.q === 'number' && typeof anyMove.r === 'number' ? { q: anyMove.q, r: anyMove.r } : null);
      const pCor = anyMove.cor;

      if (pPos && pCor) {
        networkMove = {
          placements: [{
            coord: { q: pPos.q, r: pPos.r },
            color: pCor === 'preta' ? 'black' : 'white'
          }]
        };
      }
    } else if (currentGameId === 'atari-go' && move) {
      networkMove = toNetworkAtariGoMove(move as AtariGoPosicao);
    } else if (currentGameId === 'nex' && move) {
      networkMove = toNetworkNexMove(move as NexAcao);
    }

    clientRef.current.send({
      type: 'submit_move',
      matchId: currentMatch.id,
      gameNumber: currentGameNumber,
      move: networkMove,
    });
  };

  const handleNextGame = () => {
    // Limpa o estado de fim de partida e inicia a próxima
    setGameJustEnded(false);
    setLastGameWinnerId(null);
    setLastGameWinnerRole(null);
    // Chama ready_for_match para iniciar a próxima partida
    handleReadyForMatch();
  };

  const handleDisconnect = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setPhase('connect');
    setTournamentState(null);
    setCurrentMatch(null);
    setMyRole(null);
    setGameState(null);
    setPlayerId(null);
    setConnectionStatus('disconnected');
    setGameJustEnded(false);
    setLastGameWinnerId(null);
    setLastGameWinnerRole(null);
  };

  // Só permite voltar se estiver no ecrã de connect
  // Durante lobby ou match, não deve poder sair acidentalmente
  const canGoBack = phase === 'connect';

  return (
    <div className="min-h-screen flex flex-col">
      <Header titulo="Modo Campeonato" onVoltar={canGoBack ? onVoltar : undefined} />

      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {phase === 'connect' && (
                <ConnectForm
                  serverUrl={serverUrl}
                  setServerUrl={setServerUrl}
                  useMockServer={useMockServer}
                  setUseMockServer={setUseMockServer}
                  playerName={playerName}
                  setPlayerName={setPlayerName}
                  classId={classId}
                  setClassId={setClassId}
                  selectedGame={selectedGame}
                  setSelectedGame={setSelectedGame}
                  connectionStatus={connectionStatus}
                  connectionError={connectionError}
                  onConnect={handleConnect}
                  reconnectionCodeInput={reconnectionCodeInput}
                  setReconnectionCodeInput={setReconnectionCodeInput}
                  onRejoin={handleRejoin}
                />
              )}

              {phase === 'lobby' && tournamentState && (
                <TournamentLobby
                  tournamentState={tournamentState}
                  playerId={playerId}
                  reconnectionCode={reconnectionCode}
                  activeGames={activeGames}
                  spectatorMatchStates={spectatorMatchStates}
                  selectedSpectateMatchId={selectedSpectateMatchId}
                  onSelectSpectateMatch={setSelectedSpectateMatchId}
                  currentGameId={currentGameId}
                />
              )}

              {phase === 'match' && currentMatch && (
                <MatchArea
                  match={currentMatch}
                  myRole={myRole}
                  isMyTurn={isMyTurn}
                  gameId={currentGameId}
                  gameState={gameState}
                  currentGameNumber={currentGameNumber}
                  matchScore={matchScore}
                  gameJustEnded={gameJustEnded}
                  lastGameWinnerId={lastGameWinnerId}
                  lastGameWinnerRole={lastGameWinnerRole}
                  playerId={playerId}
                  onReady={handleReadyForMatch}
                  onMove={handleMove}
                  onNextGame={handleNextGame}
                />
              )}

              {phase === 'finished' && tournamentState && (
                <TournamentFinished
                  tournamentState={tournamentState}
                  playerId={playerId}
                  onNewTournament={handleDisconnect}
                />
              )}
            </div>

            <div className="lg:col-span-1">
              <EventLog
                logs={logs}
                logsEndRef={logsEndRef}
                connectionStatus={connectionStatus}
                onDisconnect={phase !== 'connect' ? handleDisconnect : undefined}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Componentes auxiliares
// ============================================================================

interface ConnectFormProps {
  serverUrl: string;
  setServerUrl: (url: string) => void;
  useMockServer: boolean;
  setUseMockServer: (use: boolean) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  classId: string;
  setClassId: (id: string) => void;
  selectedGame: GameId;
  setSelectedGame: (game: GameId) => void;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  onConnect: () => void;
  reconnectionCodeInput: string;
  setReconnectionCodeInput: (code: string) => void;
  onRejoin: () => void;
}

function ConnectForm({
  serverUrl, setServerUrl,
  useMockServer, setUseMockServer,
  playerName, setPlayerName,
  classId, setClassId,
  selectedGame, setSelectedGame,
  connectionStatus, connectionError,
  onConnect,
  reconnectionCodeInput, setReconnectionCodeInput,
  onRejoin,
}: ConnectFormProps) {
  // Jogos suportados no modo campeonato (servidor real + mock)
  const games: GameId[] = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'];
  const isConnecting = connectionStatus === 'connecting';

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <span>🏆</span>
        Entrar no Campeonato
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-white/80 text-sm font-medium mb-2">
            O teu nome *
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Ex: João Silva"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
            disabled={isConnecting}
          />
        </div>

        <div>
          <label className="block text-white/80 text-sm font-medium mb-2">
            Turma (opcional)
          </label>
          <input
            type="text"
            value={classId}
            onChange={e => setClassId(e.target.value)}
            placeholder="Ex: 5ºA"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
            disabled={isConnecting}
          />
        </div>

        <div>
          <label className="block text-white/80 text-sm font-medium mb-2">
            Jogo do campeonato *
          </label>
          <select
            value={selectedGame}
            onChange={e => setSelectedGame(e.target.value as GameId)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
            disabled={isConnecting}
          >
            {games.map(g => (
              <option key={g} value={g} className="bg-gray-800">
                {GAME_NAMES[g]}
              </option>
            ))}
          </select>
          <p className="text-white/50 text-xs mt-1">
            Mais jogos em breve!
          </p>
        </div>

        {/* Toggle modo de teste vs servidor real */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <label className="text-white/80 text-sm font-medium">
              Modo de ligação
            </label>
            <button
              type="button"
              onClick={() => setUseMockServer(!useMockServer)}
              disabled={isConnecting}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useMockServer ? 'bg-blue-500' : 'bg-green-500'
                } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useMockServer ? 'translate-x-1' : 'translate-x-6'
                  }`}
              />
            </button>
          </div>

          {useMockServer ? (
            <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3">
              <p className="text-blue-200 text-sm">
                <strong>Modo de teste</strong> - Jogas contra um bot simulado localmente.
                Ideal para treinar e testar a interface.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-3">
                <p className="text-green-200 text-sm">
                  <strong>Modo campeonato</strong> - Liga-te ao servidor do professor
                  para competir contra colegas em tempo real!
                </p>
              </div>
              <div>
                <label className="block text-white/60 text-xs font-medium mb-1">
                  Servidor do torneio
                </label>
                <select
                  value={PRESET_TOURNAMENT_SERVERS.find(s => s.url === serverUrl)?.url || 'custom'}
                  onChange={e => {
                    const selected = e.target.value;
                    if (selected === 'custom') {
                      setServerUrl('');
                    } else {
                      setServerUrl(selected);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-green-400/50 text-sm mb-2"
                  disabled={isConnecting}
                >
                  {PRESET_TOURNAMENT_SERVERS.map(server => (
                    <option key={server.url} value={server.url} className="bg-gray-800">
                      {server.label}
                    </option>
                  ))}
                </select>
                {/* Show custom URL input if 'custom' is selected or URL doesn't match presets */}
                {!PRESET_TOURNAMENT_SERVERS.some(s => s.url === serverUrl && s.url !== 'custom') && (
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={e => setServerUrl(e.target.value)}
                    placeholder="wss://torneio.exemplo.com ou ws://192.168.1.100:4000"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-400/50 font-mono text-sm"
                    disabled={isConnecting}
                  />
                )}
                <p className="text-white/40 text-xs mt-1">
                  Introduz o endereço da escola ou usa o servidor configurado no ambiente, se existir.
                </p>
              </div>
            </div>
          )}
        </div>

        {connectionError && (
          <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-3">
            <p className="text-red-200 text-sm">{connectionError}</p>
          </div>
        )}

        <button
          onClick={onConnect}
          disabled={isConnecting || !playerName.trim() || (!useMockServer && (!serverUrl.trim() || serverUrl === 'custom'))}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
          {isConnecting ? (
            <>
              <span className="animate-spin">⏳</span>
              A ligar...
            </>
          ) : (
            <>
              <span>🎮</span>
              {useMockServer ? 'Iniciar Treino' : 'Entrar no Campeonato'}
            </>
          )}
        </button>

        {/* Secção de reconexão */}
        {!useMockServer && (
          <div className="mt-6 pt-6 border-t border-white/20">
            <h3 className="text-white/80 text-sm font-medium mb-3 flex items-center gap-2">
              <span>🔄</span>
              Voltar a entrar no torneio
            </h3>
            <p className="text-white/50 text-xs mb-3">
              Se foste desconectado, insere o teu código de reconexão:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={reconnectionCodeInput}
                onChange={e => setReconnectionCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABC234"
                maxLength={6}
                className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50 font-mono text-lg tracking-widest text-center uppercase"
                disabled={isConnecting}
              />
              <button
                onClick={onRejoin}
                disabled={isConnecting || reconnectionCodeInput.length !== 6 || (!serverUrl.trim() || serverUrl === 'custom')}
                className="px-4 py-2 rounded-lg bg-blue-500/30 border border-blue-400/50 text-blue-200 font-medium hover:bg-blue-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reconectar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TournamentLobbyProps {
  tournamentState: TournamentState;
  playerId: string | null;
  reconnectionCode: string | null;
  activeGames: ActiveGameInfo[];
  spectatorMatchStates: Map<string, SpectatorMatchState>;
  selectedSpectateMatchId: string | null;
  onSelectSpectateMatch: (matchId: string | null) => void;
  currentGameId: GameId | null;
}

function TournamentLobby({ 
  tournamentState, 
  playerId, 
  reconnectionCode,
  activeGames,
  spectatorMatchStates,
  selectedSpectateMatchId,
  onSelectSpectateMatch,
  currentGameId,
}: TournamentLobbyProps) {
  const copyCode = () => {
    if (reconnectionCode) {
      navigator.clipboard.writeText(reconnectionCode).then(() => {
        // Success feedback could be added here
      });
    }
  };

  const isWaitingForMatch = tournamentState.phase === 'running';
  const selectedSpectateState = selectedSpectateMatchId 
    ? spectatorMatchStates.get(selectedSpectateMatchId) 
    : null;

  // Converte estado de rede para local para o tabuleiro espectador
  const spectatorGameState = useMemo(() => {
    if (!selectedSpectateState?.gameState || !currentGameId) return null;
    try {
      return fromNetworkGameState(currentGameId, selectedSpectateState.gameState);
    } catch {
      return selectedSpectateState.gameState;
    }
  }, [selectedSpectateState, currentGameId]);

  return (
    <>
      {/* Overlay de espera quando o torneio está a decorrer */}
      {isWaitingForMatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex flex-col p-4 overflow-auto">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col gap-4">
            {/* Header com info de espera */}
            <div className="bg-gradient-to-r from-indigo-900/90 to-purple-900/90 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  {/* Animação de espera */}
                  <div className="relative">
                    <div className="text-4xl animate-bounce">⏳</div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 border-3 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      A aguardar o teu match
                    </h2>
                    <p className="text-white/60 text-sm">
                      Enquanto esperas, podes observar outros jogos!
                    </p>
                  </div>
                </div>
                
                {/* Info do torneio compacta */}
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 rounded-lg px-3 py-2">
                    <p className="text-white/50 text-xs">Jogo</p>
                    <p className="text-white font-medium text-sm">{GAME_NAMES[tournamentState.gameId]}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg px-3 py-2">
                    <p className="text-white/50 text-xs">Jogadores</p>
                    <p className="text-white font-medium text-sm">
                      {tournamentState.players.filter(p => p.isOnline !== false).length}/{tournamentState.players.length}
                    </p>
                  </div>
                  {reconnectionCode && (
                    <div className="bg-purple-500/20 border border-purple-400/40 rounded-lg px-3 py-2 flex items-center gap-2">
                      <div>
                        <p className="text-purple-200 text-xs">Código</p>
                        <p className="font-mono font-bold text-white text-sm tracking-wider">{reconnectionCode}</p>
                      </div>
                      <button
                        onClick={copyCode}
                        className="p-1 rounded bg-purple-500/30 text-purple-200 text-xs hover:bg-purple-500/40"
                        title="Copiar"
                      >
                        📋
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Área principal: lista de jogos + tabuleiro espectador */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
              {/* Lista de jogos em curso */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <span>🎮</span>
                  Jogos em Curso ({activeGames.length})
                </h3>
                
                {activeGames.length === 0 ? (
                  <div className="text-white/50 text-sm text-center py-8">
                    <p className="text-3xl mb-2">🔍</p>
                    <p>Nenhum jogo a decorrer neste momento.</p>
                    <p className="text-xs mt-1">Os jogos aparecerão aqui quando começarem.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {activeGames.map(game => (
                      <button
                        key={game.matchId}
                        onClick={() => onSelectSpectateMatch(
                          selectedSpectateMatchId === game.matchId ? null : game.matchId
                        )}
                        className={`w-full text-left p-3 rounded-xl transition-all ${
                          selectedSpectateMatchId === game.matchId
                            ? 'bg-yellow-500/30 border-2 border-yellow-400'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-white/50">
                            {game.bracket === 'grandFinal' ? '🏆 Final' : 
                             game.bracket === 'grandFinalReset' ? '🏆 Reset' :
                             game.bracket === 'winners' ? '🟢 Winners' : '🟠 Losers'}
                            {' • Ronda ' + game.round}
                          </span>
                          <span className="text-xs text-white/50">Jogo {game.gameNumber}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-white font-medium text-sm truncate">{game.player1Name}</p>
                            <p className="text-white/60 text-sm truncate">vs {game.player2Name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold">
                              <span className="text-green-400">{game.score.player1Wins}</span>
                              <span className="text-white/40 mx-1">-</span>
                              <span className="text-red-400">{game.score.player2Wins}</span>
                            </p>
                          </div>
                        </div>
                        {selectedSpectateMatchId === game.matchId && (
                          <div className="mt-2 text-[10px] text-yellow-300 flex items-center gap-1">
                            <span className="animate-pulse">👁️</span> A observar
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabuleiro do jogo selecionado */}
              <div className="lg:col-span-2 bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col">
                {!selectedSpectateMatchId ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-white/50">
                      <p className="text-5xl mb-4">👈</p>
                      <p className="font-medium">Seleciona um jogo para observar</p>
                      <p className="text-sm mt-1">Clica num jogo da lista à esquerda</p>
                    </div>
                  </div>
                ) : selectedSpectateState && spectatorGameState ? (
                  <>
                    {/* Header do jogo espectador */}
                    <div className="mb-4 pb-3 border-b border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/50 text-xs uppercase tracking-wider">
                            {selectedSpectateState.bracket === 'grandFinal' ? '🏆 Grand Final' :
                             selectedSpectateState.bracket === 'grandFinalReset' ? '🏆 Grand Final Reset' :
                             selectedSpectateState.bracket === 'winners' ? '🟢 Winners Bracket' : '🟠 Losers Bracket'}
                            {' • Ronda ' + selectedSpectateState.round}
                          </p>
                          <p className="text-white font-semibold">
                            {selectedSpectateState.player1Name} vs {selectedSpectateState.player2Name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            <span className="text-green-400">{selectedSpectateState.score.player1Wins}</span>
                            <span className="text-white/40 mx-2">-</span>
                            <span className="text-red-400">{selectedSpectateState.score.player2Wins}</span>
                          </p>
                          <p className="text-white/50 text-xs">Jogo {selectedSpectateState.gameNumber}</p>
                        </div>
                      </div>
                      {selectedSpectateState.whoseTurn && (
                        <p className="text-sm mt-2 text-yellow-300">
                          Vez de: {selectedSpectateState.whoseTurn === 'player1' 
                            ? selectedSpectateState.player1Name 
                            : selectedSpectateState.player2Name}
                        </p>
                      )}
                    </div>

                    {/* Tabuleiro read-only */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-full max-w-md">
                        {currentGameId === 'gatos-caes' && (
                          <GatosCaesBoard
                            state={spectatorGameState as GatosCaesState}
                            isMyTurn={false}
                            myRole="jogador1"
                            onMove={() => {}}
                          />
                        )}
                        {currentGameId === 'dominorio' && (
                          <DominorioBoard
                            state={spectatorGameState as DominorioState}
                            isMyTurn={false}
                            myRole="jogador1"
                            onMove={() => {}}
                          />
                        )}
                        {currentGameId === 'quelhas' && (
                          <QuelhasBoard
                            state={spectatorGameState as QuelhasState}
                            isMyTurn={false}
                            myRole="jogador1"
                            onMove={() => {}}
                          />
                        )}
                        {currentGameId === 'produto' && (
                          <ProdutoBoard
                            state={spectatorGameState as ProdutoState}
                            isMyTurn={false}
                            myRole="jogador1"
                            onMove={() => {}}
                          />
                        )}
                        {currentGameId === 'atari-go' && (
                          <AtariGoBoard
                            state={spectatorGameState as AtariGoState}
                            isMyTurn={false}
                            myRole="jogador1"
                            onMove={() => {}}
                          />
                        )}
                        {currentGameId === 'nex' && (
                          <NexBoard
                            state={spectatorGameState as NexState}
                            isMyTurn={false}
                            myRole="jogador1"
                            onMove={() => {}}
                          />
                        )}
                      </div>
                    </div>

                    {/* Aviso de modo espectador */}
                    <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-center">
                      <p className="text-yellow-200 text-xs">
                        👁️ Modo espectador - Estás apenas a observar este jogo
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-white/50">
                      <div className="animate-spin text-4xl mb-4">⏳</div>
                      <p>A carregar estado do jogo...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Nota de rodapé */}
            <p className="text-white/30 text-xs text-center">
              💡 Serás automaticamente redirecionado quando o teu match começar
            </p>
          </div>
        </div>
      )}

      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>🏟️</span>
            {GAME_NAMES[tournamentState.gameId]}
          </h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${tournamentState.phase === 'registration'
            ? 'bg-blue-500/30 text-blue-200'
            : 'bg-green-500/30 text-green-200'
            }`}>
            {tournamentState.phase === 'registration' ? 'Inscrições abertas' : 'A decorrer'}
          </span>
        </div>

        {/* Código de reconexão */}
        {reconnectionCode && (
          <div className="mb-6 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm font-medium mb-1">
                  🔑 O teu código de reconexão
                </p>
                <p className="text-white/60 text-xs">
                  Guarda este código! Dá-o ao professor se fores desconectado.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-white tracking-widest bg-black/30 px-4 py-2 rounded-lg">
                  {reconnectionCode}
                </span>
                <button
                  onClick={copyCode}
                  className="px-3 py-2 rounded-lg bg-purple-500/30 border border-purple-400/50 text-purple-200 text-sm hover:bg-purple-500/40 transition-colors"
                  title="Copiar código"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-white/80 text-sm font-medium mb-3">
            Jogadores ({tournamentState.players.length})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {tournamentState.players.map(player => (
              <div
                key={player.id}
                className={`px-3 py-2 rounded-lg text-sm ${player.id === playerId
                  ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-400/50'
                  : 'bg-white/10 text-white/80'
                  }`}
              >
                <span className="font-medium">{player.name}</span>
                {player.classId && (
                  <span className="text-white/50 ml-1">({player.classId})</span>
                )}
                {player.id === playerId && (
                  <span className="ml-1">👈</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {tournamentState.phase === 'registration' && (
          <div className="mt-6 bg-blue-500/20 border border-blue-400/50 rounded-lg p-4">
            <p className="text-blue-200 text-sm">
              ⏳ A aguardar início do campeonato...
            </p>
          </div>
        )}
      </div>
    </>
  );
}

interface MatchAreaProps {
  match: Match;
  myRole: 'player1' | 'player2' | null;
  isMyTurn: boolean;
  gameId: GameId | null;
  gameState: any;
  currentGameNumber: number;
  matchScore: { player1Wins: number; player2Wins: number };
  gameJustEnded: boolean;
  lastGameWinnerId: string | null;
  lastGameWinnerRole: 'player1' | 'player2' | null;
  playerId: string | null;
  onReady: () => void;
  onMove: (move: unknown) => void;
  onNextGame: () => void;
}

function MatchArea({ match, myRole, isMyTurn, gameId, gameState, currentGameNumber, matchScore, gameJustEnded, lastGameWinnerId, lastGameWinnerRole, playerId, onReady, onMove, onNextGame }: MatchAreaProps) {
  // IMPORTANTE: myRole é o SEAT fixo no match (player1 ou player2), definido em match_assigned
  // O seat NUNCA muda durante o match. O que muda é apenas quem joga como Gatos/Cães.
  const mySeatInMatch = myRole;

  // Determinar se os papéis (Gatos/Cães) estão trocados no jogo atual
  // Jogos ímpares (1, 3): player1 seat = jogador1 (Gatos), player2 seat = jogador2 (Cães)
  // Jogos pares (2): player1 seat = jogador2 (Cães), player2 seat = jogador1 (Gatos)
  const currentRolesSwapped = currentGameNumber % 2 === 0;

  // Meu papel no JOGO atual (quem jogo como: jogador1=Gatos ou jogador2=Cães)
  const gameMyRole = currentRolesSwapped
    ? (mySeatInMatch === 'player1' ? 'jogador2' : 'jogador1')
    : (mySeatInMatch === 'player1' ? 'jogador1' : 'jogador2');

  // Score é baseado no SEAT (fixo), não no papel do jogo
  const opponent = mySeatInMatch === 'player1' ? match.player2 : match.player1;
  const myScore = mySeatInMatch === 'player1' ? matchScore.player1Wins : matchScore.player2Wins;
  const opponentScore = mySeatInMatch === 'player1' ? matchScore.player2Wins : matchScore.player1Wins;

  // Determinar se eu ganhei a última partida
  const iWonLastGame = lastGameWinnerId === playerId;
  const isDraw = lastGameWinnerId === null && gameJustEnded;

  // Próximo jogo
  const nextGameNumber = currentGameNumber + 1;
  const nextRolesSwapped = nextGameNumber % 2 === 0;

  // Quem começa o próximo jogo (quem joga como jogador1/Gatos)
  // Jogos ímpares: seat player1 começa como Gatos
  // Jogos pares: seat player2 começa como Gatos
  const seatWhoStartsNext: 'player1' | 'player2' = nextGameNumber % 2 === 1 ? 'player1' : 'player2';
  const iStartNext = seatWhoStartsNext === mySeatInMatch;

  // Determinar que peça jogarei no próximo jogo (Gatos ou Cães)
  // Se nextRolesSwapped: player1 seat = Cães, player2 seat = Gatos
  // Se !nextRolesSwapped: player1 seat = Gatos, player2 seat = Cães
  const iPlayGatosNext = nextRolesSwapped
    ? mySeatInMatch === 'player2'
    : mySeatInMatch === 'player1';

  // Verificar se o match vai continuar (ninguém chegou a 2 vitórias ainda)
  const maxWins = 2; // Melhor de 3
  const matchContinues = myScore < maxWins && opponentScore < maxWins;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/20">
      {/* Header do match */}
      <div className="text-center mb-6">
        <div className="inline-block px-3 py-1 rounded-full bg-purple-500/30 text-purple-200 text-sm mb-3">
          {match.bracket === 'winners' ? 'Winners Bracket' : 'Losers Bracket'} • Ronda {match.round}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Tu vs {opponent?.name}
        </h2>
        <div className="text-4xl font-bold">
          <span className="text-green-400">{myScore}</span>
          <span className="text-white/40 mx-2">-</span>
          <span className="text-red-400">{opponentScore}</span>
        </div>
        <p className="text-white/60 text-sm mt-1">
          Melhor de 3 • Jogo {currentGameNumber}
        </p>
      </div>

      {/* Anúncio de fim de partida individual */}
      {gameJustEnded && matchContinues && (
        <div className="text-center py-8">
          <div className={`inline-block p-6 rounded-2xl ${iWonLastGame
            ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border border-green-400/50'
            : isDraw
              ? 'bg-gradient-to-br from-gray-500/30 to-slate-500/30 border border-gray-400/50'
              : 'bg-gradient-to-br from-red-500/30 to-orange-500/30 border border-red-400/50'
            }`}>
            <div className="text-6xl mb-3">
              {iWonLastGame ? '🎉' : isDraw ? '🤝' : '😔'}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {iWonLastGame
                ? 'Ganhaste esta partida!'
                : isDraw
                  ? 'Empate!'
                  : 'Perdeste esta partida...'}
            </h3>
            <p className="text-white/70 mb-4">
              Resultado do match: <span className="font-bold text-green-400">{myScore}</span> - <span className="font-bold text-red-400">{opponentScore}</span>
            </p>
            <div className="bg-white/10 rounded-lg p-3 mb-4">
              <p className="text-white/60 text-sm">
                Próxima partida: Jogo {nextGameNumber}
              </p>
              <p className="text-white/80 text-sm font-medium mb-1">
                {nextRolesSwapped
                  ? '🔄 Papéis trocados! '
                  : ''}
                {gameId === 'gatos-caes' && (
                  <>Serás {iPlayGatosNext ? '🐱 Gatos' : '🐶 Cães'}</>
                )}
                {gameId === 'dominorio' && (
                  <>Serás {iStartNext ? '▯ Vertical' : '▬ Horizontal'}</>
                )}
                {gameId === 'quelhas' && (
                  <>Serás {iStartNext ? '▯ Vertical' : '▬ Horizontal'}</>
                )}
                {gameId === 'produto' && (
                  <>Serás {iStartNext ? '🔴 Vermelho' : '🔵 Azul'}</>
                )}
                {gameId === 'atari-go' && (
                  <>Serás {iStartNext ? '⚫ Pretas' : '⚪ Brancas'}</>
                )}
                {gameId === 'nex' && (
                  <>Serás {iStartNext ? '⚫ Pretas' : '⚪ Brancas'}</>
                )}
              </p>
              <p className="text-white/70 text-sm">
                {iStartNext ? '👆 Tu irás começar!' : '👀 O adversário irá começar.'}
              </p>
            </div>
            <button
              onClick={onNextGame}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              ▶️ Próxima Partida
            </button>
          </div>
        </div>
      )}

      {/* Área de jogo - fase waiting (antes de começar) */}
      {match.phase === 'waiting' && !gameJustEnded && (
        <div className="text-center py-8">
          <p className="text-white/80 mb-4">Estás pronto para começar?</p>
          <button
            onClick={onReady}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            ✅ Estou pronto!
          </button>
        </div>
      )}

      {match.phase === 'playing' && gameState && gameId && myRole && (
        <div className="py-4">
          {/* Indicador de vez */}
          <div className="text-center mb-4">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${isMyTurn
              ? 'bg-green-500/30 text-green-200 animate-pulse'
              : 'bg-gray-500/30 text-gray-300'
              }`}>
              {isMyTurn ? '👆 É a tua vez!' : '⏳ A aguardar adversário...'}
            </span>
          </div>

          {/* Tabuleiro do jogo */}
          {gameId === 'gatos-caes' && (
            <GatosCaesBoard
              state={gameState as GatosCaesState}
              isMyTurn={isMyTurn}
              myRole={gameMyRole as 'jogador1' | 'jogador2'}
              onMove={(pos: GatosCaesPosicao) => onMove(pos)}
            />
          )}

          {gameId === 'dominorio' && (
            <DominorioBoard
              state={gameState as DominorioState}
              isMyTurn={isMyTurn}
              myRole={gameMyRole as 'jogador1' | 'jogador2'}
              onMove={(domino: Domino) => onMove(domino)}
            />
          )}

          {gameId === 'quelhas' && (
            <QuelhasBoard
              state={gameState as QuelhasState}
              isMyTurn={isMyTurn}
              myRole={gameMyRole as 'jogador1' | 'jogador2'}
              onMove={(segmento: QuelhasSegmento) => onMove(segmento)}
              onSwap={() => onMove({ swap: true })}
            />
          )}

          {gameId === 'produto' && (
            <ProdutoBoard
              state={gameState as ProdutoState}
              isMyTurn={isMyTurn}
              myRole={gameMyRole as 'jogador1' | 'jogador2'}
              onMove={(pos: any) => onMove(pos)}
            />
          )}

          {gameId === 'atari-go' && (
            <AtariGoBoard
              state={gameState as AtariGoState}
              isMyTurn={isMyTurn}
              myRole={gameMyRole as 'jogador1' | 'jogador2'}
              onMove={(pos: AtariGoPosicao) => onMove(pos)}
            />
          )}

          {gameId === 'nex' && (
            <NexBoard
              state={gameState as NexState}
              isMyTurn={isMyTurn}
              myRole={gameMyRole as 'jogador1' | 'jogador2'}
              onMove={(acao: any) => onMove(acao)}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface TournamentFinishedProps {
  tournamentState: TournamentState;
  playerId: string | null;
  onNewTournament: () => void;
}

function TournamentFinished({ tournamentState, playerId, onNewTournament }: TournamentFinishedProps) {
  const isChampion = tournamentState.championId === playerId;
  const champion = tournamentState.players.find(p => p.id === tournamentState.championId);

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/20 text-center">
      <div className="text-8xl mb-4">
        {isChampion ? '🏆' : '🎮'}
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">
        {isChampion ? 'CAMPEÃO!' : 'Campeonato Terminado'}
      </h2>
      {!isChampion && champion && (
        <p className="text-white/80 text-lg mb-4">
          Campeão: <span className="text-yellow-300 font-bold">{champion.name}</span>
        </p>
      )}
      {isChampion && (
        <p className="text-yellow-300 text-lg mb-4">
          Parabéns! Representas a escola em {GAME_NAMES[tournamentState.gameId]}!
        </p>
      )}

      <button
        onClick={onNewTournament}
        className="mt-6 px-8 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
      >
        🔄 Novo Campeonato
      </button>
    </div>
  );
}

interface EventLogProps {
  logs: LogEntry[];
  logsEndRef: React.RefObject<HTMLDivElement | null>;
  connectionStatus: ConnectionStatus;
  onDisconnect?: () => void;
}

function EventLog({ logs, logsEndRef, connectionStatus, onDisconnect }: EventLogProps) {
  const statusColors: Record<ConnectionStatus, string> = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  };

  const statusLabels: Record<ConnectionStatus, string> = {
    disconnected: 'Desligado',
    connecting: 'A ligar...',
    connected: 'Ligado',
    error: 'Erro',
  };

  const typeColors: Record<LogEntry['type'], string> = {
    info: 'text-white/70',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-4 md:p-6 border border-white/20 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>📋</span>
          Eventos
        </h3>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${statusColors[connectionStatus]}`} />
          <span className="text-white/60 text-sm">{statusLabels[connectionStatus]}</span>
        </div>
      </div>

      <div className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto space-y-1 text-sm font-mono">
        {logs.length === 0 ? (
          <p className="text-white/40 text-center py-4">
            Nenhum evento ainda...
          </p>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`${typeColors[log.type]} py-1`}>
              <span className="text-white/30">
                {log.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              {' '}
              {log.message}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {onDisconnect && (
        <button
          onClick={onDisconnect}
          className="mt-4 w-full py-2 px-4 rounded-lg bg-red-500/20 border border-red-400/50 text-red-200 text-sm hover:bg-red-500/30 transition-colors"
        >
          ❌ Sair do Campeonato
        </button>
      )}
    </div>
  );
}
