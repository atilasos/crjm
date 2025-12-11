/**
 * Servidor de torneios WebSocket usando Bun.
 * 
 * Para executar:
 *   bun run src/server/tournament-server.ts
 * 
 * Para expor via túnel (ngrok ou cloudflare):
 *   ngrok http 4000
 *   -- ou --
 *   cloudflared tunnel --url http://localhost:4000
 */

import type { ServerWebSocket } from 'bun';
import type {
  ClientMessage,
  ServerMessage,
  GameId,
} from '../tournament/protocol';
import {
  createTournament,
  addPlayer,
  removePlayer,
  updatePlayerConnection,
  startTournament,
  setPlayerReady,
  startGame,
  recordMove,
  endGame,
  processMatchResult,
  toTournamentState,
  handlePlayerDisconnect,
  forfeitMatch,
  type Tournament,
  type TournamentPlayer,
  type TournamentMatch,
} from './tournament-engine';
import {
  createGameState,
  applyGameMove,
  isValidGameMove,
  isGameFinished,
  getGameWinner,
  isGameSupported,
} from './game-adapter';
import { getAdminPageHtml } from './admin-page';

// ============================================================================
// Configuração
// ============================================================================

const PORT = parseInt(process.env.PORT || '4000', 10);
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

// ============================================================================
// Estado global do servidor
// ============================================================================

interface ClientData {
  playerId: string | null;
  tournamentId: string | null;
}

// Mapa de torneios ativos (por jogo, só um torneio por jogo de cada vez)
const tournaments = new Map<GameId, Tournament>();

// Mapa de sockets por playerId
const playerSockets = new Map<string, ServerWebSocket<ClientData>>();

// Log de eventos
interface LogEntry {
  timestamp: Date;
  type: 'info' | 'game' | 'match' | 'error';
  tournamentId?: string;
  matchId?: string;
  message: string;
  data?: unknown;
}
const eventLog: LogEntry[] = [];

function log(entry: Omit<LogEntry, 'timestamp'>): void {
  const fullEntry = { ...entry, timestamp: new Date() };
  eventLog.push(fullEntry);
  
  // Manter só os últimos 1000 eventos
  if (eventLog.length > 1000) {
    eventLog.shift();
  }
  
  console.log(`[${fullEntry.type.toUpperCase()}] ${fullEntry.message}`);
}

// ============================================================================
// Funções de comunicação
// ============================================================================

function sendToPlayer(playerId: string, message: ServerMessage): void {
  const socket = playerSockets.get(playerId);
  if (socket) {
    try {
      socket.send(JSON.stringify(message));
    } catch (e) {
      console.error(`Erro ao enviar mensagem para ${playerId}:`, e);
    }
  }
}

function sendToSocket(socket: ServerWebSocket<ClientData>, message: ServerMessage): void {
  try {
    socket.send(JSON.stringify(message));
  } catch (e) {
    console.error('Erro ao enviar mensagem:', e);
  }
}

function broadcastToTournament(tournament: Tournament, message: ServerMessage): void {
  for (const player of tournament.players) {
    if (player.isConnected) {
      sendToPlayer(player.id, message);
    }
  }
}

function broadcastTournamentState(tournament: Tournament): void {
  const state = toTournamentState(tournament);
  broadcastToTournament(tournament, {
    type: 'tournament_state_update',
    tournamentState: state,
  });
}

// ============================================================================
// Handlers de mensagens
// ============================================================================

