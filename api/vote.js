const { updateIndex, cors, toPublic } = require('./_lib/store');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { id, dir } = req.body || {};
  const delta = dir === -1 || dir === '-1' ? -1 : 1; // anything else defaults to an upvote
  if (!id) return res.status(400).json({ error: 'Missing chart id.' });

  let updated = null;
  try {
    await updateIndex((list) => {
      const next = list.map((c) => {
        if (c.id !== id) return c;
        updated = { ...c, votes: c.votes + delta };
        return updated;
      });
      return next;
    });
  } catch (e) {
    console.error('vote: updateIndex() failed:', e && e.stack || e);
    return res.status(500).json({ error: 'Could not register the vote. Please try again.' });
  }

  if (!updated) return res.status(404).json({ error: 'Chart not found.' });
  res.status(200).json({ ok: true, chart: toPublic(updated) });
};
