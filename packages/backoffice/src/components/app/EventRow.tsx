import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ReplayResult, SessionEvent } from '../../api/admin.ts'
import { replayExchange } from '../../api/admin.ts'
import { FlagForm } from './FlagForm.tsx'

export function EventRow({ event }: { event: SessionEvent }) {
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
