'use strict';

// ── Teams ─────────────────────────────────────────────────────────────────────
const NBA_TEAMS = [
  {abbr:'ATL',city:'Atlanta',    name:'Hawks'},      {abbr:'BOS',city:'Boston',     name:'Celtics'},
  {abbr:'BKN',city:'Brooklyn',   name:'Nets'},       {abbr:'CHA',city:'Charlotte',  name:'Hornets'},
  {abbr:'CHI',city:'Chicago',    name:'Bulls'},      {abbr:'CLE',city:'Cleveland',  name:'Cavaliers'},
  {abbr:'DAL',city:'Dallas',     name:'Mavericks'},  {abbr:'DEN',city:'Denver',     name:'Nuggets'},
  {abbr:'DET',city:'Detroit',    name:'Pistons'},    {abbr:'GSW',city:'Golden St.', name:'Warriors'},
  {abbr:'HOU',city:'Houston',    name:'Rockets'},    {abbr:'IND',city:'Indiana',    name:'Pacers'},
  {abbr:'LAC',city:'LA',         name:'Clippers'},   {abbr:'LAL',city:'LA',         name:'Lakers'},
  {abbr:'MEM',city:'Memphis',    name:'Grizzlies'},  {abbr:'MIA',city:'Miami',      name:'Heat'},
  {abbr:'MIL',city:'Milwaukee',  name:'Bucks'},      {abbr:'MIN',city:'Minnesota',  name:'T-Wolves'},
  {abbr:'NOP',city:'New Orleans',name:'Pelicans'},   {abbr:'NYK',city:'New York',   name:'Knicks'},
  {abbr:'OKC',city:'OKC',        name:'Thunder'},    {abbr:'ORL',city:'Orlando',    name:'Magic'},
  {abbr:'PHI',city:'Philadelphia',name:'76ers'},     {abbr:'PHX',city:'Phoenix',    name:'Suns'},
  {abbr:'POR',city:'Portland',   name:'Blazers'},    {abbr:'SAC',city:'Sacramento', name:'Kings'},
  {abbr:'SAS',city:'San Antonio',name:'Spurs'},      {abbr:'TOR',city:'Toronto',    name:'Raptors'},
  {abbr:'UTA',city:'Utah',       name:'Jazz'},       {abbr:'WAS',city:'Washington', name:'Wizards'},
];

const MLB_TEAMS = [
  {abbr:'ARI',city:'Arizona',      name:'D-backs'},    {abbr:'ATL',city:'Atlanta',      name:'Braves'},
  {abbr:'BAL',city:'Baltimore',    name:'Orioles'},    {abbr:'BOS',city:'Boston',       name:'Red Sox'},
  {abbr:'CHC',city:'Chicago',      name:'Cubs'},       {abbr:'CHW',city:'Chicago',      name:'White Sox'},
  {abbr:'CIN',city:'Cincinnati',   name:'Reds'},       {abbr:'CLE',city:'Cleveland',    name:'Guardians'},
  {abbr:'COL',city:'Colorado',     name:'Rockies'},    {abbr:'DET',city:'Detroit',      name:'Tigers'},
  {abbr:'HOU',city:'Houston',      name:'Astros'},     {abbr:'KC', city:'Kansas City',  name:'Royals'},
  {abbr:'LAA',city:'LA',           name:'Angels'},     {abbr:'LAD',city:'LA',           name:'Dodgers'},
  {abbr:'MIA',city:'Miami',        name:'Marlins'},    {abbr:'MIL',city:'Milwaukee',    name:'Brewers'},
  {abbr:'MIN',city:'Minnesota',    name:'Twins'},      {abbr:'NYM',city:'New York',     name:'Mets'},
  {abbr:'NYY',city:'New York',     name:'Yankees'},    {abbr:'ATH',city:'Sacramento',   name:'Athletics'},
  {abbr:'PHI',city:'Philadelphia', name:'Phillies'},   {abbr:'PIT',city:'Pittsburgh',   name:'Pirates'},
  {abbr:'SD', city:'San Diego',    name:'Padres'},     {abbr:'SEA',city:'Seattle',      name:'Mariners'},
  {abbr:'SF', city:'San Francisco',name:'Giants'},     {abbr:'STL',city:'St. Louis',    name:'Cardinals'},
  {abbr:'TB', city:'Tampa Bay',    name:'Rays'},       {abbr:'TEX',city:'Texas',        name:'Rangers'},
  {abbr:'TOR',city:'Toronto',      name:'Blue Jays'},  {abbr:'WSH',city:'Washington',   name:'Nationals'},
];

