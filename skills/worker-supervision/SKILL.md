---
name: worker-supervision
description: Use when assigned to review or supervise another agent's ongoing work, including follow-up reviews and authorized feedback. Not self-review, ordinary diff review, implementation, or general research.
---

# Worker supervision

Keep implementation ownership with worker. Review-only unless user authorizes
feedback or supervision. Preserve existing authority; no added edit, commit,
delegation, scheduling, or approval authority.

## Establish current truth

1. Identify worker, repository, terminal goal, scope, and authority. Discover
   available harness capabilities; T3 is optional. Prefer native session tools;
   use an adapter only when its service exists. Without session access, use
   provided transcripts, commits, worktree, continuity, and artifacts; report
   visibility limits. Never inspect unrelated private history.
2. Read repository instructions and canonical current records. Check actual
   worktree, recent commits, prior achievements, and user corrections against
   summaries. Reuse historical knowledge within its identities and scope;
   changed implementations still need affected verification.
3. Resume previous review position and open findings. Read only relevant delta,
   widening for missing context. Recheck stale findings before sending advice.
4. Compare current batch with product goal. Separate observable behavior from
   counters, compilation, and status claims. Check ownership, duplicated state,
   experiment fidelity, missing failure/cleanup evidence, repeated fixture
   repairs, and validation cost. Favor coherent batches through existing owners.
5. Select highest-value actionable gap, or report no intervention needed. Name
   evidence, inference, consequence, and smallest next action. For an unresolved
   technical question, read [research guidance](references/research.md).

## Resolve feedback

With feedback authority and messaging capability, send one compact packet:
finding and evidence, recommended action, expected observable result, verification, and relevant
constraints. Ask worker for concrete plan, disagreement, or blocker. Continue
independent authorized work; do not interrupt cleanup or impose acknowledgement
as an approval gate.

Read substantive reply when accessible; use bounded waits only if supported.
Delivery is not acknowledgement.
Evaluate objections against evidence; revise or withdraw advice when warranted.
Clarify only unresolved points. Stop exchange once next action, expected result,
verification, and escalation condition are clear. Do not send redundant closure
messages. If no reply, retain pending status and next review trigger.

Track findings as proposed, sent, agreed, implemented, or verified; record
disputes and withdrawals explicitly. Agreement never proves implementation.
On later review, inspect changed artifacts and affected checks before closing
findings. Reuse valid unchanged checks; preserve rejected evidence and unknowns.
Do not weaken required gates or redirect scope without supporting evidence and
existing authority.

## Close review

Report current progress toward goal, consequential finding or no intervention,
evidence and limits, worker response, and concrete next action. If delivery
unavailable, return feedback as unsent; never claim worker received it.

With write authority, have worker integrate durable decisions into existing
owning records. Recheck worktree before any supervisor write; preserve concurrent
changes. Route overlapping edits through worker or isolate them. Use
project-continuity when available for canonical records. For repeat
reviews needing durable state, adapt [review checkpoint](assets/review-checkpoint.md)
in an existing owner; create a separate checkpoint only when none exists and
writes are authorized. Keep project facts in their owners, not a second diary.

Harness owns session lifecycle and recurrence. Schedule only when requested and
supported; otherwise report unscheduled review trigger. Never require installing
T3 or another orchestration service to perform a review.
