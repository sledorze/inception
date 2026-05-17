import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import { callTool } from '../../hooks/toolkit.ts'
import type { HandlerResult } from '../../hooks/toolkit.ts'
import { ResultBox } from './ResultBox.tsx'

export function ReadWorkspace() {
  const [path, setPath] = useState('')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <Card className="p-4 space-y-2">
      <h2 className="font-semibold">read-workspace</h2>
      <div className="flex gap-2">
        <Input
          className="flex-1"
          data-testid="rw-path"
          onChange={e => setPath(e.target.value)}
          placeholder="path"
          value={path}
        />
        <Button
          data-testid="rw-submit"
          onClick={async () => {
            setResult(await callTool('read-workspace', { path }))
          }}
          size="sm"
          type="button"
        >
          Call
        </Button>
      </div>
      <div data-testid="rw-result">
        <ResultBox result={result} />
      </div>
    </Card>
  )
}