function handleJoinTournament(
  socket: ServerWebSocket<ClientData>,
  gameId: GameId,
  playerName: string,
  classId?: string
): void {
  // Verificar se o jogo é suportado
  if (!isGameSupported(gameId)) {
    sendToSocket(socket, {
      type: 'error',
      code: 'UNSUPPORTED_GAME',
      message: `O jogo ${gameId} ainda não é suportado no modo campeonato.`,
    });
    return;
  }

  // Obter ou criar torneio para este jogo
  let tournament = tournaments.get(gameId);
  
  if (!tournament) {
    tournament = createTournament(gameId);
    tournaments.set(gameId, tournament);
    log({
      type: 'info',
      tournamentId: tournament.id,
      message: `Novo torneio criado para ${gameId}`,
    });
  }

  // Verificar se o torneio ainda aceita inscrições
  if (tournament.phase !== 'registration') {
    sendToSocket(socket, {
      type: 'error',
      code: 'REGISTRATION_CLOSED',
      message: 'As inscrições para este torneio já estão fechadas.',
    });
    return;
  }

  // Adicionar jogador
  const socketId = `${Date.now()}-${Math.random()}`;
  const player = addPlayer(tournament, playerName, classId, socketId);
  
  if (!player) {
    sendToSocket(socket, {
      type: 'error',
      code: 'JOIN_FAILED',
      message: 'Não foi possível entrar no torneio.',
    });
    return;
  }

  // Associar socket ao jogador
  socket.data.playerId = player.id;
  socket.data.tournamentId = tournament.id;
  playerSockets.set(player.id, socket);

  log({
    type: 'info',
    tournamentId: tournament.id,
    message: `Jogador ${playerName} (${player.id}) inscrito`,
  });

  // Enviar welcome ao jogador
  sendToSocket(socket, {
    type: 'welcome',
    playerId: player.id,
    tournamentState: toTournamentState(tournament),
  });

  // Notificar todos os outros jogadores
  broadcastTournamentState(tournament);

  sendToSocket(socket, {
    type: 'info',
    message: `Bem-vindo ao campeonato de ${gameId}! A aguardar início do torneio...`,
  });
}

function handleReadyForMatch(
  socket: ServerWebSocket<ClientData>,
  matchId: string
): void {
  const playerId = socket.data.playerId;
  if (!playerId) {
    sendToSocket(socket, {
      type: 'error',
      code: 'NOT_IN_TOURNAMENT',
      message: 'Não estás inscrito num torneio.',
    });
    return;
  }

  // Encontrar o torneio do jogador
  let tournament: Tournament | null = null;
  let match: TournamentMatch | null = null;

  for (const t of tournaments.values()) {
    const m = t.matchById.get(matchId);
    if (m) {
      tournament = t;
      match = m;
      break;
    }
  }

  if (!tournament || !match) {
    sendToSocket(socket, {
      type: 'error',
      code: 'INVALID_MATCH',
      message: 'Match não encontrado.',
    });
    return;
  }

  // Verificar se o jogador pertence a este match
  if (match.player1?.id !== playerId && match.player2?.id !== playerId) {
    sendToSocket(socket, {
      type: 'error',
      code: 'NOT_YOUR_MATCH',
      message: 'Este match não é teu.',
    });
    return;
  }

  // Marcar jogador como pronto
  const { bothReady, match: updatedMatch } = setPlayerReady(tournament, matchId, playerId);

  if (!updatedMatch) {
    sendToSocket(socket, {
      type: 'error',
      code: 'INVALID_STATE',
      message: 'O match não está em estado de espera.',
    });
    return;
  }

  // Se ambos estão prontos, iniciar o jogo
  if (bothReady) {
    const gameState = createGameState(tournament.gameId);
    if (!gameState) {
      sendToSocket(socket, {
        type: 'error',
        code: 'GAME_ERROR',
        message: 'Erro ao criar estado do jogo.',
      });
      return;
    }

    startGame(updatedMatch, gameState);

    log({
      type: 'game',
      tournamentId: tournament.id,
      matchId: match.id,
      message: `Jogo ${match.currentGame} iniciado: ${match.player1?.name} vs ${match.player2?.name}`,
    });

    // Notificar ambos os jogadores
    const p1Start = updatedMatch.whoStartsCurrentGame === 'player1';
    
    sendToPlayer(match.player1!.id, {
      type: 'game_start',
      matchId,
      gameNumber: updatedMatch.currentGame,
      youStart: p1Start,
      initialState: gameState,
    });

    sendToPlayer(match.player2!.id, {
      type: 'game_start',
      matchId,
      gameNumber: updatedMatch.currentGame,
      youStart: !p1Start,
      initialState: gameState,
    });

    broadcastTournamentState(tournament);
  } else {
    // Notificar que estamos à espera do outro jogador
    sendToSocket(socket, {
      type: 'info',
      message: 'Estás pronto! A aguardar o adversário...',
    });
  }
}

