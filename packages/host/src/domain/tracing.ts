import { Context } from 'effect'
import { bootstrapCorrelationId, type CorrelationId } from './ids.ts'

export const CurrentCorrelationId = Context.Reference<CorrelationId>('@app/host/CurrentCorrelationId', {
  defaultValue: () => bootstrapCorrelationId,
})
