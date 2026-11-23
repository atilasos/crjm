/**
 * Cliente WebSocket real para ligar ao servidor de torneios.
 * 
 * Implementa a interface TournamentClient usando WebSocket do browser.
 */

import { tournamentStateFromUpdate } from './protocol';
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
  /** ~2 minutos de tentativas (1, 2, 4, 8 e depois 10 s) para cortes de rede ou reinícios. */
  private _maxReconnectAttempts = 15;
  /** A recuperar o lugar depois de uma queda; termina com `welcome` ou ao desistir. */
  private _recovering = false;
  /** Identifica esta sessão do cliente perante o servidor (distingue outro dispositivo). */
  private readonly _deviceId = crypto.randomUUID();
  private _reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private _serverUrl: string | null = null;
  private _reconnectionCode: string | null = null;

  get status(): ConnectionStatus {
    return this._status;
  }

  get playerId(): string | null {
    return this._playerId;
  }

  get tournamentState(): TournamentState | null {
    return this._tournamentState;
  }

  get reconnectionCode(): string | null {
    return this._reconnectionCode;
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
          // As tentativas só voltam a zero com `welcome` (lugar recuperado), não com o socket aberto.
          if (!this._recovering) this._reconnectAttempts = 0;
          this._events.onConnectionStatusChange?.('connected');
          resolve();
        };

        this._ws.onclose = (event) => {
          const wasConnected = this._status === 'connected';
          this._status = 'disconnected';
          this._ws = null;
          
          // 4001: o mesmo aluno entrou noutro dispositivo — não disputar a sessão.
          const replacedElsewhere = event.code === 4001;
          // Continua a tentar enquanto recupera (uma tentativa falhada não põe fim à recuperação).
          if ((wasConnected || this._recovering) && !replacedElsewhere && this._serverUrl
            && this._reconnectAttempts < this._maxReconnectAttempts) {
            this._recovering = true;
            this._events.onConnectionStatusChange?.('connecting', 'Ligação perdida, a reconectar...');
            this.scheduleReconnect();
          } else {
            this._recovering = false;
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
    this._recovering = false;
    this._reconnectAttempts = this._maxReconnectAttempts; // Previne reconexão

    if (this._ws) {
      this._ws.close(1000, 'Desligado pelo utilizador');
      this._ws = null;
    }

    this._status = 'disconnected';
    this._playerId = null;
    this._tournamentState = null;
    this._serverUrl = null;
    this._reconnectionCode = null;
    this._events.onConnectionStatusChange?.('disconnected');
  }

  /**
   * Reconecta ao torneio usando um código de reconexão.
   */
  async rejoin(serverUrl: string, reconnectionCode: string): Promise<void> {
    await this.connect(serverUrl);

    // Enviar mensagem de rejoin
    this.send({
      type: 'rejoin_tournament',
      reconnectionCode: reconnectionCode.toUpperCase().trim(),
      deviceId: this._deviceId,
    });
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

    // Inscrição e reentrada identificam sempre esta sessão do cliente.
    if ((message.type === 'join_tournament' || message.type === 'rejoin_tournament') && !message.deviceId) {
      message = { ...message, deviceId: this._deviceId };
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
      case 'welcome': {
        const recovered = this._recovering;
        this._playerId = message.playerId;
        this._tournamentState = message.tournamentState;
        this._reconnectionCode = message.reconnectionCode;
        this._recovering = false;
        this._reconnectAttempts = 0;
        this._events.onMessage?.(message);
        if (recovered) this._events.onMessage?.({ type: 'info', message: 'Reconectado ao servidor!' });
        return;
      }

      case 'error':
        if (this._recovering) this.handleRecoveryError(message.code);
        break;

      case 'tournament_state_update':
        this._tournamentState = tournamentStateFromUpdate(message);
        break;
    }

    // Notifica o handler
    this._events.onMessage?.(message);
  }

  /**
   * Durante a recuperação, um código recusado pode ser temporário (servidor reiniciado
   * antes de o professor restaurar o torneio): volta a tentar até ao limite. Eliminado
   * ou lugar ocupado noutro dispositivo põem fim à recuperação.
   */
  private handleRecoveryError(code: string): void {
    if (code === 'INVALID_CODE' && this._reconnectAttempts < this._maxReconnectAttempts) {
      this.scheduleReconnect();
      return;
    }
    if (code === 'INVALID_CODE' || code === 'PLAYER_ELIMINATED' || code === 'SEAT_TAKEN') {
      this.clearReconnectTimeout();
      this._recovering = false;
      this._events.onConnectionStatusChange?.('disconnected', code);
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimeout();

    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 10000);
    this._reconnectAttempts++;

    this._reconnectTimeout = setTimeout(async () => {
      if (!this._serverUrl || !this._recovering) return;
      try {
        if (this._status !== 'connected') await this.connect(this._serverUrl);
        // Voltar a ocupar o lugar com o código guardado; o sucesso é o `welcome`.
        if (this._reconnectionCode) {
          this.send({ type: 'rejoin_tournament', reconnectionCode: this._reconnectionCode, auto: true, deviceId: this._deviceId });
        } else {
          this._recovering = false;
        }
      } catch {
        // O onclose do socket falhado agenda a tentativa seguinte.
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