function handleSubmitMove(
  socket: ServerWebSocket<ClientData>,
  matchId: string,
  gameNumber: number,
  move: unknown
): void {
  const playerId = socket.data.playerId;
  if (!playerId) {
    sendToSocket(socket, {
      type: 'error',
      code: 'NOT_IN_TOURNAMENT',
      message: 'Não estás inscrito num torneio.',
    });
    return;
  }

  // Encontrar o torneio e match
  let tournament: Tournament | null = null;
  let match: TournamentMatch | null = null;

  for (const t of tournaments.values()) {
    const m = t.matchById.get(matchId);
    if (m) {
      tournament = t;
      match = m;
      break;
    }
  }

  if (!tournament || !match) {
    sendToSocket(socket, {
      type: 'error',
      code: 'INVALID_MATCH',
      message: 'Match não encontrado.',
    });
    return;
  }

  // Verificar se é a vez deste jogador
  const isPlayer1 = match.player1?.id === playerId;
  const isPlayer2 = match.player2?.id === playerId;

  if (!isPlayer1 && !isPlayer2) {
    sendToSocket(socket, {
      type: 'error',
      code: 'NOT_YOUR_MATCH',
      message: 'Este match não é teu.',
    });
    return;
  }

  const expectedTurn = match.whoseTurn;
  const actualTurn = isPlayer1 ? 'player1' : 'player2';

  if (expectedTurn !== actualTurn) {
    sendToSocket(socket, {
      type: 'error',
      code: 'NOT_YOUR_TURN',
      message: 'Não é a tua vez.',
    });
    return;
  }

  // Verificar número do jogo
  if (match.currentGame !== gameNumber) {
    sendToSocket(socket, {
      type: 'error',
      code: 'WRONG_GAME',
      message: 'Número de jogo incorreto.',
    });
    return;
  }

  // Validar e aplicar jogada
  const gameState = match.gameState;
  if (!gameState) {
    sendToSocket(socket, {
      type: 'error',
      code: 'NO_GAME_STATE',
      message: 'Jogo não iniciado.',
    });
    return;
  }

  if (!isValidGameMove(tournament.gameId, gameState as any, move)) {
    sendToSocket(socket, {
      type: 'error',
      code: 'INVALID_MOVE',
      message: 'Jogada inválida.',
    });
    return;
  }

  const newState = applyGameMove(tournament.gameId, gameState as any, move);
  if (!newState) {
    sendToSocket(socket, {
      type: 'error',
      code: 'MOVE_FAILED',
      message: 'Erro ao aplicar jogada.',
    });
    return;
  }

  // Registar a jogada
  recordMove(match, playerId, move, newState);

  log({
    type: 'game',
    tournamentId: tournament.id,
    matchId: match.id,
    message: `Jogada de ${isPlayer1 ? match.player1?.name : match.player2?.name}`,
    data: move,
  });

  // Verificar se o jogo acabou
  if (isGameFinished(tournament.gameId, newState)) {
    const winner = getGameWinner(tournament.gameId, newState);
    const winnerId = winner === 'jogador1' ? match.player1!.id : match.player2!.id;

    // Terminar o jogo
    const { matchEnded, matchWinnerId } = endGame(match, winnerId);

    log({
      type: 'game',
      tournamentId: tournament.id,
      matchId: match.id,
      message: `Jogo ${gameNumber} terminou. Vencedor: ${winner === 'jogador1' ? match.player1?.name : match.player2?.name}`,
    });

    // Notificar fim do jogo
    sendToPlayer(match.player1!.id, {
      type: 'game_end',
      matchId,
      gameNumber,
      winnerId,
      finalState: newState,
    });

    sendToPlayer(match.player2!.id, {
      type: 'game_end',
      matchId,
      gameNumber,
      winnerId,
      finalState: newState,
    });

    // Se o match terminou
    if (matchEnded && matchWinnerId) {
      handleMatchEnd(tournament, match, matchWinnerId);
    } else {
      // Match continua, aguardar ready para próximo jogo
      broadcastTournamentState(tournament);
      
      sendToPlayer(match.player1!.id, {
        type: 'info',
        message: `Prepara-te para o jogo ${match.currentGame}!`,
      });
      sendToPlayer(match.player2!.id, {
        type: 'info',
        message: `Prepara-te para o jogo ${match.currentGame}!`,
      });
    }
  } else {
    // Jogo continua, enviar atualização
    const isP1Turn = match.whoseTurn === 'player1';

    sendToPlayer(match.player1!.id, {
      type: 'game_state_update',
      matchId,
      gameNumber,
      gameState: newState,
      yourTurn: isP1Turn,
      lastMove: move,
    });

    sendToPlayer(match.player2!.id, {
      type: 'game_state_update',
      matchId,
      gameNumber,
      gameState: newState,
      yourTurn: !isP1Turn,
      lastMove: move,
    });
  }
}

