import { useNavigate, useParams } from 'react-router'
import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { Button } from '@app/design-system/button'
import { cn } from '@app/design-system/utils'
import { sessionsAtom, sessionsView } from '../../atoms.ts'

export function SessionList() {
  const view = useAtomValue(sessionsView)
  const refresh = useAtomRefresh(sessionsAtom)
  const navigate = useNavigate()
  const { sessionId: activeId } = useParams()

  const sessions = view._tag === 'Ready' ? view.value : null
  const error = view._tag === 'Error' ? view.message : null
  const loading = view.waiting

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight">Your conversations</h2>
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
      <div className="min-h-0 flex-1 px-2 py-2 sm:overflow-y-auto">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {sessions !== null && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">No conversations yet. Start a new one.</p>
        )}
        {sessions !== null && sessions.length > 0 && (
          <div className="divide-y divide-border">
            {sessions.map(s => (
              <Button
                aria-current={s.sessionId === activeId ? 'page' : undefined}
                className={cn(
                  'h-auto w-full flex-col items-start gap-0 border-0 p-3 text-left text-xs',
                  s.sessionId === activeId && 'bg-muted font-semibold',
                )}
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
      </div>
    </div>
  )
}
