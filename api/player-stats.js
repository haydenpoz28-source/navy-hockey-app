// Same headless-browser approach as team-stats.js — see the comment there
// for why this is necessary (Cloudflare's bot challenge blocks plain fetch).

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';

export const config = { maxDuration: 120 };

const PLAYER_URL = 'https://gamesheetstats.com/seasons/15222/players/8292333?configuration=34&filter%5Bdivision%5D=81652&filter%5Bstatus%5D=completed';

const REAL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

async function launchBrowser() {
  chromium.setGraphicsMode = false;
  const executablePath = await chromium.executablePath();
  process.env.LD_LIBRARY_PATH = `${path.dirname(executablePath)}:${process.env.LD_LIBRARY_PATH || ''}`;

  return puppeteer.launch({
    args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: chromium.headless,
  });
}

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
    const page = await browser.newPage();
    await page.setUserAgent(REAL_USER_AGENT);

    const html = await fetchRenderedHtml(page, PLAYER_URL);
    await browser.close();
    browser = null;

    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    if (/just a moment/i.test(text.slice(0, 200))) {
      throw new Error('Still blocked by Cloudflare challenge after waiting — headless browser was detected as automation.');
    }

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
    if (browser) { try { await browser.close(); } catch (_) {} }
    res.status(500).json({ ok: false, error: err.message });
  }
}
