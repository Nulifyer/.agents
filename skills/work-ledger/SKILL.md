---
name: work-ledger
description: Use when repository task state must survive session or agent handoffs, or when resuming an existing ledger. Do not use for one-session tasks or when a canonical project record already exists.
---

# Work ledger

Maintain one canonical repository-local record that lets a new session or coordinating agent resume without the original conversation. The ledger holds durable state, not a transcript.

Create or update a ledger only when repository writes are within the user's request. For read-only work, provide the proposed state in the response instead. Reuse an existing project convention when one exists. Otherwise use `.agents/work/<task-slug>.md` from the repository root and tell the user whether it is committed or local-only.

When resuming, use the ledger path supplied by the user or prior handoff. If no path is available, check the repository's convention and `.agents/work/` for an active match. Do not combine or choose silently when several ledgers could match the request.

## Ledger contract

Keep these sections in this order:

```markdown
# <task name>

Status: active | blocked | complete
Repository: <root or package>
Base: <branch or revision when it matters>

## Goal
<requested outcome>

## Acceptance checks
- [ ] <observable completion condition>

## Scope
In: <owned areas>
Out: <explicit exclusions>

## Current state
Phase: <current phase>
Next action: <one concrete next action>

## Decisions
| Decision | Reason | Evidence |

## Findings
| Finding | Evidence | Status |

## Changes
| Path or artifact | Change | Verification |

## Risks and unknowns
- <unresolved item and what would settle it>
```

Add detail only when another agent needs it to continue correctly. Evidence should point to durable sources such as paths, revisions, tests, artifacts, issue comments, or user decisions. Do not paste raw logs, large command output, secrets, credentials, or speculative narrative.

## Maintain current truth

- Read the ledger before resuming or accepting a handoff.
- Update it after a durable decision, finding, scope change, completed phase, or meaningful verification result. Do not update it after every command.
- Update current state before a session boundary or handoff so the next agent has a valid next action.
- Replace stale current state instead of appending diary entries. Preserve decisions whose reasons still affect the work.
- Mark superseded findings and decisions explicitly. Do not silently rewrite history when the old state explains later work.
- Keep acceptance checks aligned with the user's current request. Record scope changes and their source.
- Mark the ledger complete only when the acceptance checks are settled. Carry unresolved limitations into `Risks and unknowns`.

## Coordinate multiple agents

The coordinating agent is the sole ledger writer by default. Subagents receive the ledger path plus the exact sections they need through `subagent-handoff`. They return proposed findings, changes, evidence, and unknowns. The coordinator verifies and merges those updates.

If concurrent workers need writable artifacts, assign separate files or directories. Do not let them edit the canonical ledger concurrently. A handoff packet is a bounded view of current work; the ledger remains the durable source of truth.

Do not commit, publish, or delete the ledger unless the user's request or repository convention calls for it. Mark completed ledgers complete rather than removing them automatically.
