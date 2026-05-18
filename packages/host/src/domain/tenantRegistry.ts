import { makeSessionId } from './ids.ts'

export const SYSTEM_TENANT_ID = '__system__'
export const TENANTS_SESSION_ID = makeSessionId('__tenants__')
