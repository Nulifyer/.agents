---
name: skill-authoring
description: Use when creating, revising, reviewing, organizing, or validating an Agent Skill or SKILL.md.
---

# Skill authoring

A skill is a reusable instruction package loaded when its description matches the task.

If the harness provides skill-authoring guidance, use it for discovery paths, metadata, invocation controls, and validation. Keep the structure and writing style below.

## Context budget

- `name` and `description` may remain in context every turn. Make `description` only a precise trigger: `Use when ...`. Include each distinct case that should load the skill once.
- `SKILL.md` loads after selection. Put what the skill is and how to use it here.
- References load on demand. Move branch-specific detail out of `SKILL.md` and link it with the exact condition for reading it.

## Build

1. Inspect the target harness, nearby skills, and existing files. Choose global, project, or cross-harness placement.
2. Match the lowercase hyphenated folder name and frontmatter `name`. Add only supported metadata the skill needs.
3. Write only instructions that change agent behavior: purpose, workflow, inputs, outputs, invariants, and checkable completion criteria. Prefer positive, concrete directions and established terms. Remove exposition, defaults, duplicate meanings, and facts cheap to inspect from files or `--help`.
4. Keep always-needed instructions in `SKILL.md`. Use `references/` for conditional knowledge, `scripts/` for repeated deterministic work, and `assets/` for output resources. Keep each fact in one place and avoid reference chains.
5. Add human-facing README or setup docs only when requested or required for packaging. Link them from `SKILL.md` only when agents must read them.
6. Validate frontmatter, links, scripts, and observable behavior with a meaningful example. Prune again after testing.
