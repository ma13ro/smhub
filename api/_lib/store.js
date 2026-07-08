const { put, head, BlobPreconditionFailedError, BlobNotFoundError } = require('@vercel/blob');

const INDEX_PATH = 'index.json';
const MAX_RETRIES = 5;

// Reads the current index and its ETag. Returns an empty list (no etag) only
// when the index genuinely doesn't exist yet (BlobNotFoundError) — that's
// expected on the very first upload. Any other error (bad/missing
// credentials, store not found, etc.) is logged and rethrown rather than
// silently treated the same way, which would otherwise show up as a
// misleading empty chart list instead of a real error.
async function readIndexRaw() {
  let meta;
  try {
    meta = await head(INDEX_PATH);
  } catch (e) {
    if (e instanceof BlobNotFoundError) return { list: [], etag: null };
    console.error('store: head() failed:', e && e.stack || e);
    throw e;
  }
  const res = await fetch(meta.url, { cache: 'no-store' });
  const list = res.ok ? await res.json() : [];
  return { list, etag: meta.etag };
}

// Read-only helper for GET /api/charts.
async function readIndex() {
  const { list } = await readIndexRaw();
  return list;
}

// Safely applies `mutate(list) -> newList` to the shared index. Uses
// Vercel Blob's conditional-write (ifMatch) support: if another request
// (an upload or a vote landing at the same moment) changed the index
// between our read and our write, the write is rejected and we retry
// with a fresh read. A handful of retries is more than enough at the
// traffic this project expects — this gets us safe concurrent writes
// without needing a separate database.
async function updateIndex(mutate) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { list, etag } = await readIndexRaw();
    const next = mutate(list);
    try {
      await put(INDEX_PATH, JSON.stringify(next), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return next;
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError && attempt < MAX_RETRIES - 1) {
        continue; // someone else wrote in between — re-read and retry
      }
      console.error('store: put() failed:', e && e.stack || e);
      throw e;
    }
  }
  throw new Error('Could not update index after several retries — please try again.');
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = { readIndex, updateIndex, cors };
