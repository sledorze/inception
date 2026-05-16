import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { listProposals, promoteProposal } from '../../api/proposals.ts'
import type { Proposal } from '../../api/proposals.ts'

export function Proposals() {
  const [proposals, setProposals] = useState<readonly Proposal[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = () => {
    setMsg(null)
    listProposals()
      .then(setProposals)
      .catch((error: unknown) => setMsg(String(error)))
  }

  const promote = (id: string) => {
    setMsg(null)
    promoteProposal(id)
      .then(({ version }) => {
        setMsg(`Promoted → registry v${version}`)
        return listProposals().then(setProposals)
      })
      .catch((error: unknown) => setMsg(String(error)))
  }

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Pending Proposals</h2>
        <Button data-testid="proposals-refresh" onClick={refresh} size="sm" type="button" variant="secondary">
          Refresh
        </Button>
      </div>
      {proposals.length === 0 && (
        <p className="text-sm text-muted-foreground">No pending proposals. Submit a goal first.</p>
      )}
      {proposals.map(p => (
        <Card className="p-3 space-y-1 text-sm" key={p.contentHash}>
          <div>
            <span className="font-medium">Name:</span> {p.payload.name ?? '(unknown)'}
          </div>
          <div>
            <span className="font-medium">ID:</span> <span className="font-mono text-xs">{p.contentHash}</span>
          </div>
          <div>
            <span className="font-medium">At:</span> {p.occurredAt}
          </div>
          {p.payload.description && (
            <div>
              <span className="font-medium">Description:</span> {p.payload.description}
            </div>
          )}
          <Button
            className="mt-1"
            data-testid={`promote-${p.contentHash}`}
            onClick={() => promote(p.contentHash)}
            size="sm"
            type="button"
          >
            Promote
          </Button>
        </Card>
      ))}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </Card>
  )
}
