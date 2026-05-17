/**
 * Settings driven port (§7.2).
 *
 * Runtime-configurable parameters for the Host. Changes to session settings and
 * llmBaseUrl take effect on the next request. llmModel is baked into the
 * language-model layer at boot and requires a restart (tracked as TODO P.5).
 */
import type { Effect } from 'effect'
import { Context, Schema } from 'effect'

export const AppSettingsSchema = Schema.Struct({
  llmBaseUrl: Schema.String,
  llmModel: Schema.String,
  sessionMaxTurns: Schema.Number,
})
export type AppSettings = typeof AppSettingsSchema.Type

export const SettingsErrorTag = '@app/host/SettingsError' as const
export class SettingsError extends Schema.TaggedErrorClass<SettingsError>()(SettingsErrorTag, {
  cause: Schema.Defect,
}) {}

export class Settings extends Context.Service<
  Settings,
  {
    readonly get: () => Effect.Effect<AppSettings, SettingsError>
    readonly patch: (updates: Partial<AppSettings>) => Effect.Effect<AppSettings, SettingsError>
  }
>()('@app/host/ports/driven/Settings') {}

export const DEFAULT_SETTINGS: AppSettings = {
  llmBaseUrl: 'http://172.15.8.149:1235/v1',
  llmModel: 'qwopus3.6-35b-a3b-v1@q4_k_s',
  sessionMaxTurns: 10,
}
