import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import type { TodoItem } from '../../hooks/admin.ts'
import { getWork } from '../../hooks/admin.ts'
import { useAsyncFetch } from '../../hooks/useAsyncFetch.ts'

const STATUS_COLOR: Record<string, string> = {
  blocked: 'bg-destructive/20 text-destructive',
  done: 'bg-success/20 text-success',
  'in-progress': 'bg-primary/20 text-primary',
  parked: 'bg-muted text-muted-foreground',
  todo: 'bg-secondary text-secondary-foreground',
}

export function WorkBoard() {
  const { data: items, error, refresh } = useAsyncFetch<readonly TodoItem[]>(getWork)

  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Work Board (TODO)</h2>
        <Button data-testid="work-refresh" onClick={refresh} size="sm" type="button" variant="secondary">
          Refresh
        </Button>
      </div>
      {(items === null || items.length === 0) && <p className="text-sm text-muted-foreground">No TODO items loaded.</p>}
      {items !== null &&
        items.map(item => (
          <div className="flex items-start gap-2 rounded border p-2 text-sm" key={item.id}>
            <span className="font-mono font-medium">{item.id}</span>
            <span className="flex-1">{item.title}</span>
            <span
              className={`rounded px-1 text-xs ${STATUS_COLOR[item.status] ?? 'bg-secondary text-secondary-foreground'}`}
            >
              {item.status}
            </span>
          </div>
        ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Card>
  )
}
