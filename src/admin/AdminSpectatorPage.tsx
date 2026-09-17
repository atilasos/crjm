import { LanguageProvider, LanguageSelector, useTranslation } from '../i18n/LanguageProvider';
import { ThemeToggle } from '../components/ThemeToggle';
/**
 * Página de espectador para o painel de administração.
 * Mostra jogos em curso e permite visualizar tabuleiros em tempo real.
 */

import { createRoot } from 'react-dom/client';
import { useState, useEffect, useRef } from 'react';
import type { GameId, BracketType, MatchScore } from '../tournament/protocol';
import {
  GatosCaesBoard,
  DominorioBoard,
  QuelhasBoard,
  ProdutoBoard,
  AtariGoBoard,
  NexBoard,
  FaiscaBoard,
} from '../tournament/GameBoards';

// Tipos para os estados
interface ActiveGameInfo {
  gameId: GameId;
  matchId: string;
  bracket: BracketType | 'grandFinal' | 'grandFinalReset';
  round: number;
  player1Name: string;
  player2Name: string;
  score: MatchScore;
  gameNumber: number;
}

interface SpectatorMatchState {
  gameId: GameId;
  matchId: string;
  gameNumber: number;
  gameState: unknown;
  bracket: BracketType | 'grandFinal' | 'grandFinalReset';
  round: number;
  player1Name: string;
  player2Name: string;
  score: MatchScore;
  whoseTurn: 'player1' | 'player2' | null;
}

