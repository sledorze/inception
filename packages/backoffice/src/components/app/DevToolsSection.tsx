import { CallCapability } from './CallCapability.tsx'
import { ListTools } from './ListTools.tsx'
import { ReadWorkspace } from './ReadWorkspace.tsx'
import { WriteWorkspace } from './WriteWorkspace.tsx'

export function DevToolsSection() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CallCapability />
      <ListTools />
      <ReadWorkspace />
      <WriteWorkspace />
    </div>
  )
}
