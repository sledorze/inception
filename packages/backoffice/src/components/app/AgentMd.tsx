import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Textarea } from '@app/design-system/textarea'
import { getAgentMd, patchAgentMd } from '../../hooks/admin.ts'

export function AgentMd() {
  const [content, setContent] = useState<string | null>(null)
  const [rationale, setRationale] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ prevHash: string; newHash: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setErr(null)
    setResult(null)
    try {
      const r = await getAgentMd()
      setContent(r.content)
    } catch (e: unknown) {
      setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (content === null || !rationale.trim()) {
      return
    }
    setSaving(true)
    setErr(null)
    setResult(null)
    try {
      const r = await patchAgentMd(content, rationale)
      setResult(r)
      setRationale('')
    } catch (e: unknown) {
      setErr(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-base font-semibold tracking-tight">agent.md Amendment</h2>
        <Button
          data-testid="agentmd-load"
          disabled={loading}
          onClick={load}
          size="sm"
          type="button"
          variant="secondary"
        >
          {loading ? 'Loading…' : 'Load'}
        </Button>
      </div>
      {content !== null && (
        <div className="space-y-3">
          <Textarea
            className="min-h-64 font-mono text-xs"
            data-testid="agentmd-content"
            onChange={e => setContent(e.target.value)}
            value={content}
          />
          <Textarea
            className="text-xs"
            data-testid="agentmd-rationale"
            onChange={e => setRationale(e.target.value)}
            placeholder="Rationale for amendment (required — must reference a flagged exchange or rejection)"
            rows={2}
            value={rationale}
          />
          <Button
            data-testid="agentmd-save"
            disabled={saving || !rationale.trim()}
            onClick={save}
            size="sm"
            type="button"
          >
            {saving ? 'Saving…' : 'Save amendment'}
          </Button>
        </div>
      )}
      {result && (
        <p className="font-mono text-xs text-muted-foreground">
          Amended: {result.prevHash.slice(0, 8)} → {result.newHash.slice(0, 8)}
        </p>
      )}
      {err && <pre className="rounded bg-destructive/10 p-2 text-xs text-destructive">{err}</pre>}
    </Card>
  )
}
