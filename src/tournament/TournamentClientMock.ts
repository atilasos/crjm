/**
 * Cliente mock para testar a UI de campeonato sem servidor real.
 * 
 * Usa a lógica REAL dos jogos para simular partidas.
 */

import type {
  ClientMessage,
  ServerMessage,
  GameId,
  TournamentState,
  Player,
  Match,
  BracketType,
} from './protocol';
import type {
  TournamentClient,
  TournamentClientEvents,
  ConnectionStatus,
} from './TournamentClient';

// Importar lógica dos jogos
import { criarEstadoInicial as criarGatosCaes, colocarPeca as colocarGatosCaes, jogadaComputador as iaGatosCaes } from '../games/gatos-caes/logic';
import { criarEstadoInicial as criarDominorio, colocarDomino as colocarDominorio, jogadaComputador as iaDominorio } from '../games/dominorio/logic';
import type { GatosCaesState, Posicao as GatosCaesPosicao } from '../games/gatos-caes/types';
import type { DominorioState, Domino } from '../games/dominorio/types';

// Nomes fictícios para bots
const BOT_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diogo', 'Eva', 'Filipe', 'Gisela', 'Hugo',
  'Inês', 'João', 'Kátia', 'Luís', 'Maria', 'Nuno', 'Olga', 'Pedro',
];

