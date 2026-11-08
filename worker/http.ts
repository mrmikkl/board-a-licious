export type ErrorCode =
  | 'unauthenticated'
  | 'bad_request'
  | 'not_found'
  | 'bgg_unavailable'
  | 'bgg_rate_limited'
  | 'bgg_search_unavailable'
  | 'bgg_preparing'
  | 'bgg_signed_out'
  | 'bgg_refused'
  | 'price_conflict'

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  bad_request: 400,
  not_found: 404,
  bgg_unavailable: 502,
  bgg_rate_limited: 503,
  bgg_search_unavailable: 503,
  /** F008: BGG still prepares a collection; the app retries after Retry-After. */
  bgg_preparing: 202,
  /** F008: no, an expired or a rejected BGG session; sign in to BGG again. */
  bgg_signed_out: 401,
  /** F008: BGG did not take a change. */
  bgg_refused: 502,
  /** F008: BGG already holds another price paid. */
  price_conflict: 409,
}
const RETRYABLE: Record<ErrorCode, boolean> = {
  unauthenticated: false,
  bad_request: false,
  not_found: false,
  bgg_unavailable: true,
  bgg_rate_limited: true,
  bgg_search_unavailable: false,
  bgg_preparing: true,
  bgg_signed_out: false,
  bgg_refused: true,
  price_conflict: false,
}

/** The error format of contracts/api.md. */
export function errorResponse(code: ErrorCode, message: string, headers?: HeadersInit, extra?: Record<string, unknown>): Response {
  return Response.json({ error: code, message, retryable: RETRYABLE[code], ...extra }, { status: STATUS[code], headers })
}

export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
  }
}
