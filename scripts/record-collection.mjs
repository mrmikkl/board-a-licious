// F008 T002: records official BGG collection answers as test fixtures (research R1).
// Run: node --env-file=.dev.vars scripts/record-collection.mjs <bggUser> [outDir]
// Reads BGG_TOKEN from the environment and never prints it; prints only status and size.
// Writes the raw answers; trimming to a few items is done by hand or with scripts/trim-collection.mjs.
import { writeFile } from 'node:fs/promises'

const token = process.env.BGG_TOKEN
if (!token) throw new Error('BGG_TOKEN is not set (add it to .dev.vars).')
const [user = 'mrmikkl', out = 'tests/fixtures/bgg-xml'] = process.argv.slice(2)
const BASE = 'https://boardgamegeek.com/xmlapi2/collection?username='
const JOBS = [
  ['collection-games.xml', `${BASE}${encodeURIComponent(user)}&subtype=boardgame&excludesubtype=boardgameexpansion`],
  ['collection-expansions.xml', `${BASE}${encodeURIComponent(user)}&subtype=boardgameexpansion`],
  ['collection-unknown-user.xml', `${BASE}no-such-user-board-a-licious-x9`],
]
const sleep = ms => new Promise(r => setTimeout(r, ms))

for (const [file, url] of JOBS) {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'board-a-licious/1.0 (fixture recording; private app for a small group of friends)' },
    })
    const body = await res.text()
    console.log(`${file}: ${res.status} ${body.length} bytes`)
    if (res.status === 202) {
      await writeFile(`${out}/collection-queued.xml`, body)
      await sleep(5000)
      continue
    }
    await writeFile(`${out}/${file}`, body)
    break
  }
  await sleep(1500)
}
