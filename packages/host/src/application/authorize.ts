import { Effect } from 'effect'
import type { Principal, Role } from '../ports/driving/AuthGateway.ts'
import { AuthGateway, Forbidden, SessionNotFound } from '../ports/driving/AuthGateway.ts'

/** Extract Bearer token from an Authorization header value. */
export const extractBearer = (authHeader: string | undefined): string | undefined =>
  authHeader?.startsWith('Bearer ') === true ? authHeader.slice(7) : undefined

/**
 * Verify the token and assert the caller holds the required role.
 * Yields `Principal` on success; fails with `SessionNotFound`, `SessionExpired`, or `Forbidden`.
 */
export const requireRole = Effect.fn('authorize.requireRole')(function* (token: string | undefined, required: Role) {
  if (token === undefined) {
    return yield* Effect.fail(new SessionNotFound())
  }
  const auth = yield* AuthGateway
  const principal: Principal = yield* auth.verify(token)
  if (required === 'admin' && principal.role !== 'admin') {
    return yield* Effect.fail(new Forbidden({ required, subject: principal.subject }))
  }
  return principal
})
