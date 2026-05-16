import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { callTool } from '../../api/toolkit.ts'
import type { HandlerResult } from '../../api/toolkit.ts'
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
          onClick={() => callTool('read-workspace', { path }).then(setResult)}
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
