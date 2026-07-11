const { updateIndex, cors } = require('./_lib/store');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing chart id.' });

  let updated = null;
  try {
    await updateIndex((list) => list.map((c) => {
      if (c.id !== id) return c;
      updated = { ...c, reports: (c.reports || 0) + 1 };
      return updated;
    }));
  } catch (e) {
    console.error('report: updateIndex() failed:', e && e.stack || e);
    return res.status(500).json({ error: 'Could not register the report. Please try again.' });
  }

  if (!updated) return res.status(404).json({ error: 'Chart not found.' });
  res.status(200).json({ ok: true });
};
