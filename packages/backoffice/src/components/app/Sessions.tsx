import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import type { SessionSummary } from '../../api/admin.ts'
import { getSessions } from '../../api/admin.ts'
import { SessionDetail } from './SessionDetail.tsx'
import { Patterns } from './Patterns.tsx'

export function Sessions() {
  const [sessions, setSessions] = useState<readonly SessionSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    setErr(null)
    getSessions()
      .then(s => {
        setSessions(s)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setErr(String(e))
        setLoading(false)
      })
  }

  if (selected !== null) {
    return (
      <Card className="space-y-3 p-4">
        <SessionDetail onBack={() => setSelected(null)} sessionId={selected} />
      </Card>
    )
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Exchange Viewer</h2>
        <Button
          data-testid="sessions-refresh"
          disabled={loading}
          onClick={load}
          size="sm"
          type="button"
          variant="secondary"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {sessions !== null && sessions.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
      {sessions !== null && (
        <div className="space-y-1">
          {sessions.map(s => (
            <Button
              className="h-auto w-full flex-col items-start gap-0 rounded border p-2 text-left text-xs"
              key={s.sessionId}
              onClick={() => setSelected(s.sessionId)}
              type="button"
              variant="ghost"
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-mono">{s.sessionId.slice(0, 20)}…</span>
                <span className="text-muted-foreground">
                  {s.goalCount} goals · {s.eventCount} events
                </span>
              </div>
              <p className="text-muted-foreground">{s.lastActivity.slice(0, 19)}</p>
            </Button>
          ))}
        </div>
      )}
      <Patterns />
    </Card>
  )
}
