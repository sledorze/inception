import { CallCapability } from './components/app/CallCapability.tsx'
import { Conversation } from './components/app/Conversation.tsx'
import { ListTools } from './components/app/ListTools.tsx'
import { Proposals } from './components/app/Proposals.tsx'
import { ReadWorkspace } from './components/app/ReadWorkspace.tsx'
import { SubmitGoal } from './components/app/SubmitGoal.tsx'
import { WriteWorkspace } from './components/app/WriteWorkspace.tsx'

export function App() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Georges Toolkit</h1>
      <Conversation />
      <SubmitGoal />
      <Proposals />
      <CallCapability />
      <ListTools />
      <ReadWorkspace />
      <WriteWorkspace />
    </div>
  )
}