const LEAGUE_CONFIG = {
  nba: { teams: NBA_TEAMS, color: '#C9082A' },
  mlb: { teams: MLB_TEAMS, color: '#002D72' },
};

// ── Persistent state ──────────────────────────────────────────────────────────
// Uses localStorage so teams survive across sessions and app restarts
function loadFollowed(league) {
  try { return new Set(JSON.parse(localStorage.getItem(`followed_${league}`) || '[]')); }
  catch { return new Set(); }
}
function saveFollowed(league, set) {
  localStorage.setItem(`followed_${league}`, JSON.stringify([...set]));
}
function loadLeague() {
  return localStorage.getItem('sports_league') || 'nba';
}
function hasOnboarded() {
  return localStorage.getItem('onboarded') === 'true';
}
function markOnboarded() {
  localStorage.setItem('onboarded', 'true');
}

let currentLeague  = loadLeague();
let followed       = { nba: loadFollowed('nba'), mlb: loadFollowed('mlb') };
let allGames       = { nba: [], mlb: [] };
let prevScores     = {};
let currentTab     = 'my';
let obLeague       = 'nba';
const REFRESH_SEC  = 120;
let countdown      = REFRESH_SEC;
let countdownTimer;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  if (!hasOnboarded()) {
    showOnboarding();
  } else {
    showApp();
  }
});

// ── Onboarding ────────────────────────────────────────────────────────────────
function showOnboarding() {
  document.getElementById('onboarding').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  obLeague = 'nba';
  renderObGrid();
}

function obSetLeague(league) {
  obLeague = league;
  document.getElementById('ob-nba').classList.toggle('active', league === 'nba');
  document.getElementById('ob-mlb').classList.toggle('active', league === 'mlb');
  renderObGrid();
}

function renderObGrid() {
  const teams = LEAGUE_CONFIG[obLeague].teams;
  const fol   = followed[obLeague];
  const grid  = document.getElementById('obTeamGrid');
  grid.innerHTML = teams.map(t => {
    const sel = fol.has(t.abbr);
    return `<button class="ob-team-btn${sel ? ' selected' : ''}" onclick="obToggleTeam('${t.abbr}')">
      <span class="t-abbr">${t.abbr}</span>
      <span class="t-city">${t.city}</span>
    </button>`;
  }).join('');
  updateObCount();
}

function obToggleTeam(abbr) {
  const fol = followed[obLeague];
  if (fol.has(abbr)) fol.delete(abbr); else fol.add(abbr);
  saveFollowed(obLeague, fol);
  const btn = document.querySelector(`#obTeamGrid [data-abbr="${abbr}"]`) ||
    [...document.querySelectorAll('#obTeamGrid .ob-team-btn')].find(b => b.onclick.toString().includes(`'${abbr}'`));
  renderObGrid(); // re-render to update selected state
  updateObCount();
}

function updateObCount() {
  const total = followed.nba.size + followed.mlb.size;
  const el = document.getElementById('obCount');
  el.textContent = total === 0 ? 'No teams selected yet'
    : `${total} team${total !== 1 ? 's' : ''} selected`;
  document.getElementById('obDoneBtn').style.opacity = total > 0 ? '1' : '0.5';
}

function finishOnboarding() {
  markOnboarded();
  document.getElementById('onboarding').style.display = 'none';
  showApp();
}

// ── App init ──────────────────────────────────────────────────────────────────
function showApp() {
  document.getElementById('app').style.display = 'flex';
  document.getElementById('app').style.flexDirection = 'column';
  setDatePill();
  applyLeagueTheme();
  renderFollowedChips();
  loadGames();
  startCountdown();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { loadGames(); resetCountdown(); }
  });
}

function setDatePill() {
  const d = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York'
  });
  document.getElementById('datePill').textContent = d.toUpperCase();
}

// ── League ────────────────────────────────────────────────────────────────────
function setLeague(league) {
  currentLeague = league;
  localStorage.setItem('sports_league', league);
  document.getElementById('league-nba').classList.toggle('active', league === 'nba');
  document.getElementById('league-mlb').classList.toggle('active', league === 'mlb');
  applyLeagueTheme();
  renderFollowedChips();
  renderGames();
}

