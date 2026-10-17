// T006 spike (temporary): can a deployed Worker reach BGG's public website JSON? Deleted after the check.
const USER_AGENT = 'board-a-licious/0.5 (private app for a group of friends; spike)'

const urls = [
  'https://api.geekdo.com/api/geekpreviewitems?previewid=93&pageid=1',
  'https://api.geekdo.com/api/geekitems?objectid=295947&objecttype=thing',
]

export async function spike(): Promise<Response> {
  const results = []
  for (const url of urls) {
    const started = Date.now()
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
      const body = await res.text()
      results.push({ url, status: res.status, ms: Date.now() - started, bytes: body.length, start: body.slice(0, 200) })
    } catch (error) {
      results.push({ url, error: String(error), ms: Date.now() - started })
    }
  }
  return Response.json({ results })
}
