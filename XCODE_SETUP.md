# Game Day — iOS Setup Guide

## First time setup (run once in Terminal)

```bash
# 1. Navigate to your project
cd SPORTS_WATCH_SRC

# 2. Install all dependencies including Capacitor
npm install

# 3. Add iOS platform
npx cap add ios

# 4. Sync web assets to iOS
npx cap sync ios

# 5. Open in Xcode
npx cap open ios
```

## In Xcode

1. Click the top-level **App** project in the left sidebar
2. Under **Signing & Capabilities** → select your **Team** (your Apple ID)
3. **Bundle Identifier** is already set to `com.gameday.app`
4. Change it to something unique like `com.YOURNAME.gameday`
5. Connect your iPhone via USB (or use Simulator)
6. Hit the **▶ Play** button to test

## Submit to App Store

1. Make sure your iPhone is disconnected
2. Select **Any iOS Device** in the device picker at top
3. Menu: **Product → Archive**
4. When done: **Distribute App → App Store Connect → Upload**
5. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
6. Fill in: name (Game Day), description, screenshots, category (Sports)
7. Submit for review — Apple takes 1–3 days

## App Store description (suggested)

**Game Day** — Never miss a game.

Follow your favorite NBA and MLB teams. See live scores, current quarter or inning, and exactly where to watch tonight — ESPN, NBC, Peacock, Prime Video and more.

- Live scores updated every 2 minutes
- Real broadcast info for every game
- Follow teams across NBA and MLB
- Tap to open your streaming app directly

Category: Sports
Age Rating: 4+
Price: Free
