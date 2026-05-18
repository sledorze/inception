import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { cn } from '@app/design-system/utils'
import { promoteProposalAtom, promoteProposalView, proposalsAtom, proposalsView } from '../../atoms.ts'

export function Proposals() {
  const listView = useAtomValue(proposalsView)
  const refresh = useAtomRefresh(proposalsAtom)
  const promote = useAtomSet(promoteProposalAtom) // (id: string) => void — fire-and-forget dispatch
  const promoteView = useAtomValue(promoteProposalView)

  const { contentHash } = useParams()
  const navigate = useNavigate()
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const proposals = listView._tag === 'Ready' ? listView.value : []
  const listError = listView._tag === 'Error' ? listView.message : null
  const promoteMsg = promoteView._tag === 'Ready' ? promoteView.value : null
  const promoteError = promoteView._tag === 'Error' ? promoteView.message : null
  const msg = promoteError ?? listError ?? promoteMsg

  useEffect(() => {
    if (contentHash) {
      cardRefs.current[contentHash]?.scrollIntoView({ block: 'center' })
    }
  }, [contentHash, proposals])

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
              disabled={promoteView.waiting}
              onClick={() => promote(p.contentHash)}
              size="sm"
              type="button"
            >
              {promoteView.waiting ? 'Promoting…' : 'Promote'}
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
