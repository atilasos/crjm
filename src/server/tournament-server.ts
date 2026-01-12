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
  findPlayerByCode,
  reactivatePlayer,
  eliminatePlayer,
  suspendPlayer,
  findActiveMatchForPlayer,
  restartCurrentGame,
  restartMatch,
  getActiveMatchesWithGameState,
  exportTournament,
  importTournament,
  type Tournament,
  type TournamentPlayer,
  type TournamentMatch,
  type TournamentExport,
} from './tournament-engine';
import {
  createGameState,
  applyGameMove,
  isValidGameMove,
  isGameFinished,
  getGameWinner,
  isGameSupported,
  getCurrentGamePlayer,
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
    ...state,
  });

  // Também envia a lista de jogos activos para espectadores
  broadcastActiveGamesList(tournament);
}

/** Envia a lista de jogos em curso para todos os jogadores (para modo espectador) */
function broadcastActiveGamesList(tournament: Tournament): void {
  const activeMatches = getActiveMatchesWithGameState(tournament);

  const games = activeMatches.map(({ match }) => {
    let bracket: 'winners' | 'losers' | 'grandFinal' | 'grandFinalReset' = match.bracket;
    if (tournament.grandFinal?.id === match.id) bracket = 'grandFinal';
    if (tournament.grandFinalReset?.id === match.id) bracket = 'grandFinalReset';

    return {
      matchId: match.id,
      bracket,
      round: match.round,
      player1Name: match.player1?.name || 'TBD',
      player2Name: match.player2?.name || 'TBD',
      score: match.score,
      gameNumber: match.currentGame,
    };
  });

  broadcastToTournament(tournament, {
    type: 'active_games_list',
    games,
  });
}

/** Envia o estado de um jogo específico para todos os jogadores (espectadores) */
function broadcastSpectatorGameState(tournament: Tournament, match: TournamentMatch): void {
  if (!match.gameState || match.phase !== 'playing') return;

  let bracket: 'winners' | 'losers' | 'grandFinal' | 'grandFinalReset' = match.bracket;
  if (tournament.grandFinal?.id === match.id) bracket = 'grandFinal';
  if (tournament.grandFinalReset?.id === match.id) bracket = 'grandFinalReset';

  const message: ServerMessage = {
    type: 'spectator_game_state',
    matchId: match.id,
    gameNumber: match.currentGame,
    gameState: match.gameState,
    bracket,
    round: match.round,
    player1Name: match.player1?.name || 'TBD',
    player2Name: match.player2?.name || 'TBD',
    score: match.score,
    whoseTurn: match.whoseTurn,
  };

  // Envia para todos os jogadores conectados (exceto os do próprio match que já recebem game_state_update)
  for (const player of tournament.players) {
    if (player.isConnected && player.id !== match.player1?.id && player.id !== match.player2?.id) {
      sendToPlayer(player.id, message);
    }
  }
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
    playerName: player.name,
    tournamentId: tournament.id,
    tournamentState: toTournamentState(tournament),
    reconnectionCode: player.reconnectionCode,
  });

  // Notificar todos os outros jogadores
  broadcastTournamentState(tournament);

  sendToSocket(socket, {
    type: 'info',
    message: `Bem-vindo ao campeonato de ${gameId}! O teu código de reconexão é: ${player.reconnectionCode}`,
  });
}

