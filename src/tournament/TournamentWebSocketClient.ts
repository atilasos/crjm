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

/**
 * Identificador aleatório da sessão do cliente. `crypto.randomUUID` só existe em
 * contextos seguros; na rede local da escola o site pode ser servido por HTTP.
 */
export function makeSessionId(cryptoApi: Partial<Crypto> | undefined = globalThis.crypto): string {
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    try { return cryptoApi.randomUUID(); } catch { /* contexto não seguro */ }
  }
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Tempo máximo de uma tentativa de recuperação (abrir o socket e receber `welcome`). */
const RECOVERY_ATTEMPT_TIMEOUT_MS = 8000;

/** Ajustes de tempo (os testes encurtam-nos). */
export const recoveryTiming = { attemptTimeoutMs: RECOVERY_ATTEMPT_TIMEOUT_MS, maxDelayMs: 10000, baseDelayMs: 1000 };
const RECOVERY_GAVE_UP = 'Não foi possível voltar a ligar. Carrega em «Reconectar».';
const LOST_WITHOUT_CODE = 'Ligação perdida. Volta a inscrever-te.';
const UNREACHABLE = 'Não foi possível ligar ao servidor. Confirma o endereço.';

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
  private readonly _deviceId = makeSessionId();
  private _reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private _attemptDeadline: ReturnType<typeof setTimeout> | null = null;
  private _serverUrl: string | null = null;
  /** Código confirmado pelo servidor (`welcome`). */
  private _reconnectionCode: string | null = null;
  /** Código pedido em `rejoin()` antes da confirmação (cobre uma queda antes do `welcome`). */
  private _pendingCode: string | null = null;
  /** À espera de `welcome` depois de uma reentrada: pedida pelo aluno ou automática. */
  private _joinMode: 'manual' | 'auto' | null = null;

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
    return this._reconnectionCode ?? this._pendingCode;
  }

  setEventHandlers(events: Partial<TournamentClientEvents>): void {
    this._events = { ...this._events, ...events };
  }

  async connect(serverUrl: string): Promise<void> {
    // Limpa tentativas anteriores e um socket anterior (ignorado a partir daqui).
    this.clearReconnectTimeout();
    const previous = this._ws;
    this._ws = null;
    if (previous) { try { previous.close(1000, 'Substituído'); } catch { /* já fechado */ } }

    this._serverUrl = serverUrl;
    this._status = 'connecting';
    this._events.onConnectionStatusChange?.('connecting');

    return new Promise((resolve, reject) => {
      // A promessa resolve-se uma única vez (abertura, erro ou fecho antes de abrir).
      let settled = false;
      const succeed = () => { if (!settled) { settled = true; resolve(); } };
      const fail = (error: Error) => { if (!settled) { settled = true; reject(error); } };
      let failure: string | undefined;
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

        const ws = new WebSocket(wsUrl);
        this._ws = ws;
        // Um handshake que nunca termina não deixa a página presa em «A ligar…».
        const handshake = setTimeout(() => {
          if (this._ws === ws && this._status === 'connecting') ws.close();
        }, recoveryTiming.attemptTimeoutMs);

        ws.onopen = () => {
          clearTimeout(handshake);
          if (this._ws !== ws) { ws.close(); fail(new Error('Ligação abandonada')); return; }
          this._status = 'connected';
          if (this._recovering || this._joinMode) {
            // Socket aberto ainda não é lugar recuperado: o sucesso é o `welcome`.
            this._events.onConnectionStatusChange?.('connecting', 'A voltar a entrar…');
          } else {
            this._reconnectAttempts = 0;
            this._events.onConnectionStatusChange?.('connected');
          }
          succeed();
        };

        ws.onclose = (event) => {
          clearTimeout(handshake);
          fail(new Error(failure ?? 'Ligação fechada antes de abrir'));
          if (this._ws !== ws) return; // socket substituído ou abandonado
          const wasConnected = this._status === 'connected';
          this._status = 'disconnected';
          this._ws = null;
          this.clearAttemptDeadline();

          // 4001: o mesmo aluno entrou noutro dispositivo — não disputar a sessão.
          const replacedElsewhere = event.code === 4001;
          const canRetry = this._reconnectAttempts < this._maxReconnectAttempts;
          const hasCode = Boolean(this._reconnectionCode ?? this._pendingCode);
          // Só é «queda» se houve ligação (ou já se estava a recuperar). Uma reentrada pedida
          // pelo aluno que nem chegou a abrir (endereço errado, servidor em baixo) falha logo.
          const dropped = wasConnected || this._recovering;
          // Continua a tentar enquanto recupera (uma tentativa falhada não põe fim à recuperação).
          if (dropped && hasCode && !replacedElsewhere && this._serverUrl && canRetry) {
            this._recovering = true;
            this._events.onConnectionStatusChange?.('connecting', 'Ligação perdida, a reconectar...');
            this.scheduleReconnect();
          } else {
            const gaveUp = this._recovering && !canRetry;
            const manualNeverOpened = this._joinMode === 'manual' && !wasConnected;
            this._recovering = false;
            this._joinMode = null;
            if (manualNeverOpened) this._pendingCode = null;
            const reason = gaveUp ? RECOVERY_GAVE_UP
              : (wasConnected && !hasCode && !replacedElsewhere) ? LOST_WITHOUT_CODE
              : manualNeverOpened ? UNREACHABLE
              : (failure ?? (event.reason || undefined));
            this._events.onConnectionStatusChange?.('disconnected', reason);
          }
        };

        ws.onerror = () => {
          const errorMsg = 'Erro de ligação WebSocket';
          if (this._ws !== ws) { fail(new Error(errorMsg)); return; } // tentativa abandonada
          if (this._status === 'connecting') {
            failure = errorMsg;
            // O estado mantém-se «a ligar» até ao fecho, que decide (erro final ou nova tentativa).
            fail(new Error(errorMsg));
          }
        };

        ws.onmessage = (event) => {
          if (this._ws !== ws) return;
          try {
            const message = JSON.parse(event.data) as ServerMessage;
            this.handleServerMessage(message);
          } catch (e) {
            console.error('Erro ao processar mensagem do servidor:', e);
          }
        };
      } catch (e) {
        // Endereço mal formado (ex.: sem ws:// ou http://): não há tentativa que o resolva.
        const errorMsg = e instanceof Error ? e.message : 'Erro desconhecido';
        this._ws = null;
        if (this._recovering) {
          this.stopRecovery(UNREACHABLE);
        } else {
          this.clearAttemptDeadline();
          this._joinMode = null;
          this._pendingCode = null;
          this._status = 'error';
          this._events.onConnectionStatusChange?.('error', errorMsg);
        }
        fail(e instanceof Error ? e : new Error(errorMsg));
      }
    });
  }

  disconnect(): void {
    this.clearReconnectTimeout();
    this.clearAttemptDeadline();
    this._recovering = false;
    this._reconnectAttempts = this._maxReconnectAttempts; // Previne reconexão

    const ws = this._ws;
    this._ws = null;
    if (ws) ws.close(1000, 'Desligado pelo utilizador');

    this._status = 'disconnected';
    this._playerId = null;
    this._tournamentState = null;
    this._serverUrl = null;
    this._reconnectionCode = null;
    this._pendingCode = null;
    this._joinMode = null;
    this._events.onConnectionStatusChange?.('disconnected');
    // Um cliente desligado não volta a falar com a página (eventos tardios do socket antigo).
    this._events = {};
  }

  /**
   * Reconecta ao torneio usando um código de reconexão.
   */
  async rejoin(serverUrl: string, reconnectionCode: string): Promise<void> {
    const code = reconnectionCode.toUpperCase().trim();
    this._pendingCode = code;
    this._joinMode = 'manual';
    this.armAttemptDeadline();
    await this.connect(serverUrl);
    this.send({ type: 'rejoin_tournament', reconnectionCode: code, deviceId: this._deviceId });
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
    switch (message.type) {
      case 'welcome': {
        const recovered = this._recovering || this._joinMode === 'auto';
        const awaited = recovered || this._joinMode !== null;
        this._playerId = message.playerId;
        this._tournamentState = message.tournamentState;
        this._reconnectionCode = message.reconnectionCode;
        this._pendingCode = null;
        this._recovering = false;
        this._joinMode = null;
        this._reconnectAttempts = 0;
        this.clearAttemptDeadline();
        // Só agora o lugar está recuperado: «ligado» depois do `welcome`, não do socket.
        if (awaited) this._events.onConnectionStatusChange?.('connected');
        this._events.onMessage?.(message);
        if (recovered) this._events.onMessage?.({ type: 'info', message: 'Reconectado ao servidor!' });
        return;
      }

      case 'error': {
        if (this._recovering) {
          const willRetry = message.code === 'INVALID_CODE' && this._reconnectAttempts < this._maxReconnectAttempts;
          // Código recusado que vai ser tentado de novo: não encher o registo de erros.
          if (!willRetry) this._events.onMessage?.(message);
          this.handleRecoveryError(message.code, message.message);
          return;
        }
        if (this._joinMode === 'manual'
          && (message.code === 'INVALID_CODE' || message.code === 'PLAYER_ELIMINATED')) {
          // Recusa definitiva da reentrada pedida pelo aluno: avisar e fechar, sem recuperação.
          this._events.onMessage?.(message);
          this._pendingCode = null;
          this.stopRecovery(message.message);
          return;
        }
        if (message.code === 'INVALID_CODE') this._pendingCode = null;
        break;
      }

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
  private handleRecoveryError(code: string, humanMessage: string): void {
    if (code === 'INVALID_CODE' && this._reconnectAttempts < this._maxReconnectAttempts) {
      this.clearAttemptDeadline();
      this.scheduleReconnect();
      return;
    }
    if (code === 'INVALID_CODE' || code === 'PLAYER_ELIMINATED' || code === 'SEAT_TAKEN') {
      this.stopRecovery(code === 'INVALID_CODE' ? RECOVERY_GAVE_UP : humanMessage);
    }
  }

  /** Fim definitivo da recuperação: fecha o socket sem voltar a tentar. */
  private stopRecovery(reason: string): void {
    this.clearReconnectTimeout();
    this.clearAttemptDeadline();
    this._recovering = false;
    this._joinMode = null;
    this._reconnectAttempts = this._maxReconnectAttempts;
    const ws = this._ws;
    this._ws = null; // o onclose deste socket é ignorado
    this._status = 'disconnected';
    if (ws) ws.close(1000, 'Recuperação terminada');
    this._events.onConnectionStatusChange?.('disconnected', reason);
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimeout();

    const delay = Math.min(recoveryTiming.baseDelayMs * Math.pow(2, this._reconnectAttempts), recoveryTiming.maxDelayMs);
    this._reconnectAttempts++;

    this._reconnectTimeout = setTimeout(async () => {
      if (!this._serverUrl || !this._recovering) return;
      const code = this._reconnectionCode ?? this._pendingCode;
      if (!code) {
        this.stopRecovery(LOST_WITHOUT_CODE);
        return;
      }
      this._joinMode = 'auto';
      // Uma tentativa que fica pendurada (handshake ou `welcome` que não chega) é abandonada.
      this.armAttemptDeadline();
      try {
        if (this._status !== 'connected') await this.connect(this._serverUrl);
        // Tentativa entretanto abandonada ou terminada: não enviar por um socket que já não é este.
        if (!this._recovering || this._status !== 'connected') return;
        // Voltar a ocupar o lugar com o código guardado; o sucesso é o `welcome`.
        this.send({ type: 'rejoin_tournament', reconnectionCode: code, auto: true, deviceId: this._deviceId });
      } catch {
        // O onclose do socket falhado agenda a tentativa seguinte.
      }
    }, delay);
  }

  private armAttemptDeadline(): void {
    this.clearAttemptDeadline();
    this._attemptDeadline = setTimeout(() => this.abandonAttempt(), recoveryTiming.attemptTimeoutMs);
  }

  /** Abandona a tentativa em curso e passa à seguinte (ou desiste no fim do orçamento). */
  private abandonAttempt(): void {
    this._attemptDeadline = null;
    if (!this._recovering && this._joinMode === null) return;
    if (this._joinMode === 'manual' && this._status !== 'connected') {
      // Reentrada pedida pelo aluno cujo socket nem abriu: erro imediato, o aluno corrige o endereço.
      const ws = this._ws;
      this._ws = null;
      this._joinMode = null;
      this._pendingCode = null;
      this._status = 'disconnected';
      if (ws) ws.close();
      this._events.onConnectionStatusChange?.('disconnected', UNREACHABLE);
      return;
    }
    // Socket aberto mas sem `welcome`: passa a recuperação automática com o mesmo código.
    this._recovering = true;
    this._events.onConnectionStatusChange?.('connecting', 'Ligação perdida, a reconectar...');
    const ws = this._ws;
    this._ws = null;
    this._status = 'disconnected';
    if (ws) ws.close(4002, 'Tentativa expirada');
    if (this._reconnectAttempts < this._maxReconnectAttempts) this.scheduleReconnect();
    else this.stopRecovery(RECOVERY_GAVE_UP);
  }

  private clearAttemptDeadline(): void {
    if (this._attemptDeadline) {
      clearTimeout(this._attemptDeadline);
      this._attemptDeadline = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
  }
}
