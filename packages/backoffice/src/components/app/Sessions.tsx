import { useState } from 'react'
import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Cause from 'effect/Cause'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import type { SessionSummary } from '../../hooks/admin.ts'
import { sessionsAtom } from '../../atoms.ts'
import { SessionDetail } from './SessionDetail.tsx'
import { Patterns } from './Patterns.tsx'

export function Sessions() {
  const result = useAtomValue(sessionsAtom)
  const refresh = useAtomRefresh(sessionsAtom)
  const sessions = AsyncResult.isSuccess(result) ? result.value : null
  const error = AsyncResult.isFailure(result) ? String(Cause.squash(result.cause)) : null
  const loading = result.waiting
  const [selected, setSelected] = useState<string | null>(null)

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
          onClick={refresh}
          size="sm"
          type="button"
          variant="secondary"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
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
