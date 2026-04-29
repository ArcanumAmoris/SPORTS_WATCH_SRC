const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Full platform map with correct URLs ──────────────────────────────────────
const PLATFORMS = {
  'ESPN':                { name: 'ESPN',          url: 'https://www.espn.com/watch',                    color: '#E60000' },
  'ESPN2':               { name: 'ESPN2',         url: 'https://www.espn.com/watch',                    color: '#E60000' },
  'ESPN Unlmtd':         { name: 'ESPN+',         url: 'https://www.espn.com/watch',                    color: '#E60000' },
  'ESPN+':               { name: 'ESPN+',         url: 'https://www.espn.com/watch',                    color: '#E60000' },
  'ABC':                 { name: 'ABC',           url: 'https://abc.com/watch-live-tv',                 color: '#006AB3' },
  'TNT':                 { name: 'TNT / Max',     url: 'https://www.max.com/sports',                    color: '#E4002B' },
  'TBS':                 { name: 'TBS / Max',     url: 'https://www.max.com/sports',                    color: '#E4002B' },
  'truTV':               { name: 'truTV / Max',   url: 'https://www.max.com/sports',                    color: '#E4002B' },
  'Max':                 { name: 'Max',           url: 'https://www.max.com/sports',                    color: '#002BE7' },
  'NBC':                 { name: 'NBC',           url: 'https://www.nbc.com/live',                      color: '#0A5FA8' },
  'Peacock':             { name: 'Peacock',       url: 'https://www.peacocktv.com/sports',              color: '#000000' },
  'NBA TV':              { name: 'NBA TV',        url: 'https://www.nba.com/watch',                     color: '#1D428A' },
  'NBA League Pass':     { name: 'League Pass',   url: 'https://www.nba.com/watch',                     color: '#1D428A' },
  'MLB.TV':              { name: 'MLB.TV',        url: 'https://www.mlb.com/tv',                        color: '#002D72' },
  'TBS':                 { name: 'TBS / Max',     url: 'https://www.max.com/sports',                    color: '#E4002B' },
  'FS1':                 { name: 'Fox Sports 1',  url: 'https://www.foxsports.com/live',                color: '#E4002B' },
  'FS2':                 { name: 'Fox Sports 2',  url: 'https://www.foxsports.com/live',                color: '#E4002B' },
  'Prime Video':         { name: 'Prime Video',   url: 'https://www.amazon.com/primevideo',             color: '#00A8E1' },
  'Apple TV+':           { name: 'Apple TV+',     url: 'https://tv.apple.com',                          color: '#444444' },
  'fubo':                { name: 'FuboTV',        url: 'https://www.fubo.tv',                           color: '#E4002B' },
};

// Regional channel → correct streaming URL (MLB.TV carries regional games)
const REGIONAL_PLATFORMS = {
  'MASN':                { name: 'MASN',              url: 'https://www.mlb.com/tv', color: '#002D72' },
  'NESN':                { name: 'NESN',              url: 'https://www.nesn.com',   color: '#002D72' },
  'YES':                 { name: 'YES Network',       url: 'https://www.mlb.com/tv', color: '#002D72' },
  'CHSN':                { name: 'Chicago SN',        url: 'https://www.mlb.com/tv', color: '#002D72' },
  'Bally':               { name: 'FanDuel SN',        url: 'https://www.mlb.com/tv', color: '#002D72' },
  'FanDuel':             { name: 'FanDuel SN',        url: 'https://www.mlb.com/tv', color: '#002D72' },
  'Marquee':             { name: 'Marquee SN',        url: 'https://www.mlb.com/tv', color: '#002D72' },
  'NBC Sports':          { name: 'NBC Sports RSN',    url: 'https://www.mlb.com/tv', color: '#002D72' },
  'Space City':          { name: 'Space City HN',     url: 'https://www.mlb.com/tv', color: '#002D72' },
  'Sportsnet':           { name: 'Sportsnet',         url: 'https://www.sportsnet.ca/live', color: '#002D72' },
};

function resolvePlatform(name) {
  // Exact match first
  if (PLATFORMS[name]) return { ...PLATFORMS[name] };
  // Partial match on national platforms
  for (const [key, val] of Object.entries(PLATFORMS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return { ...val };
  }
  // Partial match on regional
  for (const [key, val] of Object.entries(REGIONAL_PLATFORMS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return { name: val.name, url: val.url, color: val.color };
  }
  // Team-branded streaming (.TV suffix) → MLB.TV
  if (name.endsWith('.TV') || name.includes('GuardianTV') || name.includes('RaysTV')) {
    return { name: 'MLB.TV', url: 'https://www.mlb.com/tv', color: '#002D72' };
  }
  return null; // skip unknown
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

  // ── Streams: national first, then one regional, then league fallback ─────────
  const broadcasts = comp.broadcasts || [];
  const nationalStreams = [];
  const regionalStreams = [];
  const seen = new Set();

  // Separate national vs regional
  for (const b of broadcasts) {
    const isNational = b.market === 'national';
    for (const name of (b.names || [])) {
      if (seen.has(name)) continue;
      seen.add(name);
      const resolved = resolvePlatform(name);
      if (!resolved) continue;
      // MLB.TV alone is not useful as "national" — treat as fallback
      if (name === 'MLB.TV') continue;
      if (isNational) nationalStreams.push(resolved);
      else regionalStreams.push(resolved);
    }
  }

  const streams = [...nationalStreams];
  // Add one regional only if no national TV (common for MLB)
  if (streams.length === 0 && regionalStreams.length > 0) streams.push(regionalStreams[0]);
  // Always add league streaming service as last option
  const fallback = sport === 'baseball'
    ? { name: 'MLB.TV', url: 'https://www.mlb.com/tv', color: '#002D72' }
    : { name: 'League Pass', url: 'https://www.nba.com/watch', color: '#1D428A' };
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
