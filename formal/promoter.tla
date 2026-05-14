---------------------------- MODULE promoter ----------------------------
(**
 * Promoter handshake protocol (L0.2, L2.6).
 *
 * Actors:
 *   Georges  — proposes capability / role / workflow changes.
 *   Supervisor — evaluates proposals against a DelegatedPromotionPolicy
 *                published by Claude; emits Promoted when policy matches.
 *   Claude   — reviews proposals the Supervisor cannot auto-approve;
 *               emits Promoted or Rejected.
 *
 * Protocol:
 *   1. Georges emits Proposed(scope, contentHash).
 *   2. Supervisor checks the DelegatedPromotionPolicy for that scope.
 *      a. Policy matches AND blast-radius/fitness checks pass
 *         → emits Promoted(scope, contentHash, policyId).  State: promoted.
 *      b. No matching policy → routes to Claude.  State: awaiting_claude.
 *   3. Claude reviews the proposal.
 *      a. Accept → emits Promoted(scope, contentHash, "claude").  State: promoted.
 *      b. Reject → emits Rejected(scope, contentHash).            State: rejected.
 *
 * Safety (Inv):
 *   For every scope, at most one contentHash is ever Promoted.
 *   No scope can be simultaneously promoted and rejected with the same hash.
 *
 * Liveness (Live):
 *   Every proposed scope eventually reaches promoted or rejected.
 *
 * Note: Tier-1 amendments bypass this protocol entirely (L0.2 requires
 * unanimous Claude+User+2-of-3 Witness co-signing; not modelled here).
 *
 * Model check:
 *   tlc promoter.tla -config promoter.cfg -deadlock
 * Expected: no errors; Inv holds under all interleavings;
 *           Live holds under fairness assumptions.
 *)
EXTENDS Sequences, FiniteSets, TLC

CONSTANTS
  Scopes,         \* set of promotion scopes, e.g. {"role", "workflow", "capability"}
  ContentHashes,  \* set of possible content hashes
  Policies        \* set of DelegatedPromotionPolicy ids (including "none")

ASSUME Policies # {}
ASSUME "none" \in Policies   \* sentinel: Supervisor has no matching policy

VARIABLES
  proposalState,   \* scope -> "idle" | "proposed" | "evaluating" | "awaiting_claude"
                   \*                 | "promoted" | "rejected"
  promotedHash,    \* scope -> ContentHash (defined only when promoted)
  proposedHash     \* scope -> ContentHash (defined when proposed/evaluating/awaiting_claude)

vars == <<proposalState, promotedHash, proposedHash>>

\* ─── type invariant ─────────────────────────────────────────────────────────

TypeOK ==
  /\ proposalState \in [Scopes -> {"idle", "proposed", "evaluating",
                                   "awaiting_claude", "promoted", "rejected"}]
  /\ promotedHash  \in [Scopes -> ContentHashes \cup {"none"}]
  /\ proposedHash  \in [Scopes -> ContentHashes \cup {"none"}]

\* ─── initial state ──────────────────────────────────────────────────────────

Init ==
  /\ proposalState = [s \in Scopes |-> "idle"]
  /\ promotedHash  = [s \in Scopes |-> "none"]
  /\ proposedHash  = [s \in Scopes |-> "none"]

\* ─── transitions ────────────────────────────────────────────────────────────

\* Georges submits a proposal for a scope that is currently idle.
GeorgesProposes(scope, hash) ==
  /\ proposalState[scope] = "idle"
  /\ hash \in ContentHashes
  /\ proposalState' = [proposalState EXCEPT ![scope] = "proposed"]
  /\ proposedHash'  = [proposedHash  EXCEPT ![scope] = hash]
  /\ UNCHANGED promotedHash

\* Supervisor picks up the proposal for evaluation.
SupervisorEvaluates(scope) ==
  /\ proposalState[scope] = "proposed"
  /\ proposalState' = [proposalState EXCEPT ![scope] = "evaluating"]
  /\ UNCHANGED <<promotedHash, proposedHash>>

