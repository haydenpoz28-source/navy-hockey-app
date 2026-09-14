// Same idea as team-stats.js — server-side fetch avoids the browser's CORS
// block. Also unverified against the live site; check Vercel function logs
// if the numbers come back null and adjust the regex/selectors below.

const PLAYER_URL = 'https://gamesheetstats.com/seasons/15222/players/8292333?configuration=34&filter%5Bdivision%5D=81652&filter%5Bstatus%5D=completed';

export default async function handler(req, res) {
  try {
    const cheerio = await import('cheerio');

    const playerRes = await fetch(PLAYER_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!playerRes.ok) throw new Error(`Upstream fetch failed: ${playerRes.status}`);

    const html = await playerRes.text();
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    // season totals — labels observed on the player page: GP, G, A, PTS, PIM
    const gpMatch = text.match(/\bGP\s*(\d+)/i);
    const gMatch = text.match(/\bG\s*(\d+)\s*A\b/i); // "G <n> A" pattern from the stat strip
    const aMatch = text.match(/\bA\s*(\d+)\s*PTS\b/i);
    const ptsMatch = text.match(/\bPTS\s*(\d+)/i);
    const pimMatch = text.match(/\bPIM\s*([\d.]+)/i);

    // "Last 5" games list — each entry looks like:
    // "Sep 13 @ Ashburn Xtreme 14LA ... L 0 - 7"
    const games = [];
    const gameBlockRegex = /([A-Z][a-z]{2} \d{1,2})\s*(@|VS)\s*([A-Za-z0-9 .'-]+?14LA)[^A-Za-z]*(W|L|T)\s*(\d+)\s*-\s*(\d+)/g;
    let m;
    while ((m = gameBlockRegex.exec(text)) !== null) {
      games.push({
        date: m[1],
        homeAway: m[2] === '@' ? 'away' : 'home',
        opponent: m[3].trim(),
        result: m[4],
        scoreFor: m[2] === '@' ? m[6] : m[5],
        scoreAgainst: m[2] === '@' ? m[5] : m[6],
      });
    }

    res.status(200).json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      gp: gpMatch ? parseInt(gpMatch[1], 10) : null,
      g: gMatch ? parseInt(gMatch[1], 10) : null,
      a: aMatch ? parseInt(aMatch[1], 10) : null,
      pts: ptsMatch ? parseInt(ptsMatch[1], 10) : null,
      pim: pimMatch ? parseFloat(pimMatch[1]) : null,
      recentGames: games,
      _debugTextSample: text.slice(0, 500),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
