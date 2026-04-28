'use strict';

// ── Teams ─────────────────────────────────────────────────────────────────────
const NBA_TEAMS = [
  {abbr:'ATL',city:'Atlanta',  name:'Hawks'},    {abbr:'BOS',city:'Boston',   name:'Celtics'},
  {abbr:'BKN',city:'Brooklyn', name:'Nets'},     {abbr:'CHA',city:'Charlotte',name:'Hornets'},
  {abbr:'CHI',city:'Chicago',  name:'Bulls'},    {abbr:'CLE',city:'Cleveland',name:'Cavaliers'},
  {abbr:'DAL',city:'Dallas',   name:'Mavericks'},{abbr:'DEN',city:'Denver',   name:'Nuggets'},
  {abbr:'DET',city:'Detroit',  name:'Pistons'},  {abbr:'GSW',city:'GS',       name:'Warriors'},
  {abbr:'HOU',city:'Houston',  name:'Rockets'},  {abbr:'IND',city:'Indiana',  name:'Pacers'},
  {abbr:'LAC',city:'LA',       name:'Clippers'}, {abbr:'LAL',city:'LA',       name:'Lakers'},
  {abbr:'MEM',city:'Memphis',  name:'Grizzlies'},{abbr:'MIA',city:'Miami',    name:'Heat'},
  {abbr:'MIL',city:'Milwaukee',name:'Bucks'},    {abbr:'MIN',city:'Minnesota',name:'T-Wolves'},
  {abbr:'NOP',city:'N.Orleans',name:'Pelicans'}, {abbr:'NYK',city:'New York', name:'Knicks'},
  {abbr:'OKC',city:'OKC',      name:'Thunder'},  {abbr:'ORL',city:'Orlando',  name:'Magic'},
  {abbr:'PHI',city:'Philly',   name:'76ers'},    {abbr:'PHX',city:'Phoenix',  name:'Suns'},
  {abbr:'POR',city:'Portland', name:'Blazers'},  {abbr:'SAC',city:'Sacramento',name:'Kings'},
  {abbr:'SAS',city:'San Antonio',name:'Spurs'},  {abbr:'TOR',city:'Toronto',  name:'Raptors'},
  {abbr:'UTA',city:'Utah',     name:'Jazz'},     {abbr:'WAS',city:'Washington',name:'Wizards'},
];

const MLB_TEAMS = [
  {abbr:'ARI',city:'Arizona',    name:'D-backs'},  {abbr:'ATL',city:'Atlanta',   name:'Braves'},
  {abbr:'BAL',city:'Baltimore',  name:'Orioles'},  {abbr:'BOS',city:'Boston',    name:'Red Sox'},
  {abbr:'CHC',city:'Chicago',    name:'Cubs'},     {abbr:'CHW',city:'Chicago',   name:'White Sox'},
  {abbr:'CIN',city:'Cincinnati', name:'Reds'},     {abbr:'CLE',city:'Cleveland', name:'Guardians'},
  {abbr:'COL',city:'Colorado',   name:'Rockies'},  {abbr:'DET',city:'Detroit',   name:'Tigers'},
  {abbr:'HOU',city:'Houston',    name:'Astros'},   {abbr:'KC', city:'Kansas City',name:'Royals'},
  {abbr:'LAA',city:'LA',         name:'Angels'},   {abbr:'LAD',city:'LA',        name:'Dodgers'},
  {abbr:'MIA',city:'Miami',      name:'Marlins'},  {abbr:'MIL',city:'Milwaukee', name:'Brewers'},
  {abbr:'MIN',city:'Minnesota',  name:'Twins'},    {abbr:'NYM',city:'New York',  name:'Mets'},
  {abbr:'NYY',city:'New York',   name:'Yankees'},  {abbr:'OAK',city:'Oakland',   name:'Athletics'},
  {abbr:'PHI',city:'Philadelphia',name:'Phillies'},{abbr:'PIT',city:'Pittsburgh',name:'Pirates'},
  {abbr:'SD', city:'San Diego',  name:'Padres'},   {abbr:'SEA',city:'Seattle',   name:'Mariners'},
  {abbr:'SF', city:'San Francisco',name:'Giants'}, {abbr:'STL',city:'St. Louis', name:'Cardinals'},
  {abbr:'TB', city:'Tampa Bay',  name:'Rays'},     {abbr:'TEX',city:'Texas',     name:'Rangers'},
  {abbr:'TOR',city:'Toronto',    name:'Blue Jays'},{abbr:'WSH',city:'Washington',name:'Nationals'},
];

