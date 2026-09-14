const PREVIEW_URL = 'https://gamesheetstats.com/seasons/15222/teams/524988/preview?configuration=34&filter%5Bstatus%5D=completed&filter%5Bdivision%5D=81652';
const STANDINGS_URL = 'https://gamesheetstats.com/seasons/15222/standings?configuration=34&filter%5Bdivision%5D=81652&filter%5Bstatus%5D=completed';

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

    const [previewRes, standingsRes] = await Promise.all([
      fetch(PREVIEW_URL, { headers: BROWSER_HEADERS }),
      fetch(STANDINGS_URL, { headers: BROWSER_HEADERS }),
    ]);

    if (!previewRes.ok || !standingsRes.ok) {
      const previewBody = previewRes.ok ? '' : (await previewRes.text()).slice(0, 300);
      const standingsBody = standingsRes.ok ? '' : (await standingsRes.text()).slice(0, 300);
      throw new Error(
        `Upstream fetch failed: preview=${previewRes.status} standings=${standingsRes.status}` +
        (previewBody ? ` | previewBody: ${previewBody}` : '') +
        (standingsBody ? ` | standingsBody: ${standingsBody}` : '')
      );
    }

    const previewHtml = await previewRes.text();
    const standingsHtml = await standingsRes.text();

    const $preview = cheerio.load(previewHtml);
    const previewText = $preview('body').text().replace(/\s+/g, ' ').trim();

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
      _debugPreviewTextSample: previewText.slice(0, 500),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
