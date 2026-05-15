/**
 * CapabilityAwareToolRegistry — merges YAML seed tools with promoted capabilities (4.3).
 *
 * At layer construction:
 *   1. Reads + validates tools.yaml (via loadYamlTools).
 *   2. Reads promoted capabilities from CapabilityRegistry.
 *   3. Converts each CapabilityEntry to a ToolEntry (name, description, roles from scope).
 *   4. Builds a merged ToolRegistry from both sets.
 *
 * Result: `list-tools` returns both seed tools and promoted capabilities.
 * Requires FileSystem.FileSystem and CapabilityRegistry in context.
 */
import { Effect, Layer } from 'effect'
import { CapabilityRegistry } from '../../ports/driven/CapabilityRegistry.ts'
import { ToolRegistry } from '../../ports/driven/ToolRegistry.ts'
import { loadYamlTools, makeRegistry } from './InMemoryToolRegistry.ts'

export const CapabilityAwareToolRegistry = {
  layerFromYamlFile: (filePath: string) =>
    Layer.effect(
      ToolRegistry,
      Effect.gen(function* () {
        const yamlTools = yield* loadYamlTools(filePath)
        const capRegistry = yield* CapabilityRegistry
        const caps = yield* capRegistry.list().pipe(Effect.orDie)
        const capEntries = caps.map(cap => ({
          description: cap.description,
          inputSchema: {},
          name: cap.name,
          roles: [...cap.scope],
        }))
        return makeRegistry([...yamlTools, ...capEntries])
      }),
    ),
}
