// F006 T002: records official BGG XML API answers as test fixtures.
// Run: node --env-file=.dev.vars scripts/record-bgg-xml.mjs
// Reads BGG_TOKEN from the environment and never prints it; prints only status and size.
import { writeFile } from 'node:fs/promises'

const token = process.env.BGG_TOKEN
if (!token) throw new Error('BGG_TOKEN is not set (add it to .dev.vars).')
const BASE = 'https://boardgamegeek.com'
const JOBS = [
  ['thing-295947-385318.xml', '/xmlapi2/thing?id=295947,385318,374341&stats=1'],
  ['thing-477191.xml', '/xmlapi2/thing?id=477191&stats=1'],
  ['search-cascad.xml', '/xmlapi2/search?query=cascad&type=boardgame,boardgameexpansion'],
  ['geeklist-66420.xml', '/xmlapi/geeklist/66420'],
  ...process.argv.slice(2).map(arg => arg.split('=')),
]
const sleep = ms => new Promise(r => setTimeout(r, ms))

for (const [file, path] of JOBS) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(BASE + path, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'board-a-licious/1.0 (fixture recording; private app for a small group of friends)' },
    })
    const body = await res.text()
    console.log(`${file}: ${res.status} ${body.length} bytes${res.headers.get('retry-after') ? ' retry-after ' + res.headers.get('retry-after') : ''}`)
    if (res.status === 202) {
      await writeFile(`tests/fixtures/bgg-xml/geeklist-202.xml`, body)
      await sleep(3000)
      continue
    }
    if (res.ok) await writeFile(`tests/fixtures/bgg-xml/${file}`, body)
    break
  }
  await sleep(1500)
}
