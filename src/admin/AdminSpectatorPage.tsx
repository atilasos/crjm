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
  const urlParams = new URLSearchParams(window.location.search);
  const initialMatchId = urlParams.get('matchId');
  const gameIdParam = urlParams.get('gameId') as GameId | null;

  const [activeGames, setActiveGames] = useState<ActiveGameInfo[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(initialMatchId);
  const [matchState, setMatchState] = useState<SpectatorMatchState | null>(null);
  const [gameId, setGameId] = useState<GameId | null>(gameIdParam);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Conexao WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connect = () => {
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
            // Actualiza se for o match selecionado ou se nenhum está selecionado ainda
            if (msg.matchId === selectedMatchId || !selectedMatchId) {
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
              if (!selectedMatchId) {
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
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Atualizar matchState quando selectedMatchId muda
  useEffect(() => {
    if (selectedMatchId && matchState && matchState.matchId !== selectedMatchId) {
      // Limpar estado antigo ao trocar de match
      setMatchState(null);
    }
  }, [selectedMatchId]);

  // Renderizar tabuleiro baseado no gameId
  const renderBoard = () => {
    if (!matchState || !matchState.gameState || !gameId) {
      return (
        <div className="flex items-center justify-center h-64 text-white/50">
          <p>A aguardar dados do jogo...</p>
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
      case 'nex':
        return <NexBoard state={state} {...commonProps} />;
      default:
        return <div className="text-white/50">Jogo desconhecido: {gameId}</div>;
    }
  };

  const getBracketLabel = (bracket: BracketType | 'grandFinal' | 'grandFinalReset') => {
    switch (bracket) {
      case 'winners': return 'Winners';
      case 'losers': return 'Losers';
      case 'grandFinal': return 'Grande Final';
      case 'grandFinalReset': return 'Final Reset';
      default: return bracket;
    }
  };

  const getBracketColor = (bracket: BracketType | 'grandFinal' | 'grandFinalReset') => {
    switch (bracket) {
      case 'winners': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'losers': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'grandFinal':
      case 'grandFinalReset': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Admin Spectator</h1>
        <div className={`px-2 py-1 rounded text-xs ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {connected ? 'Conectado' : 'Desconectado'}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Lista de jogos */}
        <div className="lg:col-span-1 bg-gray-800/50 rounded-xl p-3 border border-white/10">
          <h2 className="text-sm font-semibold mb-3 text-white/70">Jogos em Curso ({activeGames.length})</h2>

          {activeGames.length === 0 ? (
            <p className="text-white/40 text-sm">Nenhum jogo em curso</p>
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
                      ? 'bg-blue-500/20 border border-blue-500/50'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getBracketColor(game.bracket)}`}>
                      {getBracketLabel(game.bracket)}
                    </span>
                    <span className="text-[10px] text-white/40">R{game.round}</span>
                  </div>
                  <div className="text-sm font-medium truncate">
                    {game.player1Name} vs {game.player2Name}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs">
                      <span className="text-green-400">{game.score.player1Wins}</span>
                      <span className="text-white/30"> - </span>
                      <span className="text-red-400">{game.score.player2Wins}</span>
                    </span>
                    <span className="text-[10px] text-white/40">Jogo {game.gameNumber}</span>
                  </div>
                  {selectedMatchId === game.matchId && (
                    <div className="text-[10px] text-blue-400 mt-1">A observar</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Visualizador do jogo */}
        <div className="lg:col-span-3 bg-gray-800/50 rounded-xl p-4 border border-white/10">
          {selectedMatchId && matchState ? (
            <>
              {/* Info do match */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded border ${getBracketColor(matchState.bracket)}`}>
                      {getBracketLabel(matchState.bracket)} - Ronda {matchState.round}
                    </span>
                    <span className="text-xs text-white/40">Jogo {matchState.gameNumber}</span>
                  </div>
                  <h3 className="text-lg font-bold">
                    {matchState.player1Name} vs {matchState.player2Name}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    <span className="text-green-400">{matchState.score.player1Wins}</span>
                    <span className="text-white/30 mx-2">-</span>
                    <span className="text-red-400">{matchState.score.player2Wins}</span>
                  </div>
                  {matchState.whoseTurn && (
                    <div className="text-xs text-white/50">
                      Vez de: {matchState.whoseTurn === 'player1' ? matchState.player1Name : matchState.player2Name}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabuleiro */}
              <div className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-xl p-4">
                {renderBoard()}
              </div>

              {/* Aviso de modo espectador */}
              <div className="mt-3 text-center text-xs text-white/40 bg-white/5 py-2 rounded-lg">
                Modo espectador - apenas a observar
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-white/40">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p>Seleciona um jogo para observar</p>
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
  createRoot(rootEl).render(<AdminSpectatorPage />);
}
