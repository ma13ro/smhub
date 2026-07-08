const { randomUUID } = require('crypto');
const { put } = require('@vercel/blob');
const { updateIndex, cors } = require('./_lib/store');
const { validateSM, tag } = require('./_lib/validate');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { content, uploader } = req.body || {};

  const err = validateSM(content);
  if (err) return res.status(400).json({ error: err });

  const title = tag(content, 'TITLE') || 'Untitled';
  const artist = tag(content, 'ARTIST') || 'Unknown';
  const isDouble = /#NOTES:\s*dance-double\s*:/i.test(content);

  const id = randomUUID();

  let blob;
  try {
    blob = await put(`charts/${id}.sm`, content, {
      access: 'public',
      contentType: 'text/plain; charset=utf-8',
      addRandomSuffix: false,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Could not store the file. Please try again.' });
  }

  const entry = {
    id,
    title,
    artist,
    uploader: String(uploader || 'Anonymous').slice(0, 40) || 'Anonymous',
    type: isDouble ? 'double' : 'single',
    votes: 0,
    uploadedAt: Date.now(),
    url: blob.url,
    size: content.length,
  };

  try {
    await updateIndex((list) => [...list, entry]);
  } catch (e) {
    return res.status(500).json({ error: 'File stored, but the listing could not be updated. Please try again.' });
  }

  res.status(200).json({ ok: true, chart: entry });
};
