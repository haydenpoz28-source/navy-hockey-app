const { loadPage, teamPreviewUrl } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const { text } = await loadPage(teamPreviewUrl());

    const rankRecordMatch = text.match(/(\d+)(?:st|nd|rd|th) Place\s*\((\d+-\d+-\d+(?:-\d+)?)\)/i);
    const ppMatch = text.match(/PP%\s*([\d.]+%)/i);
    const pkMatch = text.match(/PK%\s*([\d.]+%)/i);
    const gdMatch = text.match(/\bGD\s*(\+?-?\d+)/i);
    const streakMatch = text.match(/Streak\s*([A-Za-z0-9\-\s]{1,12}?)(?=\s*(Leaders|Goals|$))/i);

    const data = {
      rank: rankRecordMatch ? rankRecordMatch[1] : null,
      record: rankRecordMatch ? rankRecordMatch[2] : null,
      pp: ppMatch ? ppMatch[1] : null,
      pk: pkMatch ? pkMatch[1] : null,
      gd: gdMatch ? gdMatch[1] : null,
      streak: streakMatch ? streakMatch[1].trim() : null,
    };

    const parsedOk = Object.values(data).some((v) => v !== null);

    res.status(200).json({
      ok: parsedOk,
      data,
      fetchedAt: new Date().toISOString(),
      ...(parsedOk ? {} : { debugText: text.slice(0, 800) }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
};
