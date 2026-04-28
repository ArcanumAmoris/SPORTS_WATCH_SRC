# NBA Tracker — PWA

Follow your teams. See where to watch tonight. Works on iPhone as a home screen app.

---

## What it does

- Pick any of the 30 NBA teams to follow
- Shows tonight's games with live scores, quarter, clock
- Shows exactly which platform to watch on (ESPN, TNT/Max, ABC, League Pass) with direct links
- Refreshes automatically every 2 minutes
- Installable on iPhone — looks and feels like a native app
- Your followed teams are saved on-device (localStorage)

---

## Deploy to Vercel (free, ~5 minutes)

### 1. Install dependencies locally first (optional, just to verify)
```bash
npm install
npm start
# visit http://localhost:3000
```

### 2. Push to GitHub
```bash
git init
git add .
git commit -m "nba tracker"
gh repo create nba-tracker --public --push
# or manually create repo on github.com and push
```

### 3. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Framework preset: **Other**
4. Build command: (leave blank)
5. Output directory: `public`
6. Install command: `npm install`
7. Start command: `node server.js`
8. Click Deploy

> Vercel will give you a live URL like `https://nba-tracker-xyz.vercel.app`

### 4. Add a SportRadar API key (for real live data)
1. Sign up at [developer.sportradar.com](https://developer.sportradar.com)
2. Get your NBA v8 API key (free trial available)
3. In Vercel → Project → Settings → Environment Variables
4. Add: `SPORTRADAR_KEY` = your key
5. Redeploy

Without a key the app uses realistic mock data so you can still test everything.

---

## Add to iPhone home screen

1. Open the app URL in **Safari** on iPhone
2. Tap the **Share** button (box with arrow)
3. Scroll down → tap **"Add to Home Screen"**
4. Name it "NBA" → tap **Add**

It now lives on your home screen with a full-screen experience, no browser chrome.

---

## Project structure

```
nba-tracker/
├── server.js              # Express backend — fetches NBA schedule, maps broadcasts
├── package.json
├── public/
│   ├── index.html         # PWA shell
│   ├── style.css          # Dark sports UI
│   ├── app.js             # Team picker, game cards, API fetch
│   ├── sw.js              # Service worker — offline support
│   ├── manifest.json      # PWA manifest — makes it installable
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
└── README.md
```

---

## Broadcast mapping logic

The server maps games to platforms using the 2025-26 NBA playoff broadcast schedule:

| Day       | Platform      |
|-----------|---------------|
| Monday    | TNT / Max     |
| Tuesday   | ESPN          |
| Wednesday | ESPN or TNT   |
| Thursday  | TNT / Max     |
| Friday    | ESPN          |
| Saturday  | ABC / ESPN+   |
| Sunday    | ABC / ESPN+   |

NBA League Pass is always listed as the streaming fallback for out-of-market viewers.

---

## Customization

- **Refresh rate**: Change `2 * 60 * 1000` in `app.js` (currently every 2 min)
- **Broadcast data**: Update `BROADCAST_MAP` in `server.js` for regular season vs playoffs
- **Cache TTL**: Change `CACHE_TTL` in `server.js` (currently 5 min)

---

## Alternative deploy: Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Set start command: `node server.js`
3. Add env var `SPORTRADAR_KEY`
4. Done — Railway handles the always-on Node server better than Vercel for persistent connections