function handleRejoinTournament(
  socket: ServerWebSocket<ClientData>,
  reconnectionCode: string
): void {
  const normalizedCode = reconnectionCode.toUpperCase().trim();

  // Procurar jogador em todos os torneios
  let foundTournament: Tournament | null = null;
  let foundPlayer: TournamentPlayer | null = null;

  for (const tournament of tournaments.values()) {
    const player = findPlayerByCode(tournament, normalizedCode);
    if (player) {
      foundTournament = tournament;
      foundPlayer = player;
      break;
    }
  }

  if (!foundTournament || !foundPlayer) {
    sendToSocket(socket, {
      type: 'error',
      code: 'INVALID_CODE',
      message: 'Código de reconexão inválido.',
    });
    return;
  }

  // Verificar se o jogador foi eliminado
  if (foundPlayer.status === 'eliminated') {
    sendToSocket(socket, {
      type: 'error',
      code: 'PLAYER_ELIMINATED',
      message: 'Este jogador foi eliminado do torneio.',
    });
    return;
  }

  // Verificar se já está conectado (evitar duplicados)
  // Mas primeiro limpar socket antigo se existir (evita race condition)
  const existingSocket = playerSockets.get(foundPlayer.id);
  if (existingSocket) {
    // Fechar socket antigo se ainda existir
    try {
      existingSocket.close(1000, 'Reconexão de outro dispositivo');
    } catch {
      // Ignorar erros ao fechar socket
    }
    playerSockets.delete(foundPlayer.id);
  }

  // Resetar estado de conexão antes de reativar
  foundPlayer.isConnected = false;

  // Reativar jogador
  const socketId = `${Date.now()}-${Math.random()}`;
  const { resumedMatchId } = reactivatePlayer(foundTournament, foundPlayer.id, socketId);

  // Associar socket ao jogador
  socket.data.playerId = foundPlayer.id;
  socket.data.tournamentId = foundTournament.id;
  playerSockets.set(foundPlayer.id, socket);

  log({
    type: 'info',
    tournamentId: foundTournament.id,
    message: `Jogador ${foundPlayer.name} reconectou usando código ${normalizedCode}`,
  });

  // Enviar welcome
  sendToSocket(socket, {
    type: 'welcome',
    playerId: foundPlayer.id,
    playerName: foundPlayer.name,
    tournamentId: foundTournament.id,
    tournamentState: toTournamentState(foundTournament),
    reconnectionCode: foundPlayer.reconnectionCode,
  });

  // Se tinha match pausado, verificar se pode retomar
  if (resumedMatchId) {
    const match = foundTournament.matchById.get(resumedMatchId);
    if (match) {
      const opponentId = match.player1?.id === foundPlayer.id
        ? match.player2?.id
        : match.player1?.id;

      const opponent = opponentId ? foundTournament.playerById.get(opponentId) : null;
      const opponentConnected = opponent?.isConnected && playerSockets.has(opponentId!);

      if (!opponentConnected) {
        // Oponente não está conectado - manter match pausado e notificar
        // Re-pausar o match (porque reactivatePlayer o retomou)
        match.isPaused = true;
        match.pausedAt = new Date();
        match.pausedByPlayerId = opponentId ?? null;
        foundPlayer.suspendedMatchId = resumedMatchId;

        sendToSocket(socket, {
          type: 'info',
          message: 'Voltaste ao campeonato! O teu adversário ainda não está conectado. A aguardar...',
        });

        // Re-enviar match assignment para o jogador
        sendToSocket(socket, {
          type: 'match_assigned',
          match: match,
          yourRole: match.player1?.id === foundPlayer.id ? 'player1' : 'player2',
          opponentName: opponent?.name ?? 'Adversário desconectado',
        });

        log({
          type: 'match',
          tournamentId: foundTournament.id,
          matchId: resumedMatchId,
          message: `${foundPlayer.name} voltou mas adversário ainda está desconectado`,
        });
      } else {
        // Ambos conectados - retomar match normalmente
        sendToSocket(socket, {
          type: 'info',
          message: 'Voltaste ao teu match! O jogo vai continuar.',
        });

        sendToPlayer(opponentId!, {
          type: 'info',
          message: `O teu adversário ${foundPlayer.name} voltou! O jogo vai continuar.`,
        });

        // Re-enviar match assignment para ambos
        sendToSocket(socket, {
          type: 'match_assigned',
          match: match,
          yourRole: match.player1?.id === foundPlayer.id ? 'player1' : 'player2',
          opponentName: opponent?.name || '',
        });

        sendToPlayer(opponentId!, {
          type: 'match_assigned',
          match: match,
          yourRole: match.player1?.id === opponentId ? 'player1' : 'player2',
          opponentName: foundPlayer.name,
        });

        // Se o match estava em playing, enviar o estado atual do jogo
        if (match.phase === 'playing' && match.gameState) {
          const isP1 = match.player1?.id === foundPlayer.id;
          const isMyTurn = match.whoseTurn === (isP1 ? 'player1' : 'player2');
          sendToSocket(socket, {
            type: 'game_state_update',
            matchId: resumedMatchId,
            gameNumber: match.currentGame,
            gameState: match.gameState,
            yourTurn: isMyTurn,
          });

          // Enviar estado também para o oponente
          const isOpponentP1 = match.player1?.id === opponentId;
          const isOpponentTurn = match.whoseTurn === (isOpponentP1 ? 'player1' : 'player2');
          sendToPlayer(opponentId!, {
            type: 'game_state_update',
            matchId: resumedMatchId,
            gameNumber: match.currentGame,
            gameState: match.gameState,
            yourTurn: isOpponentTurn,
          });
        }

        log({
          type: 'match',
          tournamentId: foundTournament.id,
          matchId: resumedMatchId,
          message: `Match retomado após reconexão de ${foundPlayer.name}`,
        });
      }
    }
  } else {
    sendToSocket(socket, {
      type: 'info',
      message: 'Voltaste ao campeonato! A aguardar próximo match...',
    });
  }

  // Notificar todos os jogadores da atualização
  broadcastTournamentState(foundTournament);
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
      yourRole: 'player1',
    });

    sendToPlayer(match.player2!.id, {
      type: 'game_start',
      matchId,
      gameNumber: updatedMatch.currentGame,
      youStart: !p1Start,
      initialState: gameState,
      yourRole: 'player2',
    });

    // Broadcast para espectadores
    broadcastSpectatorGameState(tournament, updatedMatch);
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

  // Determinar quem é o próximo jogador baseado na lógica do jogo
  const nextJogador = getCurrentGamePlayer(tournament.gameId, newState as any);
  const isP1Jogador1 = match.whoStartsCurrentGame === 'player1';
  const nextTurn: 'player1' | 'player2' = nextJogador === 'jogador1'
    ? (isP1Jogador1 ? 'player1' : 'player2')
    : (isP1Jogador1 ? 'player2' : 'player1');

  // Registar a jogada
  recordMove(match, playerId, move, newState, nextTurn);

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

    // CORREÇÃO: Mapear jogador1/jogador2 (papel no jogo) para player1/player2 (seat no match)
    // whoStartsCurrentGame indica qual seat está a jogar como jogador1 neste jogo
    // Jogo 1: player1 = jogador1, Jogo 2: player2 = jogador1, Jogo 3: player1 = jogador1
    const isPlayer1AsJogador1 = match.whoStartsCurrentGame === 'player1';
    const winnerId = winner === 'jogador1'
      ? (isPlayer1AsJogador1 ? match.player1!.id : match.player2!.id)
      : (isPlayer1AsJogador1 ? match.player2!.id : match.player1!.id);

    // Determinar o winnerRole (seat) para enviar aos clientes
    const winnerRole: 'player1' | 'player2' = winnerId === match.player1!.id ? 'player1' : 'player2';

    // Terminar o jogo
    const { matchEnded, matchWinnerId } = endGame(match, winnerId);

    // Obter o nome do vencedor corretamente
    const winnerName = winnerId === match.player1!.id ? match.player1?.name : match.player2?.name;

    log({
      type: 'game',
      tournamentId: tournament.id,
      matchId: match.id,
      message: `Jogo ${gameNumber} terminou. Vencedor: ${winnerName}`,
    });

    // DEBUG: Log the score being sent
    console.log('[DEBUG] Score após endGame:', JSON.stringify(match.score));

    // Criar cópia do score para enviar (evitar problemas de referência)
    const scoreToSend = {
      player1Wins: match.score.player1Wins,
      player2Wins: match.score.player2Wins
    };

    console.log('[DEBUG] Score a enviar:', JSON.stringify(scoreToSend));

    // Notificar fim do jogo com campos completos
    sendToPlayer(match.player1!.id, {
      type: 'game_end',
      matchId,
      gameNumber,
      winnerId,
      winnerRole,
      isDraw: false,
      finalState: newState,
      matchScore: scoreToSend,
    });

    sendToPlayer(match.player2!.id, {
      type: 'game_end',
      matchId,
      gameNumber,
      winnerId,
      winnerRole,
      isDraw: false,
      finalState: newState,
      matchScore: scoreToSend,
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

    // Broadcast para espectadores
    broadcastSpectatorGameState(tournament, match);
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
    winnerName: winner.name,
    finalScore: match.score,
    youWon: true,
    nextBracket: winnerNextBracket,
    eliminatedFromTournament: false,
  });

  sendToPlayer(loserId, {
    type: 'match_end',
    matchId: match.id,
    winnerId,
    winnerName: winner.name,
    finalScore: match.score,
    youWon: false,
    nextBracket: loserNextBracket,
    eliminatedFromTournament: loserNextBracket === 'eliminated',
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
      tournamentId: tournament.id,
      championId: winnerId,
      championName: winner.name,
      finalStandings: tournament.players.map((p, i) => ({
        rank: p.id === winnerId ? 1 : (p.losses < 2 ? 2 : Math.min(3, 1 + p.losses)),
        playerId: p.id,
        playerName: p.name,
      })),
    });
  } else {
    // Notificar novos matches se foram criados
    for (const newMatch of result.newMatches) {
      if (newMatch.player1) {
        sendToPlayer(newMatch.player1.id, {
          type: 'match_assigned',
          match: newMatch,
          yourRole: 'player1',
          opponentName: newMatch.player2?.name || 'A aguardar adversário...',
        });
      }
      if (newMatch.player2) {
        sendToPlayer(newMatch.player2.id, {
          type: 'match_assigned',
          match: newMatch,
          yourRole: 'player2',
          opponentName: newMatch.player1?.name || 'A aguardar adversário...',
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

    case 'rejoin_tournament':
      handleRejoinTournament(socket, message.reconnectionCode);
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
    // Encontrar torneio e marcar jogador como suspenso (pode reconectar)
    for (const tournament of tournaments.values()) {
      const player = tournament.playerById.get(playerId);
      if (player) {
        log({
          type: 'info',
          tournamentId: tournament.id,
          message: `Jogador ${player.name} desconectou`,
        });

        // Suspender jogador (pausa match em vez de forfeit imediato)
        const { pausedMatchId } = handlePlayerDisconnect(tournament, playerId);

        if (pausedMatchId) {
          const match = tournament.matchById.get(pausedMatchId);
          if (match) {
            // Notificar o oponente que o match está pausado
            const opponentId = match.player1?.id === playerId
              ? match.player2?.id
              : match.player1?.id;

            if (opponentId) {
              sendToPlayer(opponentId, {
                type: 'info',
                message: `O teu adversário ${player.name} desconectou. O jogo está pausado. A aguardar reconexão...`,
              });
            }

            log({
              type: 'match',
              tournamentId: tournament.id,
              matchId: pausedMatchId,
              message: `Match pausado devido a desconexão de ${player.name}`,
            });
          }
        }

        // Atualizar estado para todos
        broadcastTournamentState(tournament);
        break;
      }
    }

    playerSockets.delete(playerId);
  }
}

// ============================================================================
// API HTTP de administração
// ============================================================================

async function handleHttpRequest(req: Request): Promise<Response> {
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
          status: p.status,
          reconnectionCode: p.reconnectionCode,
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
      // Skip matches já terminados (byes) - jogadores serão notificados separadamente
      if (match.phase === 'finished') {
        continue;
      }
      const p1 = match.player1;
      const p2 = match.player2;
      if (p1) {
        sendToPlayer(p1.id, {
          type: 'match_assigned',
          match: match,
          yourRole: 'player1',
          opponentName: p2?.name || 'A aguardar adversário...',
        });
      }
      if (p2) {
        sendToPlayer(p2.id, {
          type: 'match_assigned',
          match: match,
          yourRole: 'player2',
          opponentName: p1?.name || 'A aguardar adversário...',
        });
      }
    }

    // Notificar jogadores que ganharam por bye para irem ao lobby ver jogos
    for (const match of allMatches) {
      if (match.result === 'bye' && match.winnerId) {
        sendToPlayer(match.winnerId, {
          type: 'info',
          message: 'Avançaste automaticamente! Podes ver os outros jogos enquanto esperas pelo próximo adversário.',
        });
        // Enviar também a lista de jogos ativos para que possam ver
        broadcastActiveGamesList(tournament);
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

  // Eliminar jogador (requer admin key)
  // POST /api/tournaments/:gameId/players/:playerId/eliminate
  const eliminateMatch = url.pathname.match(/^\/api\/tournaments\/([^/]+)\/players\/([^/]+)\/eliminate$/);
  if (eliminateMatch && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = eliminateMatch[1] as GameId;
    const playerId = eliminateMatch[2];
    const tournament = tournaments.get(gameId);

    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404, headers: corsHeaders });
    }

    const player = tournament.playerById.get(playerId);
    if (!player) {
      return Response.json({ error: 'Player not found' }, { status: 404, headers: corsHeaders });
    }

    if (player.status === 'eliminated') {
      return Response.json({ error: 'Player already eliminated' }, { status: 400, headers: corsHeaders });
    }

    // Eliminar jogador (forfeit todos os matches)
    const { forfeitedMatchIds } = eliminatePlayer(tournament, playerId);

    log({
      type: 'info',
      tournamentId: tournament.id,
      message: `Jogador ${player.name} eliminado pelo administrador`,
    });

    // Processar resultados dos matches forfeitados
    for (const matchId of forfeitedMatchIds) {
      const match = tournament.matchById.get(matchId);
      if (match && match.winnerId) {
        handleMatchEnd(tournament, match, match.winnerId);
      }
    }

    broadcastTournamentState(tournament);

    return Response.json({ success: true, forfeitedMatchIds }, { headers: corsHeaders });
  }

  // Suspender jogador manualmente (requer admin key)
  // POST /api/tournaments/:gameId/players/:playerId/suspend
  const suspendMatch = url.pathname.match(/^\/api\/tournaments\/([^/]+)\/players\/([^/]+)\/suspend$/);
  if (suspendMatch && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = suspendMatch[1] as GameId;
    const playerId = suspendMatch[2];
    const tournament = tournaments.get(gameId);

    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404, headers: corsHeaders });
    }

    const player = tournament.playerById.get(playerId);
    if (!player) {
      return Response.json({ error: 'Player not found' }, { status: 404, headers: corsHeaders });
    }

    if (player.status === 'suspended') {
      return Response.json({ error: 'Player already suspended' }, { status: 400, headers: corsHeaders });
    }

    if (player.status === 'eliminated') {
      return Response.json({ error: 'Cannot suspend eliminated player' }, { status: 400, headers: corsHeaders });
    }

    // Suspender jogador
    const { pausedMatchId } = suspendPlayer(tournament, playerId);

    log({
      type: 'info',
      tournamentId: tournament.id,
      message: `Jogador ${player.name} suspenso pelo administrador`,
    });

    // Notificar oponente se tinha match em curso
    if (pausedMatchId) {
      const match = tournament.matchById.get(pausedMatchId);
      if (match) {
        const opponentId = match.player1?.id === playerId
          ? match.player2?.id
          : match.player1?.id;

        if (opponentId) {
          sendToPlayer(opponentId, {
            type: 'info',
            message: `O teu adversário ${player.name} foi suspenso. O jogo está pausado.`,
          });
        }
      }
    }

    broadcastTournamentState(tournament);

    return Response.json({ success: true, pausedMatchId }, { headers: corsHeaders });
  }

  // Obter código de reconexão de um jogador (requer admin key)
  // GET /api/tournaments/:gameId/players/:playerId/code
  const codeMatch = url.pathname.match(/^\/api\/tournaments\/([^/]+)\/players\/([^/]+)\/code$/);
  if (codeMatch && req.method === 'GET') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = codeMatch[1] as GameId;
    const playerId = codeMatch[2];
    const tournament = tournaments.get(gameId);

    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404, headers: corsHeaders });
    }

    const player = tournament.playerById.get(playerId);
    if (!player) {
      return Response.json({ error: 'Player not found' }, { status: 404, headers: corsHeaders });
    }

    return Response.json({
      playerId: player.id,
      playerName: player.name,
      reconnectionCode: player.reconnectionCode,
      status: player.status,
    }, { headers: corsHeaders });
  }

  // Exportar torneio (requer admin key)
  // GET /api/tournaments/:gameId/export
  const exportMatch = url.pathname.match(/^\/api\/tournaments\/([^/]+)\/export$/);
  if (exportMatch && req.method === 'GET') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = exportMatch[1] as GameId;
    const tournament = tournaments.get(gameId);

    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404, headers: corsHeaders });
    }

    const exported = exportTournament(tournament);

    log({
      type: 'info',
      tournamentId: tournament.id,
      message: `Torneio exportado pelo administrador`,
    });

    return Response.json(exported, {
      headers: {
        ...corsHeaders,
        'Content-Disposition': `attachment; filename="torneio-${gameId}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  }

  // Importar torneio (requer admin key)
  // POST /api/tournaments/:gameId/import
  const importMatch = url.pathname.match(/^\/api\/tournaments\/([^/]+)\/import$/);
  if (importMatch && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = importMatch[1] as GameId;

    try {
      const body = await req.json() as TournamentExport;

      // Validar que o gameId corresponde
      if (body.gameId !== gameId) {
        return Response.json({
          error: 'Game ID mismatch',
          expected: gameId,
          received: body.gameId,
        }, { status: 400, headers: corsHeaders });
      }

      // Validar versão
      if (body.version !== 1) {
        return Response.json({
          error: 'Unsupported export version',
          version: body.version,
        }, { status: 400, headers: corsHeaders });
      }

      // Importar o torneio
      const imported = importTournament(body);

      // Substituir o torneio existente (ou adicionar se não existir)
      tournaments.set(gameId, imported);

      log({
        type: 'info',
        tournamentId: imported.id,
        message: `Torneio importado pelo administrador com ${imported.players.length} jogadores`,
      });

      // Notificar jogadores conectados (se houver)
      // Neste ponto, todos os jogadores estão marcados como desconectados
      // Eles precisarão reconectar usando os seus códigos de reconexão

      return Response.json({
        success: true,
        tournamentId: imported.id,
        players: imported.players.length,
        phase: imported.phase,
      }, { headers: corsHeaders });
    } catch (e) {
      return Response.json({
        error: 'Invalid import data',
        details: e instanceof Error ? e.message : 'Unknown error',
      }, { status: 400, headers: corsHeaders });
    }
  }

  // Create tournament with pre-registered players (requer admin key)
  // POST /api/tournaments/:gameId/create-with-players
  const createWithPlayersMatch = url.pathname.match(/^\/api\/tournaments\/([^/]+)\/create-with-players$/);
  if (createWithPlayersMatch && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = createWithPlayersMatch[1] as GameId;

    // Verificar se o jogo é suportado
    if (!isGameSupported(gameId)) {
      return Response.json({
        error: 'Unsupported game',
        gameId,
      }, { status: 400, headers: corsHeaders });
    }

    try {
      const body = await req.json() as { players: Array<{ name: string; classId?: string }> };

      if (!body.players || !Array.isArray(body.players) || body.players.length === 0) {
        return Response.json({
          error: 'Players array is required and must not be empty',
        }, { status: 400, headers: corsHeaders });
      }

      // Remover torneio existente (se houver)
      tournaments.delete(gameId);

      // Criar novo torneio
      const tournament = createTournament(gameId);
      tournaments.set(gameId, tournament);

      // Adicionar todos os jogadores
      const addedPlayers: Array<{ id: string; name: string; classId?: string; reconnectionCode: string }> = [];

      for (const playerData of body.players) {
        if (!playerData.name || typeof playerData.name !== 'string') {
          continue; // Skip invalid entries
        }

        const player = addPlayer(tournament, playerData.name.trim(), playerData.classId?.trim());
        if (player) {
          // Marcar como desconectado (aguardando conexão via código)
          player.isConnected = false;
          player.socketId = null;

          addedPlayers.push({
            id: player.id,
            name: player.name,
            classId: player.classId,
            reconnectionCode: player.reconnectionCode,
          });
        }
      }

      log({
        type: 'info',
        tournamentId: tournament.id,
        message: `Torneio criado pelo administrador com ${addedPlayers.length} jogadores pré-registados`,
      });

      return Response.json({
        success: true,
        tournamentId: tournament.id,
        gameId,
        players: addedPlayers,
        phase: tournament.phase,
      }, { headers: corsHeaders });
    } catch (e) {
      return Response.json({
        error: 'Invalid request data',
        details: e instanceof Error ? e.message : 'Unknown error',
      }, { status: 400, headers: corsHeaders });
    }
  }

  // Logs
  if (url.pathname === '/api/logs') {
    return Response.json(eventLog, { headers: corsHeaders });
  }

  // Reiniciar apenas o jogo atual de um match (requer admin key)
  // POST /api/tournaments/:gameId/matches/:matchId/restart-game
  const restartGameMatch = url.pathname.match(/^\/api\/tournaments\/([^/]+)\/matches\/([^/]+)\/restart-game$/);
  if (restartGameMatch && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = restartGameMatch[1] as GameId;
    const matchId = restartGameMatch[2];
    const tournament = tournaments.get(gameId);

    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404, headers: corsHeaders });
    }

    const match = tournament.matchById.get(matchId);
    if (!match) {
      return Response.json({ error: 'Match not found' }, { status: 404, headers: corsHeaders });
    }

    const result = restartCurrentGame(tournament, matchId);
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400, headers: corsHeaders });
    }

    log({
      type: 'match',
      tournamentId: tournament.id,
      matchId: matchId,
      message: `Jogo atual reiniciado pelo administrador (${match.player1?.name} vs ${match.player2?.name})`,
    });

    // Notificar jogadores do match e enviar match_assigned para atualizar o estado
    if (match.player1) {
      sendToPlayer(match.player1.id, {
        type: 'info',
        message: 'O jogo foi reiniciado pelo administrador. Clica em "Estou pronto" para recomeçar.',
      });
      sendToPlayer(match.player1.id, {
        type: 'match_assigned',
        match: match,
        yourRole: 'player1',
        opponentName: match.player2?.name || 'TBD',
      });
    }
    if (match.player2) {
      sendToPlayer(match.player2.id, {
        type: 'info',
        message: 'O jogo foi reiniciado pelo administrador. Clica em "Estou pronto" para recomeçar.',
      });
      sendToPlayer(match.player2.id, {
        type: 'match_assigned',
        match: match,
        yourRole: 'player2',
        opponentName: match.player1?.name || 'TBD',
      });
    }

    broadcastTournamentState(tournament);

    return Response.json({ success: true, message: 'Jogo reiniciado' }, { headers: corsHeaders });
  }

  // Reiniciar um match completo (requer admin key)
  // POST /api/tournaments/:gameId/matches/:matchId/restart-match
  const restartMatchPattern = url.pathname.match(/^\/api\/tournaments\/([^/]+)\/matches\/([^/]+)\/restart-match$/);
  if (restartMatchPattern && req.method === 'POST') {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${ADMIN_KEY}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const gameId = restartMatchPattern[1] as GameId;
    const matchId = restartMatchPattern[2];
    const tournament = tournaments.get(gameId);

    if (!tournament) {
      return Response.json({ error: 'Tournament not found' }, { status: 404, headers: corsHeaders });
    }

    const match = tournament.matchById.get(matchId);
    if (!match) {
      return Response.json({ error: 'Match not found' }, { status: 404, headers: corsHeaders });
    }

    const result = restartMatch(tournament, matchId);
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400, headers: corsHeaders });
    }

    log({
      type: 'match',
      tournamentId: tournament.id,
      matchId: matchId,
      message: `Match reiniciado pelo administrador (${match.player1?.name} vs ${match.player2?.name}, score resetado para 0-0)`,
    });

    // Notificar jogadores do match
    if (match.player1) {
      sendToPlayer(match.player1.id, {
        type: 'info',
        message: 'O match foi reiniciado pelo administrador. Score volta a 0-0. Clica em "Estou pronto" para recomeçar.',
      });
      sendToPlayer(match.player1.id, {
        type: 'match_assigned',
        match: match,
        yourRole: 'player1',
        opponentName: match.player2?.name || 'TBD',
      });
    }
    if (match.player2) {
      sendToPlayer(match.player2.id, {
        type: 'info',
        message: 'O match foi reiniciado pelo administrador. Score volta a 0-0. Clica em "Estou pronto" para recomeçar.',
      });
      sendToPlayer(match.player2.id, {
        type: 'match_assigned',
        match: match,
        yourRole: 'player2',
        opponentName: match.player1?.name || 'TBD',
      });
    }

    broadcastTournamentState(tournament);

    return Response.json({ success: true, message: 'Match reiniciado (0-0)' }, { headers: corsHeaders });
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