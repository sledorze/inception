import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import type { PainItem } from '../../api/admin.ts'
import { getPain } from '../../api/admin.ts'

export function PainBoard() {
  const [items, setItems] = useState<readonly PainItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setError(null)
    getPain()
      .then(setItems)
      .catch((err: unknown) => setError(String(err)))
  }

  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">PAIN Board</h2>
        <Button data-testid="pain-refresh" onClick={refresh} size="sm" type="button" variant="secondary">
          Refresh
        </Button>
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No open PAIN items.</p>}
      {items.map(item => (
        <div className="flex items-start gap-2 rounded border p-2 text-sm" key={item.id}>
          <span className="font-mono font-medium">{item.id}</span>
          <span className="flex-1">{item.title}</span>
          <span className="rounded bg-secondary px-1 text-xs text-secondary-foreground">{item.severity}</span>
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Card>
  )
}
