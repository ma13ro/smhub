const { updateIndex, cors, hashToken } = require('../_lib/store');

// Set this in the Vercel project's env vars if you want an admin override
// that can remove any chart regardless of the self-delete window. Leave it
// unset and only self-delete (within the window) will ever work.
const ADMIN_SECRET = process.env.ADMIN_SECRET;

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE only' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing chart id.' });

  const { deleteToken } = req.body || {};
  const isAdmin = !!ADMIN_SECRET && req.headers['x-admin-secret'] === ADMIN_SECRET;

  let removed = null;
  let failReason = null;

  try {
    await updateIndex((list) => {
      const idx = list.findIndex((c) => c.id === id);
      if (idx === -1) { failReason = 'not_found'; return list; }
      const chart = list[idx];

      if (!isAdmin) {
        const tokenOk = chart.deleteTokenHash && deleteToken && hashToken(deleteToken) === chart.deleteTokenHash;
        if (!tokenOk) { failReason = 'forbidden'; return list; }
        if (!chart.deleteExpiresAt || Date.now() > chart.deleteExpiresAt) { failReason = 'expired'; return list; }
      }

      removed = chart;
      return [...list.slice(0, idx), ...list.slice(idx + 1)];
    });
  } catch (e) {
    console.error('charts/[id]: updateIndex() failed:', e && e.stack || e);
    return res.status(500).json({ error: 'Could not remove the chart. Please try again.' });
  }

  if (!removed) {
    if (failReason === 'expired') {
      return res.status(403).json({ error: 'The 7-day self-delete window for this chart has passed.' });
    }
    if (failReason === 'forbidden') {
      return res.status(403).json({ error: 'Not authorized to delete this chart.' });
    }
    return res.status(404).json({ error: 'Chart not found.' });
  }

  // The .sm blob itself is intentionally left in place — it's cheap to keep,
  // and skipping it avoids a second failure mode (index updated but blob
  // delete fails, or vice versa). The chart just becomes unlisted.
  res.status(200).json({ ok: true });
};
