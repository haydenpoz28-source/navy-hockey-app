// Vercel serverless function — runs on the server, so it is NOT subject to
// the browser's cross-origin (CORS) restrictions that block this fetch from
// working inside client-side JS. This is the piece that makes live CBHL data
// possible once this app is deployed as a real site (it can't work as a
// static file alone, or inside a Claude.ai artifact sandbox).
//
// NOTE: this was written without being able to test a live fetch against
// gamesheetstats.com (that domain isn't reachable from the environment this
// was built in). The parsing logic is a best-effort based on the page
// content observed manually. If GameSheet changes their markup, or if the
// data is loaded client-side via a separate API call rather than rendered
// into the initial HTML, this will need adjusting — check the console.error
// output in Vercel's function logs for clues.

const PREVIEW_URL = 'https://gamesheetstats.com/seasons/15222/teams/524988/preview?configuration=34&filter%5Bstatus%5D=completed&filter%5Bdivision%5D=81652';
const STANDINGS_URL = 'https://gamesheetstats.com/seasons/15222/standings?configuration=34&filter%5Bdivision%5D=81652&filter%5Bstatus%5D=completed';

export default async function handler(req, res) {
  try {
    const cheerio = await import('cheerio');

    const [previewRes, standingsRes] = await Promise.all([
      fetch(PREVIEW_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      fetch(STANDINGS_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
    ]);

    if (!previewRes.ok || !standingsRes.ok) {
      throw new Error(`Upstream fetch failed: preview=${previewRes.status} standings=${standingsRes.status}`);
    }

    const previewHtml = await previewRes.text();
    const standingsHtml = await standingsRes.text();

    const $preview = cheerio.load(previewHtml);
    const previewText = $preview('body').text().replace(/\s+/g, ' ').trim();

    // ---- team-level record / PP / PK / GD / streak from the preview page ----
    const recordAllMatch = previewText.match(/\((\d+)-(\d+)-(\d+)(?:-(\d+))?\)/);
    const ppMatch = previewText.match(/PP%\s*([\d.]+%)/i);
    const pkMatch = previewText.match(/PK%\s*([\d.]+%)/i);
    const gdMatch = previewText.match(/\bGD\s*(-?\d+)/);
    const streakMatch = previewText.match(/Streak\s*([A-Za-z]+ ?\d*)/i);
    const pimPgMatch = previewText.match(/PIM\s*PG\s*([\d.]+)/i);
    const ppGpgMatch = previewText.match(/PP\s*GPG\s*([\d.]+)/i);

    const recordAll = recordAllMatch
      ? `${recordAllMatch[1]}-${recordAllMatch[2]}-${recordAllMatch[3]}`
      : null;

    // ---- division standings table ----
    const $standings = cheerio.load(standingsHtml);
    const rows = [];
    $standings('table tr').each((i, el) => {
      const cells = $standings(el)
        .find('td,th')
        .map((j, cell) => $standings(cell).text().trim())
        .get()
        .filter(Boolean);
      if (cells.length > 3) rows.push(cells);
    });

    // first row is usually the header — try to detect it and drop it
    const header = rows[0] && /rk|team/i.test(rows[0].join(' ')) ? rows.shift() : null;

    res.status(200).json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      recordAll,
      pp: ppMatch ? ppMatch[1] : null,
      pk: pkMatch ? pkMatch[1] : null,
      gd: gdMatch ? gdMatch[1] : null,
      streak: streakMatch ? streakMatch[1].trim() : null,
      pimPerGame: pimPgMatch ? pimPgMatch[1] : null,
      ppGoalsPerGame: ppGpgMatch ? ppGpgMatch[1] : null,
      standingsHeader: header,
      standingsRows: rows,
      // raw text included for debugging in Vercel logs / manual inspection —
      // safe to remove once this is confirmed working
      _debugPreviewTextSample: previewText.slice(0, 500),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
