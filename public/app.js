'use strict';

// ── All 30 NBA teams ─────────────────────────────────────────────────────────
const TEAMS = [
  {abbr:'ATL',city:'Atlanta',  name:'Hawks'},
  {abbr:'BOS',city:'Boston',   name:'Celtics'},
  {abbr:'BKN',city:'Brooklyn', name:'Nets'},
  {abbr:'CHA',city:'Charlotte',name:'Hornets'},
  {abbr:'CHI',city:'Chicago',  name:'Bulls'},
  {abbr:'CLE',city:'Cleveland',name:'Cavaliers'},
  {abbr:'DAL',city:'Dallas',   name:'Mavericks'},
  {abbr:'DEN',city:'Denver',   name:'Nuggets'},
  {abbr:'DET',city:'Detroit',  name:'Pistons'},
  {abbr:'GSW',city:'GS',       name:'Warriors'},
  {abbr:'HOU',city:'Houston',  name:'Rockets'},
  {abbr:'IND',city:'Indiana',  name:'Pacers'},
  {abbr:'LAC',city:'LA',       name:'Clippers'},
  {abbr:'LAL',city:'LA',       name:'Lakers'},
  {abbr:'MEM',city:'Memphis',  name:'Grizzlies'},
  {abbr:'MIA',city:'Miami',    name:'Heat'},
  {abbr:'MIL',city:'Milwaukee',name:'Bucks'},
  {abbr:'MIN',city:'Minnesota',name:'T-Wolves'},
  {abbr:'NOP',city:'N. Orleans',name:'Pelicans'},
  {abbr:'NYK',city:'New York', name:'Knicks'},
  {abbr:'OKC',city:'OKC',      name:'Thunder'},
  {abbr:'ORL',city:'Orlando',  name:'Magic'},
  {abbr:'PHI',city:'Philly',   name:'76ers'},
  {abbr:'PHX',city:'Phoenix',  name:'Suns'},
  {abbr:'POR',city:'Portland', name:'Blazers'},
  {abbr:'SAC',city:'Sacramento',name:'Kings'},
  {abbr:'SAS',city:'San Antonio',name:'Spurs'},
  {abbr:'TOR',city:'Toronto',  name:'Raptors'},
  {abbr:'UTA',city:'Utah',     name:'Jazz'},
  {abbr:'WAS',city:'Washington',name:'Wizards'},
];

const TEAM_MAP = Object.fromEntries(TEAMS.map(t => [t.abbr, t]));

// ── Platform dot colors ───────────────────────────────────────────────────────
const PLATFORM_COLORS = {
  'TNT / Max':       '#E4002B',
  'ESPN':            '#E60000',
  'ABC / ESPN+':     '#006AB3',
  'NBA TV':          '#1D428A',
  'NBA League Pass': '#1D428A',
  'Peacock':         '#333',
};

// ── State ─────────────────────────────────────────────────────────────────────
let followed      = new Set(JSON.parse(localStorage.getItem('nba_followed') || '[]'));
let allGames      = [];
let prevScores    = {}; // gameId -> {home: n, away: n} for change detection
let currentTab    = 'my';
const REFRESH_SEC = 120;
let countdown     = REFRESH_SEC;
let countdownTimer;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  setDatePill();
  renderTeamGrid();
  loadGames();
  startCountdown();
  // Refresh when tab becomes visible again after being hidden
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { loadGames(); resetCountdown(); }
  });
});

function startCountdown() {
  clearInterval(countdownTimer);
  countdown = REFRESH_SEC;
  updateCountdownUI();
  countdownTimer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      loadGames();
      countdown = REFRESH_SEC;
    }
    updateCountdownUI();
  }, 1000);
}

function resetCountdown() {
  countdown = REFRESH_SEC;
  updateCountdownUI();
}

