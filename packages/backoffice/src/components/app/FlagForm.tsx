import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Textarea } from '@app/design-system/textarea'
import { flagExchange } from '../../hooks/admin.ts'

type Severity = 'observation' | 'issue' | 'blocker'

export function FlagForm({ correlationId, onDone }: { correlationId: string; onDone: () => void }) {
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
