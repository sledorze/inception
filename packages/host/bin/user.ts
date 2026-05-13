#!/usr/bin/env node
/**
 * Submit a goal to the Host's UserGateway HTTP endpoint.
 * Usage: USER_GATEWAY_PORT=3001 node --import tsx bin/user.ts <goal> <handleId>
 * Session id is the current process pid (§10.1 Q4).
 */
const goal = process.argv[2]
const handleId = process.argv[3]

if (!goal || !handleId) {
  process.stderr.write('Usage: bin/user.ts <goal> <handleId>\n')
  process.exit(1)
}

const port = process.env['USER_GATEWAY_PORT'] ?? '3001'
const url = `http://127.0.0.1:${port}/goals`

const res = await fetch(url, {
  body: JSON.stringify({ goal, handleId, sessionId: String(process.pid) }),
  headers: { 'Content-Type': 'application/json' },
  method: 'POST',
})

if (!res.ok) {
  const text = await res.text()
  process.stderr.write(`Error ${res.status}: ${text}\n`)
  process.exit(1)
}

process.stdout.write('Goal submitted.\n')
