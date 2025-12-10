/**
 * Interface abstrata para o cliente de torneio.
 * 
 * Permite ter:
 * - TournamentClientMock: para testar a UI sem servidor real
 * - TournamentWebSocketClient: para ligar ao servidor real
 */

import type {
  ClientMessage,
  ServerMessage,
  GameId,
  TournamentState,
} from './protocol';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TournamentClientEvents {
  onConnectionStatusChange: (status: ConnectionStatus, error?: string) => void;
  onMessage: (message: ServerMessage) => void;
}

export interface TournamentClient {
  /** Estado atual da ligação */
  readonly status: ConnectionStatus;
  
  /** ID do jogador (após join bem-sucedido) */
  readonly playerId: string | null;
  
  /** Estado atual do torneio (atualizado automaticamente) */
  readonly tournamentState: TournamentState | null;

  /** Liga ao servidor */
  connect(serverUrl: string): Promise<void>;

  /** Desliga do servidor */
  disconnect(): void;

  /** Envia uma mensagem para o servidor */
  send(message: ClientMessage): void;

  /** Regista callbacks para eventos */
  setEventHandlers(events: Partial<TournamentClientEvents>): void;
}

/**
 * Cria um cliente de torneio.
 * Por agora retorna sempre o mock; quando tivermos servidor real,
 * podemos escolher baseado no URL ou configuração.
 */
export function createTournamentClient(): TournamentClient {
  // Importação dinâmica para evitar dependência circular
  // Por agora usamos sempre o mock
  const { TournamentClientMock } = require('./TournamentClientMock');
  return new TournamentClientMock();
}

