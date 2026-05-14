import { Context } from 'effect'

export const CurrentCorrelationId = Context.Reference<string>('@app/host/CurrentCorrelationId', {
  defaultValue: () => 'bootstrap',
})
