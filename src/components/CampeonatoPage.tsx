import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './Header';
import {
  createTournamentClient,
  type TournamentClient,
  type ConnectionStatus,
  type ServerMessage,
  type GameId,
  type TournamentState,
  type Match,
  GAME_NAMES,
  // Boards
  GatosCaesBoard,
  DominorioBoard,
} from '../tournament';

// Tipos dos jogos
import type { GatosCaesState, Posicao as GatosCaesPosicao } from '../games/gatos-caes/types';
import type { DominorioState, Domino } from '../games/dominorio/types';

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

export function CampeonatoPage({ onVoltar }: CampeonatoPageProps) {
  // Estado de conexão
  const [serverUrl, setServerUrl] = useState('ws://localhost:8080');
  const [playerName, setPlayerName] = useState('');
  const [classId, setClassId] = useState('');
  const [selectedGame, setSelectedGame] = useState<GameId>('gatos-caes');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Estado do torneio
  const [phase, setPhase] = useState<Phase>('connect');
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [myRole, setMyRole] = useState<'player1' | 'player2' | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<GameId | null>(null);

  // Estado do jogo atual
  const [gameState, setGameState] = useState<GatosCaesState | DominorioState | null>(null);

  // Log de eventos
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Cliente de torneio
  const clientRef = useRef<TournamentClient | null>(null);

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

  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'welcome':
        setPlayerId(message.playerId);
        setTournamentState(message.tournamentState);
        setCurrentGameId(message.tournamentState.gameId);
        setPhase('lobby');
        addLog('Inscrito no campeonato!', 'success');
        break;

      case 'tournament_state_update':
        setTournamentState(message.tournamentState);
        break;

      case 'match_assigned':
        setCurrentMatch(message.match);
        setMyRole(message.yourRole);
        setPhase('match');
        const opponent = message.yourRole === 'player1' 
          ? message.match.player2?.name 
          : message.match.player1?.name;
        addLog(`Confronto atribuído: Tu vs ${opponent}`, 'success');
        break;

      case 'game_start':
        setIsMyTurn(message.youStart);
        setGameState(message.initialState as GatosCaesState | DominorioState);
        addLog(
          `Jogo ${message.gameNumber} começou! ${message.youStart ? 'É a tua vez!' : 'Aguarda a jogada do adversário.'}`,
          'info'
        );
        break;

      case 'game_state_update':
        setIsMyTurn(message.yourTurn);
        setGameState(message.gameState as GatosCaesState | DominorioState);
        break;

      case 'game_end':
        setGameState(message.finalState as GatosCaesState | DominorioState);
        addLog(`Jogo ${message.gameNumber} terminou!`, 'info');
        break;

      case 'match_end':
        setCurrentMatch(null);
        setMyRole(null);
        setGameState(null);
        if (message.youWon) {
          addLog(`🎉 Ganhaste o confronto! ${message.finalScore.player1Wins}-${message.finalScore.player2Wins}`, 'success');
        } else {
          addLog(`Perdeste o confronto. ${message.finalScore.player1Wins}-${message.finalScore.player2Wins}`, 'warning');
        }
        if (message.nextBracket === 'losers') {
          addLog('Vais para a Losers Bracket. Uma derrota e estás eliminado!', 'warning');
        } else if (message.nextBracket === 'eliminated') {
          addLog('Foste eliminado do campeonato.', 'error');
          setPhase('finished');
        }
        break;

      case 'tournament_end':
        setPhase('finished');
        const isChampion = message.championId === playerId;
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
    }
  }, [addLog, playerId]);

  useEffect(() => {
    const client = createTournamentClient();
    clientRef.current = client;

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
          setPhase('connect');
        }
      },
      onMessage: handleServerMessage,
    });

    return () => {
      client.disconnect();
    };
  }, [addLog, handleServerMessage]);

  const handleConnect = async () => {
    if (!playerName.trim()) {
      addLog('Introduz o teu nome!', 'error');
      return;
    }

    const client = clientRef.current;
    if (!client) return;

    try {
      await client.connect(serverUrl);
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
    clientRef.current.send({
      type: 'submit_move',
      matchId: currentMatch.id,
      gameNumber: currentMatch.currentGame,
      move,
    });
  };

  const handleDisconnect = () => {
    clientRef.current?.disconnect();
    setPhase('connect');
    setTournamentState(null);
    setCurrentMatch(null);
    setMyRole(null);
    setGameState(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header titulo="Modo Campeonato" onVoltar={onVoltar} />

      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {phase === 'connect' && (
                <ConnectForm
                  serverUrl={serverUrl}
                  setServerUrl={setServerUrl}
                  playerName={playerName}
                  setPlayerName={setPlayerName}
                  classId={classId}
                  setClassId={setClassId}
                  selectedGame={selectedGame}
                  setSelectedGame={setSelectedGame}
                  connectionStatus={connectionStatus}
                  connectionError={connectionError}
                  onConnect={handleConnect}
                />
              )}

              {phase === 'lobby' && tournamentState && (
                <TournamentLobby
                  tournamentState={tournamentState}
                  playerId={playerId}
                />
              )}

              {phase === 'match' && currentMatch && (
                <MatchArea
                  match={currentMatch}
                  myRole={myRole}
                  isMyTurn={isMyTurn}
                  gameId={currentGameId}
                  gameState={gameState}
                  onReady={handleReadyForMatch}
                  onMove={handleMove}
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
  playerName: string;
  setPlayerName: (name: string) => void;
  classId: string;
  setClassId: (id: string) => void;
  selectedGame: GameId;
  setSelectedGame: (game: GameId) => void;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  onConnect: () => void;
}

function ConnectForm({
  serverUrl, setServerUrl,
  playerName, setPlayerName,
  classId, setClassId,
  selectedGame, setSelectedGame,
  connectionStatus, connectionError,
  onConnect,
}: ConnectFormProps) {
  // Por agora, só suportamos Gatos & Cães e Dominório
  const games: GameId[] = ['gatos-caes', 'dominorio'];
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

        <div>
          <label className="block text-white/80 text-sm font-medium mb-2">
            Endereço do servidor
          </label>
          <input
            type="text"
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="ws://192.168.1.100:8080"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 font-mono text-sm"
            disabled={isConnecting}
          />
          <p className="text-white/50 text-xs mt-1">
            No modo de teste, o servidor é simulado localmente.
          </p>
        </div>

        {connectionError && (
          <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-3">
            <p className="text-red-200 text-sm">{connectionError}</p>
          </div>
        )}

        <button
          onClick={onConnect}
          disabled={isConnecting || !playerName.trim()}
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
              Entrar no Campeonato
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface TournamentLobbyProps {
  tournamentState: TournamentState;
  playerId: string | null;
}

function TournamentLobby({ tournamentState, playerId }: TournamentLobbyProps) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span>🏟️</span>
          {GAME_NAMES[tournamentState.gameId]}
        </h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          tournamentState.phase === 'registration' 
            ? 'bg-blue-500/30 text-blue-200' 
            : 'bg-green-500/30 text-green-200'
        }`}>
          {tournamentState.phase === 'registration' ? 'Inscrições abertas' : 'A decorrer'}
        </span>
      </div>

      <div>
        <h3 className="text-white/80 text-sm font-medium mb-3">
          Jogadores ({tournamentState.players.length})
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {tournamentState.players.map(player => (
            <div
              key={player.id}
              className={`px-3 py-2 rounded-lg text-sm ${
                player.id === playerId
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
  );
}

interface MatchAreaProps {
  match: Match;
  myRole: 'player1' | 'player2' | null;
  isMyTurn: boolean;
  gameId: GameId | null;
  gameState: GatosCaesState | DominorioState | null;
  onReady: () => void;
  onMove: (move: unknown) => void;
}

function MatchArea({ match, myRole, isMyTurn, gameId, gameState, onReady, onMove }: MatchAreaProps) {
  const opponent = myRole === 'player1' ? match.player2 : match.player1;
  const myScore = myRole === 'player1' ? match.score.player1Wins : match.score.player2Wins;
  const opponentScore = myRole === 'player1' ? match.score.player2Wins : match.score.player1Wins;

  // Converter myRole para o formato do jogo
  const gameMyRole = myRole === 'player1' ? 'jogador1' : 'jogador2';

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
          Melhor de {match.bestOf} • Jogo {match.currentGame}
        </p>
      </div>

      {/* Área de jogo */}
      {match.phase === 'waiting' && (
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
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              isMyTurn 
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