function updateCountdownUI() {
  const el = document.getElementById('refreshCountdown');
  if (!el) return;
  const anyLive = allGames.some(g => g.status === 'inprogress');
  if (!anyLive) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const mins = Math.floor(countdown / 60);
  const secs = String(countdown % 60).padStart(2, '0');
  el.querySelector('.cd-time').textContent = mins > 0 ? `${mins}:${secs}` : `0:${secs}`;
  // Animate SVG ring — circumference 47.1, drain from full to empty
  const ring = document.getElementById('cdRing');
  if (ring) {
    const pct = countdown / REFRESH_SEC;
    ring.style.strokeDashoffset = (47.1 * (1 - pct)).toFixed(2);
  }
  el.classList.toggle('cd-imminent', countdown <= 10);
}

function setDatePill() {
  const d = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'America/New_York'
  });
  document.getElementById('datePill').textContent = d.toUpperCase();
}

// ── Data fetch ────────────────────────────────────────────────────────────────
async function loadGames() {
  try {
    const res = await fetch('/api/games');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);

    // Detect score changes before updating state
    const changed = new Set();
    (json.games || []).forEach(g => {
      if (g.status === 'inprogress' && g.score && prevScores[g.id]) {
        const prev = prevScores[g.id];
        if (prev.home !== g.score[g.home] || prev.away !== g.score[g.away]) {
          changed.add(g.id);
        }
      }
      if (g.score) prevScores[g.id] = { home: g.score[g.home], away: g.score[g.away] };
    });

    allGames = json.games || [];
    updatePlayingDots();
    renderGames(changed);
  } catch (e) {
    if (allGames.length === 0) {
      document.getElementById('gamesContainer').innerHTML =
        `<div class="empty-card">Couldn't load games. Make sure the server is running.</div>`;
    }
  }
}

function getPlayingTeams() {
  const s = new Set();
  allGames.forEach(g => {
    if (g.status === 'inprogress' || g.status === 'scheduled') {
      s.add(g.home); s.add(g.away);
    }
  });
  return s;
}

function updatePlayingDots() {
  const playing = getPlayingTeams();
  document.querySelectorAll('.team-btn').forEach(btn => {
    const abbr = btn.dataset.abbr;
    btn.classList.toggle('playing', playing.has(abbr));
  });
}

// ── Team grid ─────────────────────────────────────────────────────────────────
function renderTeamGrid() {
  const grid = document.getElementById('teamGrid');
  const playing = getPlayingTeams();
  grid.innerHTML = TEAMS.map(t => {
    const sel = followed.has(t.abbr);
    const isPlaying = playing.has(t.abbr);
    return `<button class="team-btn${sel?' selected':''}${isPlaying?' playing':''}"
      data-abbr="${t.abbr}" onclick="toggleTeam('${t.abbr}')">
      <span class="t-abbr">${t.abbr}</span>
      <span class="t-city">${t.city}</span>
      <span class="live-dot"></span>
    </button>`;
  }).join('');

  // Show/hide clear button
  document.getElementById('clearBtn').style.display = followed.size ? 'block' : 'none';
}

function toggleTeam(abbr) {
  if (followed.has(abbr)) followed.delete(abbr);
  else followed.add(abbr);
  localStorage.setItem('nba_followed', JSON.stringify([...followed]));

  // Update just this button for snappiness
  const btn = document.querySelector(`[data-abbr="${abbr}"]`);
  if (btn) btn.classList.toggle('selected', followed.has(abbr));

  document.getElementById('clearBtn').style.display = followed.size ? 'block' : 'none';
  renderGames();
}

function clearAll() {
  followed.clear();
  localStorage.setItem('nba_followed', '[]');
  document.querySelectorAll('.team-btn.selected').forEach(b => b.classList.remove('selected'));
  document.getElementById('clearBtn').style.display = 'none';
  renderGames();
}

// ── Tab ───────────────────────────────────────────────────────────────────────
function setTab(tab) {
  currentTab = tab;
  document.getElementById('tab-my').className  = 'tab' + (tab === 'my'  ? ' active' : '');
  document.getElementById('tab-all').className = 'tab' + (tab === 'all' ? ' active' : '');
  renderGames();
}

