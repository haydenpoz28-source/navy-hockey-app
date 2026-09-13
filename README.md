# Navy Hockey Dashboard — Live Version

This is a real website (not just a chat file) that checks CBHL/GameSheet
live every time you open it or hit Refresh — no coming back to chat needed
for stats/standings to update.

## What's here
- `public/index.html` — your dashboard (same one you've been using, now
  wired to fetch live data)
- `api/team.js` — scrapes team record, PP%, PK%, GD, streak
- `api/standings.js` — scrapes the division standings table
- `api/player-log.js` — scans your team's completed box scores for
  Hayden Pozerski (#72) and pulls goals/assists/PIM per game
- `api/games.js` — helper endpoint listing the team's games

## Deploying (free, ~10 minutes, one time)

1. **Install Node.js** if you don't have it: https://nodejs.org (LTS version)
2. **Install the Vercel CLI**. Open Terminal (Mac) or Command Prompt (Windows)
   and run:
   ```
   npm install -g vercel
   ```
3. **Unzip this folder** somewhere on your computer, then `cd` into it in
   the terminal:
   ```
   cd path/to/navy-hockey-app
   ```
4. **Deploy**:
   ```
   vercel
   ```
   - First time, it'll ask you to log in (free account, email or GitHub).
   - Accept the defaults for all setup questions.
5. When it finishes, it gives you a URL like `https://navy-hockey-app.vercel.app`.
   Open that on your iPad and add it to your Home Screen (Share → Add to
   Home Screen) so it feels like an app icon.
6. For future updates to the code (if we tweak the scraper), run
   `vercel --prod` again from the same folder.

## Important: this WILL need a debugging pass

I wrote the scraper based on the page content I could see, but I can't
fully test it against the live site's exact HTML from where I'm building
this. After you deploy, open the site and check:

- Does the stat rail / team panel show real numbers, or blanks?
- Does "Refresh" show "Synced with CBHL" or an error message?

If anything looks off, come back to this chat, tell me what you're seeing
(or paste what shows up if you visit `your-url.vercel.app/api/team`
directly in a browser — it should show raw JSON), and I'll fix the
parsing logic and give you an updated file to redeploy.

## What still works the old way
- Your profile photo, name, position, team logo — saved locally, editable anytime
- Practice schedule via .ics import — unaffected by any of this
- Manual "Add game" for anything not on CBHL (still there as a backup)
