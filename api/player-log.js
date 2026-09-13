const { loadPage, teamScheduleUrl, gameUrl, CONFIG } = require('./_lib');

function extractSection(text, startLabel, endLabels) {
  const startIdx = text.indexOf(startLabel);
  if (startIdx === -1) return '';
  const sub = text.slice(startIdx + startLabel.length);
  let endIdx = sub.length;
  for (const label of endLabels) {
    const i = label ? sub.indexOf(label) : -1;
    if (i !== -1 && i < endIdx) endIdx = i;
  }
  return sub.slice(0, endIdx);
}

// Goal blocks look like: "06:34 #33 ISAIAH BROWN (2) #31 GRAYSON HEXTER (2) Navy Youth Hockey Gold 14LA"
// First player mentioned = scorer, any additional players = assists.
function parseGoalsForPlayer(text, playerNum, playerLast) {
  const section = extractSection(text, 'GOALS BY PERIOD', ['PENALTIES BY PERIOD']);
  const blocks = section.split(/(?=\d{1,2}:\d{2}(?:GWG|PP|SH)?)/).filter(Boolean);
  let goals = 0;
  let assists = 0;

  for (const block of blocks) {
    const mentions = [...block.matchAll(/#(\d+)\s+([A-Z][A-Z .'-]*?)\s*\(\d+\)/g)];
    mentions.forEach((m, idx) => {
      const num = m[1];
      const name = m[2].trim().toUpperCase();
      const isPlayer = num === playerNum || name.includes(playerLast);
      if (!isPlayer) return;
      if (idx === 0) goals += 1;
      else assists += 1;
    });
  }
  return { goals, assists };
}

// Penalty blocks look like: "05:42 #42 ADON GRANDIN Hooking - Minor, 1.5 min Tri-City Eagles 14LA"
function parsePimForPlayer(text, playerNum, playerLast) {
  const section = extractSection(text, 'PENALTIES BY PERIOD', []);
  const blocks = section.split(/(?=\d{1,2}:\d{2})/).filter(Boolean);
  let pim = 0;

  for (const block of blocks) {
    const m = block.match(/#(\d+)\s+([A-Z][A-Z .'-]*)/);
    if (!m) continue;
    const num = m[1];
    const name = m[2].trim().toUpperCase();
    const isPlayer = num === playerNum || name.includes(playerLast);
    if (!isPlayer) continue;
    const minMatch = block.match(/([\d.]+)\s*min/i);
    if (minMatch) pim += parseFloat(minMatch[1]);
  }
  return pim;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const { $ } = await loadPage(teamScheduleUrl());
    const gameIds = new Set();
    $('a[href*="/games/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const m = href.match(/\/games\/(\d+)/);
      if (m) gameIds.add(m[1]);
    });

    const results = [];
    for (const id of gameIds) {
      try {
        const { text } = await loadPage(gameUrl(id));
        if (!/FINAL/i.test(text)) continue; // only count completed games

        const dateMatch = text.match(/[A-Z][a-z]{2}\s+\d{1,2},\s*\d{4}/);
        const oppMatch =
          text.match(/Visitor[^]*?\n?([A-Za-z0-9 .'-]+?14LA)/) ||
          text.match(/([A-Za-z0-9 .'-]+?14LA)(?=[\s\S]*Home)/);

        const { goals, assists } = parseGoalsForPlayer(text, CONFIG.playerNumber, CONFIG.playerLastName);
        const pim = parsePimForPlayer(text, CONFIG.playerNumber, CONFIG.playerLastName);

        results.push({
          id,
          date: dateMatch ? dateMatch[0] : null,
          opponent: oppMatch ? oppMatch[1].trim() : 'Opponent',
          g: goals,
          a: assists,
          pim,
        });
      } catch (innerErr) {
        results.push({ id, error: String(innerErr) });
      }
    }

    res.status(200).json({ ok: true, games: results, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
};
