const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Full platform map with verified correct URLs ─────────────────────────────
const PLATFORMS = {
  'ESPN':            { name: 'ESPN',         url: 'https://www.espn.com/watch',              color: '#E60000' },
  'ESPN2':           { name: 'ESPN2',        url: 'https://www.espn.com/watch',              color: '#E60000' },
  'ESPN Unlmtd':     { name: 'ESPN+',        url: 'https://www.espn.com/watch',              color: '#E60000' },
  'ESPN+':           { name: 'ESPN+',        url: 'https://www.espn.com/watch',              color: '#E60000' },
  'ABC':             { name: 'ABC',          url: 'https://abc.com/watch-live',              color: '#006AB3' },
  'TNT':             { name: 'TNT / Max',    url: 'https://www.max.com/sports',              color: '#E4002B' },
  'TBS':             { name: 'TBS / Max',    url: 'https://www.max.com/sports',              color: '#E4002B' },
  'truTV':           { name: 'truTV / Max',  url: 'https://www.max.com/sports',              color: '#E4002B' },
  'Max':             { name: 'Max',          url: 'https://www.max.com/sports',              color: '#002BE7' },
  'NBC':             { name: 'NBC',          url: 'https://www.nbc.com/nbc-sports',          color: '#0A5FA8' },
  'Peacock':         { name: 'Peacock',      url: 'https://www.peacocktv.com/watch/sports',  color: '#000000' },
  'NBA TV':          { name: 'NBA TV',       url: 'https://www.nba.com/watch',               color: '#1D428A' },
  'NBA League Pass': { name: 'League Pass',  url: 'https://www.nba.com/watch',               color: '#1D428A' },
  'MLB.TV':          { name: 'MLB.TV',       url: 'https://www.mlb.com/tv',                  color: '#002D72' },
  'FS1':             { name: 'Fox Sports 1', url: 'https://www.foxsports.com/live',          color: '#E4002B' },
  'FS2':             { name: 'Fox Sports 2', url: 'https://www.foxsports.com/live',          color: '#E4002B' },
  'Prime Video':     { name: 'Prime Video',  url: 'https://www.amazon.com/gp/video/storefront', color: '#00A8E1' },
  'Apple TV+':       { name: 'Apple TV+',    url: 'https://tv.apple.com',                    color: '#444444' },
  'fubo':            { name: 'FuboTV',       url: 'https://www.fubo.tv',                     color: '#E4002B' },
};

// Regional channel → cable only, shown but not clickable
const REGIONAL_PLATFORMS = {
  'MASN':        { name: 'MASN',              color: '#888', cable: true },
  'NESN':        { name: 'NESN',              color: '#888', cable: true },
  'YES':         { name: 'YES Network',        color: '#888', cable: true },
  'CHSN':        { name: 'Chicago SN',         color: '#888', cable: true },
  'Bally':       { name: 'FanDuel SN',         color: '#888', cable: true },
  'FanDuel':     { name: 'FanDuel SN',         color: '#888', cable: true },
  'Marquee':     { name: 'Marquee SN',         color: '#888', cable: true },
  'NBC Sports':  { name: 'NBC Sports RSN',     color: '#888', cable: true },
  'Space City':  { name: 'Space City HN',      color: '#888', cable: true },
  'Sportsnet':   { name: 'Sportsnet',          color: '#888', cable: true },
  'Rangers':     { name: 'Rangers SN',         color: '#888', cable: true },
  'SNY':         { name: 'SNY',                color: '#888', cable: true },
  'KMSP':        { name: 'KMSP-TV',            color: '#888', cable: true },
  'Gray Media':  { name: 'Gray Media',         color: '#888', cable: true },
  'BravesVision':{ name: 'BravesVision',       color: '#888', cable: true },
};

function resolvePlatform(name, market) {
  // National streamable platforms — exact then partial
  if (PLATFORMS[name]) return { ...PLATFORMS[name], cable: false };
  for (const [key, val] of Object.entries(PLATFORMS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return { ...val, cable: false };
  }
  // Regional cable channels — partial match
  for (const [key, val] of Object.entries(REGIONAL_PLATFORMS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return { ...val };
  }
  // Team-branded .TV → MLB.TV (streamable)
  if (name.endsWith('.TV')) {
    return { name: 'MLB.TV', url: 'https://www.mlb.com/tv', color: '#002D72', cable: false };
  }
  // Anything else from a non-national market = cable, show but no link
  if (market && market !== 'national') {
    return { name, color: '#888', cable: true };
  }
  return null; // skip completely unknown national entries
}

// ─── ESPN fetch ───────────────────────────────────────────────────────────────
const ESPN_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';

async function espnFetch(sport, league) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
  const res = await fetch(url, { headers: { 'User-Agent': ESPN_UA, 'Accept': 'application/json' } });
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
  if (statusType.state === 'in')        gameStatus = 'inprogress';
  else if (statusType.state === 'post') gameStatus = 'closed';

  let score = null;
  if (gameStatus !== 'scheduled') {
    score = {
      [home]: parseInt(homeTeam?.score || '0', 10),
      [away]: parseInt(awayTeam?.score || '0', 10),
    };
  }

  // Period label
  const period = status.period || null;
  let periodLabel = null;
  if (gameStatus === 'inprogress' && period) {
    if (sport === 'basketball') {
      periodLabel = statusType.description === 'Halftime' ? 'Half'
        : period > 4 ? `OT${period - 4 > 1 ? period - 4 : ''}` : `Q${period}`;
    } else if (sport === 'baseball') {
      const desc = (statusType.description || '').toLowerCase();
      const half = desc.includes('bottom') ? '▼' : '▲';
      periodLabel = desc.includes('middle') || desc.includes('end') ? `Mid ${period}` : `${half}${period}`;
    }
  }

  // MLB situation
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

  // ── Streams: national streamable first, then cable channels, then league fallback ──
  const broadcasts = comp.broadcasts || [];
  const streamable = [];
  const cableOnly  = [];
  const seen = new Set();

  for (const b of broadcasts) {
    for (const name of (b.names || [])) {
      if (seen.has(name)) continue;
      seen.add(name);
      if (name === 'MLB.TV') continue; // handled as fallback
      const resolved = resolvePlatform(name, b.market);
      if (!resolved) continue;
      if (resolved.cable) cableOnly.push(resolved);
      else streamable.push(resolved);
    }
  }

  const streams = [...streamable, ...cableOnly];
  // Always add league streaming fallback (streamable)
  const fallback = sport === 'baseball'
    ? { name: 'MLB.TV', url: 'https://www.mlb.com/tv', color: '#002D72', cable: false }
    : { name: 'League Pass', url: 'https://www.nba.com/watch', color: '#1D428A', cable: false };
  streams.push(fallback);

  // Local time
  const scheduledDate = new Date(comp.date || event.date);
  const localTime = scheduledDate.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true
  }) + ' ET';

  const notes = comp.notes || [];
  const seriesInfo = notes.find(n => n.type === 'event')?.headline || null;

  return {
    id: comp.id || event.id, sport, home, away,
    homeName: homeTeam?.team?.displayName || home,
    awayName: awayTeam?.team?.displayName || away,
    homeRecord: homeTeam?.records?.[0]?.summary || null,
    awayRecord: awayTeam?.records?.[0]?.summary || null,
    status: gameStatus, scheduled: comp.date || event.date,
    localTime, periodLabel, score, situation, streams, seriesInfo,
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const caches = {
  basketball: { data: null, ts: 0 },
  baseball:   { data: null, ts: 0 },
};
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

// ─── Routes ───────────────────────────────────────────────────────────────────
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

