import type { HandlerResult } from '../../hooks/toolkit.ts'

export function ResultBox({ result }: { result: HandlerResult | null }) {
  if (!result) {
    return null
  }
  return (
    <pre
      className={`mt-2 rounded p-3 text-sm whitespace-pre-wrap break-all ${result.isFailure ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}
    >
      {JSON.stringify(result.result, null, 2)}
    </pre>
  )
}
