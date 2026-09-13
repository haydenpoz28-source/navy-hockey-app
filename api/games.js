const { loadPage, teamScheduleUrl, CONFIG } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const { $ } = await loadPage(teamScheduleUrl());

    const games = [];
    const seen = new Set();

    $('a[href*="/games/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/\/games\/(\d+)/);
      if (!match) return;
      const gameId = match[1];
      if (seen.has(gameId)) return;
      seen.add(gameId);

      // Look at the nearest row-like ancestor for context (date, opponent, final/score).
      const context = $(el).closest('tr,li,div').text().replace(/\s+/g, ' ').trim();
      const isCompleted = /FINAL|\bF\b/i.test(context) || /\d+\s*-\s*\d+/.test(context);
      const dateMatch = context.match(/[A-Z][a-z]{2}\s+\d{1,2}(?:,\s*\d{4})?/);

      games.push({
        id: gameId,
        completed: isCompleted,
        context,
        date: dateMatch ? dateMatch[0] : null,
      });
    });

    res.status(200).json({
      ok: games.length > 0,
      games,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
};
