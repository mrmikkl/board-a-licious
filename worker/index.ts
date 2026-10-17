import { spike } from './spike.ts'

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/_spike') return spike()
    return Response.json({ error: 'not_found', message: 'No such API route.', retryable: false }, { status: 404 })
  },
} satisfies ExportedHandler
