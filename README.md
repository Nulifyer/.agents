# Shared agent skills

Reusable instructions and command-line helpers for coding agents, shared across
Codex, GitHub Copilot, and OpenCode. Each skill lives in `skills/<name>/`, with a
`SKILL.md` that describes when and how to use it.

## Skills

| Skill | Summary |
| --- | --- |
| [caveman](skills/caveman/SKILL.md) | Use a compressed writing style when explicitly requested. |
| [clear-technical-writing](skills/clear-technical-writing/SKILL.md) | Make technical explanations and instructions easy to follow. |
| [codebase-design](skills/codebase-design/SKILL.md) | Decide behavior ownership, module boundaries, interfaces, and testability. |
| [document-read](skills/document-read/SKILL.md) | Extract bounded text and artifacts from local documents, email, scans, audio, and video. |
| [dotnet](skills/dotnet/SKILL.md) | Design, implement, refactor, and review C#/.NET code with clear ownership and configuration. |
| [evidence-discipline](skills/evidence-discipline/SKILL.md) | Keep findings and completion claims grounded in evidence. |
| [frontend-design](skills/frontend-design/SKILL.md) | Build and audit frontend layouts, user flows, styling, and interaction states. |
| [git-delivery](skills/git-delivery/SKILL.md) | Prepare commits and manage pull requests. |
| [guget](skills/guget/SKILL.md) | Inspect, add, upgrade, remove, and restore .NET NuGet package references with guget. |
| [oracle-lab](skills/oracle-lab/SKILL.md) | Establish undocumented behavior through repeatable experiments. |
| [project-continuity](skills/project-continuity/SKILL.md) | Maintain project records and resume long-running work. |
| [project-inception](skills/project-inception/SKILL.md) | Agree on a new project's goals, scope, architecture, and completion criteria. |
| [repo-map](skills/repo-map/SKILL.md) | Find entrypoints, owners, tests, and conventions in an unfamiliar repository. |
| [reverse-engineering](skills/reverse-engineering/SKILL.md) | Analyze artifacts, recover source, and reconstruct behavior using decompilation and compatibility evidence. |
| [shape](skills/shape/SKILL.md) | Map value-free structure and implementation ownership in code, data, documents, APIs, web pages, and binaries. |
| [skill-authoring](skills/skill-authoring/SKILL.md) | Create, revise, and validate agent skills. |
| [sqlgo](skills/sqlgo/SKILL.md) | Run and export SQL queries with sqlgo. |
| [stale-code-cleanup](skills/stale-code-cleanup/SKILL.md) | Remove superseded implementations and task-created disk usage. |
| [subagent-handoff](skills/subagent-handoff/SKILL.md) | Define delegated tasks and integrate agent results. |
| [unslop](skills/unslop/SKILL.md) | Remove formulaic AI writing and use concrete language. |
| [work-ledger](skills/work-ledger/SKILL.md) | Preserve repository task state across sessions and handoffs. |
| [worker-supervision](skills/worker-supervision/SKILL.md) | Review ongoing agent work, resolve authorized feedback, and verify follow-through. |
| [workflow-miner](skills/workflow-miner/SKILL.md) | Find reusable improvements in completed work and repeated corrections. |
| [youtube-transcript](skills/youtube-transcript/SKILL.md) | Retrieve, search, and summarize public YouTube captions. |
| [zig-systems-development](skills/zig-systems-development/SKILL.md) | Develop and debug Zig systems code. |

## Development workflows

`worker-supervision` reviews an active implementation stream, resolves authorized
feedback with its worker, and checks follow-through without becoming another
code owner. It uses available harness capabilities or supplied transcripts and
repository evidence.

`oracle-lab` defines repeatable black-box and differential experiments against a
reference system. `reverse-engineering` owns artifact analysis and routes
source-informed reconstruction through subsystem ownership and consumer
validation. Its [analysis tools](skills/reverse-engineering/references/tools.md)
export Ghidra code and instructions, search functions/strings, navigate calls
and references, check PE/PDB identity, and recover embedded source-map files.
Its optional case utility checks evidence identity and stale inputs. Clean-room
methods are a separate study branch, used when requested.

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

The setup script runs the package setup for `shape`, `youtube-transcript`, and
`document-read`. Shape installs its locked parser dependencies and verifies
ripgrep and all 40 Tree-sitter grammars and queries. YouTube transcript installs
and checks its caption client.
Document-read prepares its extraction container, reusing a local image or
pulling the GHCR package, then verifies offline extraction and automatic
container removal. First installation or image pulls need network access.
No global Tree-sitter installation or WASM compiler is needed.

If the container image cannot be pulled, build it locally, then rerun setup:

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

The three Bun packages own their dependencies and setup commands. Each works
independently of the repository. Run `bun run setup` or `bun run check:setup`
from the selected skill's directory.

Other skills declare runtime and system-tool requirements in their `SKILL.md`
and references. The reverse-engineering CLI requires Python 3.10+, with Ghidra,
Java, or LLVM needed for the relevant native-analysis commands. Read its
[tool requirements](skills/reverse-engineering/references/tools.md) before use.
The root setup script does not install these tools.

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
