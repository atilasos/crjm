/**
 * Página de administração HTML para o servidor de torneios.
 * 
 * Esta página permite ao professor:
 * - Ver estado de todos os torneios
 * - Ver jogadores inscritos
 * - Iniciar e reiniciar torneios
 * - Acompanhar o bracket em tempo real (com visualização gráfica)
 * - Ver classificação dos jogadores (1º a 5º destacados)
 * - Ver logs de eventos
 * - Modo fullscreen para projeção
 */

export function getAdminPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - Torneio de Jogos Matemáticos</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      min-height: 100vh;
      color: white;
      padding: 20px;
    }
    
    body.fullscreen-mode {
      padding: 0;
      overflow: hidden;
    }
    
    .container {
      max-width: 1600px;
      margin: 0 auto;
    }
    
    body.fullscreen-mode .container {
      max-width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    header {
      text-align: center;
      padding: 20px 0 30px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 30px;
    }
    
    body.fullscreen-mode header {
      padding: 10px 0 15px;
      margin-bottom: 15px;
    }
    
    header h1 {
      font-size: 2rem;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    header p {
      color: rgba(255,255,255,0.6);
    }
    
    .status-bar {
      display: flex;
      gap: 20px;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 15px;
    }
    
    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      font-size: 0.9rem;
    }
    
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .status-dot.connected { background: #4ade80; box-shadow: 0 0 10px #4ade80; }
    .status-dot.disconnected { background: #f87171; animation: pulse 1s infinite; }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 5px currentColor; }
      50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
    }
    
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .grid.bracket-view {
      grid-template-columns: 3fr 1fr;
    }

    .grid.bracket-view .card:first-child {
      grid-row: 1 / 3;
    }

    .grid.bracket-view .card:nth-child(3) {
      grid-column: 1 / -1;
    }

    body.fullscreen-mode .grid {
      flex: 1;
      grid-template-columns: 4fr 1fr;
      overflow: hidden;
    }
    
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 20px;
      backdrop-filter: blur(10px);
    }
    
    body.fullscreen-mode .card {
      border-radius: 12px;
      padding: 15px;
      overflow: auto;
    }
    
    .card h2 {
      font-size: 1.2rem;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    
    .card h2 .title-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .card h2 .emoji {
      font-size: 1.5rem;
    }
    
    .card-actions {
      display: flex;
      gap: 8px;
    }
    
    .tournament-card {
      margin-bottom: 15px;
      padding: 15px;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
    }
    
    .tournament-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .tournament-name {
      font-weight: 600;
      font-size: 1.1rem;
    }
    
    .phase-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .phase-registration { background: #3b82f6; }
    .phase-running { background: #22c55e; animation: glow 2s infinite; color: #22c55e; }
    .phase-finished { background: #6b7280; }
    
    .player-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0;
    }
    
    .player-tag {
      padding: 6px 10px;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .player-tag.connected {
      border: 1px solid #4ade80;
    }

    .player-tag.disconnected {
      opacity: 0.7;
      border: 1px solid #f87171;
    }

    .player-tag.suspended {
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid #f59e0b;
    }

    .player-tag.eliminated {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid #ef4444;
      opacity: 0.5;
      text-decoration: line-through;
    }

    .player-code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.75rem;
      background: rgba(0,0,0,0.3);
      padding: 2px 5px;
      border-radius: 4px;
      cursor: pointer;
      user-select: all;
    }

    .player-code:hover {
      background: rgba(0,0,0,0.5);
    }

    .player-actions-inline {
      display: inline-flex;
      gap: 4px;
      margin-left: 4px;
    }

    .btn-tiny {
      padding: 2px 6px;
      font-size: 0.7rem;
      border-radius: 4px;
    }

    .btn-suspend {
      background: rgba(245, 158, 11, 0.3);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.5);
    }

    .btn-eliminate {
      background: rgba(239, 68, 68, 0.3);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.5);
    }

    .player-status-icon {
      font-size: 0.8rem;
    }
    
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    button:hover {
      transform: translateY(-1px);
    }
    
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
    }
    
    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
    }
    
    .btn-secondary {
      background: rgba(255,255,255,0.1);
      color: white;
      border: 1px solid rgba(255,255,255,0.2);
    }
    
    .btn-icon {
      padding: 6px 10px;
      font-size: 1rem;
    }
    
    /* ========== VISUAL BRACKET STYLES ========== */
    
    .bracket-visual {
      margin-top: 15px;
      overflow-x: auto;
      padding-bottom: 10px;
    }
    
    .bracket-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
      min-width: fit-content;
    }
    
    .bracket-section {
      margin-bottom: 0;
    }
    
    .bracket-section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    
    .bracket-title {
      font-size: 0.9rem;
      color: rgba(255,255,255,0.8);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
    }
    
    .bracket-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, rgba(255,255,255,0.3), transparent);
    }
    
    .rounds-container {
      display: flex;
      gap: 25px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .round {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 180px;
      flex: 1;
      max-width: 220px;
    }

    .round-header {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      text-align: center;
      letter-spacing: 1px;
      margin-bottom: 3px;
    }

    .match-card {
      background: rgba(255,255,255,0.08);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
      transition: all 0.2s ease;
      font-size: 0.85rem;
    }

    .match-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    
    .match-card.playing {
      border-color: #22c55e;
      box-shadow: 0 0 15px rgba(34, 197, 94, 0.3);
      animation: matchGlow 2s infinite;
    }
    
    @keyframes matchGlow {
      0%, 100% { box-shadow: 0 0 10px rgba(34, 197, 94, 0.3); }
      50% { box-shadow: 0 0 25px rgba(34, 197, 94, 0.5); }
    }
    
    .match-card.waiting {
      border-color: #f59e0b;
    }
    
    .match-card.finished {
      opacity: 0.7;
    }

    .match-card.bye {
      opacity: 0.6;
      border-style: dashed;
    }

    .match-card.bye .match-player {
      background: rgba(100, 100, 100, 0.2);
    }
    
    .match-actions {
      display: flex;
      gap: 4px;
      padding: 6px 8px;
      background: rgba(0,0,0,0.3);
      justify-content: center;
    }
    
    .match-list-actions {
      display: inline-flex;
      gap: 4px;
      margin-left: 8px;
    }
    
    .btn-restart-game, .btn-restart-match {
      padding: 4px 8px;
      font-size: 0.7rem;
      border-radius: 4px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    
    .btn-restart-game {
      background: rgba(59, 130, 246, 0.3);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.5);
    }
    
    .btn-restart-game:hover {
      background: rgba(59, 130, 246, 0.5);
    }
    
    .btn-restart-match {
      background: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.5);
    }
    
    .btn-restart-match:hover {
      background: rgba(239, 68, 68, 0.5);
    }
    
    .match-player {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: rgba(0,0,0,0.2);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .match-player:last-child {
      border-bottom: none;
    }

    .match-player.winner {
      background: rgba(34, 197, 94, 0.2);
    }

    .match-player.winner .player-name {
      color: #4ade80;
      font-weight: 600;
    }

    .player-name {
      font-size: 0.8rem;
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .player-name.tbd {
      color: rgba(255,255,255,0.4);
      font-style: italic;
      font-size: 0.75rem;
    }

    .player-name.pending-match {
      color: rgba(255,255,255,0.5);
      font-size: 0.7rem;
    }

    .player-score {
      font-weight: 700;
      font-size: 0.85rem;
      min-width: 18px;
      text-align: center;
    }
    
    .grand-final-section {
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 165, 0, 0.1));
      border: 2px solid rgba(255, 215, 0, 0.3);
      border-radius: 16px;
      padding: 20px;
      text-align: center;
    }
    
    .grand-final-section .bracket-title {
      color: #FFD700;
    }
    
    .grand-final-match {
      max-width: 280px;
      margin: 15px auto 0;
    }
    
    .champion-banner {
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
      border-radius: 16px;
      padding: 25px;
      text-align: center;
      margin-top: 20px;
      box-shadow: 0 10px 40px rgba(255, 215, 0, 0.3);
    }
    
    .champion-trophy {
      font-size: 4rem;
      margin-bottom: 10px;
      text-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }
    
    .champion-text {
      font-size: 0.9rem;
      color: rgba(0,0,0,0.6);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 8px;
    }
    
    .champion-name {
      font-size: 1.8rem;
      font-weight: 700;
      color: #1a1a2e;
    }
    
    /* ========== STANDINGS TABLE STYLES ========== */
    
    .standings-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    
    .standings-table th {
      text-align: left;
      padding: 12px 10px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(255,255,255,0.5);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    
    .standings-table td {
      padding: 12px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      vertical-align: middle;
    }
    
    .standings-table tr:hover td {
      background: rgba(255,255,255,0.03);
    }
    
    .standings-table tr.top-1 td {
      background: linear-gradient(90deg, rgba(255, 215, 0, 0.15), transparent);
    }
    
    .standings-table tr.top-2 td {
      background: linear-gradient(90deg, rgba(192, 192, 192, 0.12), transparent);
    }
    
    .standings-table tr.top-3 td {
      background: linear-gradient(90deg, rgba(205, 127, 50, 0.12), transparent);
    }
    
    .standings-table tr.top-4 td,
    .standings-table tr.top-5 td {
      background: linear-gradient(90deg, rgba(99, 102, 241, 0.1), transparent);
    }
    
    .position-cell {
      width: 60px;
      text-align: center;
    }
    
    .medal {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1.1rem;
      font-weight: 700;
    }
    
    .medal-gold {
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #1a1a2e;
      box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
    }
    
    .medal-silver {
      background: linear-gradient(135deg, #E8E8E8, #B8B8B8);
      color: #1a1a2e;
      box-shadow: 0 4px 15px rgba(192, 192, 192, 0.3);
    }
    
    .medal-bronze {
      background: linear-gradient(135deg, #CD7F32, #A0522D);
      color: white;
      box-shadow: 0 4px 15px rgba(205, 127, 50, 0.3);
    }
    
    .position-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    
    .position-4, .position-5 {
      background: rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
    }
    
    .position-other {
      color: rgba(255,255,255,0.4);
    }
    
    .player-info {
      display: flex;
      flex-direction: column;
    }
    
    .player-info .name {
      font-weight: 500;
    }
    
    .player-info .class {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.5);
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    
    .status-playing {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    
    .status-waiting {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
    }
    
    .status-eliminated {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
    
    .status-champion {
      background: rgba(255, 215, 0, 0.2);
      color: #FFD700;
    }
    
    /* ========== LOGS STYLES ========== */
    
    .logs-container {
      max-height: 400px;
      overflow-y: auto;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.8rem;
    }
    
    body.fullscreen-mode .logs-container {
      max-height: none;
      flex: 1;
    }
    
    .log-entry {
      padding: 6px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    
    .log-entry:hover {
      background: rgba(255,255,255,0.05);
    }
    
    .log-time {
      color: rgba(255,255,255,0.4);
      flex-shrink: 0;
    }
    
    .log-type {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      flex-shrink: 0;
      text-transform: uppercase;
    }
    
    .log-type.info { background: #3b82f6; }
    .log-type.game { background: #22c55e; }
    .log-type.match { background: #f59e0b; }
    .log-type.error { background: #ef4444; }
    
    .log-message {
      flex: 1;
      word-break: break-word;
    }
    
    .no-data {
      text-align: center;
      padding: 40px;
      color: rgba(255,255,255,0.4);
    }
    
    .refresh-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      z-index: 100;
    }
    
    body.fullscreen-mode .refresh-btn {
      bottom: 10px;
      right: 10px;
      width: 40px;
      height: 40px;
      font-size: 1.2rem;
    }
    
    .auto-refresh {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: rgba(255,255,255,0.6);
    }
    
    .auto-refresh input {
      width: 16px;
      height: 16px;
      accent-color: #22c55e;
    }
    
    /* ========== VIEW TOGGLE ========== */
    
    .view-toggle {
      display: flex;
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      overflow: hidden;
    }
    
    .view-toggle button {
      padding: 6px 12px;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.5);
      font-size: 0.8rem;
      border-radius: 0;
    }
    
    .view-toggle button.active {
      background: rgba(255,255,255,0.1);
      color: white;
    }
    
    .view-toggle button:hover:not(.active) {
      background: rgba(255,255,255,0.05);
      transform: none;
    }
    
    /* ========== FULLSCREEN OVERLAY ========== */
    
    .fullscreen-content {
      display: none;
    }
    
    body.fullscreen-mode .normal-content {
      display: none;
    }
    
    body.fullscreen-mode .fullscreen-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    .fullscreen-bracket {
      flex: 2;
      padding: 20px;
      overflow: auto;
    }
    
    .fullscreen-sidebar {
      width: 400px;
      background: rgba(0,0,0,0.3);
      padding: 20px;
      overflow: auto;
      border-left: 1px solid rgba(255,255,255,0.1);
    }
    
    /* ========== ACTIVE GAMES LIST ========== */

    .active-game-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .active-game-item:hover {
      background: rgba(255,255,255,0.1);
      border-color: rgba(34, 197, 94, 0.5);
      transform: translateX(3px);
    }

    .active-game-item.watching {
      border-color: #22c55e;
      background: rgba(34, 197, 94, 0.15);
    }

    .active-game-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .active-game-bracket {
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 8px;
      font-weight: 600;
    }

    .bracket-winners {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }

    .bracket-losers {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
    }

    .bracket-final {
      background: rgba(255, 215, 0, 0.2);
      color: #FFD700;
    }

    .active-game-players {
      font-weight: 600;
      font-size: 0.95rem;
    }

    .active-game-score {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
    }

    .active-game-score .score-value {
      font-weight: 700;
    }

    .active-game-score .score-p1 {
      color: #4ade80;
    }

    .active-game-score .score-p2 {
      color: #f87171;
    }

    .active-game-watching {
      font-size: 0.7rem;
      color: #22c55e;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* ========== RESPONSIVE ========== */

    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
      
      body.fullscreen-mode .grid {
        grid-template-columns: 1fr;
      }
      
      .fullscreen-sidebar {
        width: 100%;
        border-left: none;
        border-top: 1px solid rgba(255,255,255,0.1);
      }
      
      body.fullscreen-mode .fullscreen-content {
        flex-direction: column;
      }
      
      .rounds-container {
        flex-direction: column;
        gap: 20px;
      }
      
      .round {
        min-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🏆 Painel de Administração</h1>
      <p>Servidor de Torneios - Jogos Matemáticos</p>
      <div class="status-bar">
        <div class="status-item">
          <span class="status-dot" id="connectionStatus"></span>
          <span id="connectionText">A verificar...</span>
        </div>
        <div class="auto-refresh">
          <input type="checkbox" id="autoRefresh" checked>
          <label for="autoRefresh">Atualização automática (2s)</label>
        </div>
        <button class="btn-secondary btn-icon" onclick="toggleFullscreen()" title="Modo Projeção">
          <span id="fullscreenIcon">⛶</span>
        </button>
      </div>
    </header>
    
    <!-- Normal View -->
    <div class="normal-content">
      <div class="grid">
        <div class="card">
          <h2>
            <span class="title-left"><span class="emoji">🎮</span> Torneios Ativos</span>
            <div class="view-toggle">
              <button class="btn-primary btn-tiny" onclick="doShowCreateTournament()" style="margin-right: 10px; padding: 4px 8px;">➕ Criar</button>
              <button class="btn-secondary btn-tiny" onclick="doImportTournament()" style="margin-right: 10px; padding: 4px 8px;">📂 Importar</button>
              <button class="btn-secondary btn-tiny" onclick="doGeneratePdfFromUpload()" style="margin-right: 10px; padding: 4px 8px;">📄 PDF de Ficheiro</button>
              <button id="viewList" class="active" onclick="setView('list')">Lista</button>
              <button id="viewBracket" onclick="setView('bracket')">Bracket</button>
            </div>
          </h2>
          <div id="tournaments">
            <div class="no-data">A carregar...</div>
          </div>
        </div>
        
        <div class="card">
          <h2><span class="title-left"><span class="emoji">🏅</span> Classificação</span></h2>
          <div id="standings">
            <div class="no-data">A carregar...</div>
          </div>
        </div>
        
        <div class="card" id="active-games-card">
          <h2>
            <span class="title-left"><span class="emoji">🎮</span> Jogos em Curso</span>
            <span id="activeGamesCount" style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">(0)</span>
          </h2>
          <div id="active-games-list">
            <div class="no-data">Nenhum jogo em curso</div>
          </div>
        </div>

        <div class="card" id="game-viewer-card" style="display: none; grid-column: 1 / -1;">
          <h2>
            <span class="title-left"><span class="emoji">📺</span> Visualizar Jogo</span>
            <button class="btn-secondary btn-icon" onclick="closeGameViewer()" title="Fechar">✕</button>
          </h2>
          <iframe
            id="game-viewer-iframe"
            src=""
            style="width: 100%; height: 600px; border: none; border-radius: 8px; background: #1a1a2e;"
          ></iframe>
        </div>

        <div class="card" style="grid-column: 1 / -1;">
          <h2><span class="title-left"><span class="emoji">📋</span> Logs de Eventos</span></h2>
          <div class="logs-container" id="logs">
            <div class="no-data">A carregar...</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Fullscreen View -->
    <div class="fullscreen-content">
      <div class="fullscreen-bracket" id="fullscreenBracket">
        <div class="no-data">A carregar...</div>
      </div>
      <div class="fullscreen-sidebar">
        <h2 style="margin-bottom: 15px;"><span class="emoji">🏅</span> Classificação</h2>
        <div id="fullscreenStandings">
          <div class="no-data">A carregar...</div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Modal for Create Tournament -->
  <div id="createTournamentModal" class="modal" style="display: none;">
    <div class="modal-backdrop" onclick="hideCreateTournamentModal()"></div>
    <div class="modal-content">
      <h2>➕ Criar Torneio</h2>
      <div class="form-group">
        <label for="gameSelect">Jogo:</label>
        <select id="gameSelect" class="form-input">
          <option value="gatos-caes">Gatos & Cães</option>
          <option value="dominorio">Dominório</option>
          <option value="quelhas">Quelhas</option>
          <option value="produto">Produto</option>
          <option value="atari-go">Atari Go</option>
          <option value="nex">Nex</option>
        </select>
      </div>
      <div class="form-group">
        <label for="playerList">Lista de Jogadores (um por linha, formato: Nome ou Nome;Turma):</label>
        <textarea id="playerList" class="form-input" rows="10" placeholder="João Silva;5A
Maria Santos;5B
Pedro Costa"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-primary" onclick="doCreateTournament()">Criar Torneio</button>
        <button class="btn-secondary" onclick="hideCreateTournamentModal()">Cancelar</button>
      </div>
    </div>
  </div>
  
  <style>
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
    }
    .modal-content {
      position: relative;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 30px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal-content h2 {
      margin-bottom: 20px;
      color: white;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.9rem;
    }
    .form-input {
      width: 100%;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      font-size: 0.95rem;
      font-family: inherit;
    }
    .form-input:focus {
      outline: none;
      border-color: #22c55e;
    }
    .form-input option {
      background: #1a1a2e;
      color: white;
    }
    .modal-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 20px;
    }
  </style>
  
  <button class="btn-primary refresh-btn" onclick="refresh()" title="Atualizar">🔄</button>
  
  <script>
    let autoRefreshEnabled = true;
    let refreshInterval = null;
    let currentView = 'list';
    let isFullscreen = false;
    let cachedTournaments = [];
    
    const GAME_NAMES = {
      'gatos-caes': 'Gatos & Cães',
      'dominorio': 'Dominório',
      'quelhas': 'Quelhas',
      'produto': 'Produto',
      'atari-go': 'Atari Go',
      'nex': 'Nex',
    };
    
    // ========== DATA FETCHING ==========
    
    async function fetchData(endpoint) {
      try {
        const res = await fetch(endpoint);
        return await res.json();
      } catch (e) {
        console.error('Fetch error:', e);
        return null;
      }
    }
    
    async function postAction(endpoint) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
        });
        return await res.json();
      } catch (e) {
        console.error('Post error:', e);
        return null;
      }
    }
    
    async function refresh() {
      const health = await fetchData('/health');
      const statusDot = document.getElementById('connectionStatus');
      const statusText = document.getElementById('connectionText');
      
      if (health && health.status === 'ok') {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Servidor ativo';
      } else {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'Sem conexão';
        return;
      }
      
      const tournaments = await fetchData('/api/tournaments');
      cachedTournaments = tournaments || [];
      renderTournaments(cachedTournaments);
      renderAllStandings(cachedTournaments);
      
      if (isFullscreen) {
        renderFullscreenView(cachedTournaments);
      }
      
      const logs = await fetchData('/api/logs');
      renderLogs(logs || []);
    }
    
    // ========== VIEW MANAGEMENT ==========
    
    function setView(view) {
      currentView = view;
      document.getElementById('viewList').classList.toggle('active', view === 'list');
      document.getElementById('viewBracket').classList.toggle('active', view === 'bracket');
      // Toggle grid layout based on view
      document.querySelector('.normal-content .grid').classList.toggle('bracket-view', view === 'bracket');
      renderTournaments(cachedTournaments);
    }
    
    function toggleFullscreen() {
      isFullscreen = !isFullscreen;
      document.body.classList.toggle('fullscreen-mode', isFullscreen);
      document.getElementById('fullscreenIcon').textContent = isFullscreen ? '✕' : '⛶';
      
      if (isFullscreen) {
        renderFullscreenView(cachedTournaments);
      }
    }
    
    // ========== STANDINGS CALCULATION ==========
    
    function calculateStandings(tournament) {
      if (!tournament || !tournament.players) return [];
      
      const players = tournament.players;
      const state = tournament.state;
      const standings = [];
      
      // Track elimination order for ranking
      const eliminationOrder = [];
      
      // Go through all finished matches to determine elimination order
      const allMatches = [
        ...(state?.losersMatches || []),
        ...(state?.winnersMatches || []),
      ];
      
      // Sort matches by round to get elimination order
      const finishedLosersMatches = (state?.losersMatches || [])
        .filter(m => m.phase === 'finished' && m.winnerId)
        .sort((a, b) => a.round - b.round);
      
      // Get eliminated players from losers bracket (2 losses)
      for (const match of finishedLosersMatches) {
        const loserId = match.player1?.id === match.winnerId ? match.player2?.id : match.player1?.id;
        if (loserId && !eliminationOrder.includes(loserId)) {
          eliminationOrder.push(loserId);
        }
      }
      
      // Calculate wins and losses for each player from all finished matches
      const playerWins = new Map();
      const playerLosses = new Map();
      
      for (const p of players) {
        playerWins.set(p.id, 0);
        playerLosses.set(p.id, 0);
      }
      
      const allMatchesList = [
        ...(state?.winnersMatches || []),
        ...(state?.losersMatches || []),
        state?.grandFinal,
        state?.grandFinalReset,
      ].filter(Boolean);
      
      for (const match of allMatchesList) {
        // Only count matches that are finished and have a winner (not BYE matches)
        if (match.winnerId && match.result !== 'bye') {
          // Count the win
          playerWins.set(match.winnerId, (playerWins.get(match.winnerId) || 0) + 1);
          
          // Count the loss for the loser
          const loserId = match.player1?.id === match.winnerId 
            ? match.player2?.id 
            : match.player1?.id;
          if (loserId) {
            playerLosses.set(loserId, (playerLosses.get(loserId) || 0) + 1);
          }
        }
      }
      
      // Determine positions
      const positionedPlayers = new Map();
      
      // 1st place: Champion
      if (state?.championId) {
        positionedPlayers.set(state.championId, 1);
      }
      
      // 2nd place: Lost in Grand Final or Grand Final Reset
      if (state?.grandFinalReset && state.grandFinalReset.winnerId) {
        const loserId = state.grandFinalReset.player1?.id === state.grandFinalReset.winnerId 
          ? state.grandFinalReset.player2?.id 
          : state.grandFinalReset.player1?.id;
        if (loserId) positionedPlayers.set(loserId, 2);
      } else if (state?.grandFinal && state.grandFinal.winnerId) {
        const loserId = state.grandFinal.player1?.id === state.grandFinal.winnerId 
          ? state.grandFinal.player2?.id 
          : state.grandFinal.player1?.id;
        if (loserId && !positionedPlayers.has(loserId)) positionedPlayers.set(loserId, 2);
      }
      
      // 3rd, 4th, 5th: Only assign when tournament is finished (has champion)
      // Otherwise eliminated players shouldn't have positions yet
      if (state?.championId) {
        const remainingEliminated = eliminationOrder
          .filter(id => !positionedPlayers.has(id))
          .reverse();

        let nextPosition = 3;
        for (const playerId of remainingEliminated) {
          if (nextPosition <= 5) {
            positionedPlayers.set(playerId, nextPosition);
            nextPosition++;
          } else {
            break;
          }
        }
      }
      
      // Build standings array
      for (const player of players) {
        const position = positionedPlayers.get(player.id) || null;
        const wins = playerWins.get(player.id) || 0;
        const losses = playerLosses.get(player.id) || 0;
        
        // Determine status
        let status = 'waiting';
        if (state?.championId === player.id) {
          status = 'champion';
        } else if (losses >= 2) {
          status = 'eliminated';
        } else {
          // Check if currently playing
          const currentMatch = allMatchesList.find(m => 
            m && m.phase === 'playing' && 
            (m.player1?.id === player.id || m.player2?.id === player.id)
          );
          if (currentMatch) {
            status = 'playing';
          }
        }
        
        standings.push({
          position,
          player,
          wins,
          losses,
          status,
          eliminationIndex: eliminationOrder.indexOf(player.id),
        });
      }
      
      // Sort:
      // 1. Players with position (1-5) first, sorted by position
      // 2. Active players (playing/waiting) sorted by wins desc, then losses asc
      // 3. Eliminated players without position sorted by wins desc, then losses asc
      standings.sort((a, b) => {
        // Both have positions - sort by position
        if (a.position !== null && b.position !== null) {
          return a.position - b.position;
        }
        // Only one has position - that one comes first
        if (a.position !== null) return -1;
        if (b.position !== null) return 1;

        // Check if players are active (not eliminated)
        const aActive = a.status === 'playing' || a.status === 'waiting';
        const bActive = b.status === 'playing' || b.status === 'waiting';

        // Active players come before eliminated
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;

        // Within same group (both active or both eliminated), sort by wins desc, then losses asc
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses;

        // If still tied, sort alphabetically
        return a.player.name.localeCompare(b.player.name, 'pt');
      });
      
      return standings;
    }
    
    // ========== TOURNAMENT RENDERING ==========
    
    function renderTournaments(tournaments) {
      const container = document.getElementById('tournaments');
      
      if (tournaments.length === 0) {
        container.innerHTML = '<div class="no-data">' +
          'Nenhum torneio ativo. Os jogadores podem criar um ao inscrever-se.' +
          '<div style="margin-top: 15px;"><button class="btn-secondary" onclick="doImportTournament()">📂 Importar Torneio</button></div>' +
        '</div>';
        return;
      }
      
      container.innerHTML = tournaments.map(t => {
        const gameName = GAME_NAMES[t.gameId] || t.gameId;
        const phaseClass = 'phase-' + t.phase;
        const phaseText = t.phase === 'registration' ? 'Inscrições' : 
                         t.phase === 'running' ? 'A decorrer' : 'Terminado';
        
        const players = t.players.map(p => {
          let statusClass = p.status === 'eliminated' ? 'eliminated' :
                           p.status === 'suspended' ? 'suspended' :
                           p.isConnected ? 'connected' : 'disconnected';
          let statusIcon = p.status === 'eliminated' ? '❌' :
                          p.status === 'suspended' ? '⏸️' :
                          p.isConnected ? '🟢' : '🔴';
          let actionBtns = '';
          if (p.status !== 'eliminated' && t.phase === 'running') {
            actionBtns = '<span class="player-actions-inline">' +
              (p.status !== 'suspended' ? '<button class="btn-tiny btn-suspend" onclick="suspendPlayer(\\'' + t.gameId + '\\', \\'' + p.id + '\\', event)" title="Suspender">⏸</button>' : '') +
              '<button class="btn-tiny btn-eliminate" onclick="eliminatePlayer(\\'' + t.gameId + '\\', \\'' + p.id + '\\', event)" title="Eliminar">✕</button>' +
            '</span>';
          }
          return '<span class="player-tag ' + statusClass + '">' +
            '<span class="player-status-icon">' + statusIcon + '</span>' +
            p.name + (p.classId ? ' (' + p.classId + ')' : '') +
            (p.losses > 0 ? ' [' + p.losses + 'D]' : '') +
            ' <span class="player-code" onclick="copyCode(\\'' + p.reconnectionCode + '\\', event)" title="Clique para copiar">' + p.reconnectionCode + '</span>' +
            actionBtns +
          '</span>';
        }).join('');
        
        const canStart = t.phase === 'registration' && t.players.length >= 2;
        
        let bracketHtml = '';
        if (t.state && t.phase !== 'registration') {
          bracketHtml = currentView === 'bracket' 
            ? renderVisualBracket(t.state, t.gameId) 
            : renderListBracket(t.state, t.gameId);
        }
        
        return '<div class="tournament-card">' +
          '<div class="tournament-header">' +
            '<span class="tournament-name">' + gameName + '</span>' +
            '<span class="phase-badge ' + phaseClass + '">' + phaseText + '</span>' +
          '</div>' +
          '<div class="player-list">' + (players || '<span class="no-data">Nenhum jogador inscrito</span>') + '</div>' +
          bracketHtml +
          '<div class="actions">' +
            '<button class="btn-primary" onclick="startTournament(\\'' + t.gameId + '\\')" ' + (canStart ? '' : 'disabled') + '>▶️ Iniciar</button>' +
            '<button class="btn-danger" onclick="resetTournament(\\'' + t.gameId + '\\')" >🔄 Reiniciar</button>' +
            '<button class="btn-secondary" onclick="doExportTournament(\\'' + t.gameId + '\\')">' + '💾 Exportar</button>' +
            '<button class="btn-secondary" onclick="doImportTournament(\\'' + t.gameId + '\\')">' + '📂 Importar</button>' +
            '<button class="btn-secondary" onclick="doExportCards(\\'' + t.gameId + '\\')">' + '🎴 Cartões</button>' +
            '<button class="btn-secondary" onclick="doExportStatePdf(\\'' + t.gameId + '\\')">' + '📄 PDF</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    
    // ========== VISUAL BRACKET RENDERING ==========
    
    function renderVisualBracket(state, gameId) {
      let html = '<div class="bracket-visual"><div class="bracket-container">';

      // Winners Bracket
      if (state.winnersMatches && state.winnersMatches.length > 0) {
        const rounds = groupMatchesByRound(state.winnersMatches);
        html += '<div class="bracket-section">' +
          '<div class="bracket-section-header">' +
            '<span class="bracket-title" style="color: #4ade80;">Winners Bracket</span>' +
            '<div class="bracket-line"></div>' +
          '</div>' +
          '<div class="rounds-container">';

        for (const [round, matches] of Object.entries(rounds).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
          html += '<div class="round">' +
            '<div class="round-header">Ronda ' + round + '</div>' +
            matches.map(m => renderMatchCard(m, gameId)).join('') +
          '</div>';
        }

        html += '</div></div>';
      }

      // Losers Bracket - group by phase first (playing/waiting first), then by round
      if (state.losersMatches && state.losersMatches.length > 0) {
        // Sort: playing first, then waiting, then finished
        const sortedMatches = [...state.losersMatches].sort((a, b) => {
          const phaseOrder = { playing: 0, waiting: 1, finished: 2 };
          return (phaseOrder[a.phase] || 2) - (phaseOrder[b.phase] || 2);
        });

        const rounds = groupMatchesByRound(sortedMatches);
        html += '<div class="bracket-section">' +
          '<div class="bracket-section-header">' +
            '<span class="bracket-title" style="color: #f59e0b;">Losers Bracket</span>' +
            '<div class="bracket-line"></div>' +
          '</div>' +
          '<div class="rounds-container">';

        for (const [round, matches] of Object.entries(rounds).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
          html += '<div class="round">' +
            '<div class="round-header">Ronda ' + round + '</div>' +
            matches.map(m => renderMatchCard(m, gameId)).join('') +
          '</div>';
        }

        html += '</div></div>';
      }

      // Grand Final
      if (state.grandFinal || state.grandFinalReset) {
        html += '<div class="grand-final-section">' +
          '<div class="bracket-title">🏆 Grand Final</div>';

        if (state.grandFinal) {
          html += '<div class="grand-final-match">' + renderMatchCard(state.grandFinal, gameId) + '</div>';
        }

        if (state.grandFinalReset) {
          html += '<div style="margin-top: 15px; font-size: 0.8rem; color: rgba(255,255,255,0.6);">Reset</div>' +
            '<div class="grand-final-match">' + renderMatchCard(state.grandFinalReset, gameId) + '</div>';
        }

        html += '</div>';
      }
      
      // Champion Banner
      if (state.championId) {
        const champion = state.players?.find(p => p.id === state.championId);
        html += '<div class="champion-banner">' +
          '<div class="champion-trophy">🏆</div>' +
          '<div class="champion-text">Campeão</div>' +
          '<div class="champion-name">' + (champion?.name || 'Desconhecido') + '</div>' +
        '</div>';
      }
      
      html += '</div></div>';
      return html;
    }
    
    function groupMatchesByRound(matches) {
      const rounds = {};
      for (const match of matches) {
        const round = match.round || 1;
        if (!rounds[round]) rounds[round] = [];
        rounds[round].push(match);
      }
      return rounds;
    }
    
    function renderMatchCard(match, gameId) {
      // Determinar nomes/labels para jogadores
      let p1Label, p2Label, p1Class, p2Class;

      if (match.player1) {
        p1Label = match.player1.name;
        p1Class = '';
      } else if (match.sourceLabel1) {
        p1Label = match.sourceLabel1;
        p1Class = 'pending-match';
      } else {
        p1Label = 'A aguardar...';
        p1Class = 'tbd';
      }

      if (match.player2) {
        p2Label = match.player2.name;
        p2Class = '';
      } else if (match.sourceLabel2) {
        p2Label = match.sourceLabel2;
        p2Class = 'pending-match';
      } else {
        p2Label = 'A aguardar...';
        p2Class = 'tbd';
      }

      const p1Score = match.score?.player1Wins || 0;
      const p2Score = match.score?.player2Wins || 0;
      const p1Winner = match.winnerId && match.winnerId === match.player1?.id;
      const p2Winner = match.winnerId && match.winnerId === match.player2?.id;
      const showRestartButtons = match.phase === 'playing' || match.phase === 'waiting';
      const isBye = match.result === 'bye';

      // Match number header
      const matchNumberHeader = match.matchNumber
        ? '<div style="font-size: 0.65rem; color: rgba(255,255,255,0.4); text-align: center; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">' +
            'Jogo #' + match.matchNumber + (isBye ? ' (BYE)' : '') +
          '</div>'
        : '';

      let restartButtons = '';
      if (showRestartButtons && gameId && !isBye) {
        restartButtons = '<div class="match-actions">' +
          '<button class="btn-restart-game" onclick="restartGame(\\'' + gameId + '\\', \\'' + match.id + '\\', event)" title="Reiniciar só o jogo atual (mantém score)">🔄 Jogo</button>' +
          '<button class="btn-restart-match" onclick="restartMatchFull(\\'' + gameId + '\\', \\'' + match.id + '\\', event)" title="Reiniciar match completo (0-0)">🔁 Match</button>' +
        '</div>';
      }

      return '<div class="match-card ' + match.phase + (isBye ? ' bye' : '') + '">' +
        matchNumberHeader +
        '<div class="match-player ' + (p1Winner ? 'winner' : '') + '">' +
          '<span class="player-name ' + p1Class + '" title="' + p1Label + '">' + p1Label + '</span>' +
          '<span class="player-score">' + p1Score + '</span>' +
        '</div>' +
        '<div class="match-player ' + (p2Winner ? 'winner' : '') + '">' +
          '<span class="player-name ' + p2Class + '" title="' + p2Label + '">' + p2Label + '</span>' +
          '<span class="player-score">' + p2Score + '</span>' +
        '</div>' +
        restartButtons +
      '</div>';
    }
    
    // ========== LIST BRACKET RENDERING (original) ==========
    
    function renderListBracket(state, gameId) {
      let html = '<div class="bracket">';
      
      if (state.winnersMatches && state.winnersMatches.length > 0) {
        html += '<div class="bracket-section">' +
          '<div class="bracket-title">Winners Bracket</div>' +
          state.winnersMatches.map(m => renderListMatch(m, gameId)).join('') +
        '</div>';
      }
      
      if (state.losersMatches && state.losersMatches.length > 0) {
        html += '<div class="bracket-section">' +
          '<div class="bracket-title">Losers Bracket</div>' +
          state.losersMatches.map(m => renderListMatch(m, gameId)).join('') +
        '</div>';
      }
      
      if (state.grandFinal) {
        html += '<div class="bracket-section">' +
          '<div class="bracket-title">Grand Final</div>' +
          renderListMatch(state.grandFinal, gameId) +
        '</div>';
      }
      
      if (state.grandFinalReset) {
        html += '<div class="bracket-section">' +
          '<div class="bracket-title">Grand Final Reset</div>' +
          renderListMatch(state.grandFinalReset, gameId) +
        '</div>';
      }
      
      if (state.championId) {
        const champion = state.players?.find(p => p.id === state.championId);
        html += '<div class="bracket-section" style="text-align:center; padding: 15px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 8px;">' +
          '<div style="font-size: 2rem;">🏆</div>' +
          '<div style="font-weight: 600;">Campeão: ' + (champion?.name || 'Desconhecido') + '</div>' +
        '</div>';
      }
      
      html += '</div>';
      return html;
    }
    
    function renderListMatch(match, gameId) {
      const p1 = match.player1 ? match.player1.name : 'TBD';
      const p2 = match.player2 ? match.player2.name : 'TBD';
      const score = (match.score?.player1Wins || 0) + '-' + (match.score?.player2Wins || 0);
      const p1Winner = match.winnerId === match.player1?.id;
      const p2Winner = match.winnerId === match.player2?.id;
      const showRestartButtons = match.phase === 'playing' || match.phase === 'waiting';
      
      let restartButtons = '';
      if (showRestartButtons && gameId) {
        restartButtons = '<div class="match-list-actions">' +
          '<button class="btn-restart-game btn-tiny" onclick="restartGame(\\'' + gameId + '\\', \\'' + match.id + '\\', event)" title="Reiniciar só o jogo atual">🔄</button>' +
          '<button class="btn-restart-match btn-tiny" onclick="restartMatchFull(\\'' + gameId + '\\', \\'' + match.id + '\\', event)" title="Reiniciar match (0-0)">🔁</button>' +
        '</div>';
      }
      
      return '<div class="match ' + match.phase + '">' +
        '<div class="match-players">' +
          '<span class="' + (p1Winner ? 'winner' : '') + '">' + p1 + '</span>' +
          ' vs ' +
          '<span class="' + (p2Winner ? 'winner' : '') + '">' + p2 + '</span>' +
        '</div>' +
        '<div class="match-score">' + score + '</div>' +
        restartButtons +
      '</div>';
    }
    
    // ========== STANDINGS RENDERING ==========
    
    function renderAllStandings(tournaments) {
      const container = document.getElementById('standings');
      const fullscreenContainer = document.getElementById('fullscreenStandings');
      
      if (tournaments.length === 0) {
        const noData = '<div class="no-data">Nenhum torneio ativo.</div>';
        container.innerHTML = noData;
        fullscreenContainer.innerHTML = noData;
        return;
      }
      
      let html = '';
      
      for (const t of tournaments) {
        if (t.phase === 'registration') {
          html += '<div style="margin-bottom: 20px;">' +
            '<div style="font-weight: 600; margin-bottom: 10px;">' + (GAME_NAMES[t.gameId] || t.gameId) + '</div>' +
            '<div class="no-data" style="padding: 20px;">Torneio ainda não iniciado</div>' +
          '</div>';
          continue;
        }
        
        const standings = calculateStandings(t);
        html += renderStandingsTable(t.gameId, standings);
      }
      
      container.innerHTML = html;
      fullscreenContainer.innerHTML = html;
    }
    
    function renderStandingsTable(gameId, standings) {
      if (standings.length === 0) {
        return '<div class="no-data">Sem dados de classificação.</div>';
      }
      
      let html = '<div style="margin-bottom: 25px;">' +
        '<div style="font-weight: 600; margin-bottom: 10px; font-size: 1.1rem;">' + (GAME_NAMES[gameId] || gameId) + '</div>' +
        '<table class="standings-table">' +
          '<thead><tr>' +
            '<th class="position-cell">Pos</th>' +
            '<th>Jogador</th>' +
            '<th style="text-align:center;">V</th>' +
            '<th style="text-align:center;">D</th>' +
            '<th>Estado</th>' +
          '</tr></thead>' +
          '<tbody>';
      
      for (const s of standings) {
        const posClass = s.position ? 'top-' + s.position : '';
        html += '<tr class="' + posClass + '">' +
          '<td class="position-cell">' + renderPosition(s.position) + '</td>' +
          '<td>' +
            '<div class="player-info">' +
              '<span class="name">' + s.player.name + '</span>' +
              (s.player.classId ? '<span class="class">' + s.player.classId + '</span>' : '') +
            '</div>' +
          '</td>' +
          '<td style="text-align:center; font-weight: 600; color: #4ade80;">' + s.wins + '</td>' +
          '<td style="text-align:center; font-weight: 600; color: #f87171;">' + s.losses + '</td>' +
          '<td>' + renderStatus(s.status) + '</td>' +
        '</tr>';
      }
      
      html += '</tbody></table></div>';
      return html;
    }
    
    function renderPosition(position) {
      if (!position) return '<span class="position-other">-</span>';
      
      if (position === 1) {
        return '<span class="medal medal-gold">🥇</span>';
      } else if (position === 2) {
        return '<span class="medal medal-silver">🥈</span>';
      } else if (position === 3) {
        return '<span class="medal medal-bronze">🥉</span>';
      } else if (position === 4) {
        return '<span class="position-number position-4">4º</span>';
      } else if (position === 5) {
        return '<span class="position-number position-5">5º</span>';
      }
      
      return '<span class="position-other">' + position + 'º</span>';
    }
    
    function renderStatus(status) {
      const statusMap = {
        'champion': { text: '🏆 Campeão', class: 'status-champion' },
        'playing': { text: '🎮 A jogar', class: 'status-playing' },
        'waiting': { text: '⏳ A aguardar', class: 'status-waiting' },
        'eliminated': { text: '❌ Eliminado', class: 'status-eliminated' },
      };
      
      const s = statusMap[status] || statusMap['waiting'];
      return '<span class="status-badge ' + s.class + '">' + s.text + '</span>';
    }
    
    // ========== FULLSCREEN VIEW ==========
    
    function renderFullscreenView(tournaments) {
      const container = document.getElementById('fullscreenBracket');
      
      if (tournaments.length === 0) {
        container.innerHTML = '<div class="no-data">Nenhum torneio ativo.</div>';
        return;
      }
      
      let html = '';
      
      for (const t of tournaments) {
        const gameName = GAME_NAMES[t.gameId] || t.gameId;
        
        html += '<div style="margin-bottom: 30px;">' +
          '<h2 style="font-size: 1.5rem; margin-bottom: 20px;">' +
            '<span style="margin-right: 10px;">🎮</span>' + gameName +
          '</h2>';
        
        if (t.state && t.phase !== 'registration') {
          html += renderVisualBracket(t.state, t.gameId);
        } else {
          html += '<div class="no-data">Torneio ainda não iniciado</div>';
        }
        
        html += '</div>';
      }
      
      container.innerHTML = html;
      renderAllStandings(tournaments);
    }
    
    // ========== LOGS RENDERING ==========
    
    function renderLogs(logs) {
      const container = document.getElementById('logs');
      
      if (logs.length === 0) {
        container.innerHTML = '<div class="no-data">Nenhum evento registado.</div>';
        return;
      }
      
      const recentLogs = logs.slice(-50).reverse();
      
      container.innerHTML = recentLogs.map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString('pt-PT');
        return '<div class="log-entry">' +
          '<span class="log-time">' + time + '</span>' +
          '<span class="log-type ' + log.type + '">' + log.type + '</span>' +
          '<span class="log-message">' + log.message + '</span>' +
        '</div>';
      }).join('');
    }
    
    // ========== TOURNAMENT ACTIONS ==========

    async function startTournament(gameId) {
      if (!confirm('Iniciar o torneio de ' + (GAME_NAMES[gameId] || gameId) + '?')) return;

      const result = await postAction('/api/tournaments/' + gameId + '/start');
      if (result && result.success) {
        alert('Torneio iniciado!');
      } else {
        alert('Erro ao iniciar torneio: ' + (result?.error || 'Erro desconhecido'));
      }
      refresh();
    }

    async function resetTournament(gameId) {
      if (!confirm('Reiniciar o torneio de ' + (GAME_NAMES[gameId] || gameId) + '? Todos os dados serão perdidos!')) return;

      const result = await postAction('/api/tournaments/' + gameId + '/reset');
      if (result && result.success) {
        alert('Torneio reiniciado!');
      } else {
        alert('Erro ao reiniciar torneio: ' + (result?.error || 'Erro desconhecido'));
      }
      refresh();
    }

    async function doExportTournament(gameId) {
      try {
        const res = await fetch('/api/tournaments/' + gameId + '/export');
        
        if (!res.ok) {
          const error = await res.json();
          alert('Erro ao exportar: ' + (error.error || 'Erro desconhecido'));
          return;
        }
        
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'torneio-' + gameId + '-' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Torneio exportado com sucesso!');
      } catch (e) {
        alert('Erro ao exportar: ' + e.message);
      }
    }

    function doImportTournament(gameId) {
      // Create a file input dynamically
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          
          // Validate basic structure
          if (!data.version || !data.gameId || !data.players) {
            alert('Ficheiro inválido: não parece ser um export de torneio.');
            return;
          }
          
          const targetGameId = gameId || data.gameId;
          
          if (gameId && data.gameId !== gameId) {
            if (!confirm('O ficheiro é de um torneio de ' + (GAME_NAMES[data.gameId] || data.gameId) + ', mas estás a importar para ' + (GAME_NAMES[gameId] || gameId) + '. Continuar?')) {
              return;
            }
          }
          
          const gameName = GAME_NAMES[targetGameId] || targetGameId;
          if (!confirm('Importar torneio de ' + gameName + ' com ' + data.players.length + ' jogadores? O torneio atual será substituído.')) {
            return;
          }
          
          const res = await fetch('/api/tournaments/' + targetGameId + '/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });
          
          const result = await res.json();
          
          if (result.success) {
            alert('Torneio importado com sucesso! ' + result.players + ' jogadores restaurados.');
            refresh();
          } else {
            alert('Erro ao importar: ' + (result.error || 'Erro desconhecido'));
          }
        } catch (e) {
          alert('Erro ao ler ficheiro: ' + e.message);
        }
      };
      input.click();
    }

    // ========== PDF EXPORT FUNCTIONS ==========

    function generateTournamentPdf(data, filename) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const gameName = GAME_NAMES[data.gameId] || data.gameId;
      const timestamp = new Date().toLocaleString('pt-PT');
      
      // Page 1: Bracket
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('Torneio: ' + gameName, 105, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('Gerado em: ' + timestamp, 105, 22, { align: 'center' });
      
      let y = 35;
      
      // Winners Bracket
      if (data.state && data.state.winnersMatches && data.state.winnersMatches.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(34, 197, 94);
        doc.text('Winners Bracket', 10, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
        
        const rounds = {};
        data.state.winnersMatches.forEach(m => {
          if (!rounds[m.round]) rounds[m.round] = [];
          rounds[m.round].push(m);
        });
        
        Object.keys(rounds).sort((a, b) => a - b).forEach(round => {
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text('Ronda ' + round, 10, y);
          y += 5;
          doc.setFont(undefined, 'normal');
          rounds[round].forEach(m => {
            const p1 = m.player1?.name || 'TBD';
            const p2 = m.player2?.name || 'TBD';
            const score = m.score ? m.score[0] + '-' + m.score[1] : '-';
            doc.text('  ' + p1 + ' vs ' + p2 + ' (' + score + ')', 10, y);
            y += 5;
            if (y > 270) { doc.addPage(); y = 20; }
          });
          y += 3;
        });
      }
      
      // Losers Bracket
      if (data.state && data.state.losersMatches && data.state.losersMatches.length > 0) {
        y += 5;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(245, 158, 11);
        doc.text('Losers Bracket', 10, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
        
        const rounds = {};
        data.state.losersMatches.forEach(m => {
          if (!rounds[m.round]) rounds[m.round] = [];
          rounds[m.round].push(m);
        });
        
        Object.keys(rounds).sort((a, b) => a - b).forEach(round => {
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text('Ronda ' + round, 10, y);
          y += 5;
          doc.setFont(undefined, 'normal');
          rounds[round].forEach(m => {
            const p1 = m.player1?.name || 'TBD';
            const p2 = m.player2?.name || 'TBD';
            const score = m.score ? m.score[0] + '-' + m.score[1] : '-';
            doc.text('  ' + p1 + ' vs ' + p2 + ' (' + score + ')', 10, y);
            y += 5;
            if (y > 270) { doc.addPage(); y = 20; }
          });
          y += 3;
        });
      }
      
      // Page 2: Standings
      doc.addPage();
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('Classifica\u00e7\u00e3o - ' + gameName, 105, 15, { align: 'center' });
      
      y = 30;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Pos', 10, y);
      doc.text('Nome', 30, y);
      doc.text('Turma', 120, y);
      doc.text('Derrotas', 160, y);
      y += 2;
      doc.line(10, y, 200, y);
      y += 6;
      
      doc.setFont(undefined, 'normal');
      const sortedPlayers = [...data.players].sort((a, b) => {
        if (a.status === 'eliminated' && b.status !== 'eliminated') return 1;
        if (b.status === 'eliminated' && a.status !== 'eliminated') return -1;
        return (a.losses || 0) - (b.losses || 0);
      });
      
      sortedPlayers.forEach((p, i) => {
        const pos = (i + 1) + '.';
        doc.text(pos, 10, y);
        doc.text(p.name || 'Desconhecido', 30, y);
        doc.text(p.classId || '-', 120, y);
        doc.text(String(p.losses || 0), 165, y);
        y += 7;
        if (y > 270) { doc.addPage(); y = 20; }
      });
      
      doc.save(filename);
    }

    function doExportCards(gameId) {
      const tournament = cachedTournaments.find(t => t.gameId === gameId);
      if (!tournament || !tournament.players || tournament.players.length === 0) {
        alert('Sem jogadores para exportar.');
        return;
      }
      
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const gameName = GAME_NAMES[gameId] || gameId;
      
      const cardWidth = 90;
      const cardHeight = 60;
      const margin = 10;
      const cardsPerRow = 2;
      const cardsPerCol = 4;
      const cardsPerPage = cardsPerRow * cardsPerCol;
      
      tournament.players.forEach((player, index) => {
        if (index > 0 && index % cardsPerPage === 0) {
          doc.addPage();
        }
        
        const pageIndex = index % cardsPerPage;
        const col = pageIndex % cardsPerRow;
        const row = Math.floor(pageIndex / cardsPerRow);
        
        const x = margin + col * (cardWidth + margin);
        const y = margin + row * (cardHeight + margin);
        
        // Card border
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3);
        
        // Game name header
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(gameName, x + cardWidth / 2, y + 8, { align: 'center' });
        
        // Player name
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        const displayName = player.name.length > 18 ? player.name.substring(0, 16) + '...' : player.name;
        doc.text(displayName, x + cardWidth / 2, y + 22, { align: 'center' });
        
        // Class ID
        if (player.classId) {
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(80, 80, 80);
          doc.text('Turma: ' + player.classId, x + cardWidth / 2, y + 32, { align: 'center' });
        }
        
        // Reconnection code
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(player.reconnectionCode || '---', x + cardWidth / 2, y + 48, { align: 'center' });
        
        // Label
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text('C\u00f3digo de Reconex\u00e3o', x + cardWidth / 2, y + 55, { align: 'center' });
      });
      
      doc.save('cartoes-' + gameId + '.pdf');
    }

    async function doExportStatePdf(gameId) {
      const tournament = cachedTournaments.find(t => t.gameId === gameId);
      if (!tournament) {
        alert('Torneio n\u00e3o encontrado.');
        return;
      }
      
      generateTournamentPdf(tournament, 'torneio-' + gameId + '.pdf');
    }

    function doGeneratePdfFromUpload() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          
          if (!data.version || !data.gameId || !data.players) {
            alert('Ficheiro inv\u00e1lido: n\u00e3o parece ser um export de torneio.');
            return;
          }
          
          const gameName = GAME_NAMES[data.gameId] || data.gameId;
          generateTournamentPdf(data, 'torneio-' + data.gameId + '-arquivo.pdf');
          alert('PDF gerado com sucesso!');
        } catch (e) {
          alert('Erro ao processar ficheiro: ' + e.message);
        }
      };
      input.click();
    }

    // ========== TOURNAMENT CREATION ==========

    function doShowCreateTournament() {
      document.getElementById('createTournamentModal').style.display = 'flex';
      document.getElementById('playerList').value = '';
    }

    function hideCreateTournamentModal() {
      document.getElementById('createTournamentModal').style.display = 'none';
    }

    async function doCreateTournament() {
      const gameId = document.getElementById('gameSelect').value;
      const playerListText = document.getElementById('playerList').value.trim();
      
      if (!playerListText) {
        alert('Por favor, insira pelo menos um jogador.');
        return;
      }
      
      // Parse player list (one per line, format: Name or Name;Class)
      const lines = playerListText.split('\\n').filter(line => line.trim());
      const players = lines.map(line => {
        const parts = line.split(';').map(p => p.trim());
        return {
          name: parts[0] || '',
          classId: parts[1] || undefined
        };
      }).filter(p => p.name);
      
      if (players.length === 0) {
        alert('Nenhum jogador v\u00e1lido encontrado.');
        return;
      }
      
      if (players.length < 2) {
        alert('S\u00e3o necess\u00e1rios pelo menos 2 jogadores para criar um torneio.');
        return;
      }
      
      const gameName = GAME_NAMES[gameId] || gameId;
      if (!confirm('Criar torneio de ' + gameName + ' com ' + players.length + ' jogadores?')) {
        return;
      }
      
      try {
        const res = await fetch('/api/tournaments/' + gameId + '/create-with-players', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ players }),
        });
        
        const result = await res.json();
        
        if (result.success) {
          hideCreateTournamentModal();
          alert('Torneio criado com sucesso!\\n\\n' + result.players.length + ' jogadores registados.\\n\\nUsa o bot\u00e3o \"Cart\u00f5es\" para exportar os c\u00f3digos de reconex\u00e3o.');
          refresh();
        } else {
          alert('Erro ao criar torneio: ' + (result.error || 'Erro desconhecido'));
        }
      } catch (e) {
        alert('Erro de comunica\u00e7\u00e3o: ' + e.message);
      }
    }

    // ========== PLAYER MANAGEMENT ==========

    function copyCode(code, event) {
      event.stopPropagation();
      navigator.clipboard.writeText(code).then(() => {
        const el = event.target;
        const originalText = el.textContent;
        el.textContent = '✓ Copiado!';
        el.style.background = 'rgba(34, 197, 94, 0.3)';
        setTimeout(() => {
          el.textContent = originalText;
          el.style.background = '';
        }, 1500);
      }).catch(err => {
        alert('Erro ao copiar: ' + err);
      });
    }

    async function suspendPlayer(gameId, playerId, event) {
      event.stopPropagation();
      if (!confirm('Suspender este jogador? O match será pausado.')) return;

      const result = await postAction('/api/tournaments/' + gameId + '/players/' + playerId + '/suspend');
      if (result && result.success) {
        // Success, refresh will update
      } else {
        alert('Erro ao suspender jogador: ' + (result?.error || 'Erro desconhecido'));
      }
      refresh();
    }

    async function eliminatePlayer(gameId, playerId, event) {
      event.stopPropagation();
      if (!confirm('Eliminar este jogador? O oponente ganhará automaticamente todos os matches pendentes.')) return;

      const result = await postAction('/api/tournaments/' + gameId + '/players/' + playerId + '/eliminate');
      if (result && result.success) {
        // Success, refresh will update
      } else {
        alert('Erro ao eliminar jogador: ' + (result?.error || 'Erro desconhecido'));
      }
      refresh();
    }

    // ========== MATCH RESTART ACTIONS ==========

    async function restartGame(gameId, matchId, event) {
      event.stopPropagation();
      if (!confirm('Reiniciar o jogo atual deste match?\\n\\nO score do match será mantido, mas o jogo atual recomeça do zero.\\nOs jogadores terão de clicar "Estou pronto" novamente.')) return;

      const result = await postAction('/api/tournaments/' + gameId + '/matches/' + matchId + '/restart-game');
      if (result && result.success) {
        alert('✅ Jogo reiniciado! Os jogadores foram notificados.');
      } else {
        alert('Erro ao reiniciar jogo: ' + (result?.error || 'Erro desconhecido'));
      }
      refresh();
    }

    async function restartMatchFull(gameId, matchId, event) {
      event.stopPropagation();
      if (!confirm('Reiniciar este match COMPLETO?\\n\\n⚠️ O score voltará a 0-0!\\nTodos os jogos deste confronto serão perdidos.\\nOs jogadores terão de clicar "Estou pronto" novamente.')) return;

      const result = await postAction('/api/tournaments/' + gameId + '/matches/' + matchId + '/restart-match');
      if (result && result.success) {
        alert('✅ Match reiniciado (0-0)! Os jogadores foram notificados.');
      } else {
        alert('Erro ao reiniciar match: ' + (result?.error || 'Erro desconhecido'));
      }
      refresh();
    }
    
    // ========== AUTO-REFRESH ==========
    
    document.getElementById('autoRefresh').addEventListener('change', (e) => {
      autoRefreshEnabled = e.target.checked;
      if (autoRefreshEnabled) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });
    
    function startAutoRefresh() {
      if (refreshInterval) clearInterval(refreshInterval);
      refreshInterval = setInterval(refresh, 2000);
    }
    
    function stopAutoRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    }
    
    // ========== KEYBOARD SHORTCUTS ==========
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') {
          toggleFullscreen();
        }
      }
    });
    
    // ========== SPECTATOR WEBSOCKET ==========

    let spectatorWs = null;
    let activeGames = [];
    let watchingMatchId = null;

    function connectSpectatorWs() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '/ws';

      spectatorWs = new WebSocket(wsUrl);

      spectatorWs.onopen = () => {
        console.log('[Spectator] WebSocket connected');
      };

      spectatorWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'active_games_list') {
            activeGames = msg.games || [];
            renderActiveGamesList();
          }
        } catch (e) {
          console.error('[Spectator] Error parsing message:', e);
        }
      };

      spectatorWs.onerror = (error) => {
        console.error('[Spectator] WebSocket error:', error);
      };

      spectatorWs.onclose = () => {
        console.log('[Spectator] WebSocket closed, reconnecting in 3s...');
        setTimeout(connectSpectatorWs, 3000);
      };
    }

    function renderActiveGamesList() {
      const container = document.getElementById('active-games-list');
      const countEl = document.getElementById('activeGamesCount');

      countEl.textContent = '(' + activeGames.length + ')';

      if (activeGames.length === 0) {
        container.innerHTML = '<div class="no-data" style="padding: 15px;">Nenhum jogo em curso</div>';
        return;
      }

      container.innerHTML = activeGames.map(game => {
        const bracketClass = game.bracket === 'winners' ? 'bracket-winners' :
                            game.bracket === 'losers' ? 'bracket-losers' : 'bracket-final';
        const bracketLabel = game.bracket === 'winners' ? 'Winners' :
                            game.bracket === 'losers' ? 'Losers' :
                            game.bracket === 'grandFinal' ? 'Grand Final' : 'Final Reset';
        const isWatching = watchingMatchId === game.matchId;

        return '<div class="active-game-item' + (isWatching ? ' watching' : '') + '" onclick="watchGame(\\'' + game.matchId + '\\')">' +
          '<div class="active-game-header">' +
            '<span class="active-game-bracket ' + bracketClass + '">' + bracketLabel + ' R' + game.round + '</span>' +
            '<span style="font-size: 0.75rem; color: rgba(255,255,255,0.4);">Jogo ' + game.gameNumber + '</span>' +
          '</div>' +
          '<div class="active-game-players">' + game.player1Name + ' vs ' + game.player2Name + '</div>' +
          '<div class="active-game-score">' +
            '<span class="score-value score-p1">' + game.score.player1Wins + '</span>' +
            '<span style="color: rgba(255,255,255,0.3);">-</span>' +
            '<span class="score-value score-p2">' + game.score.player2Wins + '</span>' +
            (isWatching ? '<span class="active-game-watching"><span>👁️</span> A observar</span>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }

    function watchGame(matchId) {
      const iframe = document.getElementById('game-viewer-iframe');
      const card = document.getElementById('game-viewer-card');

      // Get current tournament gameId from cached tournaments
      let gameId = 'gatos-caes'; // default
      if (cachedTournaments.length > 0) {
        const runningTournament = cachedTournaments.find(t => t.phase === 'running');
        if (runningTournament) {
          gameId = runningTournament.gameId;
        } else {
          gameId = cachedTournaments[0].gameId;
        }
      }

      watchingMatchId = matchId;
      iframe.src = '/admin/spectator?matchId=' + matchId + '&gameId=' + gameId;
      card.style.display = 'block';

      // Scroll to iframe
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Re-render list to show watching indicator
      renderActiveGamesList();
    }

    function closeGameViewer() {
      const card = document.getElementById('game-viewer-card');
      const iframe = document.getElementById('game-viewer-iframe');

      card.style.display = 'none';
      iframe.src = '';
      watchingMatchId = null;

      // Re-render list to remove watching indicator
      renderActiveGamesList();
    }

    // ========== INIT ==========

    connectSpectatorWs();
    refresh();
    startAutoRefresh();
  </script>
</body>
</html>`;
}
