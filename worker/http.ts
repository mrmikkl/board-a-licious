export type ErrorCode =
  | 'unauthenticated'
  | 'bad_request'
  | 'not_found'
  | 'bgg_unavailable'
  | 'bgg_rate_limited'
  | 'bgg_search_unavailable'

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  bad_request: 400,
  not_found: 404,
  bgg_unavailable: 502,
  bgg_rate_limited: 503,
  bgg_search_unavailable: 503,
}
const RETRYABLE: Record<ErrorCode, boolean> = {
  unauthenticated: false,
  bad_request: false,
  not_found: false,
  bgg_unavailable: true,
  bgg_rate_limited: true,
  bgg_search_unavailable: false,
}

/** The error format of contracts/api.md. */
export function errorResponse(code: ErrorCode, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: code, message, retryable: RETRYABLE[code] }, { status: STATUS[code], headers })
}

export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
  }
}
