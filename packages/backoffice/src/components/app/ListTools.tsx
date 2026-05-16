import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import { callTool } from '../../api/toolkit.ts'
import type { HandlerResult } from '../../api/toolkit.ts'
import { ResultBox } from './ResultBox.tsx'

export function ListTools() {
  const [role, setRole] = useState('Implementer')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <Card className="p-4 space-y-2">
      <h2 className="font-semibold">list-tools</h2>
      <div className="flex gap-2">
        <Input
          className="flex-1"
          data-testid="lt-role"
          onChange={e => setRole(e.target.value)}
          placeholder="role"
          value={role}
        />
        <Button
          data-testid="lt-submit"
          onClick={() => callTool('list-tools', { role }).then(setResult)}
          size="sm"
          type="button"
        >
          Call
        </Button>
      </div>
      <div data-testid="lt-result">
        <ResultBox result={result} />
      </div>
    </Card>
  )
}
