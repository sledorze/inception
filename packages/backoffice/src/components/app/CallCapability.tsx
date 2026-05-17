import { useState } from 'react'
import { Button } from '@app/design-system/button'
import { Card } from '@app/design-system/card'
import { Input } from '@app/design-system/input'
import { callTool } from '../../hooks/toolkit.ts'
import type { HandlerResult } from '../../hooks/toolkit.ts'
import { ResultBox } from './ResultBox.tsx'

export function CallCapability() {
  const [name, setName] = useState('')
  const [role, setRole] = useState('Implementer')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <Card className="p-6">
      <div className="mb-4 border-b border-border pb-3">
        <h2 className="text-base font-semibold tracking-tight">call-capability</h2>
      </div>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            className="flex-1"
            data-testid="cc-name"
            onChange={e => setName(e.target.value)}
            placeholder="capability name"
            value={name}
          />
          <Input
            className="w-32"
            data-testid="cc-role"
            onChange={e => setRole(e.target.value)}
            placeholder="role"
            value={role}
          />
          <Button
            data-testid="cc-submit"
            onClick={async () => {
              setResult(await callTool('call-capability', { name, role }))
            }}
            size="sm"
            type="button"
          >
            Call
          </Button>
        </div>
        <div data-testid="cc-result">
          <ResultBox result={result} />
        </div>
      </div>
    </Card>
  )
}
