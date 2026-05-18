// Central registry of data-testid values — import from here in components, tests, and e2e.
// Node-safe: no browser APIs.
// Keys are sorted alphabetically (oxlint sort-keys).
export const TestIds = {
  // Conversation
  convGoal: 'conv-goal',
  convReply: (n: number) => `conv-reply-${n}`,
  convSend: 'conv-send',
  convSessionId: 'conv-session-id',
  // Auth
  loginPassword: 'login-password',
  loginSubmit: 'login-submit',
  loginUsername: 'login-username',
  // Sessions
  newConversation: 'new-conversation',
} as const
