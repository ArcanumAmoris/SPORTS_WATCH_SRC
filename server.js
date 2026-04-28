const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
  'Apple TV+':       { url: 'https://tv.apple.com',                  color: '#555'    },
};

function getPlatformMeta(name) {
  for (const [key, val] of Object.entries(PLATFORM_META)) {
    if (name.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(name.toLowerCase())) {
      return { name: key, ...val };
    }
  }
  const isRegional = name.includes('.TV') || name.match(/^[A-Z]{2,5}SN/) || name.includes('NESN') || name.includes('CHSN');
  return { name, url: isRegional ? 'https://www.mlb.com/tv' : 'https://www.espn.com/watch', color: '#666' };
}

// ─── ESPN fetch ───────────────────────────────────────────────────────────────
const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  'Accept': 'application/json',
};

async function espnFetch(sport, league) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
  const res = await fetch(url, { headers: ESPN_HEADERS });
  if (!res.ok) throw new Error(`ESPN ${league} ${res.status}`);
  return res.json();
}

function parseEvent(event, sport) {
  const comp       = event.competitions[0];
  const status     = comp.status;
  const statusType = status.type;

  const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
  const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
  const home = homeTeam?.team?.abbreviation || 'TBD';
  const away = awayTeam?.team?.abbreviation || 'TBD';

  let gameStatus = 'scheduled';
  if (statusType.state === 'in')         gameStatus = 'inprogress';
  else if (statusType.state === 'post')  gameStatus = 'closed';

  let score = null;
  if (gameStatus === 'inprogress' || gameStatus === 'closed') {
    score = {
      [home]: parseInt(homeTeam?.score || '0', 10),
      [away]: parseInt(awayTeam?.score || '0', 10),
    };
  }

  const period = status.period || null;
  let periodLabel = null;
  if (gameStatus === 'inprogress' && period) {
    if (sport === 'basketball') {
      periodLabel = statusType.description === 'Halftime' ? 'Half'
        : period > 4 ? `OT${period - 4 > 1 ? period - 4 : ''}` : `Q${period}`;
    } else if (sport === 'baseball') {
      const desc = (statusType.description || '').toLowerCase();
      const half = desc.includes('bottom') ? '▼' : '▲';
      periodLabel = `${half}${period}`;
      if (desc.includes('middle') || desc.includes('end')) periodLabel = `Mid ${period}`;
    }
  }

  let situation = null;
  if (sport === 'baseball' && gameStatus === 'inprogress') {
    const sit = comp.situation || {};
    if (sit.balls !== undefined) {
      situation = {
        balls: sit.balls, strikes: sit.strikes, outs: sit.outs,
        onFirst: !!sit.onFirst, onSecond: !!sit.onSecond, onThird: !!sit.onThird,
      };
    }
  }

  // Broadcasts — national first, then fallback
  const broadcasts = comp.broadcasts || [];
  const streams = [];
  const seen = new Set();
  const regional = [];

  broadcasts.forEach(b => {
    (b.names || []).forEach(name => {
      if (seen.has(name)) return;
      seen.add(name);
      const meta = getPlatformMeta(name);
      const isRegional = name.includes('.TV') || name.match(/^[A-Z]{2,5}SN/) ||
        name.includes('NESN') || name.includes('CHSN') || name.includes('FanDuel SN');
      if (isRegional) regional.push(meta);
      else streams.push(meta);
    });
  });

  const fallbackName = sport === 'baseball' ? 'MLB.TV' : 'NBA League Pass';
  if (!seen.has(fallbackName)) streams.push(getPlatformMeta(fallbackName));
  if (streams.length <= 1 && regional.length > 0) streams.unshift(regional[0]);

  const scheduledDate = new Date(comp.date || event.date);
  const localTime = scheduledDate.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true
  }) + ' ET';

  const notes = comp.notes || [];
  const seriesInfo = notes.find(n => n.type === 'event')?.headline || null;

  return { id: comp.id || event.id, sport, home, away,
    homeName: homeTeam?.team?.displayName || home,
    awayName: awayTeam?.team?.displayName || away,
    status: gameStatus, scheduled: comp.date || event.date,
    localTime, periodLabel, score, situation, streams, seriesInfo };
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const caches = { basketball: { data: null, ts: 0 }, baseball: { data: null, ts: 0 } };
const CACHE_TTL = 60 * 1000;

async function getGames(sport, league) {
  const now = Date.now();
  const c = caches[sport];
  if (c.data && now - c.ts < CACHE_TTL) return c.data;
  const raw = await espnFetch(sport, league);
  c.data = (raw.events || []).map(e => parseEvent(e, sport));
  c.ts   = now;
  return c.data;
}

// ─── API route ────────────────────────────────────────────────────────────────
app.get('/api/games', async (req, res) => {
  try {
    const [nba, mlb] = await Promise.all([
      getGames('basketball', 'nba'),
      getGames('baseball',   'mlb'),
    ]);
    res.json({ ok: true, nba, mlb, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('ESPN error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Sports Tracker :${PORT}`));
