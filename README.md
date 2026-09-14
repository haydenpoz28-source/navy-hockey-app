# Navy Hockey Dashboard

## What changed from the Claude.ai version

1. **Storage fix (this definitely works):** the old version used `window.storage`,
   which only exists inside Claude.ai's chat interface. That's why the deployed
   Vercel site had no saved stats or game log — every save/load silently failed.
   It's now using standard browser `localStorage`, which works on any real site.
   Your data is stored per-browser on the device you use it on.

2. **Live CBHL sync (best-effort, needs verification):** `/api/team-stats.js` and
   `/api/player-stats.js` are Vercel serverless functions. They run on Vercel's
   server, not in the browser, so they aren't blocked by the cross-origin (CORS)
   restriction that stops the browser from talking to GameSheet directly. The
   dashboard calls these on load and whenever you click **"Refresh from CBHL"**.

## Deploying

1. Push this folder to a GitHub repo (or drag-and-drop deploy via the Vercel
   dashboard).
2. Import it into Vercel. No environment variables or config needed —
   `package.json` declares the one dependency (`cheerio`), and Vercel
   auto-detects the `/api` folder as serverless functions.
3. Visit the deployed URL.

## If live CBHL data doesn't show up

I built the scrapers by reading GameSheet's pages manually, but I could not
test an actual server-side fetch against gamesheetstats.com from the
environment I built this in (that domain wasn't reachable there). So treat
this as a strong first attempt, not a guarantee. If the numbers don't
populate:

1. Open your deployed site, open browser dev tools → Console tab, and look
   for `team-stats API error` or `team-stats fetch failed` messages.
2. Or visit `https://your-site.vercel.app/api/team-stats` directly in a
   browser tab — it returns raw JSON, including a `_debugPreviewTextSample`
   field showing the actual text GameSheet returned. That tells us immediately
   whether the page is being fetched at all, and what its real structure looks
   like, so the regex/selectors can be corrected.
3. Same for `/api/player-stats`.
4. Paste that JSON back to Claude and the parsing logic can be corrected to
   match the real output — that's a quick fix once we can actually see what
   the server gets back, which wasn't possible to check beforehand.

## If it still can't get live data at all

Some sites block server-to-server requests from generic HTTP clients (bot
detection, Cloudflare, etc.), which a `User-Agent` header sometimes works
around and sometimes doesn't. If that turns out to be the case here, the
dashboard still works fine on manually-pushed data — just tell Claude "update
my stats" with a link or box score after each game, the same workflow used
before, and it'll edit `index.html` directly for you to redeploy.
