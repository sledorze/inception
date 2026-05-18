import { Context } from 'effect'
import { bootstrapCorrelationId, type CorrelationId } from './ids.ts'

export const CurrentCorrelationId = Context.Reference<CorrelationId>('@app/host/CurrentCorrelationId', {
  defaultValue: () => bootstrapCorrelationId,
})

// Active tenant for the current request (L1.9 §13).
// Bound by `withTenant` middleware from the `X-Tenant-Id` header.
// Default 'default' keeps bootstrap/seed events correctly scoped.
export const CurrentTenantId = Context.Reference<string>('@app/host/CurrentTenantId', {
  defaultValue: () => 'default',
})
