import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from 'jose'

export type AuthEnv = {
  ACCESS_TEAM_DOMAIN: string
  ACCESS_AUD: string
  ENVIRONMENT: string
  DEV_USER_EMAIL?: string
}

/** The signed-in person's email (lowercased), or null. */
export type Authenticate = (request: Request) => Promise<string | null>

/**
 * Validates the Cloudflare Access JWT (ADR 0003). Locally, without Access, DEV_USER_EMAIL stands in,
 * but only when ENVIRONMENT is "development".
 */
export function createAuthenticator(env: AuthEnv, jwks?: JWTVerifyGetKey): Authenticate {
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`
  const keys = jwks ?? createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
  return async request => {
    const token = request.headers.get('Cf-Access-Jwt-Assertion')
    if (!token) {
      return env.ENVIRONMENT === 'development' && env.DEV_USER_EMAIL ? env.DEV_USER_EMAIL.toLowerCase() : null
    }
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience: env.ACCESS_AUD })
      return typeof payload.email === 'string' ? payload.email.toLowerCase() : null
    } catch {
      return null
    }
  }
}
