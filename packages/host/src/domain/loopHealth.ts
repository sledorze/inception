import { Schema } from 'effect'

export const LoopHealthSchema = Schema.Struct({
  archivedPainItems: Schema.Number,
  doneTodoItems: Schema.Number,
  eventCount: Schema.Number,
  openPainItems: Schema.Number,
  openTodoItems: Schema.Number,
})
export type LoopHealth = typeof LoopHealthSchema.Type

export const PainItemStatusSchema = Schema.Literals(['open', 'archived'])

export const PainItemSchema = Schema.Struct({
  candidateFix: Schema.optional(Schema.String),
  id: Schema.String,
  severity: Schema.String,
  status: PainItemStatusSchema,
  symptom: Schema.optional(Schema.String),
  title: Schema.String,
})
export type PainItem = typeof PainItemSchema.Type

export const TodoStatusSchema = Schema.Literals(['todo', 'in-progress', 'done', 'blocked', 'parked'])

export const TodoItemSchema = Schema.Struct({
  id: Schema.String,
  phase: Schema.String,
  status: TodoStatusSchema,
  title: Schema.String,
})
export type TodoItem = typeof TodoItemSchema.Type
