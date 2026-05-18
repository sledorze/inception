import { Context, Effect, Schema } from 'effect'

export type Role = 'admin' | 'enduser'

const RoleSchema = Schema.Literals(['admin', 'enduser'])

export const AuthSessionSchema = Schema.Struct({
  expiresAtMs: Schema.Number,
  issuedAtMs: Schema.Number,
  role: RoleSchema,
  subject: Schema.String,
  // optional on the encoded (JSON) side — absent in sessions persisted before S12
  tenantIds: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed(['default']))),
  token: Schema.String,
})
export type AuthSession = typeof AuthSessionSchema.Type

export const PrincipalSchema = Schema.Struct({
  role: RoleSchema,
  subject: Schema.String,
  tenantIds: Schema.Array(Schema.String),
})
export type Principal = typeof PrincipalSchema.Type

// Exported tag consts — prevent silent catchTags mismatches (host-package P2 pattern).
export const InvalidCredentialsTag = '@app/host/InvalidCredentials' as const
export class InvalidCredentials extends Schema.TaggedErrorClass<InvalidCredentials>()(InvalidCredentialsTag, {
  subject: Schema.String,
}) {}

export const SessionExpiredTag = '@app/host/SessionExpired' as const
export class SessionExpired extends Schema.TaggedErrorClass<SessionExpired>()(SessionExpiredTag, {}) {}

export const SessionNotFoundTag = '@app/host/SessionNotFound' as const
export class SessionNotFound extends Schema.TaggedErrorClass<SessionNotFound>()(SessionNotFoundTag, {}) {}

export const ForbiddenTag = '@app/host/Forbidden' as const
export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(ForbiddenTag, {
  required: RoleSchema,
  subject: Schema.String,
}) {}

export class AuthGateway extends Context.Service<
  AuthGateway,
  {
    readonly login: (username: string, password: string) => Effect.Effect<AuthSession, InvalidCredentials>
    readonly logout: (token: string) => Effect.Effect<void>
    readonly verify: (token: string) => Effect.Effect<Principal, SessionExpired | SessionNotFound>
  }
>()('@app/host/ports/driving/AuthGateway') {}