function applyLeagueTheme() {
  const color = LEAGUE_CONFIG[currentLeague].color;
  document.documentElement.style.setProperty('--accent', color);
}

// ── Followed chips (compact team display in main view) ────────────────────────
function renderFollowedChips() {
  const fol  = followed[currentLeague];
  const el   = document.getElementById('followedChips');
  const edit = document.getElementById('editBtn');
  if (fol.size === 0) {
    el.innerHTML = `<div class="no-teams-hint">Tap <strong>Edit</strong> to follow teams →</div>`;
    edit.textContent = 'Add Teams';
  } else {
    const playing = getPlayingTeams(currentLeague);
    el.innerHTML = [...fol].map(abbr => {
      const t = LEAGUE_CONFIG[currentLeague].teams.find(x => x.abbr === abbr) || { abbr, name: abbr };
      const isLive = playing.has(abbr);
      return `<div class="followed-chip${isLive ? ' chip-live' : ''}">
        ${isLive ? '<span class="chip-dot"></span>' : ''}
        <span class="chip-abbr">${abbr}</span>
      </div>`;
    }).join('');
    edit.textContent = 'Edit';
  }
}

// ── Edit sheet ────────────────────────────────────────────────────────────────
function openEdit() {
  document.getElementById('editSheet').style.display = 'flex';
  document.getElementById('sheetTitle').textContent =
    currentLeague === 'nba' ? 'Edit NBA Teams' : 'Edit MLB Teams';
  renderTeamGrid();
}

function closeEdit() {
  document.getElementById('editSheet').style.display = 'none';
  renderFollowedChips();
  renderGames();
}

function renderTeamGrid() {
  const teams   = LEAGUE_CONFIG[currentLeague].teams;
  const playing = getPlayingTeams(currentLeague);
  const fol     = followed[currentLeague];
  document.getElementById('teamGrid').innerHTML = teams.map(t => {
    const sel = fol.has(t.abbr);
    const isPlaying = playing.has(t.abbr);
    return `<button class="team-btn${sel ? ' selected' : ''}${isPlaying ? ' playing' : ''}"
      data-abbr="${t.abbr}" onclick="toggleTeam('${t.abbr}')">
      <span class="t-abbr">${t.abbr}</span>
      <span class="t-city">${t.city}</span>
      <span class="live-dot"></span>
    </button>`;
  }).join('');
}

function toggleTeam(abbr) {
  const fol = followed[currentLeague];
  if (fol.has(abbr)) fol.delete(abbr); else fol.add(abbr);
  saveFollowed(currentLeague, fol); // persist immediately
  const btn = document.querySelector(`#teamGrid [data-abbr="${abbr}"]`);
  if (btn) btn.classList.toggle('selected', fol.has(abbr));
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
  const anyLive = (allGames[currentLeague] || []).some(g => g.status === 'inprogress');
  el.style.display = anyLive ? 'flex' : 'none';
  if (!anyLive) return;
  const mins = Math.floor(countdown / 60);
  const secs = String(countdown % 60).padStart(2, '0');
  el.querySelector('.cd-time').textContent = `${mins}:${secs}`;
  const ring = document.getElementById('cdRing');
  if (ring) ring.style.strokeDashoffset = (47.1 * (1 - countdown / REFRESH_SEC)).toFixed(2);
  el.classList.toggle('cd-imminent', countdown <= 10);
}

