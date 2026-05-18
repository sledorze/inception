import { useNavigate } from 'react-router'
import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { sessionsAtom, sessionsView } from '../../atoms.ts'

export function SessionList() {
  const view = useAtomValue(sessionsView)
  const refresh = useAtomRefresh(sessionsAtom)
  const navigate = useNavigate()

  const sessions = view._tag === 'Ready' ? view.value : null
  const error = view._tag === 'Error' ? view.message : null
  const loading = view.waiting

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-semibold tracking-tight">Your conversations</h2>
          <div className="flex gap-2">
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
            <Button
              data-testid="new-conversation"
              onClick={() => navigate(`/sessions/${crypto.randomUUID()}`)}
              size="sm"
              type="button"
            >
              New conversation
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {sessions !== null && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">No conversations yet. Start a new one.</p>
        )}
        {sessions !== null && sessions.length > 0 && (
          <div className="divide-y divide-border">
            {sessions.map(s => (
              <Button
                className="h-auto w-full flex-col items-start gap-0 border-0 p-3 text-left text-xs"
                data-testid={`session-${s.sessionId}`}
                key={s.sessionId}
                onClick={() => navigate(`/sessions/${s.sessionId}`)}
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
      </Card>
    </div>
  )
}
