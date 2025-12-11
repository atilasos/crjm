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
 * 
 * @param serverUrl - URL do servidor WebSocket. Se não for fornecido ou for vazio,
 *                    usa o mock para testes locais.
 * @returns Uma instância de TournamentClient (mock ou WebSocket real)
 */
export function createTournamentClient(serverUrl?: string): TournamentClient {
  // Se não houver URL ou for a flag de mock, usa o mock
  const useMock = !serverUrl || serverUrl === 'mock' || serverUrl === '';
  
  if (useMock) {
    const { TournamentClientMock } = require('./TournamentClientMock');
    return new TournamentClientMock();
  }
  
  // Usa o cliente WebSocket real
  const { TournamentWebSocketClient } = require('./TournamentWebSocketClient');
  return new TournamentWebSocketClient();
}

