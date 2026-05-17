import { Metrics } from './Metrics.tsx'
import { PainBoard } from './PainBoard.tsx'
import { WorkBoard } from './WorkBoard.tsx'
import { Sessions } from './Sessions.tsx'

export function ObservabilitySection() {
  return (
    <>
      <Metrics />
      <div className="grid gap-4 lg:grid-cols-2">
        <PainBoard />
        <WorkBoard />
      </div>
      <Sessions />
    </>
  )
}