function handleMatchEnd(
  tournament: Tournament,
  match: TournamentMatch,
  winnerId: string
): void {
  const loserId = match.player1!.id === winnerId ? match.player2!.id : match.player1!.id;
  const winner = tournament.playerById.get(winnerId)!;
  const loser = tournament.playerById.get(loserId)!;

  log({
    type: 'match',
    tournamentId: tournament.id,
    matchId: match.id,
    message: `Match terminou: ${winner.name} vence ${loser.name} (${match.score.player1Wins}-${match.score.player2Wins})`,
  });

  // Processar resultado no motor de torneios
  const result = processMatchResult(tournament, match.id, winnerId);

  // Determinar próximo bracket para cada jogador
  const winnerNextBracket = result.isTournamentEnd ? 'champion' : 
    (match.bracket === 'winners' ? 'winners' : 'losers');
  const loserNextBracket = loser.losses >= 2 ? 'eliminated' : 'losers';

  // Notificar jogadores
  sendToPlayer(winnerId, {
    type: 'match_end',
    matchId: match.id,
    winnerId,
    finalScore: match.score,
    youWon: true,
    nextBracket: winnerNextBracket,
  });

  sendToPlayer(loserId, {
    type: 'match_end',
    matchId: match.id,
    winnerId,
    finalScore: match.score,
    youWon: false,
    nextBracket: loserNextBracket,
  });

  // Se o torneio terminou
  if (result.isTournamentEnd) {
    log({
      type: 'info',
      tournamentId: tournament.id,
      message: `Torneio terminado! Campeão: ${winner.name}`,
    });

    broadcastToTournament(tournament, {
      type: 'tournament_end',
      championId: winnerId,
      championName: winner.name,
      finalStandings: tournament.players.map((p, i) => ({
        player: { id: p.id, name: p.name, classId: p.classId },
        position: p.id === winnerId ? 1 : (p.losses < 2 ? 2 : tournament.players.length - i),
      })),
    });
  } else {
    // Notificar novos matches se foram criados
    for (const newMatch of result.newMatches) {
      if (newMatch.player1) {
        sendToPlayer(newMatch.player1.id, {
          type: 'match_assigned',
          match: {
            id: newMatch.id,
            round: newMatch.round,
            bracket: newMatch.bracket,
            player1: newMatch.player1,
            player2: newMatch.player2,
            score: newMatch.score,
            bestOf: newMatch.bestOf,
            currentGame: newMatch.currentGame,
            whoStartsCurrentGame: newMatch.whoStartsCurrentGame,
            phase: newMatch.phase,
            winnerId: newMatch.winnerId,
          },
          yourRole: 'player1',
        });
      }
      if (newMatch.player2) {
        sendToPlayer(newMatch.player2.id, {
          type: 'match_assigned',
          match: {
            id: newMatch.id,
            round: newMatch.round,
            bracket: newMatch.bracket,
            player1: newMatch.player1,
            player2: newMatch.player2,
            score: newMatch.score,
            bestOf: newMatch.bestOf,
            currentGame: newMatch.currentGame,
            whoStartsCurrentGame: newMatch.whoStartsCurrentGame,
            phase: newMatch.phase,
            winnerId: newMatch.winnerId,
          },
          yourRole: 'player2',
        });
      }
    }

    broadcastTournamentState(tournament);
  }
}