function randomBotName(usedNames: Set<string>): string {
  const available = BOT_NAMES.filter(n => !usedNames.has(n));
  if (available.length === 0) {
    return `Bot${Math.floor(Math.random() * 1000)}`;
  }
  return available[Math.floor(Math.random() * available.length)];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

type GameState = GatosCaesState | DominorioState;

export class TournamentClientMock implements TournamentClient {
  private _status: ConnectionStatus = 'disconnected';
  private _playerId: string | null = null;
  private _tournamentState: TournamentState | null = null;
  private _events: Partial<TournamentClientEvents> = {};
  private _currentMatch: Match | null = null;
  private _myRole: 'player1' | 'player2' | null = null;
  private _gameId: GameId | null = null;

  // Estado real do jogo em curso
  private _gameState: GameState | null = null;
  private _iHaveToPlay: boolean = false;

  get status(): ConnectionStatus {
    return this._status;
  }

  get playerId(): string | null {
    return this._playerId;
  }

  get tournamentState(): TournamentState | null {
    return this._tournamentState;
  }

  setEventHandlers(events: Partial<TournamentClientEvents>): void {
    this._events = { ...this._events, ...events };
  }

  async connect(serverUrl: string): Promise<void> {
    this._status = 'connecting';
    this._events.onConnectionStatusChange?.('connecting');

    await this.delay(500 + Math.random() * 500);

    this._status = 'connected';
    this._events.onConnectionStatusChange?.('connected');

    this.emit({
      type: 'info',
      message: `Ligado ao servidor de campeonato (modo de teste). Escolhe um jogo e inscreve-te!`,
    });
  }

  disconnect(): void {
    this._status = 'disconnected';
    this._playerId = null;
    this._tournamentState = null;
    this._currentMatch = null;
    this._myRole = null;
    this._gameState = null;
    this._gameId = null;
    this._events.onConnectionStatusChange?.('disconnected');
  }

  send(message: ClientMessage): void {
    if (this._status !== 'connected') {
      this.emit({
        type: 'error',
        code: 'NOT_CONNECTED',
        message: 'Não estás ligado ao servidor.',
      });
      return;
    }

    setTimeout(() => this.processMessage(message), 100 + Math.random() * 200);
  }

  private async processMessage(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'join_tournament':
        await this.handleJoinTournament(message.gameId, message.playerName, message.classId);
        break;

      case 'ready_for_match':
        await this.handleReadyForMatch(message.matchId);
        break;

      case 'submit_move':
        await this.handleSubmitMove(message.matchId, message.gameNumber, message.move);
        break;

      case 'leave_tournament':
        this.handleLeaveTournament();
        break;
    }
  }

  private async handleJoinTournament(gameId: GameId, playerName: string, classId?: string): Promise<void> {
    this._playerId = generateId();
    this._gameId = gameId;

    const me: Player = {
      id: this._playerId,
      name: playerName,
      classId,
    };

    // Cria torneio com um bot adversário
    const usedNames = new Set<string>([playerName]);
    const botName = randomBotName(usedNames);
    const bot: Player = {
      id: generateId(),
      name: botName,
      classId: `${Math.floor(Math.random() * 4) + 5}º${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`,
    };

    this._tournamentState = {
      id: generateId(),
      gameId,
      phase: 'registration',
      players: [me, bot],
      winnersMatches: [],
      losersMatches: [],
      grandFinal: null,
      grandFinalReset: null,
      championId: null,
    };

    this.emit({
      type: 'welcome',
      playerId: this._playerId,
      tournamentState: this._tournamentState,
    });

    this.emit({
      type: 'info',
      message: `Inscrito no campeonato de ${gameId}! O teu adversário será ${botName}. A aguardar início...`,
    });

    // Inicia o campeonato automaticamente
    await this.delay(2000);
    await this.startTournament();
  }

  private async startTournament(): Promise<void> {
    if (!this._tournamentState || !this._playerId) return;

    this._tournamentState.phase = 'running';
    const [me, bot] = this._tournamentState.players;

    // Sorteia quem começa (quem é player1 no match)
    const euSouPlayer1 = Math.random() < 0.5;

    const match: Match = {
      id: generateId(),
      round: 1,
      bracket: 'winners',
      player1: euSouPlayer1 ? me : bot,
      player2: euSouPlayer1 ? bot : me,
      score: { player1Wins: 0, player2Wins: 0 },
      bestOf: 3,
      currentGame: 1,
      whoStartsCurrentGame: 'player1',
      phase: 'waiting',
      winnerId: null,
    };

    this._tournamentState.winnersMatches = [match];
    this._currentMatch = match;
    this._myRole = euSouPlayer1 ? 'player1' : 'player2';

    this.emit({
      type: 'tournament_state_update',
      tournamentState: this._tournamentState,
    });

    this.emit({
      type: 'info',
      message: `🏆 O campeonato começou!`,
    });

    await this.delay(500);

    this.emit({
      type: 'match_assigned',
      match,
      yourRole: this._myRole,
    });

    const opponent = this._myRole === 'player1' ? match.player2 : match.player1;
    this.emit({
      type: 'info',
      message: `⚔️ Confronto: Tu vs ${opponent?.name} (melhor de 3)`,
    });
  }

  private async handleReadyForMatch(matchId: string): Promise<void> {
    if (!this._currentMatch || this._currentMatch.id !== matchId || !this._gameId) {
      this.emit({
        type: 'error',
        code: 'INVALID_MATCH',
        message: 'Match inválido.',
      });
      return;
    }

    this.emit({
      type: 'info',
      message: 'A iniciar jogo...',
    });

    await this.delay(500);

    // Cria estado real do jogo
    this._gameState = this.createGameState(this._gameId);
    this._currentMatch.phase = 'playing';

    // Determina quem começa este jogo
    const gameNumber = this._currentMatch.currentGame;
    // Jogo 1: player1 começa, Jogo 2: player2 começa, Jogo 3: player1 começa
    const whoStarts = gameNumber % 2 === 1 ? 'player1' : 'player2';
    this._currentMatch.whoStartsCurrentGame = whoStarts;
    
    const youStart = whoStarts === this._myRole;
    this._iHaveToPlay = youStart;

    this.emit({
      type: 'game_start',
      matchId: this._currentMatch.id,
      gameNumber,
      youStart,
      initialState: this._gameState,
    });

    this.emit({
      type: 'info',
      message: `🎮 Jogo ${gameNumber}/3 começou! ${youStart ? 'Tu começas!' : 'O adversário começa.'}`,
    });

    // Se o bot começa, faz a jogada dele
    if (!youStart) {
      await this.delay(800 + Math.random() * 1200);
      await this.botPlay();
    }
  }

  private async handleSubmitMove(matchId: string, gameNumber: number, move: unknown): Promise<void> {
    if (!this._currentMatch || this._currentMatch.id !== matchId || !this._gameState || !this._gameId) {
      this.emit({
        type: 'error',
        code: 'INVALID_MATCH',
        message: 'Match inválido.',
      });
      return;
    }

    if (!this._iHaveToPlay) {
      this.emit({
        type: 'error',
        code: 'NOT_YOUR_TURN',
        message: 'Não é a tua vez!',
      });
      return;
    }

    // Aplica a jogada
    const newState = this.applyMove(this._gameId, this._gameState, move);
    if (!newState) {
      this.emit({
        type: 'error',
        code: 'INVALID_MOVE',
        message: 'Jogada inválida.',
      });
      return;
    }

    this._gameState = newState;
    this._iHaveToPlay = false;

    // Verifica se o jogo acabou
    if (this.isGameOver(newState)) {
      await this.endCurrentGame(newState);
      return;
    }

    // Envia atualização
    this.emit({
      type: 'game_state_update',
      matchId,
      gameNumber,
      gameState: this._gameState,
      yourTurn: false,
      lastMove: move,
    });

    // Bot joga
    await this.delay(800 + Math.random() * 1200);
    await this.botPlay();
  }

  private async botPlay(): Promise<void> {
    if (!this._gameState || !this._gameId || !this._currentMatch) return;

    // Bot faz uma jogada usando a IA do jogo
    const newState = this.makeBotMove(this._gameId, this._gameState);
    if (!newState) return;

    this._gameState = newState;

    // Verifica se o jogo acabou
    if (this.isGameOver(newState)) {
      await this.endCurrentGame(newState);
      return;
    }

    this._iHaveToPlay = true;

    // Envia atualização
    this.emit({
      type: 'game_state_update',
      matchId: this._currentMatch.id,
      gameNumber: this._currentMatch.currentGame,
      gameState: this._gameState,
      yourTurn: true,
    });
  }

  private async endCurrentGame(finalState: GameState): Promise<void> {
    if (!this._currentMatch || !this._myRole || !this._playerId) return;

    // Determina quem ganhou
    const winner = this.getWinner(finalState);
    const iWon = (winner === 'jogador1' && this._myRole === 'player1') ||
                 (winner === 'jogador2' && this._myRole === 'player2');

    const winnerId = iWon 
      ? this._playerId 
      : (this._myRole === 'player1' ? this._currentMatch.player2!.id : this._currentMatch.player1!.id);

    // Atualiza score
    if (iWon) {
      if (this._myRole === 'player1') {
        this._currentMatch.score.player1Wins++;
      } else {
        this._currentMatch.score.player2Wins++;
      }
    } else {
      if (this._myRole === 'player1') {
        this._currentMatch.score.player2Wins++;
      } else {
        this._currentMatch.score.player1Wins++;
      }
    }

    this.emit({
      type: 'game_end',
      matchId: this._currentMatch.id,
      gameNumber: this._currentMatch.currentGame,
      winnerId,
      finalState,
    });

    const { player1Wins, player2Wins } = this._currentMatch.score;
    this.emit({
      type: 'info',
      message: `${iWon ? '🎉 Ganhaste' : '😔 Perdeste'} o jogo ${this._currentMatch.currentGame}! Resultado: ${player1Wins}-${player2Wins}`,
    });

    // Verifica se o match acabou (melhor de 3)
    const maxWins = Math.ceil(this._currentMatch.bestOf / 2);
    if (player1Wins >= maxWins || player2Wins >= maxWins) {
      await this.delay(1500);
      await this.endCurrentMatch();
    } else {
      // Próximo jogo
      this._currentMatch.currentGame++;
      this._currentMatch.phase = 'waiting';

      await this.delay(1500);

      this.emit({
        type: 'info',
        message: `Prepara-te para o jogo ${this._currentMatch.currentGame}!`,
      });

      // Auto-inicia
      await this.delay(1000);
      await this.handleReadyForMatch(this._currentMatch.id);
    }
  }

  private async endCurrentMatch(): Promise<void> {
    if (!this._currentMatch || !this._myRole || !this._playerId) return;

    const { player1Wins, player2Wins } = this._currentMatch.score;
    const iWonMatch = (this._myRole === 'player1' && player1Wins > player2Wins) ||
                      (this._myRole === 'player2' && player2Wins > player1Wins);

    const winnerId = player1Wins > player2Wins 
      ? this._currentMatch.player1!.id 
      : this._currentMatch.player2!.id;

    this._currentMatch.winnerId = winnerId;
    this._currentMatch.phase = 'finished';

    const nextBracket: BracketType | 'eliminated' | 'champion' = iWonMatch ? 'champion' : 'eliminated';

    this.emit({
      type: 'match_end',
      matchId: this._currentMatch.id,
      winnerId,
      finalScore: this._currentMatch.score,
      youWon: iWonMatch,
      nextBracket,
    });

    if (iWonMatch) {
      this.emit({
        type: 'info',
        message: `🏆 PARABÉNS! Ganhaste o confronto ${player1Wins}-${player2Wins}!`,
      });
    } else {
      this.emit({
        type: 'info',
        message: `😔 Perdeste o confronto ${player1Wins}-${player2Wins}.`,
      });
    }

    // Termina o torneio
    await this.delay(2000);
    
    this._tournamentState!.phase = 'finished';
    this._tournamentState!.championId = winnerId;

    const championName = iWonMatch ? 'Tu' : (
      this._myRole === 'player1' ? this._currentMatch.player2?.name : this._currentMatch.player1?.name
    );

    this.emit({
      type: 'tournament_end',
      championId: winnerId,
      championName: championName || 'Desconhecido',
      finalStandings: [],
    });
  }

  private handleLeaveTournament(): void {
    this.emit({
      type: 'info',
      message: 'Saíste do campeonato.',
    });
    this._tournamentState = null;
    this._currentMatch = null;
    this._myRole = null;
    this._gameState = null;
  }

  // ============================================================================
  // Lógica dos jogos
  // ============================================================================

  private createGameState(gameId: GameId): GameState {
    switch (gameId) {
      case 'gatos-caes':
        return criarGatosCaes('dois-jogadores');
      case 'dominorio':
        return criarDominorio('dois-jogadores');
      default:
        // Fallback para Gatos & Cães
        return criarGatosCaes('dois-jogadores');
    }
  }

  private applyMove(gameId: GameId, state: GameState, move: unknown): GameState | null {
    try {
      switch (gameId) {
        case 'gatos-caes': {
          const pos = move as GatosCaesPosicao;
          const gcState = state as GatosCaesState;
          // Verifica se é válida
          if (!gcState.jogadasValidas.some(j => j.linha === pos.linha && j.coluna === pos.coluna)) {
            return null;
          }
          return colocarGatosCaes(gcState, pos);
        }
        case 'dominorio': {
          const domino = move as Domino;
          const domState = state as DominorioState;
          return colocarDominorio(domState, domino);
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private makeBotMove(gameId: GameId, state: GameState): GameState | null {
    switch (gameId) {
      case 'gatos-caes':
        return iaGatosCaes(state as GatosCaesState);
      case 'dominorio':
        return iaDominorio(state as DominorioState);
      default:
        return null;
    }
  }

  private isGameOver(state: GameState): boolean {
    return state.estado !== 'a-jogar';
  }

  private getWinner(state: GameState): 'jogador1' | 'jogador2' | null {
    if (state.estado === 'vitoria-jogador1') return 'jogador1';
    if (state.estado === 'vitoria-jogador2') return 'jogador2';
    return null;
  }

  private emit(message: ServerMessage): void {
    if (message.type === 'tournament_state_update') {
      this._tournamentState = message.tournamentState;
    }
    this._events.onMessage?.(message);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

