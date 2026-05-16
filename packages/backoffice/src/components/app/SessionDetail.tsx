import { useState } from 'react'
import { Button } from '@app/design-system/button'
import type { SessionEvent } from '../../hooks/admin.ts'
import { getSessionEvents } from '../../hooks/admin.ts'
import { EventRow } from './EventRow.tsx'

export function SessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [events, setEvents] = useState<readonly SessionEvent[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    setErr(null)
    getSessionEvents(sessionId)
      .then(e => {
        setEvents(e)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setErr(String(e))
        setLoading(false)
      })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button onClick={onBack} size="sm" type="button" variant="ghost">
          ← Back
        </Button>
        <span className="break-all font-mono text-xs text-muted-foreground">{sessionId}</span>
        <Button disabled={loading} onClick={load} size="sm" type="button" variant="secondary">
          {loading ?
            'Loading…'
          : events === null ?
            'Load events'
          : 'Refresh'}
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
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
