const PLAYER_URL = 'https://gamesheetstats.com/seasons/15222/players/8292333?configuration=34&filter%5Bdivision%5D=81652&filter%5Bstatus%5D=completed';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://gamesheetstats.com/',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Dest': 'document',
};

export default async function handler(req, res) {
  try {
    const cheerio = await import('cheerio');

    const playerRes = await fetch(PLAYER_URL, { headers: BROWSER_HEADERS });
    if (!playerRes.ok) {
      const body = (await playerRes.text()).slice(0, 300);
      throw new Error(`Upstream fetch failed: ${playerRes.status} | body: ${body}`);
    }

    const html = await playerRes.text();
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    const gpMatch = text.match(/\bGP\s*(\d+)/i);
    const gMatch = text.match(/\bG\s*(\d+)\s*A\b/i);
    const aMatch = text.match(/\bA\s*(\d+)\s*PTS\b/i);
    const ptsMatch = text.match(/\bPTS\s*(\d+)/i);
    const pimMatch = text.match(/\bPIM\s*([\d.]+)/i);

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