\* Supervisor auto-promotes when a matching DelegatedPromotionPolicy exists.
SupervisorAutoPromotes(scope, policy) ==
  /\ proposalState[scope] = "evaluating"
  /\ policy \in Policies
  /\ policy # "none"
  /\ proposalState' = [proposalState EXCEPT ![scope] = "promoted"]
  /\ promotedHash'  = [promotedHash  EXCEPT ![scope] = proposedHash[scope]]
  /\ UNCHANGED proposedHash

\* Supervisor routes to Claude when no policy matches.
SupervisorRoutesToClaude(scope) ==
  /\ proposalState[scope] = "evaluating"
  /\ proposalState' = [proposalState EXCEPT ![scope] = "awaiting_claude"]
  /\ UNCHANGED <<promotedHash, proposedHash>>

\* Claude accepts the proposal.
ClaudePromotes(scope) ==
  /\ proposalState[scope] = "awaiting_claude"
  /\ proposalState' = [proposalState EXCEPT ![scope] = "promoted"]
  /\ promotedHash'  = [promotedHash  EXCEPT ![scope] = proposedHash[scope]]
  /\ UNCHANGED proposedHash

\* Claude rejects the proposal.
ClaudeRejects(scope) ==
  /\ proposalState[scope] = "awaiting_claude"
  /\ proposalState' = [proposalState EXCEPT ![scope] = "rejected"]
  /\ UNCHANGED <<promotedHash, proposedHash>>

\* ─── next-state relation ────────────────────────────────────────────────────

Next ==
  \E scope \in Scopes :
    \/ \E hash \in ContentHashes : GeorgesProposes(scope, hash)
    \/ SupervisorEvaluates(scope)
    \/ \E policy \in Policies : SupervisorAutoPromotes(scope, policy)
    \/ SupervisorRoutesToClaude(scope)
    \/ ClaudePromotes(scope)
    \/ ClaudeRejects(scope)

\* ─── fairness ───────────────────────────────────────────────────────────────

\* Weak fairness: if the Supervisor or Claude can always act, they eventually will.
Fairness ==
  /\ \A scope \in Scopes :
       WF_vars(SupervisorEvaluates(scope))
  /\ \A scope \in Scopes :
       \A policy \in Policies : WF_vars(SupervisorAutoPromotes(scope, policy))
  /\ \A scope \in Scopes :
       WF_vars(SupervisorRoutesToClaude(scope))
  /\ \A scope \in Scopes :
       WF_vars(ClaudePromotes(scope))
  /\ \A scope \in Scopes :
       WF_vars(ClaudeRejects(scope))

Spec == Init /\ [][Next]_vars /\ Fairness

\* ─── safety invariant (Inv) ─────────────────────────────────────────────────

\* Once promoted, the scope stays promoted with the same hash.
\* No contradictory outcomes: promoted and rejected are mutually exclusive.
NoContradictoryPromotions ==
  \A scope \in Scopes :
    \/ proposalState[scope] # "promoted"
    \/ promotedHash[scope] = proposedHash[scope]

PromotedAndRejectedExclusive ==
  \A scope \in Scopes :
    ~(proposalState[scope] = "promoted" /\ proposalState[scope] = "rejected")

\* Promotions are stable: once promoted, never go back.
PromotionStable ==
  [][
    \A scope \in Scopes :
      (proposalState[scope] = "promoted") =>
        (proposalState'[scope] = "promoted")
  ]_vars

Inv ==
  /\ TypeOK
  /\ NoContradictoryPromotions
  /\ PromotedAndRejectedExclusive

\* ─── liveness property (Live) ────────────────────────────────────────────────

\* Every proposed scope eventually resolves (promoted or rejected).
EventuallyResolves ==
  \A scope \in Scopes :
    (proposalState[scope] = "proposed") ~>
      (proposalState[scope] \in {"promoted", "rejected"})

Live == EventuallyResolves

==========================================================================
