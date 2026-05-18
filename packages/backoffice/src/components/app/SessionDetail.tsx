import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { Button } from '@app/design-system/button'
import { sessionEventsAtom, sessionEventsView } from '../../atoms.ts'
import { EventRow } from './EventRow.tsx'

export function SessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const view = useAtomValue(sessionEventsView(sessionId))
  const refresh = useAtomRefresh(sessionEventsAtom(sessionId))

  const events = view._tag === 'Ready' ? view.value : null
  const error = view._tag === 'Error' ? view.message : null
  const loading = view.waiting

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button className="text-ring" onClick={onBack} size="sm" type="button" variant="ghost">
          ← Back
        </Button>
        <span className="break-all font-mono text-xs text-muted-foreground">{sessionId}</span>
        <Button disabled={loading} onClick={refresh} size="sm" type="button" variant="secondary">
          {loading ?
            'Loading…'
          : events === null ?
            'Load events'
          : 'Refresh'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {events !== null && (
        <div className="space-y-1">
          {events.length === 0 && <p className="text-sm text-muted-foreground">No events.</p>}
          {events.map(e => (
            <EventRow event={e} key={e.id} />
          ))}
        </div>
      )}
    </div>
  )
}
