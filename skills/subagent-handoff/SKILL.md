---
name: subagent-handoff
description: Use when delegating work to subagents or combining their results. Requires subagents to apply $unslop for useful content and $caveman full for token-efficient internal handoffs. Do not use for direct user responses without delegation.
---

# Subagent handoff

Every subagent must load both skills:

1. `$unslop`: remove vague, generic, repetitive, unsupported content. Keep specific evidence and useful conclusions.
2. `$caveman` in `full` mode: compress improved content without losing substance.

Order matters. `$unslop` improves signal. `$caveman full` reduces tokens.

Priority when rules conflict:

1. Correctness and safety.
2. Exact evidence and uncertainty.
3. `$unslop` clarity.
4. `$caveman full` brevity.

Include this in every delegation:

```text
Load and apply the `$unslop` skill. Then load and apply the `$caveman`
skill in full mode.

Use both for updates and final handoff. Preserve exact identifiers, paths,
commands, errors, numbers, evidence, uncertainty, warnings, changes,
verification, and blockers. Never drop not, never, no, only, or except.

Apply `$unslop` but not `$caveman` to persisted artifacts: code comments,
documentation, commits, issues, reports, prompts, policies, and user-facing
text. Compress internal communication only.
```

Subagents must pass same instruction to nested subagents.

Parent verifies evidence, combines results, then applies `$unslop` to user-facing response. Never forward compressed handoffs unchanged.
