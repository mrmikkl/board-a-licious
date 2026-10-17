import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { createAuthenticator } from '../../worker/auth.ts'

const TEAM = 'friends.cloudflareaccess.com'
const AUD = 'aud-123'
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ENVIRONMENT: 'production' }

let privateKey: CryptoKey
let jwks: ReturnType<typeof createLocalJWKSet>

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' }
  jwks = createLocalJWKSet({ keys: [jwk] })
})

const token = (claims: { aud?: string; exp?: string; email?: string } = {}) =>
  new SignJWT({ email: claims.email ?? 'Anna@Example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(`https://${TEAM}`)
    .setAudience(claims.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? '1h')
    .sign(privateKey)

const request = (jwt?: string) =>
  new Request('https://app.example/api/me', jwt ? { headers: { 'Cf-Access-Jwt-Assertion': jwt } } : {})

describe('Access JWT', () => {
  it('accepts a valid assertion and returns the lowercased email', async () => {
    const authenticate = createAuthenticator(env, jwks)
    expect(await authenticate(request(await token()))).toBe('anna@example.com')
  })

  it('rejects a missing assertion', async () => {
    expect(await createAuthenticator(env, jwks)(request())).toBeNull()
  })

  it('rejects a wrong audience, an expired token and garbage', async () => {
    const authenticate = createAuthenticator(env, jwks)
    expect(await authenticate(request(await token({ aud: 'other' })))).toBeNull()
    expect(await authenticate(request(await token({ exp: '-1m' })))).toBeNull()
    expect(await authenticate(request('not-a-jwt'))).toBeNull()
  })

  it('uses DEV_USER_EMAIL only in development', async () => {
    const dev = createAuthenticator({ ...env, ENVIRONMENT: 'development', DEV_USER_EMAIL: 'Dev@Example.com' }, jwks)
    expect(await dev(request())).toBe('dev@example.com')
    const prod = createAuthenticator({ ...env, DEV_USER_EMAIL: 'dev@example.com' }, jwks)
    expect(await prod(request())).toBeNull()
  })
})
