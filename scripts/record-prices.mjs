// F007 T001: records real answers of the price sources as test fixtures.
// Run: node --env-file=.dev.vars scripts/record-prices.mjs
// Reads BGG_TOKEN from the environment and never prints it; prints only status and size.
import { writeFile } from 'node:fs/promises'

const UA = 'board-a-licious/1.0 (fixture recording; private app for a small group of friends)'
const SITE = 'https://board-a-licious.boardgamegeek.workers.dev'
const token = process.env.BGG_TOKEN
const JOBS = [
  ['brettspielpreise-295947.json', `https://brettspielpreise.de/api/info?eid=295947&sitename=${encodeURIComponent(SITE)}&currency=EUR&destination=DE&locale=en&sort=CHEAP1`, {}],
  ['bgg-market-295947.xml', 'https://boardgamegeek.com/xmlapi2/thing?id=295947&marketplace=1', token ? { Authorization: `Bearer ${token}` } : null],
  ['unknowns-feed.xml', 'https://unknowns.de/marketplace/marketplace-feed/', {}],
  ['ecb-daily.xml', 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', {}],
]
for (const [file, url, headers] of JOBS) {
  if (!headers) { console.log(`${file}: skipped (no BGG_TOKEN)`); continue }
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } })
  const body = await res.text()
  console.log(`${file}: ${res.status} ${body.length} bytes`)
  if (res.ok) await writeFile(`tests/fixtures/prices/${file}`, body)
  await new Promise(r => setTimeout(r, 1100))
}
