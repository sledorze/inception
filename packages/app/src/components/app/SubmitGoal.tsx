import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import { Textarea } from '@app/design-system/textarea'
import { submitGoal } from '../../hooks/goals.ts'
import type { GoalResult } from '../../hooks/goals.ts'

export function SubmitGoal() {
  const [goal, setGoal] = useState('')
  const [handleId, setHandleId] = useState('synthetic-001')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GoalResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!goal.trim()) {
      return
    }
    setBusy(true)
    setResult(null)
    setSubmitError(null)
    submitGoal(goal, handleId)
      .then(r => {
        setResult(r)
        setBusy(false)
      })
      .catch((error: unknown) => {
        setSubmitError(String(error))
        setBusy(false)
      })
  }

  return (
    <Card className="p-4 space-y-2">
      <h2 className="font-semibold">Submit Goal to Georges</h2>
      <Textarea
        data-testid="sg-goal"
        onChange={e => setGoal(e.target.value)}
        placeholder="Describe what you want Georges to do…"
        rows={3}
        value={goal}
      />
      <div className="flex gap-2">
        <Input
          className="flex-1"
          data-testid="sg-handle"
          onChange={e => setHandleId(e.target.value)}
          placeholder="handleId"
          value={handleId}
        />
        <Button data-testid="sg-submit" disabled={busy} onClick={handleSubmit} size="sm" type="button">
          {busy ? 'Processing…' : 'Submit'}
        </Button>
      </div>
      {result && (
        <pre className="mt-2 rounded bg-success/10 p-3 text-sm whitespace-pre-wrap break-all text-success">
          {typeof result.text === 'string' ? result.text : JSON.stringify(result, null, 2)}
        </pre>
      )}
      {submitError && (
        <pre className="mt-2 rounded bg-destructive/10 p-3 text-sm whitespace-pre-wrap break-all text-destructive">
          {submitError}
        </pre>
      )}
    </Card>
  )
}