const LEAGUE_CONFIG = {
  nba: { teams: NBA_TEAMS, label: 'NBA', color: '#C9082A', fallback: 'NBA League Pass' },
  mlb: { teams: MLB_TEAMS, label: 'MLB', color: '#002D72', fallback: 'MLB.TV' },
};

// ── State ─────────────────────────────────────────────────────────────────────
let currentLeague = localStorage.getItem('sports_league') || 'nba';
let followed      = {
  nba: new Set(JSON.parse(localStorage.getItem('followed_nba') || '[]')),
  mlb: new Set(JSON.parse(localStorage.getItem('followed_mlb') || '[]')),
};
let allGames      = { nba: [], mlb: [] };
let prevScores    = {};
let currentTab    = 'my';
const REFRESH_SEC = 120;
let countdown     = REFRESH_SEC;
let countdownTimer;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  setDatePill();
  applyLeagueTheme();
  renderTeamGrid();
  loadGames();
  startCountdown();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { loadGames(); resetCountdown(); }
  });
});

function setDatePill() {
  const d = new Date().toLocaleDateString('en-US', {
    weekday:'short', month:'short', day:'numeric', timeZone:'America/New_York'
  });
  document.getElementById('datePill').textContent = d.toUpperCase();
}

// ── League switching ──────────────────────────────────────────────────────────
function setLeague(league) {
  currentLeague = league;
  localStorage.setItem('sports_league', league);
  document.getElementById('league-nba').classList.toggle('active', league === 'nba');
  document.getElementById('league-mlb').classList.toggle('active', league === 'mlb');
  applyLeagueTheme();
  renderTeamGrid();
  renderGames();
}

function applyLeagueTheme() {
  const color = LEAGUE_CONFIG[currentLeague].color;
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent2', color);
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function startCountdown() {
  clearInterval(countdownTimer);
  countdown = REFRESH_SEC;
  updateCountdownUI();
  countdownTimer = setInterval(() => {
    countdown--;
    if (countdown <= 0) { loadGames(); countdown = REFRESH_SEC; }
    updateCountdownUI();
  }, 1000);
}

function resetCountdown() { countdown = REFRESH_SEC; updateCountdownUI(); }

function updateCountdownUI() {
  const el = document.getElementById('refreshCountdown');
  if (!el) return;
  const games = allGames[currentLeague] || [];
  const anyLive = games.some(g => g.status === 'inprogress');
  el.style.display = anyLive ? 'flex' : 'none';
  if (!anyLive) return;
  const mins = Math.floor(countdown / 60);
  const secs = String(countdown % 60).padStart(2, '0');
  el.querySelector('.cd-time').textContent = `${mins}:${secs}`;
  const ring = document.getElementById('cdRing');
  if (ring) ring.style.strokeDashoffset = (47.1 * (1 - countdown / REFRESH_SEC)).toFixed(2);
  el.classList.toggle('cd-imminent', countdown <= 10);
}

// ── Data fetch ────────────────────────────────────────────────────────────────
async function loadGames() {
  try {
    const res  = await fetch('/api/games');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);

    ['nba', 'mlb'].forEach(league => {
      const games = json[league] || [];
      // Detect score changes
      games.forEach(g => {
        if (g.status === 'inprogress' && g.score) {
          const prev = prevScores[g.id];
          if (prev && (prev.home !== g.score[g.home] || prev.away !== g.score[g.away])) {
            g._scoreChanged = true;
          }
          prevScores[g.id] = { home: g.score[g.home], away: g.score[g.away] };
        }
      });
      allGames[league] = games;
    });

    updatePlayingDots();
    renderGames();
  } catch (e) {
    if ((allGames[currentLeague] || []).length === 0) {
      document.getElementById('gamesContainer').innerHTML =
        `<div class="empty-card">Couldn't load games. Check your connection.</div>`;
    }
  }
}

