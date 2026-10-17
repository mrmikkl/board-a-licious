export default {
  async fetch(): Promise<Response> {
    return Response.json({ error: 'not_found', message: 'No such API route.', retryable: false }, { status: 404 })
  },
} satisfies ExportedHandler
