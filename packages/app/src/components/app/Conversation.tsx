import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { Button } from '@app/design-system/button'
import { Input } from '@app/design-system/input'
import { Textarea } from '@app/design-system/textarea'
import { getTurns, respondToGoal, sendMessage } from '../../hooks/chat.ts'
import type { Turn } from '../../hooks/chat.ts'

const mdComponents: Components = {
  code: ({ children }) => <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">{children}</code>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h1 className="mb-2 text-base font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1.5 text-sm font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4">{children}</ol>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded bg-background p-2 font-mono text-xs">{children}</pre>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4">{children}</ul>,
}

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
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [turns.length, busy])

  const handleSend = async () => {
    if (!goal.trim()) {
      return
    }
    const pendingGoal = goal
    const tempId = crypto.randomUUID()
    // Optimistic: show user bubble and clear input immediately
    setTurns(prev => [...prev, { correlationId: tempId, goal: pendingGoal, turnIndex: prev.length }])
    setGoal('')
    setBusy(true)
    setConvError(null)
    try {
      const result = await sendMessage(sessionId, pendingGoal, handleId)
      if (result.clarifyQuestion !== undefined) {
        const q = result.clarifyQuestion
        setTurns(prev =>
          prev.map(t =>
            t.correlationId === tempId ? { ...t, clarifyQuestion: q, correlationId: result.correlationId } : t,
          ),
        )
        setPendingClarify({ correlationId: result.correlationId, question: q })
      } else {
        setTurns(prev =>
          prev.map(t =>
            t.correlationId === tempId ? { ...t, correlationId: result.correlationId, reply: result.text ?? '' } : t,
          ),
        )
      }
    } catch (err: unknown) {
      setConvError(String(err))
      setTurns(prev => prev.filter(t => t.correlationId !== tempId))
    } finally {
      setBusy(false)
    }
  }

  const handleClarifySubmit = async () => {
    if (!pendingClarify || !clarifyAnswer.trim()) {
      return
    }
    const { correlationId } = pendingClarify
    const submittedAnswer = clarifyAnswer
    setBusy(true)
    setConvError(null)
    try {
      await respondToGoal(sessionId, correlationId, submittedAnswer)
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
      const updatedTurns = await getTurns(sessionId)
      setTurns(updatedTurns.map(t => ({ ...t })))
    } catch (err: unknown) {
      setConvError(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      {/* Compact intro strip */}
      <div className="shrink-0 border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold">Chat with Georges</h2>
        <p className="text-xs text-muted-foreground">
          Ask Georges to describe, analyse, or run scripts against the dataset selected below.
        </p>
        <p className="font-mono text-[11px] text-muted-foreground" data-testid="conv-session-id">
          New conversation · Session: {sessionId}
        </p>
      </div>

      {/* Transcript — fills remaining height, scrolls independently */}
      <div
        aria-label="Conversation with Georges"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        data-testid="conv-transcript"
        ref={scrollRef}
        role="log"
      >
        {turns.length === 0 && !busy && (
          <div className="m-auto flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Georges inspects your data handles using tools. Ask it to describe, analyse, or run scripts against a
              dataset.
            </p>
            <Button onClick={() => setGoal('What is synthetic-001?')} size="sm" type="button" variant="outline">
              Try: "What is synthetic-001?"
            </Button>
          </div>
        )}

        {turns.map((t, i) => (
          <div className="flex flex-col gap-1" key={t.correlationId}>
            {/* User bubble */}
            <p className="ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              {t.goal}
            </p>
            {/* Assistant reply */}
            {t.reply !== undefined && (
              <div
                className="mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                data-testid={`conv-reply-${i}`}
              >
                <Markdown components={mdComponents}>{t.reply}</Markdown>
              </div>
            )}
            {/* Clarify question */}
            {t.clarifyQuestion !== undefined && t.reply === undefined && (
              <p
                className="mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm italic text-muted-foreground"
                data-testid={`conv-clarify-${i}`}
              >
                Georges asks: {t.clarifyQuestion}
              </p>
            )}
            {/* User's clarify answer echo */}
            {t.clarifyAnswer !== undefined && (
              <p className="ml-auto text-right text-xs text-muted-foreground">You answered: {t.clarifyAnswer}</p>
            )}
          </div>
        ))}

        {/* Typing indicator while Georges is working */}
        {busy && (
          <div className="mr-auto flex max-w-[80%] items-center gap-1 rounded-lg bg-muted px-3 py-3">
            <span
              aria-hidden="true"
              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]"
            />
            <span
              aria-hidden="true"
              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]"
            />
            <span
              aria-hidden="true"
              className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]"
            />
            <span className="sr-only">Georges is thinking</span>
          </div>
        )}
      </div>

      {/* Composer — pinned at bottom, never scrolls */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3">
        {pendingClarify && (
          <div className="flex items-start gap-2" data-testid="conv-clarify-input-area">
            <Textarea
              aria-label={`Answer: ${pendingClarify.question}`}
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex w-full flex-col gap-0.5 sm:w-36 sm:shrink-0">
              <label className="text-xs text-muted-foreground" htmlFor="conv-handle-id">
                Dataset
              </label>
              <Input
                data-testid="conv-handle"
                id="conv-handle-id"
                onChange={e => setHandleId(e.target.value)}
                placeholder="handleId"
                title="Data handle ID — the dataset Georges will inspect (e.g. synthetic-001)"
                value={handleId}
              />
            </div>
            <Textarea
              aria-label="Message Georges"
              className="flex-1"
              data-testid="conv-goal"
              onChange={e => setGoal(e.target.value)}
              placeholder="Ask Georges anything…"
              rows={2}
              value={goal}
            />
            <Button
              className="w-full sm:w-auto"
              data-testid="conv-send"
              disabled={busy}
              onClick={handleSend}
              size="sm"
              type="button"
            >
              {busy ? 'Thinking…' : 'Send'}
            </Button>
          </div>
        )}

        {convError && (
          <pre aria-live="polite" className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive" role="alert">
            {convError}
          </pre>
        )}
      </div>
    </div>
  )
}
