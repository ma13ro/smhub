// Structural validation only. We never trust a filename or Content-Type —
// both are trivially spoofable by the client. Instead we require the tags
// a real StepMania simfile must have, mirroring the same check Choreo's
// own importer uses (parseSM in index.html), plus loose size sanity bounds.

function tag(text, name) {
  const m = text.match(new RegExp(`#${name}:([^;]*);`, 'i'));
  return m ? m[1].trim() : '';
}

// Returns an error string if invalid, or null if the content is a
// structurally valid .sm chart.
function validateSM(text) {
  if (typeof text !== 'string') return 'File content must be text.';
  if (text.length < 20) return 'File is too small to be a real chart.';
  if (text.length > 2_000_000) return 'File is too large (2MB limit).';
  if (!/#TITLE:\s*[^;]*;/i.test(text)) return 'Missing #TITLE tag — not a valid .sm file.';
  if (!/#BPMS:\s*[^;]*;/i.test(text)) return 'Missing #BPMS tag — not a valid .sm file.';
  if (!/#NOTES:\s*dance-(single|double)\s*:/i.test(text)) {
    return 'Missing a dance-single/dance-double #NOTES block — not a valid .sm file.';
  }
  return null;
}

module.exports = { validateSM, tag };
