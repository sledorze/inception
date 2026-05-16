import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import type { LoopHealth } from '../../api/admin.ts'
import { getMetrics } from '../../api/admin.ts'

export function Metrics() {
  const [health, setHealth] = useState<LoopHealth | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setError(null)
    getMetrics()
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)))
  }

  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Loop Health</h2>
        <Button data-testid="metrics-refresh" onClick={refresh} size="sm" type="button" variant="secondary">
          Refresh
        </Button>
      </div>
      {health && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Events</dt>
            <dd className="font-mono font-medium">{health.eventCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Open PAIN</dt>
            <dd className="font-mono font-medium">{health.openPainItems}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Archived PAIN</dt>
            <dd className="font-mono font-medium">{health.archivedPainItems}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Open TODO</dt>
            <dd className="font-mono font-medium">{health.openTodoItems}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Done TODO</dt>
            <dd className="font-mono font-medium">{health.doneTodoItems}</dd>
          </div>
        </dl>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Card>
  )
}
