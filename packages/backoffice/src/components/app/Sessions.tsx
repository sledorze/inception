import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { Pattern, ReplayResult, SessionEvent, SessionSummary } from '../../api/admin.ts'
import { flagExchange, getPatterns, getSessions, getSessionEvents, replayExchange } from '../../api/admin.ts'

type Severity = 'observation' | 'issue' | 'blocker'

function FlagForm({ correlationId, onDone }: { correlationId: string; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [severity, setSeverity] = useState<Severity>('observation')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    if (!note.trim()) {
      return
    }
    setBusy(true)
    setErr(null)
    flagExchange(correlationId, note, severity)
      .then(() => {
        setBusy(false)
        onDone()
      })
      .catch((e: unknown) => {
        setErr(String(e))
        setBusy(false)
      })
  }

  return (
    <div className="mt-1 space-y-1 rounded border p-2 text-xs">
      <Textarea
        className="text-xs"
        onChange={e => setNote(e.target.value)}
        placeholder="Describe the issue…"
        rows={2}
        value={note}
      />
      <div className="flex gap-1">
        {(['observation', 'issue', 'blocker'] as const).map(s => (
          <Button
            key={s}
            onClick={() => setSeverity(s)}
            size="sm"
            type="button"
            variant={severity === s ? 'default' : 'outline'}
          >
            {s}
          </Button>
        ))}
        <Button className="ml-auto" disabled={busy} onClick={submit} size="sm" type="button">
          {busy ? 'Flagging…' : 'Flag'}
        </Button>
      </div>
      {err && <p className="text-destructive">{err}</p>}
    </div>
  )
}

function EventRow({ event }: { event: SessionEvent }) {
  const [flagging, setFlagging] = useState(false)
  const [replay, setReplay] = useState<ReplayResult | null>(null)
  const [replaying, setReplaying] = useState(false)
  const [replayErr, setReplayErr] = useState<string | null>(null)

  const doReplay = () => {
    setReplaying(true)
    setReplayErr(null)
    replayExchange(event.correlationId)
      .then(r => {
        setReplay(r)
        setReplaying(false)
      })
      .catch((e: unknown) => {
        setReplayErr(String(e))
        setReplaying(false)
      })
  }

  const isGoalKind =
    event.kind === 'GoalSubmitted' ||
    event.kind === 'GoalCompleted' ||
    event.kind === 'ClarifyRequested' ||
    event.kind === 'ClarifyAnswered'

  return (
    <div className="space-y-1 rounded border p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-muted-foreground">{event.occurredAt.slice(0, 19)}</span>
        <span className="rounded bg-muted px-1 font-mono">{event.kind}</span>
        <span className="text-muted-foreground">[{event.actor}]</span>
        <div className="ml-auto flex gap-1">
          {isGoalKind && (
            <Button disabled={replaying} onClick={doReplay} size="sm" type="button" variant="outline">
              {replaying ? '…' : 'Replay'}
            </Button>
          )}
          <Button onClick={() => setFlagging(f => !f)} size="sm" type="button" variant="outline">
            Flag
          </Button>
        </div>
      </div>
      {event.payload !== '[redacted]' && (
        <pre className="max-h-24 overflow-auto rounded bg-muted p-1 text-xs">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
      {flagging && <FlagForm correlationId={event.correlationId} onDone={() => setFlagging(false)} />}
      {replay && (
        <div className="grid grid-cols-2 gap-2 rounded border p-2">
          <div>
            <p className="font-semibold text-muted-foreground">Before</p>
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-xs">{replay.before ?? '(none)'}</pre>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground">After</p>
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-xs">{replay.after ?? '(none)'}</pre>
          </div>
        </div>
      )}
      {replayErr && <p className="text-destructive">{replayErr}</p>}
    </div>
  )
}

function SessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
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
        <span className="font-mono text-xs text-muted-foreground break-all">{sessionId}</span>
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

function PatternList() {
  const [patterns, setPatterns] = useState<readonly Pattern[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    setErr(null)
    getPatterns()
      .then(setPatterns)
      .catch((e: unknown) => setErr(String(e)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Rejection Patterns</h3>
        <Button onClick={load} size="sm" type="button" variant="secondary">
          Refresh
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {patterns !== null && patterns.length === 0 && <p className="text-sm text-muted-foreground">No patterns yet.</p>}
      {patterns !== null &&
        patterns.map(p => (
          <div className="rounded border p-2 text-xs" key={p.key}>
            <div className="flex items-center justify-between">
              <span className="font-mono">{p.key || '(empty)'}</span>
              <span className="rounded bg-muted px-1 font-semibold">{p.count}×</span>
            </div>
            <p className="text-muted-foreground">
              {p.firstSeen.slice(0, 10)} – {p.lastSeen.slice(0, 10)}
            </p>
          </div>
        ))}
    </div>
  )
}

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
      <PatternList />
    </Card>
  )
}
