#!/usr/bin/env node
/**
 * Outer MCP observability server (3.3).
 * Launches StdioMcpObservabilityAdapter over stdio so Claude can query and
 * replay S1 traces without touching the running host process.
 *
 * Usage: EVENT_STORE_PATH=data/events.db node --import tsx bin/observe.ts
 *
 * Stdout carries MCP JSON-RPC only. All logs go to stderr.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Layer, Logger } from 'effect'
import * as NodeRuntime from '@effect/platform-node/NodeRuntime'
import { SqliteEventStore } from '../src/adapters/driven/SqliteEventStore.ts'
import { EventStoreObservabilityGateway } from '../src/adapters/driving/EventStoreObservabilityGateway.ts'
import { StdioMcpObservabilityAdapter } from '../src/adapters/driving/StdioMcpObservabilityAdapter.ts'

const __dir = import.meta.dirname
const DB_PATH = process.env['EVENT_STORE_PATH'] ?? join(__dir, '..', 'data', 'events.db')
mkdirSync(dirname(DB_PATH), { recursive: true })

const mainLayer = StdioMcpObservabilityAdapter.layer.pipe(
  Layer.provide(EventStoreObservabilityGateway.layer),
  Layer.provide(SqliteEventStore.layer(DB_PATH)),
  Layer.provide(Logger.layer([Logger.consolePretty({ stderr: true })])),
)

NodeRuntime.runMain()(Layer.launch(mainLayer))
