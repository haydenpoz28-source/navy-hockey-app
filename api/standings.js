const { loadPage, standingsUrl, CONFIG } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const { $ } = await loadPage(standingsUrl());

    // Find the standings table by locating a table that has a header row
    // containing "GP" and "PTS" - tolerant to extra/missing columns.
    let table = null;
    $('table').each((i, el) => {
      const headerText = $(el).find('tr').first().text().toUpperCase();
      if (headerText.includes('GP') && headerText.includes('PTS')) {
        table = $(el);
      }
    });

    if (!table) {
      const bodyText = $('body').text().slice(0, 800);
      return res.status(200).json({ ok: false, rows: [], debugText: bodyText });
    }

    const headerCells = table
      .find('tr')
      .first()
      .find('th,td')
      .map((i, el) => $(el).text().trim().toUpperCase())
      .get();

    const colIndex = (label) => headerCells.findIndex((h) => h === label);
    const idx = {
      rank: 0, // first column is usually rank, sometimes unlabeled
      team: headerCells.findIndex((h) => h.includes('TEAM')),
      gp: colIndex('GP'),
      w: colIndex('W'),
      l: colIndex('L'),
      t: colIndex('T'),
      pts: colIndex('PTS'),
      gf: colIndex('GF'),
      ga: colIndex('GA'),
      diff: colIndex('DIFF'),
      stk: colIndex('STK'),
    };

    const rows = [];
    table.find('tr').each((i, row) => {
      if (i === 0) return; // skip header
      const cells = $(row)
        .find('td,th')
        .map((j, c) => $(c).text().trim())
        .get();
      if (cells.length < 5) return;

      const team = idx.team >= 0 ? cells[idx.team] : cells[1];
      if (!team) return;

      rows.push({
        rank: cells[idx.rank] || String(i),
        team,
        gp: idx.gp >= 0 ? cells[idx.gp] : '',
        w: idx.w >= 0 ? cells[idx.w] : '',
        l: idx.l >= 0 ? cells[idx.l] : '',
        t: idx.t >= 0 ? cells[idx.t] : '',
        pts: idx.pts >= 0 ? cells[idx.pts] : '',
        gf: idx.gf >= 0 ? cells[idx.gf] : '',
        ga: idx.ga >= 0 ? cells[idx.ga] : '',
        diff: idx.diff >= 0 ? cells[idx.diff] : '',
        streak: idx.stk >= 0 ? cells[idx.stk] : '',
        me: team.toUpperCase().includes('NAVY') && team.toUpperCase().includes('GOLD'),
      });
    });

    res.status(200).json({ ok: rows.length > 0, rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
};
