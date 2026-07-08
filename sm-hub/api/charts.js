const { readIndex, cors } = require('./_lib/store');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  let list;
  try {
    list = await readIndex();
  } catch (e) {
    return res.status(500).json({ error: 'Could not load the chart list.' });
  }

  const sort = (req.query && req.query.sort) || 'top';
  const sorted = [...list].sort((a, b) =>
    sort === 'new' ? b.uploadedAt - a.uploadedAt : (b.votes - a.votes) || (b.uploadedAt - a.uploadedAt)
  );

  res.status(200).json({ charts: sorted });
};