function handleLeaveTournament(socket: ServerWebSocket<ClientData>): void {
  const playerId = socket.data.playerId;
  if (!playerId) return;

  // Encontrar torneio do jogador
  for (const tournament of tournaments.values()) {
    const player = tournament.playerById.get(playerId);
    if (player) {
      if (tournament.phase === 'registration') {
        // Pode sair normalmente
        removePlayer(tournament, playerId);
        log({
          type: 'info',
          tournamentId: tournament.id,
          message: `Jogador ${player.name} saiu do torneio`,
        });
        broadcastTournamentState(tournament);
      } else if (tournament.phase === 'running') {
        // Forfeit em match ativo
        const { forfeitMatchId } = handlePlayerDisconnect(tournament, playerId);
        if (forfeitMatchId) {
          const winnerId = forfeitMatch(tournament, forfeitMatchId, playerId);
          if (winnerId) {
            const match = tournament.matchById.get(forfeitMatchId)!;
            handleMatchEnd(tournament, match, winnerId);
          }
        }
      }
      break;
    }
  }

  // Limpar estado
  playerSockets.delete(playerId);
  socket.data.playerId = null;
  socket.data.tournamentId = null;

  sendToSocket(socket, {
    type: 'info',
    message: 'Saíste do campeonato.',
  });
}

// ============================================================================
// Handler principal de mensagens
// ============================================================================

function handleMessage(
  socket: ServerWebSocket<ClientData>,
  rawMessage: string
): void {
  let message: ClientMessage;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    sendToSocket(socket, {
      type: 'error',
      code: 'PARSE_ERROR',
      message: 'Mensagem inválida.',
    });
    return;
  }

  switch (message.type) {
    case 'join_tournament':
      handleJoinTournament(
        socket,
        message.gameId,
        message.playerName,
        message.classId
      );
      break;

    case 'ready_for_match':
      handleReadyForMatch(socket, message.matchId);
      break;

    case 'submit_move':
      handleSubmitMove(socket, message.matchId, message.gameNumber, message.move);
      break;

    case 'leave_tournament':
      handleLeaveTournament(socket);
      break;

    default:
      sendToSocket(socket, {
        type: 'error',
        code: 'UNKNOWN_MESSAGE',
        message: 'Tipo de mensagem desconhecido.',
      });
  }
}

// ============================================================================
// Handlers de conexão
// ============================================================================

function handleOpen(socket: ServerWebSocket<ClientData>): void {
  log({
    type: 'info',
    message: 'Nova conexão WebSocket',
  });
}

function handleClose(socket: ServerWebSocket<ClientData>): void {
  const playerId = socket.data.playerId;
  
  if (playerId) {
    // Encontrar torneio e marcar jogador como desconectado
    for (const tournament of tournaments.values()) {
      const player = tournament.playerById.get(playerId);
      if (player) {
        updatePlayerConnection(tournament, playerId, false);
        log({
          type: 'info',
          tournamentId: tournament.id,
          message: `Jogador ${player.name} desconectou`,
        });

        // Se o torneio está a decorrer, dar forfeit
        if (tournament.phase === 'running') {
          const { forfeitMatchId } = handlePlayerDisconnect(tournament, playerId);
          if (forfeitMatchId) {
            const winnerId = forfeitMatch(tournament, forfeitMatchId, playerId);
            if (winnerId) {
              const match = tournament.matchById.get(forfeitMatchId)!;
              handleMatchEnd(tournament, match, winnerId);
            }
          }
        }
        break;
      }
    }

    playerSockets.delete(playerId);
  }
}

// ============================================================================
// API HTTP de administração
// ============================================================================

