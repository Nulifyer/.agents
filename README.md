# Shared agent skills

Reusable instructions and command-line helpers for coding agents, shared across
Codex, GitHub Copilot, and OpenCode. Each skill lives in `skills/<name>/`, with a
`SKILL.md` that describes when and how to use it.

## Skills

| Skill | Summary |
| --- | --- |
| [active-worker-research](skills/active-worker-research/SKILL.md) | Research gaps and risks in active development without taking over implementation. |
| [caveman](skills/caveman/SKILL.md) | Use a compressed writing style when explicitly requested. |
| [clear-technical-writing](skills/clear-technical-writing/SKILL.md) | Make technical explanations and instructions easy to follow. |
| [codebase-design](skills/codebase-design/SKILL.md) | Design module boundaries, interfaces, and testable architecture. |
| [document-read](skills/document-read/SKILL.md) | Extract text and artifacts from documents, scans, audio, and video. |
| [evidence-discipline](skills/evidence-discipline/SKILL.md) | Keep findings and completion claims grounded in evidence. |
| [frontend-design](skills/frontend-design/SKILL.md) | Build interfaces with intentional visual design. |
| [git-delivery](skills/git-delivery/SKILL.md) | Prepare commits and manage pull requests. |
| [guget](skills/guget/SKILL.md) | Inspect and manage .NET NuGet package references with guget. |
| [oracle-lab](skills/oracle-lab/SKILL.md) | Establish undocumented behavior through repeatable experiments. |
| [project-continuity](skills/project-continuity/SKILL.md) | Maintain project records and resume long-running work. |
| [project-inception](skills/project-inception/SKILL.md) | Agree on a new project's goals, scope, architecture, and completion criteria. |
| [repo-map](skills/repo-map/SKILL.md) | Find entrypoints, owners, tests, and conventions in an unfamiliar repository. |
| [reverse-engineering](skills/reverse-engineering/SKILL.md) | Infer structure and behavior from compiled or packaged artifacts. |
| [shape](skills/shape/SKILL.md) | Map structure in code, data, documents, APIs, and binaries without exposing values. |
| [skill-authoring](skills/skill-authoring/SKILL.md) | Create, revise, and validate agent skills. |
| [sqlgo](skills/sqlgo/SKILL.md) | Run and export SQL queries with sqlgo. |
| [stale-code-cleanup](skills/stale-code-cleanup/SKILL.md) | Remove superseded implementations and task-created disk usage. |
| [subagent-handoff](skills/subagent-handoff/SKILL.md) | Define delegated tasks and integrate agent results. |
| [unslop](skills/unslop/SKILL.md) | Remove formulaic AI writing and use concrete language. |
| [work-ledger](skills/work-ledger/SKILL.md) | Preserve repository task state across sessions and handoffs. |
| [workflow-miner](skills/workflow-miner/SKILL.md) | Find reusable improvements in completed work and repeated corrections. |
| [youtube-transcript](skills/youtube-transcript/SKILL.md) | Retrieve, search, and summarize public YouTube captions. |
| [zig-systems-development](skills/zig-systems-development/SKILL.md) | Develop and debug Zig systems code. |

## Setup

1. Install Bun and ripgrep. Install Git if you plan to clone the repository.
2. Clone [nulifyer/.agents](https://github.com/nulifyer/.agents) into `~/.agents`:

   ```bash
   git clone https://github.com/nulifyer/.agents.git ~/.agents
   cd ~/.agents
   ```

   Alternatively, use **Code > Download ZIP** on the repository page and extract
   its contents into `~/.agents`.
3. Run setup from that directory:

   ```bash
   bun run setup
   ```

Setup installs the locked package dependencies and verifies ripgrep, the
Tree-sitter runtime, and all 40 source grammars and queries. The first install
needs network access. The packages include prebuilt WASM files, so no global
Tree-sitter installation, WASM compiler, or manual grammar downloads are needed.

Individual skills list any additional tools they require in their `SKILL.md`
and references. For a standalone copy of `skills/shape`, run `bun run setup`
from that skill's directory. Use `bun run check:setup` there to check an existing
installation without downloading packages.

## Development

Run all code checks from the repository root:

```bash
bun run check
```

Use [skill-authoring](skills/skill-authoring/SKILL.md) when adding or changing a skill.
