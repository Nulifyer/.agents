# Shared agent skills

This repository is the source of truth for personal Agent Skills shared across
Codex, GitHub Copilot, and OpenCode.

## Repository layout

Reusable behavior lives under `skills/<name>/`. Each skill starts at `SKILL.md`
and may include `scripts/`, `references/`, `assets/`, or documented host
sidecars when the skill itself needs them.

Root `package.json`, `tsconfig.json`, and `biome.json` check executable helpers
that belong to skills. Markdown-only skills do not need a test harness.

## Project lifecycle

`project-inception` turns an unsettled project into an agreed goal, scope,
architecture boundary, delivery policy, and evidence contract.

`project-continuity` keeps the Markdown records under a project's `.agents/`
directory compact and current during long-running work. It also defines the
verified batch loop: address one logical result, validate and test it, stage and
commit only that result, then repeat from the next action.

These portable skills do not create sessions, manage goals, or orchestrate
subagents. Each host owns execution and session lifecycle.

Use [`skill-authoring`](skills/skill-authoring/SKILL.md) when adding or changing
a skill.

## Checks

```text
bun run check
```
