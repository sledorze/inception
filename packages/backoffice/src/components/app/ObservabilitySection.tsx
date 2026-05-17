import { Metrics } from './Metrics.tsx'
import { PainBoard } from './PainBoard.tsx'
import { WorkBoard } from './WorkBoard.tsx'
import { Sessions } from './Sessions.tsx'

export function ObservabilitySection() {
  return (
    <>
      <Metrics />
      <div className="space-y-8">
        <PainBoard />
        <WorkBoard />
      </div>
      <Sessions />
    </>
  )
}
