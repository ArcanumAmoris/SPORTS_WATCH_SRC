const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js'))   res.setHeader('Content-Type', 'application/javascript');
    if (filePath.endsWith('.css'))  res.setHeader('Content-Type', 'text/css');
    if (filePath.endsWith('.svg'))  res.setHeader('Content-Type', 'image/svg+xml');
  }
}));

// ─── Platform metadata ────────────────────────────────────────────────────────
const PLATFORM_META = {
  'ESPN':            { url: 'https://www.espn.com/watch',            color: '#E60000' },
  'ESPN2':           { url: 'https://www.espn.com/watch',            color: '#E60000' },
  'ABC':             { url: 'https://www.espn.com/watch',            color: '#006AB3' },
  'TNT':             { url: 'https://www.tntdrama.com/sports',       color: '#E4002B' },
  'TBS':             { url: 'https://www.tbs.com/sports',            color: '#E4002B' },
  'truTV':           { url: 'https://www.trutv.com',                 color: '#E4002B' },
  'NBC':             { url: 'https://www.nbc.com/live',              color: '#0A5FA8' },
  'Peacock':         { url: 'https://www.peacocktv.com/sports',      color: '#2C2C2C' },
  'Max':             { url: 'https://www.max.com/sports',            color: '#002BE7' },
  'NBA TV':          { url: 'https://www.nba.com/watch',             color: '#1D428A' },
  'NBA League Pass': { url: 'https://www.nba.com/watch',             color: '#1D428A' },
  'MLB.TV':          { url: 'https://www.mlb.com/tv',                color: '#002D72' },
  'FS1':             { url: 'https://www.foxsports.com/live',        color: '#E4002B' },
  'FS2':             { url: 'https://www.foxsports.com/live',        color: '#E4002B' },
  'Apple TV+':       { url: 'https://tv.apple.com/channel/tvs.sbd.4000', color: '#555' },
};

function getPlatformMeta(name) {
  for (const [key, val] of Object.entries(PLATFORM_META)) {
    if (name.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(name.toLowerCase())) {
      return { name: key, ...val };
    }
  }
  // Filter out regional/team-specific channels (e.g. "Rays.TV", "CLEGuardians.TV")
  if (name.includes('.TV') || name.includes('SN ') || name.includes('NESN') || name.includes('CHSN')) {
    return { name, url: 'https://www.mlb.com/tv', color: '#002D72' };
  }
  return { name, url: 'https://www.espn.com/watch', color: '#666' };
}

// ─── ESPN fetch helper ────────────────────────────────────────────────────────
const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  'Accept': 'application/json',
};

async function espnFetch(sport, league) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
  const res = await fetch(url, { headers: ESPN_HEADERS });
  if (!res.ok) throw new Error(`ESPN ${league} error: ${res.status}`);
  return res.json();
}

// ─── Parse ESPN event → unified game object ───────────────────────────────────
function parseEvent(event, sport) {
  const comp       = event.competitions[0];
  const status     = comp.status;
  const statusType = status.type;

  const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
  const awayTeam = comp.competitors.find(c => c.homeAway === 'away');

  const home = homeTeam?.team?.abbreviation || 'TBD';
  const away = awayTeam?.team?.abbreviation || 'TBD';

  let gameStatus = 'scheduled';
  if (statusType.state === 'in')        gameStatus = 'inprogress';
  else if (statusType.state === 'post') gameStatus = 'closed';

  let score = null;
  if (gameStatus === 'inprogress' || gameStatus === 'closed') {
    score = {
      [home]: parseInt(homeTeam?.score || '0', 10),
      [away]: parseInt(awayTeam?.score || '0', 10),
    };
  }

  const period = status.period || null;

  // Sport-specific period label
  let periodLabel = null;
  if (gameStatus === 'inprogress' && period) {
    if (sport === 'basketball') {
      if (statusType.description === 'Halftime') periodLabel = 'Half';
      else periodLabel = period > 4 ? `OT${period - 4 > 1 ? period - 4 : ''}` : `Q${period}`;
    } else if (sport === 'baseball') {
      // Top/bottom from situation
      const sit = comp.situation || {};
      const half = sit.onFirst !== undefined
        ? (comp.status.period && (statusType.description || '').toLowerCase().includes('bot') ? '▼' : '▲')
        : '';
      periodLabel = `${half}${period}`;
    }
  }
  if (statusType.description === 'Final' || statusType.description === 'Game Over') {
    periodLabel = null;
  }

  // Situation (MLB-specific: balls, strikes, outs, runners)
  let situation = null;
  if (sport === 'baseball' && gameStatus === 'inprogress') {
    const sit = comp.situation || {};
    if (sit.balls !== undefined) {
      situation = {
        balls:    sit.balls,
        strikes:  sit.strikes,
        outs:     sit.outs,
        onFirst:  sit.onFirst  || false,
        onSecond: sit.onSecond || false,
        onThird:  sit.onThird  || false,
      };
    }
  }

  // Streams — filter to national only for cleanliness, keep regional as fallback
  const broadcasts = comp.broadcasts || [];
  const streams = [];
  const seen = new Set();
  const regional = [];

  broadcasts.forEach(b => {
    (b.names || []).forEach(name => {
      if (seen.has(name)) return;
      seen.add(name);
      const meta = getPlatformMeta(name);
      // Heuristic: regional if contains team name pattern or known regional markers
      const isRegional = name.includes('.TV') || name.includes('NESN') ||
        name.includes('CHSN') || name.includes('SN ') ||
        name.includes('FanDuel SN') || name.match(/^[A-Z]{2,3}SN/);
      if (isRegional) regional.push(meta);
      else streams.push(meta);
    });
  });

  // Always add league streaming fallback
  const fallback = sport === 'baseball'
    ? getPlatformMeta('MLB.TV')
    : getPlatformMeta('NBA League Pass');
  if (!seen.has(fallback.name)) streams.push(fallback);

  // Add one regional if no national found
  if (streams.length <= 1 && regional.length > 0) streams.unshift(regional[0]);

  const scheduledDate = new Date(comp.date || event.date);
  const localTime = scheduledDate.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit', hour12: true
  }) + ' ET';

  const notes = comp.notes || [];
  const seriesInfo = notes.find(n => n.type === 'event')?.headline || null;

  return {
    id:          comp.id || event.id,
    sport,
    home,
    away,
    homeName:    homeTeam?.team?.displayName || home,
    awayName:    awayTeam?.team?.displayName || away,
    status:      gameStatus,
    scheduled:   comp.date || event.date,
    localTime,
    periodLabel,
    score,
    situation,
    streams,
    seriesInfo,
  };
}

// ─── Cache (per sport) ────────────────────────────────────────────────────────
const caches = { basketball: { data: null, ts: 0 }, baseball: { data: null, ts: 0 } };
const CACHE_TTL = 60 * 1000;

async function getGames(sport, league) {
  const now = Date.now();
  const c = caches[sport];
  if (c.data && now - c.ts < CACHE_TTL) return c.data;
  const raw   = await espnFetch(sport, league);
  const games = (raw.events || []).map(e => parseEvent(e, sport));
  c.data = games;
  c.ts   = now;
  return games;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/games', async (req, res) => {
  try {
    const [nba, mlb] = await Promise.all([
      getGames('basketball', 'nba'),
      getGames('baseball',   'mlb'),
    ]);
    res.json({ ok: true, nba, mlb, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('ESPN fetch error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Sports Tracker on port ${PORT} — NBA + MLB via ESPN`));