// ── Game rendering ────────────────────────────────────────────────────────────
function renderGames(changed = new Set()) {
  const container   = document.getElementById('gamesContainer');
  const tabSwitcher = document.getElementById('tabSwitcher');
  const gamesTitle  = document.getElementById('gamesTitle');

  let games = allGames;
  const hasFollowed = followed.size > 0;

  if (hasFollowed) {
    tabSwitcher.style.display = 'flex';
    if (currentTab === 'my') {
      games = allGames.filter(g => followed.has(g.home) || followed.has(g.away));
      gamesTitle.textContent = 'YOUR GAMES';
    } else {
      gamesTitle.textContent = 'TONIGHT';
    }
  } else {
    tabSwitcher.style.display = 'none';
    gamesTitle.textContent = 'TONIGHT';
  }

  if (allGames.length === 0) {
    container.innerHTML = `<div class="loading-block"><div class="spinner"></div><span>Loading tonight's games…</span></div>`;
    return;
  }

  if (games.length === 0) {
    container.innerHTML = `<div class="no-games">None of your teams play tonight.<br>Tap All to see every game.</div>`;
    return;
  }

  container.innerHTML = games.map((g, i) => gameCard(g, i)).join('');

  // Flash scores on cards where score changed
  if (changed.size > 0) {
    games.forEach(g => {
      if (changed.has(g.id)) {
        const card = container.querySelector(`[data-game-id="${g.id}"]`);
        if (card) {
          const scoreEl = card.querySelector('.score-nums');
          if (scoreEl) { scoreEl.classList.add('score-flash'); setTimeout(() => scoreEl.classList.remove('score-flash'), 1200); }
        }
      }
    });
  }

  updateCountdownUI();
}

function gameCard(g, idx) {
  const isLive = g.status === 'inprogress';
  const isClosed = g.status === 'closed';

  const statusBadge = isLive
    ? `<span class="status-badge badge-live">LIVE</span>`
    : isClosed
    ? `<span class="status-badge badge-soon">FINAL</span>`
    : `<span class="status-badge badge-soon">${g.localTime || 'Tonight'}</span>`;

  const timeStr = isLive ? '' : `<span class="game-time">${g.localTime || ''}</span>`;

  const scoreBlock = isLive || isClosed
    ? `<div class="score-center">
        <div class="score-nums">
          <span>${g.score?.[g.away] ?? 0}</span>
          <span class="score-sep">–</span>
          <span>${g.score?.[g.home] ?? 0}</span>
        </div>
        ${isLive && g.quarter ? `<div class="quarter-tag">Q${g.quarter}${g.clock ? ' · ' + g.clock : ''}</div>` : ''}
       </div>`
    : `<div class="score-center"><div class="vs-text">VS</div></div>`;

  const awayTeam = TEAM_MAP[g.away] || {name: g.awayName || g.away, city: ''};
  const homeTeam = TEAM_MAP[g.home] || {name: g.homeName || g.home, city: ''};

  const streamLinks = (g.streams || []).map(s => {
    const color = PLATFORM_COLORS[s.name] || '#666';
    return `<a class="stream-link" href="${s.url}" target="_blank" rel="noopener">
      <span class="platform-dot" style="background:${color}"></span>
      ${s.name}
    </a>`;
  }).join('');

  const delayStyle = `animation-delay:${idx * 60}ms`;

  return `<div class="game-card${isLive?" live":""}" data-game-id="${g.id}" style="${delayStyle}">
    <div class="card-top">${statusBadge}${timeStr}</div>
    <div class="matchup">
      <div class="team-side">
        <div class="team-abbr">${g.away}</div>
        <div class="team-name">${awayTeam.name}</div>
      </div>
      ${scoreBlock}
      <div class="team-side">
        <div class="team-abbr">${g.home}</div>
        <div class="team-name">${homeTeam.name}</div>
      </div>
    </div>
    ${streamLinks ? `<div class="streams-label">WATCH ON</div><div class="stream-list">${streamLinks}</div>` : ''}
    ${g.seriesInfo ? `<div class="series-line">${g.seriesInfo}</div>` : ''}
  </div>`;
}
