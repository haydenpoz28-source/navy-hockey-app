const cheerio = require('cheerio');

// Central place to change URLs/IDs if the season, team, or division changes.
const CONFIG = {
  teamId: '524988',
  divisionId: '81652',
  seasonId: '15222',
  playerNumber: '72',
  playerLastName: 'POZERSKI',
};

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NavyHockeyDashboard/1.0)',
      'Accept': 'text/html',
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status}) for ${url}`);
  }
  return res.text();
}

async function loadPage(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim();
  return { $, html, text };
}

function teamPreviewUrl() {
  return `https://gamesheetstats.com/seasons/${CONFIG.seasonId}/teams/${CONFIG.teamId}/preview?configuration=34&filter%5Bdivision%5D=${CONFIG.divisionId}&filter%5Bstatus%5D=completed`;
}

function teamScheduleUrl() {
  return `https://gamesheetstats.com/seasons/${CONFIG.seasonId}/teams/${CONFIG.teamId}/schedule?configuration=34&filter%5Bdivision%5D=${CONFIG.divisionId}`;
}

function standingsUrl() {
  return `https://gamesheetstats.com/seasons/${CONFIG.seasonId}/standings?configuration=34&filter%5Bdivision%5D=${CONFIG.divisionId}&filter%5Bstatus%5D=completed`;
}

function gameUrl(gameId) {
  return `https://gamesheetstats.com/seasons/${CONFIG.seasonId}/games/${gameId}?configuration=34&filter%5Bdivision%5D=${CONFIG.divisionId}&filter%5Bstatus%5D=completed`;
}

module.exports = { CONFIG, fetchHtml, loadPage, teamPreviewUrl, teamScheduleUrl, standingsUrl, gameUrl };
