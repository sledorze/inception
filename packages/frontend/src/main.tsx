import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { callTool } from './api/toolkit.ts'
import type { HandlerResult } from './api/toolkit.ts'
import { submitGoal } from './api/goals.ts'
import type { GoalResult } from './api/goals.ts'
import { listProposals, promoteProposal } from './api/proposals.ts'
import type { Proposal } from './api/proposals.ts'

function ResultBox({ result }: { result: HandlerResult | null }) {
  if (!result) {
    return null
  }
  return (
    <pre
      className={`mt-2 rounded p-3 text-sm whitespace-pre-wrap break-all ${result.isFailure ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}
    >
      {JSON.stringify(result.result, null, 2)}
    </pre>
  )
}

function ListTools() {
  const [role, setRole] = useState('Implementer')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <section className="rounded border p-4 space-y-2">
      <h2 className="font-semibold">list-tools</h2>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          data-testid="lt-role"
          onChange={e => setRole(e.target.value)}
          placeholder="role"
          value={role}
        />
        <button
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          data-testid="lt-submit"
          onClick={() => callTool('list-tools', { role }).then(setResult)}
          type="button"
        >
          Call
        </button>
      </div>
      <div data-testid="lt-result">
        <ResultBox result={result} />
      </div>
    </section>
  )
}

function ReadWorkspace() {
  const [path, setPath] = useState('')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <section className="rounded border p-4 space-y-2">
      <h2 className="font-semibold">read-workspace</h2>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          data-testid="rw-path"
          onChange={e => setPath(e.target.value)}
          placeholder="path"
          value={path}
        />
        <button
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          data-testid="rw-submit"
          onClick={() => callTool('read-workspace', { path }).then(setResult)}
          type="button"
        >
          Call
        </button>
      </div>
      <div data-testid="rw-result">
        <ResultBox result={result} />
      </div>
    </section>
  )
}

function WriteWorkspace() {
  const [role, setRole] = useState('Implementer')
  const [path, setPath] = useState('')
  const [content, setContent] = useState('')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <section className="rounded border p-4 space-y-2">
      <h2 className="font-semibold">write-workspace</h2>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          data-testid="ww-role"
          onChange={e => setRole(e.target.value)}
          placeholder="role"
          value={role}
        />
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          data-testid="ww-path"
          onChange={e => setPath(e.target.value)}
          placeholder="path"
          value={path}
        />
      </div>
      <textarea
        className="w-full rounded border px-2 py-1 text-sm"
        data-testid="ww-content"
        onChange={e => setContent(e.target.value)}
        placeholder="content"
        rows={3}
        value={content}
      />
      <button
        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        data-testid="ww-submit"
        onClick={() => callTool('write-workspace', { content, path, role }).then(setResult)}
        type="button"
      >
        Call
      </button>
      <div data-testid="ww-result">
        <ResultBox result={result} />
      </div>
    </section>
  )
}

function SubmitGoal() {
  const [goal, setGoal] = useState('')
  const [handleId, setHandleId] = useState('synthetic-001')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GoalResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!goal.trim()) {
      return
    }
    setBusy(true)
    setResult(null)
    setError(null)
    submitGoal(goal, handleId)
      .then(r => {
        setResult(r)
        setBusy(false)
      })
      .catch((error: unknown) => {
        setError(String(error))
        setBusy(false)
      })
  }

  return (
    <section className="rounded border p-4 space-y-2">
      <h2 className="font-semibold">Submit Goal to Georges</h2>
      <textarea
        className="w-full rounded border px-2 py-1 text-sm"
        data-testid="sg-goal"
        onChange={e => setGoal(e.target.value)}
        placeholder="Describe what you want Georges to do…"
        rows={3}
        value={goal}
      />
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          data-testid="sg-handle"
          onChange={e => setHandleId(e.target.value)}
          placeholder="handleId"
          value={handleId}
        />
        <button
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          data-testid="sg-submit"
          disabled={busy}
          onClick={handleSubmit}
          type="button"
        >
          {busy ? 'Processing…' : 'Submit'}
        </button>
      </div>
      {result && (
        <pre className="mt-2 rounded bg-green-50 p-3 text-sm whitespace-pre-wrap break-all text-green-800">
          {typeof result.text === 'string' ? result.text : JSON.stringify(result, null, 2)}
        </pre>
      )}
      {error && (
        <pre className="mt-2 rounded bg-red-50 p-3 text-sm whitespace-pre-wrap break-all text-red-800">{error}</pre>
      )}
    </section>
  )
}

function Proposals() {
  const [proposals, setProposals] = useState<readonly Proposal[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = () => {
    setMsg(null)
    listProposals()
      .then(setProposals)
      .catch((error: unknown) => setMsg(String(error)))
  }

  const promote = (id: string) => {
    setMsg(null)
    promoteProposal(id)
      .then(({ version }) => {
        setMsg(`Promoted → registry v${version}`)
        return listProposals().then(setProposals)
      })
      .catch((error: unknown) => setMsg(String(error)))
  }

  return (
    <section className="rounded border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Pending Proposals</h2>
        <button
          className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
          data-testid="proposals-refresh"
          onClick={refresh}
          type="button"
        >
          Refresh
        </button>
      </div>
      {proposals.length === 0 && <p className="text-sm text-gray-500">No pending proposals. Submit a goal first.</p>}
      {proposals.map(p => (
        <div className="rounded border p-3 space-y-1 text-sm" key={p.contentHash}>
          <div>
            <span className="font-medium">Name:</span> {p.payload.name ?? '(unknown)'}
          </div>
          <div>
            <span className="font-medium">ID:</span> <span className="font-mono text-xs">{p.contentHash}</span>
          </div>
          <div>
            <span className="font-medium">At:</span> {p.occurredAt}
          </div>
          {p.payload.description && (
            <div>
              <span className="font-medium">Description:</span> {p.payload.description}
            </div>
          )}
          <button
            className="mt-1 rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
            data-testid={`promote-${p.contentHash}`}
            onClick={() => promote(p.contentHash)}
            type="button"
          >
            Promote
          </button>
        </div>
      ))}
      {msg && <p className="text-sm text-indigo-700">{msg}</p>}
    </section>
  )
}

function CallCapability() {
  const [name, setName] = useState('')
  const [role, setRole] = useState('Implementer')
  const [result, setResult] = useState<HandlerResult | null>(null)

  return (
    <section className="rounded border p-4 space-y-2">
      <h2 className="font-semibold">call-capability</h2>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          data-testid="cc-name"
          onChange={e => setName(e.target.value)}
          placeholder="capability name"
          value={name}
        />
        <input
          className="w-32 rounded border px-2 py-1 text-sm"
          data-testid="cc-role"
          onChange={e => setRole(e.target.value)}
          placeholder="role"
          value={role}
        />
        <button
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          data-testid="cc-submit"
          onClick={() => callTool('call-capability', { name, role }).then(setResult)}
          type="button"
        >
          Call
        </button>
      </div>
      <div data-testid="cc-result">
        <ResultBox result={result} />
      </div>
    </section>
  )
}

function App() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Georges Toolkit</h1>
      <SubmitGoal />
      <Proposals />
      <CallCapability />
      <ListTools />
      <ReadWorkspace />
      <WriteWorkspace />
    </div>
  )
}

const root = document.querySelector<HTMLElement>('#root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
