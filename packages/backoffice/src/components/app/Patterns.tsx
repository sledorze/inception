import { useAtomRefresh, useAtomValue } from '@effect/atom-react'
import { Button } from '@app/design-system/button'
import { patternsAtom, patternsView } from '../../atoms.ts'

export function Patterns() {
  const view = useAtomValue(patternsView)
  const refresh = useAtomRefresh(patternsAtom)
  const patterns = view._tag === 'Ready' ? view.value : null
  const error = view._tag === 'Error' ? view.message : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Rejection Patterns</h3>
        <Button onClick={refresh} size="sm" type="button" variant="secondary">
          Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {patterns !== null && patterns.length === 0 && <p className="text-sm text-muted-foreground">No patterns yet.</p>}
      {patterns !== null && patterns.length > 0 && (
        <div className="divide-y divide-border">
          {patterns.map(p => (
            <div className="py-2 text-xs" key={p.key}>
              <div className="flex items-center justify-between">
                <span className="font-mono">{p.key || '(empty)'}</span>
                <span className="bg-muted px-1 font-semibold">{p.count}×</span>
              </div>
              <p className="text-muted-foreground">
                {p.firstSeen.slice(0, 10)} – {p.lastSeen.slice(0, 10)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
