/**
 * FileBackedSettings: reads from a JSON file at startup, holds in an Effect Ref,
 * and persists on every patch. Changes to session settings take effect on the
 * next HTTP request. LLM connection settings are available immediately for
 * any code that reads from the Settings port at call time.
 */
import { Effect, FileSystem, Layer, Ref, Schema } from 'effect'
import { AppSettingsSchema, DEFAULT_SETTINGS, Settings, SettingsError } from '../../ports/driven/Settings.ts'
import type { AppSettings } from '../../ports/driven/Settings.ts'

// Schema that decodes JSON string → AppSettings and encodes AppSettings → JSON string.
const JsonSettings = Schema.fromJsonString(AppSettingsSchema)
const decodeJsonSettings = Schema.decodeUnknownEffect(JsonSettings)
const encodeToJsonString = Schema.encodeEffect(JsonSettings)

export const FileBackedSettings = {
  layer: (settingsPath: string): Layer.Layer<Settings, never, FileSystem.FileSystem> =>
    Layer.effect(
      Settings,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem

        // Read initial settings; fall back to defaults if file missing or invalid.
        const initial: AppSettings = yield* fs.readFileString(settingsPath).pipe(
          Effect.flatMap(raw => decodeJsonSettings(raw)),
          Effect.orElseSucceed(() => DEFAULT_SETTINGS),
        )

        const ref = yield* Ref.make<AppSettings>(initial)

        const persist = (settings: AppSettings): Effect.Effect<void, SettingsError> =>
          encodeToJsonString(settings).pipe(
            Effect.mapError(cause => new SettingsError({ cause })),
            Effect.flatMap(encoded =>
              fs.writeFileString(settingsPath, encoded).pipe(Effect.mapError(cause => new SettingsError({ cause }))),
            ),
          )

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
