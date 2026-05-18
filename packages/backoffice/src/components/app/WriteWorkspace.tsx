import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import { Textarea } from '@app/design-system/textarea'
import { callTool } from '../../hooks/toolkit.ts'
import type { HandlerResult } from '../../hooks/toolkit.ts'
import { ResultBox } from './ResultBox.tsx'

export function WriteWorkspace() {
  const [role, setRole] = useState('Implementer')
  const [path, setPath] = useState('')
  const [content, setContent] = useState('')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <Card className="p-6">
      <div className="mb-4 border-b border-border pb-3">
        <h2 className="text-base font-semibold tracking-tight">write-workspace</h2>
      </div>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            className="flex-1"
            data-testid="ww-role"
            onChange={e => setRole(e.target.value)}
            placeholder="role"
            value={role}
          />
          <Input
            className="flex-1"
            data-testid="ww-path"
            onChange={e => setPath(e.target.value)}
            placeholder="path"
            value={path}
          />
        </div>
        <Textarea
          data-testid="ww-content"
          onChange={e => setContent(e.target.value)}
          placeholder="content"
          rows={3}
          value={content}
        />
        <Button
          data-testid="ww-submit"
          onClick={async () => {
            setResult(await callTool('write-workspace', { content, path, role }))
          }}
          size="sm"
          type="button"
        >
          Call
        </Button>
        <div data-testid="ww-result">
          <ResultBox result={result} />
        </div>
      </div>
    </Card>
  )
}
