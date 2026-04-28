const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Streaming platform data ──────────────────────────────────────────────────
// NBA playoff broadcast rights 2025-26:
//   National: ESPN/ABC, TNT/TruTV, NBA League Pass
//   Streaming: Max (TNT games), ESPN+ (ESPN games), Peacock (select)
const BROADCAST_MAP = {
  TNT:    { name: 'TNT / Max',      url: 'https://www.max.com/sports',       color: '#E4002B' },
  ESPN:   { name: 'ESPN',           url: 'https://www.espn.com/watch',        color: '#E60000' },
  ABC:    { name: 'ABC / ESPN+',    url: 'https://www.espn.com/watch',        color: '#006AB3' },
  NBATV:  { name: 'NBA TV',         url: 'https://www.nba.com/watch',         color: '#1D428A' },
  LEAGUE: { name: 'NBA League Pass',url: 'https://www.nba.com/watch',         color: '#1D428A' },
  PEACOCK:{ name: 'Peacock',        url: 'https://www.peacocktv.com/sports',  color: '#000000' },
};

// Playoff schedule broadcast rotation (simplified — real apps would pull from SportRadar/NBA API)
// Pattern: TNT gets Mon/Thu prime, ESPN/ABC gets Tue/Fri/Sun, Saturday split
function getBroadcasters(game) {
  const date = new Date(game.scheduled);
  const day = date.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const hour = date.getHours(); // UTC

  // Always include League Pass as backup
  const base = [BROADCAST_MAP.LEAGUE];

  if (day === 1 || day === 4) {
    // Monday / Thursday → TNT
    return [BROADCAST_MAP.TNT, ...base];
  } else if (day === 2 || day === 5) {
    // Tuesday / Friday → ESPN
    return [BROADCAST_MAP.ESPN, ...base];
  } else if (day === 0) {
    // Sunday → ABC
    return [BROADCAST_MAP.ABC, ...base];
  } else if (day === 6) {
    // Saturday → ABC early / TNT late
    return hour < 22 ? [BROADCAST_MAP.ABC, ...base] : [BROADCAST_MAP.TNT, ...base];
  } else {
    // Wednesday → ESPN or TNT depending on game slot
    return hour < 22 ? [BROADCAST_MAP.ESPN, ...base] : [BROADCAST_MAP.TNT, ...base];
  }
}

// ─── SportRadar proxy ─────────────────────────────────────────────────────────
// We pull from the free SportRadar trial endpoint. In production replace with
// your paid key. Set SPORTRADAR_KEY in your environment.
const SR_KEY = process.env.SPORTRADAR_KEY || 'DEMO_KEY';
const SR_BASE = 'https://api.sportradar.com/nba/trial/v8/en';

async function fetchFromSR(path) {
  const url = `${SR_BASE}${path}?api_key=${SR_KEY}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`SR ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── Cache ────────────────────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getSchedule() {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) return cache.data;

  // Get today's date in Eastern time (NBA schedule runs on ET)
  const et = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const [m, d, y] = et.split('/');
  const dateStr = `${y}/${m}/${d}`;

  let raw;
  try {
    raw = await fetchFromSR(`/games/${dateStr}/schedule.json`);
  } catch (e) {
    console.warn('SR fetch failed, using mock data:', e.message);
    raw = getMockSchedule();
  }

  const games = (raw.games || []).map(g => {
    const home = g.home?.alias || g.home?.abbr || 'TBD';
    const away = g.away?.alias || g.away?.abbr || 'TBD';
    const status = g.status; // scheduled | inprogress | closed
    const scheduled = g.scheduled;

    const entry = {
      id: g.id,
      home,
      away,
      homeName: g.home?.name || home,
      awayName: g.away?.name || away,
      status,
      scheduled,
      localTime: formatET(scheduled),
      streams: getBroadcasters({ scheduled }),
      score: null,
      clock: null,
      quarter: null,
    };

    if (status === 'inprogress' || status === 'closed') {
      entry.score = {
        [home]: g.home_points ?? 0,
        [away]: g.away_points ?? 0,
      };
      entry.clock = g.clock || null;
      entry.quarter = g.quarter || null;
    }

    // Series info from brackets if available
    entry.seriesInfo = g.playoff?.series_title || null;

    return entry;
  });

  cache = { data: games, ts: now };
  return games;
}

function formatET(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: '2-digit',
    hour12: true
  }) + ' ET';
}

// ─── Mock data (fallback when no API key) ─────────────────────────────────────
function getMockSchedule() {
  const today = new Date();
  today.setHours(20, 0, 0, 0); // 8 PM ET base

  const makeTime = (addHours) => {
    const d = new Date(today);
    d.setHours(d.getHours() + addHours);
    return d.toISOString();
  };

  return {
    games: [
      {
        id: 'mock-1',
        home: { alias: 'ORL', name: 'Magic' },
        away: { alias: 'DET', name: 'Pistons' },
        status: 'inprogress',
        scheduled: makeTime(0),
        home_points: 61,
        away_points: 56,
        clock: '7:38',
        quarter: 3,
        playoff: { series_title: 'Game 4 — DET leads 2-1' }
      },
      {
        id: 'mock-2',
        home: { alias: 'PHX', name: 'Suns' },
        away: { alias: 'OKC', name: 'Thunder' },
        status: 'scheduled',
        scheduled: makeTime(1.5),
        playoff: { series_title: 'Game 4 — OKC leads 3-0' }
      },
      {
        id: 'mock-3',
        home: { alias: 'DEN', name: 'Nuggets' },
        away: { alias: 'MIN', name: 'Timberwolves' },
        status: 'scheduled',
        scheduled: makeTime(2.5),
        playoff: { series_title: 'Game 5 — MIN leads 3-1' }
      }
    ]
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/games', async (req, res) => {
  try {
    const games = await getSchedule();
    res.json({ ok: true, games, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve PWA for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`NBA Tracker running on port ${PORT}`));
