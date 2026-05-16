/**
 * FileBackedSettings: reads from a JSON file at startup, holds in an Effect Ref,
 * and persists on every patch. Changes to session settings take effect on the
 * next HTTP request. LLM connection settings are available immediately for
 * any code that reads from the Settings port at call time.
 */
import { Effect, FileSystem, Layer, Ref, Schema } from 'effect'
import { DEFAULT_SETTINGS, AppSettingsSchema, Settings, SettingsError } from '../../ports/driven/Settings.ts'
import type { AppSettings } from '../../ports/driven/Settings.ts'

const decodeSettings = Schema.decodeUnknownOption(AppSettingsSchema)

export const FileBackedSettings = {
  layer: (settingsPath: string): Layer.Layer<Settings, never, FileSystem.FileSystem> =>
    Layer.effect(
      Settings,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        // Read initial settings; fall back to defaults if file missing or invalid.
        const initial: AppSettings = yield* fs.readFileString(settingsPath).pipe(
          Effect.flatMap(raw =>
            Effect.try({
              catch: e => e,
              try: () => JSON.parse(raw) as unknown,
            }),
          ),
          Effect.flatMap(parsed => {
            const decoded = decodeSettings(parsed)
            return decoded._tag === 'Some' ? Effect.succeed(decoded.value) : Effect.fail(new Error('invalid'))
          }),
          Effect.orElseSucceed(() => DEFAULT_SETTINGS),
        )

        const ref = yield* Ref.make<AppSettings>(initial)

        const persist = (settings: AppSettings): Effect.Effect<void, SettingsError> =>
          fs
            .writeFileString(settingsPath, JSON.stringify(settings, null, 2))
            .pipe(Effect.mapError(cause => new SettingsError({ cause })))

        return Settings.of({
          get: () => Ref.get(ref),
          patch: updates =>
            Ref.updateAndGet(ref, current => ({ ...current, ...updates })).pipe(
              Effect.tap(updated => persist(updated)),
            ),
        })
      }),
    ),
}
