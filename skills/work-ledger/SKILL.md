---
name: work-ledger
description: Use when a substantial repository task needs independently resumable intent, acceptance, ownership, or handoff state, or when resuming its ledger. Skip routine one-off work and tasks already adequately tracked.
---

# Work ledger

Maintain one canonical record per substantial task, standalone or within an established project. Use an existing tracker or task record when it already serves this role. A ledger holds durable state, not a transcript. Do not create one merely because work uses tools or several agents.

Create or update a ledger only when repository writes are within the user's request. For read-only work, provide the proposed state in the response instead. Reuse an existing project convention when one exists. Otherwise use `.agents/work/<task-slug>.md` from the repository root and tell the user whether it is committed or local-only.

When resuming, use the ledger path supplied by the user or prior handoff. If no path is available, check the repository's convention and `.agents/work/` for an active match. Do not combine or choose silently when several ledgers could match the request. Read applicable project constraints and compare the task with the latest user steering before trusting its recorded state.

## Ledger contract

Keep these sections in this order:

```markdown
# <task name>

Status: active | blocked | complete
Owner: <agent or responsible person>
Repository: <root or package>
Base: <branch or revision when it matters>
Project: <parent contract link when applicable>
Request source: <durable reference or faithful statement of the user ask>

## Goal
<current requested outcome, distinct from assumptions and implementation tactics>

## Acceptance checks
- [ ] <observable completion condition>

## Scope
In: <owned areas>
Out: <explicit exclusions>

## Current state
Phase: <current phase>
Dependencies: <prerequisites or none>
Integration: <required integration and its state, or not applicable>
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

Add detail only when another agent needs it to continue correctly. Reference project constraints instead of copying the plan. Evidence should point to durable sources such as paths, revisions, tests, artifacts, issue comments, or user decisions. Do not paste raw logs, large command output, secrets, credentials, or speculative narrative.

## Maintain current truth

- Read the ledger before resuming or accepting a handoff.
- Update it after a durable decision, finding, scope change, completed phase, or meaningful verification result. Do not update it after every command.
- Update current state before a session boundary or handoff so the next agent has a valid next action.
- Replace stale current state instead of appending diary entries. Preserve decisions whose reasons still affect the work.
- Mark superseded findings and decisions explicitly. Do not silently rewrite history when the old state explains later work.
- Keep acceptance checks aligned with the user's current request. Record material changes and their source, preserve compatible work, and resolve consequential ambiguity before dependent implementation.
- Keep task-local decisions here. Promote project-wide decisions to their owning project record and leave a link. Project status links active tasks instead of mirroring their details.
- Distinguish returned worker output, verified task evidence, integration, and project acceptance. Mark the ledger complete only when acceptance checks and required integration are satisfied, or an authorized exception is recorded. Carry unresolved limitations into `Risks and unknowns`.

## Coordinate multiple agents

The task owner is the sole ledger writer by default. Independent task owners may maintain separate ledgers. For solo work, the responsible agent is the task owner. Record ownership transfers at handoff or authorized resume; do not infer abandonment from a timestamp. Workers receive the relevant project constraints and ledger sections through subagent-handoff and return proposed findings, changes, evidence, and unknowns for verification.

If concurrent workers need writable artifacts, assign separate files or directories. Do not let them edit one ledger concurrently or require a ledger per worker. Each independent task keeps its next action and prerequisites; a blocked task does not stop unrelated work. A handoff packet is a bounded view of current work; the ledger remains the durable task record.

Do not commit, publish, or delete the ledger unless the user's request or repository convention calls for it. Mark completed ledgers complete rather than removing them automatically.
