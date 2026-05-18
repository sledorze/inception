import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import Markdown from 'react-markdown'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { painAtom, painView } from '../../atoms.ts'

const inlineP = ({ children }: { children?: React.ReactNode }) => <>{children}</>

export function PainBoard() {
  const view = useAtomValue(painView)
  const refresh = useAtomRefresh(painAtom)
  const items = view._tag === 'Ready' ? view.value : null
  const error = view._tag === 'Error' ? view.message : null

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-base font-semibold tracking-tight">PAIN Board</h2>
        <Button data-testid="pain-refresh" onClick={refresh} size="sm" type="button" variant="secondary">
          Refresh
        </Button>
      </div>
      {(items === null || items.length === 0) && <p className="text-sm text-muted-foreground">No open PAIN items.</p>}
      {items !== null && (
        <div className="divide-y divide-border">
          {items.map(item => (
            <div className="flex items-start gap-2 py-3 text-sm" key={item.id}>
              <span className="font-mono font-medium">{item.id}</span>
              <span className="flex-1">
                <Markdown components={{ p: inlineP }}>{item.title}</Markdown>
              </span>
              <span className="bg-secondary px-1 text-xs text-secondary-foreground">{item.severity}</span>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Card>
  )
}
