export function ConversationEmpty() {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-3 px-4 py-10 text-center" data-testid="conv-empty">
      <p className="text-sm font-medium">No conversation selected</p>
      <p className="text-xs text-muted-foreground">
        Pick a conversation from the list, or start a new one to chat with Georges.
      </p>
    </div>
  )
}
