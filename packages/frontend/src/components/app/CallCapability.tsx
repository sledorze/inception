import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { callTool } from '../../api/toolkit.ts'
import type { HandlerResult } from '../../api/toolkit.ts'
import { ResultBox } from './ResultBox.tsx'

export function CallCapability() {
  const [name, setName] = useState('')
  const [role, setRole] = useState('Implementer')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <Card className="p-4 space-y-2">
      <h2 className="font-semibold">call-capability</h2>
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
          onClick={() => callTool('call-capability', { name, role }).then(setResult)}
          size="sm"
          type="button"
        >
          Call
        </Button>
      </div>
      <div data-testid="cc-result">
        <ResultBox result={result} />
      </div>
    </Card>
  )
}