function getPlayingTeams(league) {
  const s = new Set();
  (allGames[league] || []).forEach(g => { s.add(g.home); s.add(g.away); });
  return s;
}

function updatePlayingDots() {
  const playing = getPlayingTeams(currentLeague);
  document.querySelectorAll('.team-btn').forEach(btn => {
    btn.classList.toggle('playing', playing.has(btn.dataset.abbr));
  });
}

// ── Team grid ─────────────────────────────────────────────────────────────────
function renderTeamGrid() {
  const teams   = LEAGUE_CONFIG[currentLeague].teams;
  const playing = getPlayingTeams(currentLeague);
  const fol     = followed[currentLeague];
  const grid    = document.getElementById('teamGrid');

  grid.innerHTML = teams.map(t => {
    const sel = fol.has(t.abbr);
    const isPlaying = playing.has(t.abbr);
    return `<button class="team-btn${sel?' selected':''}${isPlaying?' playing':''}" data-abbr="${t.abbr}" onclick="toggleTeam('${t.abbr}')">
      <span class="t-abbr">${t.abbr}</span>
      <span class="t-city">${t.city}</span>
      <span class="live-dot"></span>
    </button>`;
  }).join('');

  document.getElementById('clearBtn').style.display = fol.size ? 'block' : 'none';
}

function toggleTeam(abbr) {
  const fol = followed[currentLeague];
  if (fol.has(abbr)) fol.delete(abbr); else fol.add(abbr);
  localStorage.setItem(`followed_${currentLeague}`, JSON.stringify([...fol]));
  const btn = document.querySelector(`[data-abbr="${abbr}"]`);
  if (btn) btn.classList.toggle('selected', fol.has(abbr));
  document.getElementById('clearBtn').style.display = fol.size ? 'block' : 'none';
  renderGames();
}

function clearAll() {
  followed[currentLeague].clear();
  localStorage.setItem(`followed_${currentLeague}`, '[]');
  document.querySelectorAll('.team-btn.selected').forEach(b => b.classList.remove('selected'));
  document.getElementById('clearBtn').style.display = 'none';
  renderGames();
}

// ── Tab ───────────────────────────────────────────────────────────────────────
function setTab(tab) {
  currentTab = tab;
  document.getElementById('tab-my').className  = 'tab' + (tab==='my'  ? ' active' : '');
  document.getElementById('tab-all').className = 'tab' + (tab==='all' ? ' active' : '');
  renderGames();
}

