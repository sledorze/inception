import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import { Textarea } from '@app/design-system/textarea'
import { getTurns, respondToGoal, sendMessage } from '../../api/chat.ts'
import type { Turn } from '../../api/chat.ts'

interface PendingClarify {
  correlationId: string
  question: string
}

interface TurnWithClarify extends Turn {
  pendingAnswer?: string
}

export function Conversation() {
  const [sessionId] = useState(() => crypto.randomUUID())
  const [goal, setGoal] = useState('')
  const [handleId, setHandleId] = useState('synthetic-001')
  const [turns, setTurns] = useState<TurnWithClarify[]>([])
  const [busy, setBusy] = useState(false)
  const [convError, setConvError] = useState<string | null>(null)
  const [pendingClarify, setPendingClarify] = useState<PendingClarify | null>(null)
  const [clarifyAnswer, setClarifyAnswer] = useState('')

  const handleSend = () => {
    if (!goal.trim()) {
      return
    }
    const pendingGoal = goal
    setBusy(true)
    setConvError(null)
    sendMessage(sessionId, pendingGoal, handleId)
      .then(result => {
        if (result.clarifyQuestion !== undefined) {
          const q = result.clarifyQuestion
          setTurns(prev => [
            ...prev,
            {
              clarifyQuestion: q,
              correlationId: result.correlationId,
              goal: pendingGoal,
              turnIndex: prev.length,
            },
          ])
          setPendingClarify({ correlationId: result.correlationId, question: q })
        } else {
          setTurns(prev => [
            ...prev,
            {
              correlationId: result.correlationId,
              goal: pendingGoal,
              reply: result.text ?? '',
              turnIndex: prev.length,
            },
          ])
        }
        setGoal('')
        setBusy(false)
      })
      .catch((err: unknown) => {
        setConvError(String(err))
        setBusy(false)
      })
  }

  const handleClarifySubmit = () => {
    if (!pendingClarify || !clarifyAnswer.trim()) {
      return
    }
    const { correlationId } = pendingClarify
    const submittedAnswer = clarifyAnswer
    setBusy(true)
    setConvError(null)
    respondToGoal(sessionId, correlationId, submittedAnswer)
      .then(() => {
        setTurns(prev =>
          prev.map(t => {
            if (t.correlationId !== correlationId) {
              return t
            }
            const { pendingAnswer: _removed, ...rest } = t
            return { ...rest, clarifyAnswer: submittedAnswer }
          }),
        )
        setPendingClarify(null)
        setClarifyAnswer('')
        setBusy(false)
        return getTurns(sessionId)
      })
      .then((updatedTurns: readonly Turn[]) => {
        setTurns(updatedTurns.map(t => ({ ...t })))
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
            {t.reply !== undefined && (
              <p className="text-left text-sm" data-testid={`conv-reply-${t.turnIndex}`}>
                {t.reply}
              </p>
            )}
            {t.clarifyQuestion !== undefined && t.reply === undefined && (
              <p className="text-left text-sm italic text-muted-foreground" data-testid={`conv-clarify-${t.turnIndex}`}>
                Georges asks: {t.clarifyQuestion}
              </p>
            )}
            {t.clarifyAnswer !== undefined && (
              <p className="text-right text-xs text-muted-foreground">You answered: {t.clarifyAnswer}</p>
            )}
          </div>
        ))}
      </div>
      {pendingClarify && (
        <div className="flex items-start gap-2" data-testid="conv-clarify-input-area">
          <Textarea
            className="flex-1"
            data-testid="conv-clarify-answer"
            onChange={e => setClarifyAnswer(e.target.value)}
            placeholder={`Answer: ${pendingClarify.question}`}
            rows={2}
            value={clarifyAnswer}
          />
          <Button
            data-testid="conv-clarify-submit"
            disabled={busy}
            onClick={handleClarifySubmit}
            size="sm"
            type="button"
          >
            {busy ? 'Thinking…' : 'Answer'}
          </Button>
        </div>
      )}
      {!pendingClarify && (
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
      )}
      {convError && <pre className="rounded bg-destructive/10 p-2 text-xs text-destructive">{convError}</pre>}
    </Card>
  )
}
