/**
 * Página de administração HTML para o servidor de torneios.
 * 
 * Esta página permite ao professor:
 * - Ver estado de todos os torneios
 * - Ver jogadores inscritos
 * - Iniciar e reiniciar torneios
 * - Acompanhar o bracket em tempo real
 * - Ver logs de eventos
 */

export function getAdminPageHtml(adminKey: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - Torneio de Jogos Matemáticos</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      color: white;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      padding: 20px 0 30px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 30px;
    }
    
    header h1 {
      font-size: 2rem;
      margin-bottom: 10px;
    }
    
    header p {
      color: rgba(255,255,255,0.6);
    }
    
    .status-bar {
      display: flex;
      gap: 20px;
      justify-content: center;
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
    
    .status-dot.connected { background: #4ade80; }
    .status-dot.disconnected { background: #f87171; animation: pulse 1s infinite; }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
    }
    
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 20px;
    }
    
    .card h2 {
      font-size: 1.2rem;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .card h2 .emoji {
      font-size: 1.5rem;
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
    .phase-running { background: #22c55e; }
    .phase-finished { background: #6b7280; }
    
    .player-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0;
    }
    
    .player-tag {
      padding: 4px 10px;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      font-size: 0.85rem;
    }
    
    .player-tag.connected {
      border: 1px solid #4ade80;
    }
    
    .player-tag.disconnected {
      opacity: 0.5;
      border: 1px solid #f87171;
    }
    
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
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
    }
    
    .bracket {
      margin-top: 15px;
    }
    
    .bracket-section {
      margin-bottom: 15px;
    }
    
    .bracket-title {
      font-size: 0.85rem;
      color: rgba(255,255,255,0.6);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .match {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      margin-bottom: 6px;
      font-size: 0.9rem;
    }
    
    .match.playing {
      border-left: 3px solid #22c55e;
    }
    
    .match.waiting {
      border-left: 3px solid #f59e0b;
    }
    
    .match.finished {
      opacity: 0.6;
    }
    
    .match-players {
      flex: 1;
    }
    
    .match-score {
      font-weight: 600;
      font-family: monospace;
    }
    
    .winner {
      color: #4ade80;
    }
    
    .logs-container {
      max-height: 400px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 0.8rem;
    }
    
    .log-entry {
      padding: 4px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    
    .log-entry:hover {
      background: rgba(255,255,255,0.05);
    }
    
    .log-time {
      color: rgba(255,255,255,0.4);
      margin-right: 10px;
    }
    
    .log-type {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7rem;
      margin-right: 8px;
    }
    
    .log-type.info { background: #3b82f6; }
    .log-type.game { background: #22c55e; }
    .log-type.match { background: #f59e0b; }
    .log-type.error { background: #ef4444; }
    
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
      </div>
    </header>
    
    <div class="grid">
      <div class="card">
        <h2><span class="emoji">🎮</span> Torneios Ativos</h2>
        <div id="tournaments">
          <div class="no-data">A carregar...</div>
        </div>
      </div>
      
      <div class="card">
        <h2><span class="emoji">📋</span> Logs de Eventos</h2>
        <div class="logs-container" id="logs">
          <div class="no-data">A carregar...</div>
        </div>
      </div>
    </div>
  </div>
  
  <button class="btn-primary refresh-btn" onclick="refresh()" title="Atualizar">🔄</button>
  
  <script>
    const ADMIN_KEY = '${adminKey}';
    let autoRefreshEnabled = true;
    let refreshInterval = null;
    
    const GAME_NAMES = {
      'gatos-caes': 'Gatos & Cães',
      'dominorio': 'Dominório',
      'quelhas': 'Quelhas',
      'produto': 'Produto',
      'atari-go': 'Atari Go',
      'nex': 'Nex',
    };
    
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
          headers: {
            'Authorization': 'Bearer ' + ADMIN_KEY,
          },
        });
        return await res.json();
      } catch (e) {
        console.error('Post error:', e);
        return null;
      }
    }
    
    async function refresh() {
      // Verificar conexão
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
      
      // Carregar torneios
      const tournaments = await fetchData('/api/tournaments');
      renderTournaments(tournaments || []);
      
      // Carregar logs
      const logs = await fetchData('/api/logs');
      renderLogs(logs || []);
    }
    
    function renderTournaments(tournaments) {
      const container = document.getElementById('tournaments');
      
      if (tournaments.length === 0) {
        container.innerHTML = '<div class="no-data">Nenhum torneio ativo. Os jogadores podem criar um ao inscrever-se.</div>';
        return;
      }
      
      container.innerHTML = tournaments.map(t => {
        const gameName = GAME_NAMES[t.gameId] || t.gameId;
        const phaseClass = 'phase-' + t.phase;
        const phaseText = t.phase === 'registration' ? 'Inscrições' : 
                         t.phase === 'running' ? 'A decorrer' : 'Terminado';
        
        const players = t.players.map(p => 
          '<span class="player-tag ' + (p.isConnected ? 'connected' : 'disconnected') + '">' +
            p.name + (p.classId ? ' (' + p.classId + ')' : '') +
            (p.losses > 0 ? ' [' + p.losses + 'D]' : '') +
          '</span>'
        ).join('');
        
        const canStart = t.phase === 'registration' && t.players.length >= 2;
        const canReset = true;
        
        let bracket = '';
        if (t.state && t.phase !== 'registration') {
          bracket = renderBracket(t.state);
        }
        
        return '<div class="tournament-card">' +
          '<div class="tournament-header">' +
            '<span class="tournament-name">' + gameName + '</span>' +
            '<span class="phase-badge ' + phaseClass + '">' + phaseText + '</span>' +
          '</div>' +
          '<div class="player-list">' + (players || '<span class="no-data">Nenhum jogador inscrito</span>') + '</div>' +
          bracket +
          '<div class="actions">' +
            '<button class="btn-primary" onclick="startTournament(\\'' + t.gameId + '\\')" ' + (canStart ? '' : 'disabled') + '>▶️ Iniciar</button>' +
            '<button class="btn-danger" onclick="resetTournament(\\'' + t.gameId + '\\')" ' + (canReset ? '' : 'disabled') + '>🔄 Reiniciar</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    
    function renderBracket(state) {
      let html = '<div class="bracket">';
      
      if (state.winnersMatches.length > 0) {
        html += '<div class="bracket-section">' +
          '<div class="bracket-title">Winners Bracket</div>' +
          state.winnersMatches.map(renderMatch).join('') +
        '</div>';
      }
      
      if (state.losersMatches.length > 0) {
        html += '<div class="bracket-section">' +
          '<div class="bracket-title">Losers Bracket</div>' +
          state.losersMatches.map(renderMatch).join('') +
        '</div>';
      }
      
      if (state.grandFinal) {
        html += '<div class="bracket-section">' +
          '<div class="bracket-title">Grand Final</div>' +
          renderMatch(state.grandFinal) +
        '</div>';
      }
      
      if (state.grandFinalReset) {
        html += '<div class="bracket-section">' +
          '<div class="bracket-title">Grand Final Reset</div>' +
          renderMatch(state.grandFinalReset) +
        '</div>';
      }
      
      if (state.championId) {
        const champion = state.players.find(p => p.id === state.championId);
        html += '<div class="bracket-section" style="text-align:center; padding: 15px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 8px;">' +
          '<div style="font-size: 2rem;">🏆</div>' +
          '<div style="font-weight: 600;">Campeão: ' + (champion ? champion.name : 'Desconhecido') + '</div>' +
        '</div>';
      }
      
      html += '</div>';
      return html;
    }
    
    function renderMatch(match) {
      const p1 = match.player1 ? match.player1.name : 'TBD';
      const p2 = match.player2 ? match.player2.name : 'TBD';
      const score = match.score.player1Wins + '-' + match.score.player2Wins;
      const phaseClass = match.phase;
      
      const p1Winner = match.winnerId === match.player1?.id;
      const p2Winner = match.winnerId === match.player2?.id;
      
      return '<div class="match ' + phaseClass + '">' +
        '<div class="match-players">' +
          '<span class="' + (p1Winner ? 'winner' : '') + '">' + p1 + '</span>' +
          ' vs ' +
          '<span class="' + (p2Winner ? 'winner' : '') + '">' + p2 + '</span>' +
        '</div>' +
        '<div class="match-score">' + score + '</div>' +
      '</div>';
    }
    
    function renderLogs(logs) {
      const container = document.getElementById('logs');
      
      if (logs.length === 0) {
        container.innerHTML = '<div class="no-data">Nenhum evento registado.</div>';
        return;
      }
      
      // Mostrar os últimos 50 logs (mais recentes primeiro)
      const recentLogs = logs.slice(-50).reverse();
      
      container.innerHTML = recentLogs.map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString('pt-PT');
        return '<div class="log-entry">' +
          '<span class="log-time">' + time + '</span>' +
          '<span class="log-type ' + log.type + '">' + log.type + '</span>' +
          log.message +
        '</div>';
      }).join('');
    }
    
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
    
    // Auto-refresh
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
    
    // Iniciar
    refresh();
    startAutoRefresh();
  </script>
</body>
</html>`;
}
