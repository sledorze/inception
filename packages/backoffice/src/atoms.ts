import * as Atom from 'effect/unstable/reactivity/Atom'
import * as Effect from 'effect/Effect'
import { getMetrics, getPain, getPatterns, getSessions, getWork } from './hooks/admin.ts'

const fetchAtom = <T>(fn: () => Promise<T>) => Atom.make(Effect.tryPromise({ catch: e => String(e), try: fn }))

export const metricsAtom = fetchAtom(getMetrics)
export const painAtom = fetchAtom(getPain)
export const patternsAtom = fetchAtom(getPatterns)
export const sessionsAtom = fetchAtom(getSessions)
export const workAtom = fetchAtom(getWork)