// ── Game rendering ────────────────────────────────────────────────────────────
function renderGames() {
  const container   = document.getElementById('gamesContainer');
  const tabSwitcher = document.getElementById('tabSwitcher');
  const gamesTitle  = document.getElementById('gamesTitle');
  const fol         = followed[currentLeague];

  let games = allGames[currentLeague] || [];

  if (fol.size > 0) {
    tabSwitcher.style.display = 'flex';
    if (currentTab === 'my') {
      games = games.filter(g => fol.has(g.home) || fol.has(g.away));
      gamesTitle.textContent = 'YOUR GAMES';
    } else {
      gamesTitle.textContent = 'TONIGHT';
    }
  } else {
    tabSwitcher.style.display = 'none';
    gamesTitle.textContent = 'TONIGHT';
  }

  if ((allGames[currentLeague] || []).length === 0) {
    container.innerHTML = `<div class="loading-block"><div class="spinner"></div><span>Loading games…</span></div>`;
    return;
  }
  if (games.length === 0) {
    container.innerHTML = `<div class="no-games">None of your teams play today.<br>Tap All to see every game.</div>`;
    return;
  }

  container.innerHTML = games.map((g, i) => gameCard(g, i)).join('');

  // Flash changed scores
  games.forEach(g => {
    if (g._scoreChanged) {
      const card = container.querySelector(`[data-game-id="${g.id}"]`);
      const el = card?.querySelector('.score-nums');
      if (el) { el.classList.add('score-flash'); setTimeout(() => el.classList.remove('score-flash'), 1200); }
    }
  });

  updateCountdownUI();
}

function gameCard(g, idx) {
  const isLive   = g.status === 'inprogress';
  const isFinal  = g.status === 'closed';
  const sport    = g.sport || 'basketball';

  const statusBadge = isLive
    ? `<span class="status-badge badge-live">LIVE</span>`
    : isFinal
    ? `<span class="status-badge badge-final">FINAL</span>`
    : `<span class="status-badge badge-soon">${g.localTime || 'Today'}</span>`;

  const timeStr = isLive ? '' : `<span class="game-time">${g.localTime || ''}</span>`;

  // Score / period display
  let centerBlock;
  if (isLive || isFinal) {
    const homeScore = g.score?.[g.home] ?? 0;
    const awayScore = g.score?.[g.away] ?? 0;
    const periodTag = isLive && g.periodLabel
      ? `<div class="quarter-tag">${g.periodLabel}</div>` : '';

    // MLB situation (bases, count)
    let situationBlock = '';
    if (sport === 'baseball' && isLive && g.situation) {
      const s = g.situation;
      situationBlock = `<div class="mlb-situation">
        <div class="count">${s.balls}-${s.strikes} · ${s.outs} out${s.outs !== 1 ? 's' : ''}</div>
        <div class="bases">
          <div class="base base-second ${s.onSecond ? 'on' : ''}"></div>
          <div class="base-row">
            <div class="base base-third ${s.onThird ? 'on' : ''}"></div>
            <div class="base-home"></div>
            <div class="base base-first ${s.onFirst ? 'on' : ''}"></div>
          </div>
        </div>
      </div>`;
    }

    centerBlock = `<div class="score-center">
      <div class="score-nums">${awayScore}<span class="score-sep">–</span>${homeScore}</div>
      ${periodTag}${situationBlock}
    </div>`;
  } else {
    centerBlock = `<div class="score-center"><div class="vs-text">VS</div><div class="game-time-center">${g.localTime||''}</div></div>`;
  }

  const streamLinks = (g.streams || []).map(s =>
    `<a class="stream-link" href="${s.url}" target="_blank" rel="noopener">
      <span class="platform-dot" style="background:${s.color}"></span>${s.name}
    </a>`
  ).join('');

  return `<div class="game-card${isLive?' live':''}" data-game-id="${g.id}" style="animation-delay:${idx*50}ms">
    <div class="card-top">${statusBadge}${timeStr}</div>
    <div class="matchup">
      <div class="team-side">
        <div class="team-abbr">${g.away}</div>
        <div class="team-name">${g.awayName?.split(' ').pop() || g.away}</div>
      </div>
      ${centerBlock}
      <div class="team-side">
        <div class="team-abbr">${g.home}</div>
        <div class="team-name">${g.homeName?.split(' ').pop() || g.home}</div>
      </div>
    </div>
    ${streamLinks ? `<div class="streams-label">WATCH ON</div><div class="stream-list">${streamLinks}</div>` : ''}
    ${g.seriesInfo ? `<div class="series-line">${g.seriesInfo}</div>` : ''}
  </div>`;
}
