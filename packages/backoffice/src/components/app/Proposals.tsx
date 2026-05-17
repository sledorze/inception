import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { cn } from '@app/design-system/utils'
import { listProposals, promoteProposal } from '../../hooks/proposals.ts'
import type { Proposal } from '../../hooks/proposals.ts'

export function Proposals() {
  const [proposals, setProposals] = useState<readonly Proposal[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const { contentHash } = useParams()
  const navigate = useNavigate()
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (contentHash) {
      cardRefs.current[contentHash]?.scrollIntoView({ block: 'center' })
    }
  }, [contentHash, proposals])

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
        return listProposals()
      })
      .then(setProposals)
      .catch((error: unknown) => setMsg(String(error)))
  }

  return (
    <Card className="space-y-2 p-4">
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
        <Card
          className={cn('space-y-1 p-3 text-sm', p.contentHash === contentHash && 'bg-secondary ring-2 ring-ring')}
          key={p.contentHash}
          ref={el => {
            cardRefs.current[p.contentHash] = el
          }}
        >
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
          <div className="mt-1 flex gap-2">
            <Button
              data-testid={`promote-${p.contentHash}`}
              onClick={() => promote(p.contentHash)}
              size="sm"
              type="button"
            >
              Promote
            </Button>
            <Button
              onClick={() => navigate(`/governance/proposals/${p.contentHash}`)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Link
            </Button>
          </div>
        </Card>
      ))}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </Card>
  )
}
