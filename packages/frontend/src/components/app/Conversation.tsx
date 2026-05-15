import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { sendMessage } from '../../api/chat.ts'
import type { Turn } from '../../api/chat.ts'

export function Conversation() {
  const [sessionId] = useState(() => crypto.randomUUID())
  const [goal, setGoal] = useState('')
  const [handleId, setHandleId] = useState('synthetic-001')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [convError, setConvError] = useState<string | null>(null)

  const handleSend = () => {
    if (!goal.trim()) {
      return
    }
    const pendingGoal = goal
    setBusy(true)
    setConvError(null)
    sendMessage(sessionId, pendingGoal, handleId)
      .then(result => {
        setTurns(prev => [
          ...prev,
          {
            correlationId: result.correlationId,
            goal: pendingGoal,
            reply: result.text ?? '',
            turnIndex: prev.length,
          },
        ])
        setGoal('')
        setBusy(false)
      })
      .catch((err: unknown) => {
        setConvError(String(err))
        setBusy(false)
      })
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-semibold">Chat with Georges</h2>
      <p className="font-mono break-all text-xs text-muted-foreground" data-testid="conv-session-id">
        Session: {sessionId}
      </p>
      <div className="h-48 space-y-2 overflow-y-auto rounded border p-2" data-testid="conv-transcript">
        {turns.length === 0 && (
          <p className="text-sm text-muted-foreground">Send a message to start the conversation.</p>
        )}
        {turns.map(t => (
          <div className="space-y-1" key={t.correlationId}>
            <p className="text-right text-sm font-medium text-primary">{t.goal}</p>
            <p className="text-left text-sm" data-testid={`conv-reply-${t.turnIndex}`}>
              {t.reply}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <Input
          className="w-36 shrink-0"
          data-testid="conv-handle"
          onChange={e => setHandleId(e.target.value)}
          placeholder="handleId"
          value={handleId}
        />
        <Textarea
          className="flex-1"
          data-testid="conv-goal"
          onChange={e => setGoal(e.target.value)}
          placeholder="Ask Georges anything…"
          rows={2}
          value={goal}
        />
        <Button data-testid="conv-send" disabled={busy} onClick={handleSend} size="sm" type="button">
          {busy ? 'Thinking…' : 'Send'}
        </Button>
      </div>
      {convError && <pre className="rounded bg-destructive/10 p-2 text-xs text-destructive">{convError}</pre>}
    </Card>
  )
}
