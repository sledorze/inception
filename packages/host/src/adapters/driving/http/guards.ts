/**
 * HTTP auth guards and response helpers (P75).
 * Extracted from main.ts to keep the entry point lean.
 */
import { Effect, Option, Schema } from 'effect'
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest'
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse'
import { requireRole } from '../../../application/authorize.ts'
import { CurrentTenantId } from '../../../domain/tracing.ts'
import type { Principal } from '../../../ports/driving/AuthGateway.ts'
import type { AuthGateway } from '../../../ports/driving/AuthGateway.ts'
import { SessionExpiredTag, SessionNotFoundTag } from '../../../ports/driving/AuthGateway.ts'

const extractBearer = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const auth = (req.headers['authorization'] as string | undefined) ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : undefined
})

/**
 * Shared auth helper — verify token, yield the Principal to the handler.
 * Returns 401/403 when auth fails. Used by withRole, withTenant, and tenant CRUD routes.
 */
export const withPrincipal =
  (role: 'admin' | 'enduser') =>
  <E, R>(
    handler: (principal: Principal) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  ): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest | AuthGateway> =>
    Effect.gen(function* () {
      const token = yield* extractBearer
      return yield* requireRole(token, role).pipe(
        Effect.matchEffect({
          onFailure: err =>
            Effect.succeed(
              err._tag === SessionNotFoundTag || err._tag === SessionExpiredTag ?
                HttpServerResponse.text('unauthorized', { status: 401 })
              : HttpServerResponse.text('forbidden', { status: 403 }),
            ),
          onSuccess: principal => handler(principal),
        }),
      )
    })

/** Returns 401/403 when auth fails; otherwise runs the handler. */
export const withRole =
  (role: 'admin' | 'enduser') =>
  <E, R>(
    handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  ): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest | AuthGateway> =>
    withPrincipal(role)(() => handler)

/**
 * Tenant guard — read `X-Tenant-Id` header, verify the authenticated principal is
 * entitled to the tenant, bind `CurrentTenantId` for the handler fiber.
 * Returns 400 if header absent/invalid, 401/403 on auth failure, 403 if not entitled.
 * Implies authentication: the bearer token is verified (same as `withRole`).
 * P74: header decoded via Schema.decodeUnknownOption to reject array values.
 */
export const withTenant =
  (role: 'admin' | 'enduser') =>
  <E, R>(
    handler: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  ): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R | HttpServerRequest.HttpServerRequest | AuthGateway> =>
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest
      const rawHeader: unknown = req.headers['x-tenant-id']
      const requestedTenantId = Schema.decodeUnknownOption(Schema.String)(rawHeader).pipe(Option.getOrUndefined)
      if (requestedTenantId === undefined || requestedTenantId === '') {
        return HttpServerResponse.text('X-Tenant-Id header required', { status: 400 })
      }
      return yield* withPrincipal(role)(principal =>
        principal.tenantIds.includes(requestedTenantId) ?
          Effect.provideService(handler, CurrentTenantId, requestedTenantId)
        : Effect.succeed(HttpServerResponse.text('forbidden', { status: 403 })),
      )
    })

export const jsonOk = (data: unknown): HttpServerResponse.HttpServerResponse => HttpServerResponse.jsonUnsafe(data)

export const textErr = (msg: string, status: number): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.text(msg, { status })

// Parse the request JSON body against a schema; returns null on parse failure.
export const parseBody = <A, I, RD, RE>(
  schema: Schema.Codec<A, I, RD, RE>,
): Effect.Effect<A | null, never, HttpServerRequest.HttpServerRequest | RD> =>
  HttpServerRequest.schemaBodyJson(schema).pipe(Effect.orElseSucceed(() => null))
