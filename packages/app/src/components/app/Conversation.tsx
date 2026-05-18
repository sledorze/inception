import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNavigate, useParams } from 'react-router'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Button } from '@app/design-system/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@app/design-system/collapsible'
import { Input } from '@app/design-system/input'
import { Textarea } from '@app/design-system/textarea'
import { respondAtom, respondView, sendGoalAtom, sendGoalView, turnsView } from '../../atoms.ts'

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
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  td: ({ children }) => <td className="px-2 py-1 align-top text-foreground">{children}</td>,
  th: ({ children }) => <th className="px-2 py-1 text-left font-semibold text-foreground">{children}</th>,
  thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4">{children}</ul>,
}

export function Conversation() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const view = useAtomValue(turnsView(sessionId ?? ''))
  const send = useAtomSet(sendGoalAtom)
  const sendState = useAtomValue(sendGoalView)
  const respond = useAtomSet(respondAtom)
  const respondState = useAtomValue(respondView)

  const [goal, setGoal] = useState('')
  const [handleId, setHandleId] = useState('synthetic-001')
  const [pendingGoal, setPendingGoal] = useState<string | null>(null)
  const [answeredCid, setAnsweredCid] = useState<string | null>(null)
  const [clarifyAnswer, setClarifyAnswer] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const turns = view._tag === 'Ready' ? view.value : []
  const loadError = view._tag === 'Error' ? view.message : null
  const sendError = sendState._tag === 'Error' ? sendState.message : null
  const respondErr = respondState._tag === 'Error' ? respondState.message : null
  const error = sendError ?? respondErr ?? loadError
  const busy = sendState.waiting || respondState.waiting

  // Clarification is in-flight state for the just-sent goal — read it from the
  // authoritative POST response (sendGoalView), not the /turns transcript:
  // ClarifyRequested is persisted under sessionId='bootstrap' (toolkit context
  // gap), so it never appears in GET /api/sessions/:id/turns.
  const sentClarify =
    sendState._tag === 'Ready' && sendState.value.clarifyQuestion !== undefined ?
      { correlationId: sendState.value.correlationId, question: sendState.value.clarifyQuestion }
    : null
  const pendingClarify = sentClarify !== null && sentClarify.correlationId !== answeredCid ? sentClarify : null
  const clarifyPending = pendingClarify !== null

  // Drop the optimistic bubble once the send settles with no pending clarify
  // (the key-bus refetch has hydrated the authoritative transcript by then).
  useEffect(() => {
    if (!sendState.waiting && !respondState.waiting && !clarifyPending) {
      setPendingGoal(null)
    }
  }, [sendState.waiting, respondState.waiting, clarifyPending])

  // Avoid a duplicate user bubble once the real turn arrives in the transcript.
  useEffect(() => {
    if (pendingGoal !== null && turns.some(t => t.goal === pendingGoal)) {
      setPendingGoal(null)
    }
  }, [turns, pendingGoal])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [turns.length, busy])

  if (sessionId === undefined) {
    return null
  }

  const handleSend = () => {
    const trimmed = goal.trim()
    if (!trimmed) {
      return
    }
    setPendingGoal(trimmed)
    setGoal('')
    send({ goal: trimmed, handleId, sessionId })
  }

  const handleClarifySubmit = () => {
    const trimmed = clarifyAnswer.trim()
    if (pendingClarify === null || !trimmed) {
      return
    }
    setClarifyAnswer('')
    setAnsweredCid(pendingClarify.correlationId)
    respond({ answer: trimmed, correlationId: pendingClarify.correlationId, sessionId })
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <Button
          className="sm:hidden"
          data-testid="conv-back"
          onClick={() => navigate('/')}
          size="sm"
          type="button"
          variant="ghost"
        >
          ← Conversations
        </Button>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Chat with Georges</h2>
          <p className="truncate font-mono text-[11px] text-muted-foreground" data-testid="conv-session-id">
            Session: {sessionId}
          </p>
        </div>
      </div>

      <div
        aria-label="Conversation with Georges"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        data-testid="conv-transcript"
        ref={scrollRef}
        role="log"
      >
        {turns.length === 0 && pendingGoal === null && !busy && (
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
            <p className="ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              {t.goal}
            </p>
            {t.scripts !== undefined &&
              t.scripts.length > 0 &&
              t.scripts.map((s, j) => (
                <Collapsible
                  className="mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-1 text-sm"
                  data-testid={`conv-script-${i}-${j}`}
                  key={`${i}-${j}`}
                >
                  <CollapsibleTrigger className="w-full text-left text-xs text-muted-foreground hover:text-foreground">
                    Georges ran code (exit {s.exitCode}) on {s.handleId}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Markdown components={mdComponents} remarkPlugins={[remarkGfm]}>
                      {`\`\`\`\n${s.script}\n\`\`\``}
                    </Markdown>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            {t.reply !== undefined && (
              <div
                className="mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                data-testid={`conv-reply-${i}`}
              >
                <Markdown components={mdComponents} remarkPlugins={[remarkGfm]}>
                  {t.reply}
                </Markdown>
              </div>
            )}
            {t.clarifyQuestion !== undefined && t.reply === undefined && (
              <p
                className="mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm italic text-muted-foreground"
                data-testid={`conv-clarify-${i}`}
              >
                Georges asks: {t.clarifyQuestion}
              </p>
            )}
            {t.clarifyAnswer !== undefined && (
              <p className="ml-auto text-right text-xs text-muted-foreground">You answered: {t.clarifyAnswer}</p>
            )}
          </div>
        ))}

        {pendingGoal !== null && (
          <p
            className="ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground opacity-70"
            data-testid="conv-pending-goal"
          >
            {pendingGoal}
          </p>
        )}

        {pendingClarify !== null && (
          <p
            className="mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm italic text-muted-foreground"
            data-testid={`conv-clarify-${turns.length}`}
          >
            Georges asks: {pendingClarify.question}
          </p>
        )}

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

      <div className="shrink-0 border-t border-border bg-background px-4 py-3">
        {pendingClarify !== null && (
          <div className="flex items-start gap-2" data-testid="conv-clarify-input-area">
            <Textarea
              aria-label={`Answer: ${pendingClarify.question}`}
              className="flex-1"
              data-testid="conv-clarify-answer"
              onChange={e => setClarifyAnswer(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleClarifySubmit()
                }
              }}
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

        {pendingClarify === null && (
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
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  handleSend()
                }
              }}
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

        {error && (
          <pre aria-live="polite" className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive" role="alert">
            {error}
          </pre>
        )}
      </div>
    </div>
  )
}
