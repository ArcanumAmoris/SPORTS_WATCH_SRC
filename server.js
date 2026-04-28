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

const PLATFORM_META = {
  'ESPN':        { url: 'https://www.espn.com/watch',          color: '#E60000' },
  'ESPN2':       { url: 'https://www.espn.com/watch',          color: '#E60000' },
  'ABC':         { url: 'https://www.espn.com/watch',          color: '#006AB3' },
  'TNT':         { url: 'https://www.tntdrama.com/sports',     color: '#E4002B' },
  'TBS':         { url: 'https://www.tbs.com/sports',          color: '#E4002B' },
  'truTV':       { url: 'https://www.trutv.com',               color: '#E4002B' },
  'NBC':         { url: 'https://www.nbc.com/live',            color: '#0A5FA8' },
  'Peacock':     { url: 'https://www.peacocktv.com/sports',    color: '#2C2C2C' },
  'Max':         { url: 'https://www.max.com/sports',          color: '#002BE7' },
  'NBA TV':      { url: 'https://www.nba.com/watch',           color: '#1D428A' },
  'NBA League Pass': { url: 'https://www.nba.com/watch',       color: '#1D428A' },
};

function getPlatformMeta(name) {
  for (const [key, val] of Object.entries(PLATFORM_META)) {
    if (name.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(name.toLowerCase())) {
      return { name: key, ...val };
    }
  }
  return { name, url: 'https://www.nba.com/watch', color: '#1D428A' };
}

let cache = { data: null, ts: 0 };
const CACHE_TTL = 60 * 1000;

async function fetchGamesFromESPN() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      'Accept': 'application/json',
    }
  });
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
  return res.json();
}

function parseESPN(data) {
  return (data.events || []).map(event => {
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
    const clock  = status.displayClock || null;

    let quarterLabel = null;
    if (gameStatus === 'inprogress' && period) {
      if (statusType.description === 'Halftime') {
        quarterLabel = 'Half';
      } else {
        quarterLabel = period > 4 ? `OT${period - 4 > 1 ? period - 4 : ''}` : `Q${period}`;
      }
    }

    const broadcasts = comp.broadcasts || [];
    const streams = [];
    const seen = new Set();
    broadcasts.forEach(b => {
      (b.names || []).forEach(name => {
        if (!seen.has(name)) {
          seen.add(name);
          streams.push(getPlatformMeta(name));
        }
      });
    });
    if (!seen.has('NBA League Pass')) {
      streams.push(getPlatformMeta('NBA League Pass'));
    }

    const scheduledDate = new Date(comp.date || event.date);
    const localTime = scheduledDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric', minute: '2-digit', hour12: true
    }) + ' ET';

    const notes = comp.notes || [];
    const seriesInfo = notes.find(n => n.type === 'event')?.headline || null;

    return {
      id:        comp.id || event.id,
      home,
      away,
      homeName:  homeTeam?.team?.displayName || home,
      awayName:  awayTeam?.team?.displayName || away,
      status:    gameStatus,
      scheduled: comp.date || event.date,
      localTime,
      quarter:   quarterLabel,
      clock,
      score,
      streams,
      seriesInfo,
    };
  });
}

async function getSchedule() {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) return cache.data;
  const raw   = await fetchGamesFromESPN();
  const games = parseESPN(raw);
  cache = { data: games, ts: now };
  return games;
}

app.get('/api/games', async (req, res) => {
  try {
    const games = await getSchedule();
    res.json({ ok: true, games, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('ESPN fetch error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`NBA Tracker on port ${PORT} — live data from ESPN`));
