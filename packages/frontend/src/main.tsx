import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { callTool } from './api/toolkit.ts'
import type { HandlerResult } from './api/toolkit.ts'

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

function App() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Georges Toolkit</h1>
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
