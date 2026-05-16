import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { callTool } from '../../api/toolkit.ts'
import type { HandlerResult } from '../../api/toolkit.ts'
import { ResultBox } from './ResultBox.tsx'

export function WriteWorkspace() {
  const [role, setRole] = useState('Implementer')
  const [path, setPath] = useState('')
  const [content, setContent] = useState('')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <Card className="p-4 space-y-2">
      <h2 className="font-semibold">write-workspace</h2>
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
        onClick={() => callTool('write-workspace', { content, path, role }).then(setResult)}
        size="sm"
        type="button"
      >
        Call
      </Button>
      <div data-testid="ww-result">
        <ResultBox result={result} />
      </div>
    </Card>
  )
}
