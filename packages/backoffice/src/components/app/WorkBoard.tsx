import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { workAtom, workView } from '../../atoms.ts'

const STATUS_COLOR: Record<string, string> = {
  blocked: 'bg-destructive/20 text-destructive',
  done: 'bg-success/20 text-success',
  'in-progress': 'bg-primary/20 text-primary',
  parked: 'bg-muted text-muted-foreground',
  todo: 'bg-secondary text-secondary-foreground',
}

export function WorkBoard() {
  const view = useAtomValue(workView)
  const refresh = useAtomRefresh(workAtom)
  const items = view._tag === 'Ready' ? view.value : null
  const error = view._tag === 'Error' ? view.message : null

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-base font-semibold tracking-tight">Work Board (TODO)</h2>
        <Button data-testid="work-refresh" onClick={refresh} size="sm" type="button" variant="secondary">
          Refresh
        </Button>
      </div>
      {(items === null || items.length === 0) && <p className="text-sm text-muted-foreground">No TODO items loaded.</p>}
      {items !== null && (
        <div className="divide-y divide-border">
          {items.map(item => (
            <div className="flex items-start gap-2 py-3 text-sm" key={item.id}>
              <span className="font-mono font-medium">{item.id}</span>
              <span className="flex-1">{item.title}</span>
              <span className={`px-1 text-xs ${STATUS_COLOR[item.status] ?? 'bg-secondary text-secondary-foreground'}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Card>
  )
}
