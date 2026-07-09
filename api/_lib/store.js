const { put, head, BlobPreconditionFailedError, BlobNotFoundError } = require('@vercel/blob');

const INDEX_PATH = 'index.json';
const MAX_RETRIES = 5;

// Vercel's dashboard prefixes the injected env var with the store's name
// (here "smhub_READ_WRITE_TOKEN") rather than always using the plain
// "BLOB_READ_WRITE_TOKEN" the SDK looks for automatically — so we pass it
// explicitly instead of relying on auto-detection. Falls back to the
// standard name too, in case the store ever gets reconnected with default
// naming instead.
const BLOB_TOKEN = process.env.smhub_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

// Reads the current index and its ETag. Returns an empty list (no etag) only
// when the index genuinely doesn't exist yet (BlobNotFoundError) — that's
// expected on the very first upload. Any other error (bad/missing
// credentials, store not found, etc.) is logged and rethrown rather than
// silently treated the same way, which would otherwise show up as a
// misleading empty chart list instead of a real error.
async function readIndexRaw() {
  let meta;
  try {
    meta = await head(INDEX_PATH, { token: BLOB_TOKEN });
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
        token: BLOB_TOKEN,
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

module.exports = { readIndex, updateIndex, cors, BLOB_TOKEN };
