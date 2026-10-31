---
name: subagent-handoff
description: Use when delegation is requested or concrete bounded workstreams make subagents realistic, including handoff and result integration. Do not use for ordinary local work or direct user responses.
compatibility: Delegation depends on the host's subagent support. Human-facing deliverables require the unslop skill from this suite.
---

# Subagent handoff

Delegate to isolate work, not to avoid understanding it. Delegation does not grant new permissions, broaden the user's request, or override host limits. If delegation is unavailable or unauthorized, do the work locally or report the limitation.

## Decide whether to delegate

Delegate when at least one concrete benefit outweighs coordination cost:

- The task is independently bounded and can return a clear artifact or conclusion.
- Exploration will produce large outputs that the parent does not need in full.
- Several workstreams can proceed without shared mutable state or overlapping edits.
- A focused worker can apply a specialization or a different level of model effort.
- An independent attempt or review materially reduces uncertainty.

Keep work with the parent when it is small, depends on the parent's evolving reasoning, must happen in sequence, requires frequent coordination, or would make multiple agents edit the same area. Do not delegate a vague task merely because it is difficult. First find a boundary that a worker can finish and verify.

Parallelize only tasks with independent inputs, outputs, and state. If one result changes another task's scope, run them sequentially. Keep integration, conflict resolution, permission decisions, and the final user response with the parent.

## Follow the host's execution rules

The host owns delegation tools, provider and model selection, retries, task tracking, and checkout setup. Preserve inherited settings unless a change is permitted. When worker selection is permitted, choose the least expensive available worker likely to complete the task reliably.

Distinguish a failed worker attempt from a failed tool request. For tool retries, follow the host's retry and task-tracking rules and check whether work already started before creating another task. After a failed worker attempt, improve the boundary, context, evidence, permitted model capability, or verification method. Bring the work back to the parent when repeated delegation adds no new information.

## Build the work packet

Give each worker only what it needs:

```text
Objective: one concrete outcome
Deliverable: exact artifact or answer to return
Scope: files, subsystem, data, or question owned by this worker
Starting state: repository, revision, and required uncommitted inputs
Known facts: verified facts with paths or other evidence pointers
Constraints: user choices, permissions, exclusions, and invariants
Inputs: required files, artifacts, commands, skills, or work-ledger sections
Verification: checks the worker should run or evidence it should collect
Return: findings, changes, evidence, uncertainty, and blockers
Stop when: completion condition or reason to escalate
```

Do not paste the full conversation when a short packet and evidence pointers are enough. Preserve exact identifiers, negations, numbers, errors, and user constraints. Treat parent conclusions as leads unless their evidence is included.

Confirm which files and changes the child's checkout contains. Make required inputs and skills accessible to the child, including `unslop` for human-facing deliverables. Do not assume a separate checkout contains uncommitted parent edits or another provider can discover the same skills.

Pass the relevant project constraints and task context. When a task ledger exists, pass its path and only the sections the worker needs. The task owner maintains that ledger; workers return proposed updates unless explicitly assigned record ownership. Independent task leads may own separate ledgers. Ordinary delegation does not require a ledger or a separate file for every worker.

## Keep internal handoffs dense

Internal handoffs are machine-to-machine. Do not load writing-style skills merely to format them. Include this compact contract in every delegation:

```text
Keep updates and the final handoff direct and compact. Remove greetings,
repetition, vague summaries, and unsupported commentary. Preserve exact
identifiers, paths, commands, errors, numbers, evidence, uncertainty,
warnings, changes, verification, blockers, and the words not, never, no,
only, and except. Separate observed facts from inference when it matters.

If the deliverable includes text people will read, apply the unslop skill to
that text. Do not apply compressed internal style to human-facing artifacts.
```

Workers must pass the same contract to nested workers. A worker drafting documentation, reports, issues, commits, messages, or other human-readable prose must apply `unslop` to that deliverable before returning it.

## Combine results

The parent must:

1. Check that each result stayed within scope and includes the requested evidence.
2. Resolve conflicts against source artifacts or fresh verification, not by majority vote.
3. Review overlapping changes before integration and run the relevant combined checks.
4. Have the owning agent update the relevant task record, when present, with verified findings, changes, and remaining unknowns. Update project status only when overall capability, coordination, or integration changes. Distinguish a returned result from integrated and accepted work.
5. Apply `unslop` to the user-facing response and human-readable artifacts. Never forward compressed handoffs unchanged.
