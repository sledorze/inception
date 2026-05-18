import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import type { AppSettings } from '../../hooks/admin.ts'
import { getSettings, patchSettings } from '../../hooks/admin.ts'

export function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState<Partial<AppSettings>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setError(null)
    try {
      const s = await getSettings()
      setSettings(s)
      setDraft({ llmBaseUrl: s.llmBaseUrl, llmModel: s.llmModel, sessionMaxTurns: s.sessionMaxTurns })
    } catch (err: unknown) {
      setError(String(err))
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await patchSettings(draft)
      setSettings(updated)
      setDraft({
        llmBaseUrl: updated.llmBaseUrl,
        llmModel: updated.llmModel,
        sessionMaxTurns: updated.sessionMaxTurns,
      })
    } catch (err: unknown) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-base font-semibold tracking-tight">Runtime Settings</h2>
        <Button data-testid="settings-load" onClick={load} size="sm" type="button" variant="secondary">
          Load
        </Button>
      </div>

      {settings && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="llm-base-url">
              LLM Base URL
            </label>
            <Input
              className="font-mono"
              id="llm-base-url"
              onChange={e => setDraft(d => ({ ...d, llmBaseUrl: e.target.value }))}
              type="text"
              value={draft.llmBaseUrl ?? settings.llmBaseUrl}
            />
            <p className="text-xs text-muted-foreground">Takes effect on next request</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="llm-model">
              LLM Model
            </label>
            <Input
              className="font-mono"
              id="llm-model"
              onChange={e => setDraft(d => ({ ...d, llmModel: e.target.value }))}
              type="text"
              value={draft.llmModel ?? settings.llmModel}
            />
            <p className="text-xs text-muted-foreground">Takes effect on next server restart</p>
          </div>

          <div className="space-y-1">
            <label
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              htmlFor="session-max-turns"
            >
              Session Max Turns
            </label>
            <Input
              id="session-max-turns"
              min={1}
              onChange={e => setDraft(d => ({ ...d, sessionMaxTurns: parseInt(e.target.value, 10) || 1 }))}
              type="number"
              value={draft.sessionMaxTurns ?? settings.sessionMaxTurns}
            />
            <p className="text-xs text-muted-foreground">Takes effect on next request</p>
          </div>

          <Button data-testid="settings-save" disabled={saving} onClick={save} size="sm" type="button">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </Card>
  )
}
