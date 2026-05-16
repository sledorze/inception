import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Pattern } from '../../api/admin.ts'
import { getPatterns } from '../../api/admin.ts'

export function Patterns() {
  const [patterns, setPatterns] = useState<readonly Pattern[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    setErr(null)
    getPatterns()
      .then(setPatterns)
      .catch((e: unknown) => setErr(String(e)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Rejection Patterns</h3>
        <Button onClick={load} size="sm" type="button" variant="secondary">
          Refresh
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {patterns !== null && patterns.length === 0 && <p className="text-sm text-muted-foreground">No patterns yet.</p>}
      {patterns !== null &&
        patterns.map(p => (
          <div className="rounded border p-2 text-xs" key={p.key}>
            <div className="flex items-center justify-between">
              <span className="font-mono">{p.key || '(empty)'}</span>
              <span className="rounded bg-muted px-1 font-semibold">{p.count}×</span>
            </div>
            <p className="text-muted-foreground">
              {p.firstSeen.slice(0, 10)} – {p.lastSeen.slice(0, 10)}
            </p>
          </div>
        ))}
    </div>
  )
}