// ── Data ──────────────────────────────────────────────────────────────────────
async function loadGames() {
  try {
    const res  = await fetch('/api/games');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    ['nba', 'mlb'].forEach(league => {
      (json[league] || []).forEach(g => {
        if (g.status === 'inprogress' && g.score) {
          const prev = prevScores[g.id];
          if (prev && (prev.home !== g.score[g.home] || prev.away !== g.score[g.away])) {
            g._scoreChanged = true;
          }
          prevScores[g.id] = { home: g.score[g.home], away: g.score[g.away] };
        }
      });
      allGames[league] = json[league] || [];
    });
    renderFollowedChips();
    renderGames();
    if (document.getElementById('editSheet').style.display !== 'none') renderTeamGrid();
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

// ── Tab ───────────────────────────────────────────────────────────────────────
function setTab(tab) {
  currentTab = tab;
  document.getElementById('tab-my').className  = 'tab' + (tab === 'my'  ? ' active' : '');
  document.getElementById('tab-all').className = 'tab' + (tab === 'all' ? ' active' : '');
  renderGames();
}

// ── Render games ──────────────────────────────────────────────────────────────
function renderGames() {
  const container   = document.getElementById('gamesContainer');
  const tabSwitcher = document.getElementById('tabSwitcher');
  const gamesTitle  = document.getElementById('gamesTitle');
  const fol         = followed[currentLeague];
  let   games       = allGames[currentLeague] || [];

  if (fol.size > 0) {
    tabSwitcher.style.display = 'flex';
    if (currentTab === 'my') {
      games = games.filter(g => fol.has(g.home) || fol.has(g.away));
      gamesTitle.textContent = 'YOUR GAMES';
    } else {
      gamesTitle.textContent = 'ALL GAMES';
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
    container.innerHTML = `<div class="no-games">None of your teams play today.<br>Tap <strong>All</strong> to see every game.</div>`;
    return;
  }

  container.innerHTML = games.map((g, i) => gameCard(g, i)).join('');

  // Flash score changes
  games.forEach(g => {
    if (g._scoreChanged) {
      const el = container.querySelector(`[data-game-id="${g.id}"] .score-nums`);
      if (el) { el.classList.add('score-flash'); setTimeout(() => el.classList.remove('score-flash'), 1200); }
    }
  });
  updateCountdownUI();
}

function gameCard(g, idx) {
  const isLive  = g.status === 'inprogress';
  const isFinal = g.status === 'closed';
  const sport   = g.sport || 'basketball';

  const statusBadge = isLive
    ? `<span class="status-badge badge-live">● LIVE</span>`
    : isFinal
    ? `<span class="status-badge badge-final">FINAL</span>`
    : `<span class="status-badge badge-soon">${g.localTime}</span>`;

  // Score / center block
  let centerBlock;
  if (isLive || isFinal) {
    const awayScore = g.score?.[g.away] ?? 0;
    const homeScore = g.score?.[g.home] ?? 0;
    const periodTag = isLive && g.periodLabel ? `<div class="quarter-tag">${g.periodLabel}</div>` : '';

    let situationBlock = '';
    if (sport === 'baseball' && isLive && g.situation) {
      const s = g.situation;
      situationBlock = `<div class="mlb-situation">
        <div class="count">${s.balls}-${s.strikes} &nbsp;·&nbsp; ${s.outs} out${s.outs !== 1 ? 's' : ''}</div>
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
    centerBlock = `<div class="score-center"><div class="vs-text">VS</div></div>`;
  }

  // Team records
  const awayRecord = g.awayRecord ? `<div class="team-record">${g.awayRecord}</div>` : '';
  const homeRecord = g.homeRecord ? `<div class="team-record">${g.homeRecord}</div>` : '';
  const awayName = g.awayName?.split(' ').pop() || g.away;
  const homeName = g.homeName?.split(' ').pop() || g.home;

  // Stream chips
  const streamChips = (g.streams || []).map(s => {
    if (s.cable || isFinal) {
      return `<span class="stream-chip-cable${isFinal ? ' chip-final' : ''}">
        <span class="platform-dot" style="background:${s.color}"></span>${s.name}
        ${s.cable && !isFinal ? '<span class="cable-tag">cable</span>' : ''}
      </span>`;
    }
    return `<a class="stream-link" href="${s.url}" target="_blank" rel="noopener noreferrer">
      <span class="platform-dot" style="background:${s.color}"></span>${s.name}
    </a>`;
  }).join('');

  return `<div class="game-card${isLive ? ' live' : ''}" data-game-id="${g.id}" style="animation-delay:${idx * 50}ms">
    <div class="card-top">${statusBadge}${!isLive ? `<span class="game-time">${g.localTime}</span>` : ''}</div>
    <div class="matchup">
      <div class="team-side">
        <div class="team-abbr">${g.away}</div>
        <div class="team-name">${awayName}</div>
        ${awayRecord}
      </div>
      ${centerBlock}
      <div class="team-side">
        <div class="team-abbr">${g.home}</div>
        <div class="team-name">${homeName}</div>
        ${homeRecord}
      </div>
    </div>
    ${streamChips ? `<div class="streams-label">${isFinal ? 'AIRED ON' : 'WATCH ON'}</div><div class="stream-list">${streamChips}</div>` : ''}
    ${g.seriesInfo ? `<div class="series-line">${g.seriesInfo}</div>` : ''}
  </div>`;
}