// Componente principal
function AdminSpectatorPage() {
  const { t, setLocale } = useTranslation();
  const urlParams = new URLSearchParams(window.location.search);
  const initialMatchId = urlParams.get('matchId');
  const gameIdParam = urlParams.get('gameId') as GameId | null;

  const [activeGames, setActiveGames] = useState<ActiveGameInfo[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(initialMatchId);
  const [matchState, setMatchState] = useState<SpectatorMatchState | null>(null);
  const [gameId, setGameId] = useState<GameId | null>(gameIdParam);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMatchRef = useRef(selectedMatchId);
  selectedMatchRef.current = selectedMatchId;
  const statesRef = useRef(new Map<string, SpectatorMatchState>());
  const wsRef = useRef<WebSocket | null>(null);

  // Conexao WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'active_games_list') {
            setActiveGames(msg.games || []);
          }

          if (msg.type === 'spectator_game_state') {
            statesRef.current.set(msg.matchId, msg);
            if (msg.matchId === selectedMatchRef.current || !selectedMatchRef.current) {
              setMatchState({
                gameId: msg.gameId,
                matchId: msg.matchId,
                gameNumber: msg.gameNumber,
                gameState: msg.gameState,
                bracket: msg.bracket,
                round: msg.round,
                player1Name: msg.player1Name,
                player2Name: msg.player2Name,
                score: msg.score,
                whoseTurn: msg.whoseTurn,
              });
              // Se não havia match selecionado, seleciona este
              if (!selectedMatchRef.current) {
                selectedMatchRef.current = msg.matchId;
                setSelectedMatchId(msg.matchId);
              }
              setGameId(msg.gameId);
            }
          }
        } catch (e) {
          console.error('Erro ao processar mensagem:', e);
        }
      };

      ws.onerror = () => {
        setError('Erro na conexao WebSocket');
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
        // Tentar reconectar após 3 segundos
        if (!disposed) retry = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(retry);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    setMatchState(selectedMatchId ? statesRef.current.get(selectedMatchId) ?? null : null);
  }, [selectedMatchId]);

  useEffect(() => {
    const lang = new URLSearchParams(window.location.search).get('lang');
    if (lang === 'pt-PT' || lang === 'en' || lang === 'ne') setLocale(lang);
  }, [setLocale]);

  // Renderizar tabuleiro baseado no gameId
  const renderBoard = () => {
    if (!matchState || !matchState.gameState || !gameId) {
      return (
        <div className="flex items-center justify-center h-64 [color:var(--tinta-suave)]">
          <p>{t('A aguardar dados do jogo...')}</p>
        </div>
      );
    }

    const state = matchState.gameState as any;
    const commonProps = {
      isMyTurn: false,
      myRole: 'jogador1' as const,
      onMove: () => {},
    };

    switch (gameId) {
      case 'gatos-caes':
        return <GatosCaesBoard state={state} {...commonProps} />;
      case 'dominorio':
        return <DominorioBoard state={state} {...commonProps} />;
      case 'quelhas':
        return <QuelhasBoard state={state} {...commonProps} />;
      case 'produto':
        return <ProdutoBoard state={state} {...commonProps} />;
      case 'atari-go':
        return <AtariGoBoard state={state} {...commonProps} />;
      case 'faisca':
        return <FaiscaBoard state={state} interactive={false} onMove={() => {}} />;
      case 'nex':
        return <NexBoard state={state} {...commonProps} />;
      default:
        return <div className="[color:var(--tinta-suave)]">{t('Jogo desconhecido:')} {gameId}</div>;
    }
  };

  const getBracketLabel = (bracket: BracketType | 'grandFinal' | 'grandFinalReset') => {
    switch (bracket) {
      case 'winners': return t('Winners Bracket');
      case 'losers': return t('Losers Bracket');
      case 'grandFinal': return t('Grande Final');
      case 'grandFinalReset': return t('Final Reset');
      default: return bracket;
    }
  };

  const getBracketColor = (bracket: BracketType | 'grandFinal' | 'grandFinalReset') => {
    switch (bracket) {
      case 'winners': return '[background:color-mix(in_srgb,var(--sucesso)_12%,transparent)] [color:var(--sucesso)] [border-color:var(--sucesso)]';
      case 'losers': return '[background:color-mix(in_srgb,var(--jogo-nex)_12%,transparent)] [color:var(--jogo-nex)] [border-color:var(--jogo-nex)]';
      case 'grandFinal':
      case 'grandFinalReset': return '[background:color-mix(in_srgb,var(--ouro)_12%,transparent)] [color:var(--ouro)] [border-color:var(--ouro)]';
      default: return '[background:var(--fundo)] [color:var(--tinta-suave)] [border-color:var(--linha)]';
    }
  };

  return (
    <div className="min-h-screen [background:var(--fundo)] [color:var(--tinta)] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 items-center"><LanguageSelector /><ThemeToggle /></div>
        <h1 className="text-lg font-bold">{t('Admin Spectator')}</h1>
        <div className={`px-2 py-1 rounded text-xs ${connected ? '[background:color-mix(in_srgb,var(--sucesso)_15%,transparent)] [color:var(--sucesso)]' : '[background:color-mix(in_srgb,var(--perigo)_15%,transparent)] [color:var(--perigo)]'}`}>
          {t(connected ? 'Conectado' : 'Desconectado')}
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-3 mb-4 border [border-color:var(--perigo)] [background:color-mix(in_srgb,var(--perigo)_10%,transparent)] [color:var(--perigo)] text-sm">
          {t(error)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Lista de jogos */}
        <div className="lg:col-span-1 rounded-xl p-3 border [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
          <h2 className="text-sm font-semibold mb-3 [color:var(--tinta-suave)]">{t('Jogos em Curso')} ({activeGames.length})</h2>

          {activeGames.length === 0 ? (
            <p className="[color:var(--tinta-suave)] text-sm">{t('Nenhum jogo em curso')}</p>
          ) : (
            <div className="space-y-2">
              {activeGames.map((game) => (
                <button
                  key={game.matchId}
                  onClick={() => {
                    setSelectedMatchId(game.matchId);
                    setGameId(game.gameId);
                  }}
                  className={`w-full text-left p-2 rounded-lg transition-all ${
                    selectedMatchId === game.matchId
                      ? 'border [border-color:var(--ouro)] [background:color-mix(in_srgb,var(--ouro)_15%,transparent)]'
                      : 'border [background:var(--fundo)] [border-color:var(--linha)] hover:[border-color:var(--tinta-suave)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getBracketColor(game.bracket)}`}>
                      {getBracketLabel(game.bracket)}
                    </span>
                    <span className="text-[10px] [color:var(--tinta-suave)]">R{game.round}</span>
                  </div>
                  <div className="text-sm font-medium truncate">
                    {game.player1Name} vs {game.player2Name}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs">
                      <span className="[color:var(--sucesso)]">{game.score.player1Wins}</span>
                      <span className="[color:var(--tinta-suave)]"> - </span>
                      <span className="[color:var(--perigo)]">{game.score.player2Wins}</span>
                    </span>
                    <span className="text-[10px] [color:var(--tinta-suave)]">{t('Jogo')} {game.gameNumber}</span>
                  </div>
                  {selectedMatchId === game.matchId && (
                    <div className="text-[10px] [color:var(--ouro)] mt-1">{t('A observar')}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Visualizador do jogo */}
        <div className="lg:col-span-3 rounded-xl p-4 border [background:var(--painel)] [border-color:var(--linha)] [box-shadow:var(--sombra)]">
          {selectedMatchId && matchState ? (
            <>
              {/* Info do match */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded border ${getBracketColor(matchState.bracket)}`}>
                      {getBracketLabel(matchState.bracket)} - {t('Ronda')} {matchState.round}
                    </span>
                    <span className="text-xs [color:var(--tinta-suave)]">{t('Jogo')} {matchState.gameNumber}</span>
                  </div>
                  <h3 className="text-lg font-bold">
                    {matchState.player1Name} vs {matchState.player2Name}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    <span className="[color:var(--sucesso)]">{matchState.score.player1Wins}</span>
                    <span className="[color:var(--tinta-suave)] mx-2">-</span>
                    <span className="[color:var(--perigo)]">{matchState.score.player2Wins}</span>
                  </div>
                  {matchState.whoseTurn && (
                    <div className="text-xs [color:var(--tinta-suave)]">
                      {t('Vez de:')} {matchState.whoseTurn === 'player1' ? matchState.player1Name : matchState.player2Name}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabuleiro */}
              <div className="rounded-xl p-4 border [background:var(--fundo)] [border-color:var(--linha)]">
                {renderBoard()}
              </div>

              {/* Aviso de modo espectador */}
              <div className="mt-3 text-center text-xs [color:var(--tinta-suave)] border [border-color:var(--linha)] [background:var(--fundo)] py-2 rounded-lg">
                {t('Modo espectador - apenas a observar')}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 [color:var(--tinta-suave)]">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p>{t('Seleciona um jogo para observar')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Mount
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<LanguageProvider><AdminSpectatorPage /></LanguageProvider>);
}
