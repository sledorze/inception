import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import type { AppSettings } from '../../api/admin.ts'
import { getSettings, patchSettings } from '../../api/admin.ts'

export function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [draft, setDraft] = useState<Partial<AppSettings>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setError(null)
    getSettings()
      .then(s => {
        setSettings(s)
        setDraft({ llmBaseUrl: s.llmBaseUrl, llmModel: s.llmModel, sessionMaxTurns: s.sessionMaxTurns })
      })
      .catch((err: unknown) => setError(String(err)))
  }

  const save = () => {
    setSaving(true)
    setError(null)
    patchSettings(draft)
      .then(updated => {
        setSettings(updated)
        setDraft({
          llmBaseUrl: updated.llmBaseUrl,
          llmModel: updated.llmModel,
          sessionMaxTurns: updated.sessionMaxTurns,
        })
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setSaving(false))
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Runtime Settings</h2>
        <Button data-testid="settings-load" onClick={load} size="sm" type="button" variant="secondary">
          Load
        </Button>
      </div>

      {settings && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="llm-base-url">
              LLM Base URL
            </label>
            <Input
              className="font-mono"
              id="llm-base-url"
              onChange={e => setDraft(d => ({ ...d, llmBaseUrl: e.target.value }))}
              type="text"
              value={draft.llmBaseUrl ?? settings.llmBaseUrl}
            />
            <p className="text-xs text-muted-foreground">Takes effect on next server restart</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="llm-model">
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
            <label className="text-sm font-medium" htmlFor="session-max-turns">
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
