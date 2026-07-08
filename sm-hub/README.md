# sm-hub

Small Vercel API for Choreo's community Chart Hub — upload, browse, and vote
on shared `.sm` files. Matches the same lightweight single-purpose-proxy
pattern as `bpm-proxy` and `yt-search-six`.

## What it does

- `POST /api/upload` — body `{ content: "<raw .sm text>", uploader?: "name" }`.
  Validates the content structurally (requires `#TITLE:`, `#BPMS:`, and a
  `dance-single`/`dance-double` `#NOTES:` block — filename/extension is never
  trusted). Stores the file as a public Blob and adds it to the shared index.
- `GET /api/charts?sort=top|new` — returns the chart list as JSON.
- `POST /api/vote` — body `{ id: "<chart id>", dir: 1 | -1 }`. Adjusts that
  chart's vote count.

All storage is a single **Vercel Blob** store — the `.sm` files themselves,
plus one `index.json` blob holding everyone's metadata (title, artist,
uploader, votes, upload date, download URL). Concurrent uploads/votes are
handled safely with Blob's conditional-write (`ifMatch`) support: if two
requests land at the same moment, one retries automatically against the
fresh copy rather than silently losing an update.

## Deploy steps

1. Push this folder as a new GitHub repo (or upload it directly) and import
   it into a **new Vercel project** — same flow as your other proxies.
2. In the Vercel dashboard for this project: **Storage → Create Database →
   Blob**. Connect it to this project. Vercel injects the
   `BLOB_READ_WRITE_TOKEN` environment variable automatically — nothing to
   configure by hand.
3. Deploy. Your endpoints will be live at:
   `https://<your-project-name>.vercel.app/api/upload`
   `https://<your-project-name>.vercel.app/api/charts`
   `https://<your-project-name>.vercel.app/api/vote`
4. In Choreo's `index.html`, set `HUB_API` to your project's URL (search for
   `HUB_API` near the other proxy constants).

## Notes / current limitations

- **No accounts** — "uploader" is just a free-text display name, not
  verified. Choreo's own hub page uses `localStorage` to stop the same
  browser from voting on the same chart twice, which is a courtesy, not a
  security boundary — someone could still hit the API directly. Fine for a
  good-faith community tool; revisit if abuse becomes an actual problem.
- **Doubles/VS charts upload fine** (any `dance-single` or `dance-double`
  chart passes validation) but Choreo's own *importer* currently only reads
  `dance-single` back in — so Doubles charts can be shared/downloaded from
  the Hub, just not re-opened for editing in Choreo yet.
- If this ever needs moderation (removing a bad upload), the simplest path
  for now is deleting the entry directly from the Blob store's dashboard —
  there's no admin UI here yet.
