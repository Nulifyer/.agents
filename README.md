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

1. Install Bun, ripgrep, and either Docker or Podman. Start the container runtime
   if it requires a service. Install Git if you plan to clone the repository.
2. Clone [nulifyer/.agents](https://github.com/nulifyer/.agents) into `~/.agents`:

   ```bash
   git clone https://github.com/nulifyer/.agents.git ~/.agents
   cd ~/.agents
   ```

   Alternatively, use **Code > Download ZIP** on the repository page and extract
   its contents into `~/.agents`.
3. Run setup from that directory:

   ```bash
   bun setup.ts
   ```

The Bun script calls each executable skill's own setup. Shape installs its
locked parser dependencies and verifies ripgrep and all 40 Tree-sitter grammars
and queries. YouTube transcript installs and checks its caption client.
Document-read prepares its extraction container, reusing a local image or
pulling the GHCR package, then verifies offline extraction and automatic
container removal. First installation or image pulls need network access.
No global Tree-sitter installation or WASM compiler is needed.

Before the container package's initial publication, build its image locally,
then rerun setup:

```bash
bun run --cwd skills/document-read container:build
bun setup.ts
```

Builds resolve current stable tool releases, pull fresh bases, upgrade Alpine
packages, and run offline checks. Read the [container setup reference](skills/document-read/references/container.md)
for image selection, build options, and qualification limits. Document-read
uses one complete image for document extraction, OCR, local Whisper
transcription and opt-in SmolVLM2 picture descriptions. OCR, Office parsing,
media tools and model files stay inside the image; its host requirements are
Bun and Docker or Podman. YouTube URLs use the YouTube transcript skill to
retrieve captions online; local audio and video files use document-read offline.

Each executable skill owns its package dependencies and setup commands. A copy
of one skill directory works independently of the repository. Run
`bun run setup` or `bun run check:setup` from that directory. Skills declare
additional system tools in their `SKILL.md` and references.

Use `bun setup.ts --check` to check all existing installations without
downloads. Pass skill names to select only those setups, for example
`bun setup.ts shape youtube-transcript`. The script also works when invoked
from another directory.

## Development

The root `package.json` and `bun.lock` contain only shared development tools.
`tsconfig.json` and `biome.json` configure the collection-wide type and lint
checks. Installed skills do not need these root files.

After setting up the skills, install the development tools and run all code
checks from the repository root:

```bash
bun install --frozen-lockfile
bun run check
```

Use [skill-authoring](skills/skill-authoring/SKILL.md) when adding or changing a skill.