function handleHttpRequest(req: Request): Response {
  const url = new URL(req.url);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (url.pathname === '/health') {
    return Response.json(
      {
        status: 'ok',
        tournaments: Array.from(tournaments.entries()).map(([gameId, t]) => ({
          gameId,
          id: t.id,
          phase: t.phase,
          playerCount: t.players.length,
        })),
      },
      { headers: corsHeaders }
    );
  }

  // Admin page
  if (url.pathname === '/' || url.pathname === '/admin') {
    return new Response(getAdminPageHtml(ADMIN_KEY), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders,
      },
    });
  }

  // Listar torneios
  if (url.pathname === '/api/tournaments') {
    return Response.json(
      Array.from(tournaments.entries()).map(([gameId, t]) => ({
        gameId,
        id: t.id,
        phase: t.phase,
        players: t.players.map(p => ({
          id: p.id,
          name: p.name,
          classId: p.classId,
          losses: p.losses,
          isConnected: p.isConnected,
        })),
        state: toTournamentState(t),
      })),
      { headers: corsHeaders }
    );
  }

  // Iniciar torneio (requer admin key)
  if (url.pathname.startsWith('/api/tournaments/') && url.pathname.endsWith('/start') && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = url.pathname.split('/')[3] as GameId;
    const tournament = tournaments.get(gameId);
    
    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404, headers: corsHeaders });
    }

    if (tournament.players.length < 2) {
      return Response.json({ error: 'Need at least 2 players' }, { status: 400, headers: corsHeaders });
    }

    const started = startTournament(tournament);
    if (!started) {
      return Response.json({ error: 'Could not start tournament' }, { status: 400, headers: corsHeaders });
    }

    log({
      type: 'info',
      tournamentId: tournament.id,
      message: `Torneio iniciado pelo administrador com ${tournament.players.length} jogadores`,
    });

    // Notificar todos os jogadores
    broadcastTournamentState(tournament);
    broadcastToTournament(tournament, {
      type: 'info',
      message: `O campeonato começou com ${tournament.players.length} jogadores!`,
    });

    // Enviar match assignments para os primeiros matches
    const allMatches = [...tournament.winnersMatches, ...tournament.losersMatches];
    for (const match of allMatches) {
      if (match.player1) {
        sendToPlayer(match.player1.id, {
          type: 'match_assigned',
          match: {
            id: match.id,
            round: match.round,
            bracket: match.bracket,
            player1: match.player1,
            player2: match.player2,
            score: match.score,
            bestOf: match.bestOf,
            currentGame: match.currentGame,
            whoStartsCurrentGame: match.whoStartsCurrentGame,
            phase: match.phase,
            winnerId: match.winnerId,
          },
          yourRole: 'player1',
        });
      }
      if (match.player2) {
        sendToPlayer(match.player2.id, {
          type: 'match_assigned',
          match: {
            id: match.id,
            round: match.round,
            bracket: match.bracket,
            player1: match.player1,
            player2: match.player2,
            score: match.score,
            bestOf: match.bestOf,
            currentGame: match.currentGame,
            whoStartsCurrentGame: match.whoStartsCurrentGame,
            phase: match.phase,
            winnerId: match.winnerId,
          },
          yourRole: 'player2',
        });
      }
    }

    return Response.json({ success: true, state: toTournamentState(tournament) }, { headers: corsHeaders });
  }

  // Reset torneio (requer admin key)
  if (url.pathname.startsWith('/api/tournaments/') && url.pathname.endsWith('/reset') && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = url.pathname.split('/')[3] as GameId;
    tournaments.delete(gameId);

    log({
      type: 'info',
      message: `Torneio de ${gameId} reiniciado pelo administrador`,
    });

    return Response.json({ success: true }, { headers: corsHeaders });
  }

  // Logs
  if (url.pathname === '/api/logs') {
    return Response.json(eventLog, { headers: corsHeaders });
  }

  return new Response('Not Found', { status: 404, headers: corsHeaders });
}

// ============================================================================
// Iniciar servidor
// ============================================================================

console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Servidor de Torneios - Jogos Matemáticos           ║
╠══════════════════════════════════════════════════════════════╣
║  WebSocket: ws://localhost:${PORT}/ws                          ║
║  API HTTP:  http://localhost:${PORT}                           ║
║  Admin Key: ${ADMIN_KEY.substring(0, 4)}...                                           ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                  ║
║    GET  /health           - Estado do servidor               ║
║    GET  /api/tournaments  - Listar torneios                  ║
║    POST /api/tournaments/:gameId/start - Iniciar torneio     ║
║    POST /api/tournaments/:gameId/reset - Reiniciar torneio   ║
║    GET  /api/logs         - Ver logs de eventos              ║
╚══════════════════════════════════════════════════════════════╝
`);

const server = Bun.serve<ClientData>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    
    // Upgrade para WebSocket se for /ws
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, {
        data: {
          playerId: null,
          tournamentId: null,
        },
      });
      
      if (upgraded) {
        return undefined;
      }
      
      return new Response('WebSocket upgrade failed', { status: 500 });
    }
    
    // Caso contrário, tratar como HTTP
    return handleHttpRequest(req);
  },
  websocket: {
    open: handleOpen,
    message(ws, message) {
      if (typeof message === 'string') {
        handleMessage(ws, message);
      } else {
        handleMessage(ws, new TextDecoder().decode(message));
      }
    },
    close: handleClose,
  },
});

console.log(`Servidor a escutar em http://localhost:${server.port}`);