import { describe, expect, it } from 'vitest'

import { ApiError, createApi } from '../../src/client/api.ts'

const gallery = { bggId: 295947, total: 2, images: [{ id: 1, large: 'L', small: 'S', caption: null }] }

describe('api.gallery (research R3: session cache)', () => {
  it('asks the server once per game and serves repeats from memory', async () => {
    const calls: string[] = []
    const api = createApi({ fetch: async input => (calls.push(String(input)), Response.json(gallery)) })
    expect(await api.gallery(295947)).toEqual(gallery)
    expect(await api.gallery(295947)).toEqual(gallery)
    expect(calls).toEqual(['/api/bgg/images?id=295947'])
  })

  it('does not keep a failure, so the next open tries again', async () => {
    let online = false
    const api = createApi({
      fetch: async () => {
        if (!online) throw new TypeError('offline')
        return Response.json(gallery)
      },
    })
    await expect(api.gallery(295947)).rejects.toBeInstanceOf(ApiError)
    online = true
    expect(await api.gallery(295947)).toEqual(gallery)
  })
})
