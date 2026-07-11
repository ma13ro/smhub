const { randomUUID } = require('crypto');
const { put } = require('@vercel/blob');
const { updateIndex, cors, BLOB_TOKEN, DELETE_WINDOW_MS, hashToken } = require('./_lib/store');
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
  const deleteToken = randomUUID();
  const uploadedAt = Date.now();

  let blob;
  try {
    blob = await put(`charts/${id}.sm`, content, {
      access: 'public',
      contentType: 'text/plain; charset=utf-8',
      addRandomSuffix: false,
      token: BLOB_TOKEN,
    });
  } catch (e) {
    console.error('upload: put() failed:', e && e.stack || e);
    return res.status(500).json({ error: 'Could not store the file. Please try again.' });
  }

  const entry = {
    id,
    title,
    artist,
    uploader: String(uploader || 'Anonymous').slice(0, 40) || 'Anonymous',
    type: isDouble ? 'double' : 'single',
    votes: 0,
    reports: 0,
    uploadedAt,
    url: blob.url,
    size: content.length,
    // Never the plaintext token — only its hash, plus when self-delete expires.
    deleteTokenHash: hashToken(deleteToken),
    deleteExpiresAt: uploadedAt + DELETE_WINDOW_MS,
  };

  try {
    await updateIndex((list) => [...list, entry]);
  } catch (e) {
    console.error('upload: updateIndex() failed:', e && e.stack || e);
    return res.status(500).json({ error: 'File stored, but the listing could not be updated. Please try again.' });
  }

  // deleteToken/deleteExpiresAt are returned only in this one response —
  // the client is expected to hold onto them (e.g. localStorage) since the
  // server never has the plaintext token again after this.
  const { deleteTokenHash, ...publicEntry } = entry;
  res.status(200).json({ ok: true, chart: { ...publicEntry, deleteToken, deleteExpiresAt: entry.deleteExpiresAt } });
};
