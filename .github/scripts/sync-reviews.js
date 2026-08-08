const fs = require('fs');
const https = require('https');

const BLOB_URL = 'https://jsonblob.com/api/jsonBlob/019fe06e-27cb-74fe-a958-1fe784a4dbab';
const REVIEWS_FILE = 'reviews.json';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(d);
        else reject(new Error('HTTP ' + res.statusCode));
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

function dedupKey(r) {
  return (String(r.name || '') + '|' + String(r.text || ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  let blobReviews = [];
  try {
    const raw = await fetchText(BLOB_URL);
    const data = JSON.parse(raw);
    if (Array.isArray(data.reviews)) blobReviews = data.reviews;
  } catch (e) {
    console.log('Blob unavailable (kept alive next hour): ' + e.message);
  }

  let base = { reviews: [] };
  try {
    base = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
  } catch (e) {}

  const seen = new Set();
  const merged = [];
  (base.reviews || []).forEach(r => {
    if (!r || !r.text) return;
    const k = dedupKey(r);
    if (seen.has(k)) return;
    seen.add(k);
    merged.push(r);
  });
  let added = 0;
  blobReviews.forEach(r => {
    if (!r || !r.text) return;
    const k = dedupKey(r);
    if (seen.has(k)) return;
    seen.add(k);
    merged.push(r);
    added++;
  });

  const newContent = JSON.stringify({ reviews: merged }, null, 2) + '\n';
  const oldContent = fs.readFileSync(REVIEWS_FILE, 'utf8');
  if (oldContent === newContent) {
    console.log('No new reviews to sync. Total: ' + merged.length);
    return;
  }
  fs.writeFileSync(REVIEWS_FILE, newContent, 'utf8');
  console.log('Merged ' + added + ' new review(s). Total: ' + merged.length);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
