/**
 * Cliente WebSocket real para ligar ao servidor de torneios.
 * 
 * Implementa a interface TournamentClient usando WebSocket do browser.
 */

import type {
  ClientMessage,
  ServerMessage,
  TournamentState,
} from './protocol';
import type {
  TournamentClient,
  TournamentClientEvents,
  ConnectionStatus,
} from './TournamentClient';

export class TournamentWebSocketClient implements TournamentClient {
  private _status: ConnectionStatus = 'disconnected';
  private _playerId: string | null = null;
  private _tournamentState: TournamentState | null = null;
  private _events: Partial<TournamentClientEvents> = {};
  private _ws: WebSocket | null = null;
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 3;
  private _reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private _serverUrl: string | null = null;

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
    // Limpa tentativas anteriores
    this.clearReconnectTimeout();
    
    this._serverUrl = serverUrl;
    this._status = 'connecting';
    this._events.onConnectionStatusChange?.('connecting');

    return new Promise((resolve, reject) => {
      try {
        // Converte http/https para ws/wss se necessário
        let wsUrl = serverUrl;
        if (wsUrl.startsWith('http://')) {
          wsUrl = wsUrl.replace('http://', 'ws://');
        } else if (wsUrl.startsWith('https://')) {
          wsUrl = wsUrl.replace('https://', 'wss://');
        }
        
        // Adiciona /ws se não terminar em /ws
        if (!wsUrl.endsWith('/ws')) {
          wsUrl = wsUrl.replace(/\/?$/, '/ws');
        }

        this._ws = new WebSocket(wsUrl);

        this._ws.onopen = () => {
          this._status = 'connected';
          this._reconnectAttempts = 0;
          this._events.onConnectionStatusChange?.('connected');
          resolve();
        };

        this._ws.onclose = (event) => {
          const wasConnected = this._status === 'connected';
          this._status = 'disconnected';
          this._ws = null;
          
          if (wasConnected && this._reconnectAttempts < this._maxReconnectAttempts) {
            // Tentar reconectar
            this._events.onConnectionStatusChange?.('connecting', 'Ligação perdida, a reconectar...');
            this.scheduleReconnect();
          } else {
            this._events.onConnectionStatusChange?.('disconnected', event.reason || undefined);
          }
        };

        this._ws.onerror = () => {
          const errorMsg = 'Erro de ligação WebSocket';
          if (this._status === 'connecting') {
            this._status = 'error';
            this._events.onConnectionStatusChange?.('error', errorMsg);
            reject(new Error(errorMsg));
          }
        };

        this._ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as ServerMessage;
            this.handleServerMessage(message);
          } catch (e) {
            console.error('Erro ao processar mensagem do servidor:', e);
          }
        };
      } catch (e) {
        this._status = 'error';
        const errorMsg = e instanceof Error ? e.message : 'Erro desconhecido';
        this._events.onConnectionStatusChange?.('error', errorMsg);
        reject(e);
      }
    });
  }

  disconnect(): void {
    this.clearReconnectTimeout();
    this._reconnectAttempts = this._maxReconnectAttempts; // Previne reconexão
    
    if (this._ws) {
      this._ws.close(1000, 'Desligado pelo utilizador');
      this._ws = null;
    }
    
    this._status = 'disconnected';
    this._playerId = null;
    this._tournamentState = null;
    this._serverUrl = null;
    this._events.onConnectionStatusChange?.('disconnected');
  }

  send(message: ClientMessage): void {
    if (this._status !== 'connected' || !this._ws) {
      this._events.onMessage?.({
        type: 'error',
        code: 'NOT_CONNECTED',
        message: 'Não estás ligado ao servidor.',
      });
      return;
    }

    try {
      this._ws.send(JSON.stringify(message));
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e);
      this._events.onMessage?.({
        type: 'error',
        code: 'SEND_ERROR',
        message: 'Erro ao enviar mensagem.',
      });
    }
  }

  private handleServerMessage(message: ServerMessage): void {
    // Atualiza estado interno baseado na mensagem
    switch (message.type) {
      case 'welcome':
        this._playerId = message.playerId;
        this._tournamentState = message.tournamentState;
        break;
        
      case 'tournament_state_update':
        this._tournamentState = message.tournamentState;
        break;
    }

    // Notifica o handler
    this._events.onMessage?.(message);
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimeout();
    
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 10000);
    this._reconnectAttempts++;
    
    this._reconnectTimeout = setTimeout(async () => {
      if (this._serverUrl && this._status !== 'connected') {
        try {
          await this.connect(this._serverUrl);
          
          // Se tinha um playerId, tenta re-juntar (o servidor pode ter guardado a sessão)
          // Isto depende da implementação do servidor
          this._events.onMessage?.({
            type: 'info',
            message: 'Reconectado ao servidor!',
          });
        } catch {
          // Falha silenciosa, o connect já notifica o erro
        }
      }
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
  }
}
