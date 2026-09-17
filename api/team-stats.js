// Vercel serverless function — now using a real headless Chrome browser
// (via puppeteer-core + @sparticuz/chromium, both free/open-source) instead
// of a plain fetch(). This was necessary because gamesheetstats.com sits
// behind Cloudflare's bot-verification challenge ("Just a moment..."), which
// blocks plain HTTP requests outright — only a browser that can actually run
// JavaScript can get past it. A real browser has meaningfully better odds
// here, but Cloudflare can still detect automation, so this isn't a 100%
// guarantee. If it still fails, the JSON error response will say so.
//
// This still could not be tested against the live site from the environment
// this was built in (that domain isn't reachable there). Check the `error`
// field in the JSON response, or Vercel's function logs, if it's not working.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';

export const config = { maxDuration: 120 };

const PREVIEW_URL = 'https://gamesheetstats.com/seasons/15222/teams/524988/preview?configuration=34&filter%5Bstatus%5D=completed&filter%5Bdivision%5D=81652';
const STANDINGS_URL = 'https://gamesheetstats.com/seasons/15222/standings?configuration=34&filter%5Bdivision%5D=81652&filter%5Bstatus%5D=completed&filter%5Btype%5D=regular_season';

const REAL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

async function launchBrowser() {
  chromium.setGraphicsMode = false;
  const executablePath = await chromium.executablePath();
  // Fix for "libnss3.so: cannot open shared object file" on Vercel — the
  // bundled shared libs sit next to the extracted binary, but the dynamic
  // linker won't look there unless told to explicitly.
  process.env.LD_LIBRARY_PATH = `${path.dirname(executablePath)}:${process.env.LD_LIBRARY_PATH || ''}`;

  return puppeteer.launch({
    args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: chromium.headless,
  });
}

// Navigates to a URL and waits out Cloudflare's interstitial if one appears,
// then returns the fully-rendered HTML.
async function fetchRenderedHtml(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

  for (let i = 0; i < 6; i++) {
    const title = await page.title();
    if (!/just a moment/i.test(title)) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  return page.content();
}

export default async function handler(req, res) {
  let browser;
  try {
    const cheerio = await import('cheerio');

    browser = await launchBrowser();

    // Run both page loads concurrently on separate tabs — sequential loads
    // were pushing total time past the function's limit, since each page
    // can spend several seconds waiting out Cloudflare's challenge.
    const [previewPage, standingsPage] = await Promise.all([
      browser.newPage(),
      browser.newPage(),
    ]);
    await Promise.all([
      previewPage.setUserAgent(REAL_USER_AGENT),
      standingsPage.setUserAgent(REAL_USER_AGENT),
    ]);

    const [previewHtml, standingsHtml] = await Promise.all([
      fetchRenderedHtml(previewPage, PREVIEW_URL),
      fetchRenderedHtml(standingsPage, STANDINGS_URL),
    ]);

    await browser.close();
    browser = null;

    const $preview = cheerio.load(previewHtml);
    const previewText = $preview('body').text().replace(/\s+/g, ' ').trim();

    if (/just a moment/i.test(previewText.slice(0, 200))) {
      throw new Error('Still blocked by Cloudflare challenge after waiting — headless browser was detected as automation.');
    }

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
    if (browser) { try { await browser.close(); } catch (_) {} }
    res.status(500).json({ ok: false, error: err.message });
  }
}
