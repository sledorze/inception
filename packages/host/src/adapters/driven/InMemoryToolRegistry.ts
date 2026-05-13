import { readFile } from 'node:fs/promises'
import { Effect, Layer, Schema } from 'effect'
import { parse as parseYaml } from 'yaml'
import { ToolNotFound, ToolRegistry } from '../../ports/driven/ToolRegistry.ts'
import type { ToolDescriptor } from '../../ports/driven/ToolRegistry.ts'

// ─── YAML schema ─────────────────────────────────────────────────────────────

const ToolEntrySchema = Schema.Struct({
  description: Schema.String,
  inputSchema: Schema.Unknown,
  name: Schema.String,
  // roles: which roles may call this tool; empty array = accessible to all roles
  roles: Schema.Array(Schema.String),
})

const ToolsFileSchema = Schema.Struct({
  tools: Schema.Array(ToolEntrySchema),
})

export type ToolEntry = typeof ToolEntrySchema.Type

// ─── adapter ─────────────────────────────────────────────────────────────────

const makeRegistry = (entries: readonly ToolEntry[]) => {
  const byName = new Map<string, ToolEntry>(entries.map(e => [e.name, e]))

  return ToolRegistry.of({
    get: name =>
      Effect.gen(function* () {
        const entry = byName.get(name)
        if (entry === undefined) {
          return yield* Effect.fail(new ToolNotFound({ name }))
        }
        const descriptor: ToolDescriptor = {
          description: entry.description,
          inputSchema: entry.inputSchema,
          name: entry.name,
        }
        return descriptor
      }),

    listTools: role => {
      const visible = entries
        .filter(e => e.roles.length === 0 || e.roles.includes(role))
        .map(
          (e): ToolDescriptor => ({
            description: e.description,
            inputSchema: e.inputSchema,
            name: e.name,
          }),
        )
      return Effect.succeed(visible)
    },
  })
}

// ─── public builders ─────────────────────────────────────────────────────────

export const InMemoryToolRegistry = {
  // Build from a pre-parsed list — used in tests and via fromYamlFile.
  layer: (entries: readonly ToolEntry[]) => Layer.effect(ToolRegistry, Effect.succeed(makeRegistry(entries))),

  // Bootstrap builder: reads + validates a tools.yaml file at layer construction.
  layerFromYamlFile: (filePath: string) =>
    Layer.effect(
      ToolRegistry,
      Effect.gen(function* () {
        const raw = yield* Effect.tryPromise({
          catch: cause => new Error(`Cannot read ${filePath}: ${String(cause)}`),
          try: () => readFile(filePath, 'utf8'),
        })
        const parsed = yield* Effect.try({
          catch: cause => new Error(`Cannot parse YAML in ${filePath}: ${String(cause)}`),
          try: () => parseYaml(raw) as unknown,
        })
        const validated = yield* Schema.decodeUnknownEffect(ToolsFileSchema)(parsed).pipe(
          Effect.mapError(e => new Error(`Invalid tools.yaml schema: ${String(e)}`)),
        )
        return makeRegistry(validated.tools)
      }).pipe(Effect.orDie),
    ),
}
