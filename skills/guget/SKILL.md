---
name: guget
description: Use for NuGet package management and .NET dependency upgrades in local C#, F#, or VB workspaces, including listing, inspecting, searching, adding, updating, removing, or restoring PackageReference dependencies. Prefer guget to manual project XML edits or dotnet add/remove package. Excludes publishing packages, packages.config edits, and SDK or tool upgrades.
---

# guget

Use headless verbs for agent work. Bare `guget` starts the TUI.

Check the installed command once per task, then inspect help for the verbs you need:

```bash
command -v guget
guget version
guget help update
```

Guget requires the .NET SDK. Search and restore can require network access and feed credentials. If guget is absent, report it. Install or replace it only when requested.

## Inspect, change, verify

1. Choose an explicit workspace root. Inspect structured package state and warnings:

   ```bash
   guget list --project <workspace> --format json
   guget show <package> --project <workspace> --format json
   ```

   Distinguish requested expressions, evaluated versions, and restored versions. Inspect every relevant framework and reference/version owner. A partial result can support declaration inspection, but unresolved evaluation or ownership must block dependent edits.

2. For an upgrade, use the user's exact version or inspect configured feeds:

   ```bash
   guget sources --project <workspace> --format json
   guget search <package> --project <workspace> --source <name> --format json --timeout 30s
   ```

   Match the exact package ID, source, and version. Search is not a complete version or compatibility report. Do not infer compatibility from the first search hit. Local and UNC sources support restore, not metadata search. Inspect version-selection flags in installed help; v1.10.0 refuses `--latest-compatible` and `--latest-stable`.

3. Preview explicit project scope:

   ```bash
   guget update <package> --version <version> --project <workspace> --file <project> --dry-run --format json
   guget add <package> --version <version> --project <workspace> --file <project> --dry-run --format json
   guget remove <package> --project <workspace> --file <project> --dry-run --format json
   ```

   `--file` is repeatable and names discovered project files relative to the root. `update` and `remove` also accept `--all` when the request covers all discovered projects. `add` requires `--file`.

   Inspect all planned owner paths and shared-owner consumers. A central props change can affect projects outside the selected scope. Refuse an unexplained ownership or scope expansion.

4. When the user requested the mutation and the preview matches, rerun with identical scope/version flags and remove `--dry-run`. A plan-only request stops at the preview. Apply rescans, replans, and commits without presenting a second preview. If you observe intervening edits, run another dry run and inspect it before applying. The CLI cannot bind apply to the exact previewed hashes or detect every scope change for the agent.

   Add `--restore` when restore is part of the requested work. On a mutation, `--interactive` requires `--restore`. Use interactive authentication only when authorized and attached to a terminal.

5. Inspect package state again after apply. Confirm the requested version took effect in each selected framework and identify shared-owner effects. Report files changed and restore separately. A successful dry run proves no mutation. A restore or output failure can follow a successful file edit; inspect state before retrying.

   ```bash
   guget show <package> --project <workspace> --format json
   guget restore --project <workspace> --file <project>
   # Use --all instead of --file only when the request covers the workspace.
   ```

## Output and failures

Prefer JSON because it includes workspace metadata and warnings. JSONL emits rows without the document. Terminal output defaults to a table; redirected output defaults to TSV. Treat output files as results to verify, not evidence that an edit succeeded.

| Exit | Meaning and action |
|---|---|
| 0 | Success, including no-op or empty search. Verify mutation effect. |
| 1 | Invalid command, flags, or scope. Correct the invocation. |
| 2 | Discovery or evaluation failed. Resolve the incomplete workspace. |
| 3 | Feed, authentication, or metadata failed. Preserve useful prior artifacts. |
| 4 | Ownership or version selection is unsupported, ambiguous, or locked. Report the refusal. |
| 5 | Write conflict, write failure, or incomplete rollback. Inspect changed paths and recovery state. |
| 6 | Restore or post-edit validation failed. Files may already have changed. |
| 7 | Useful partial result. Preserve data and report warnings; judge whether it supports the next action. |
| 130 | Interrupted. Inspect results before retrying a mutation. |

Respect refusals for conditional or inherited ownership, transitive packages, lock files, unsupported MSBuild shapes, and packages.config. Do not bypass a refusal with XML edits unless separately requested.

In v1.10.0, apply emits the requested structured result, including no-op and restore outcomes. Write failures can include `changed`, `rolledBack`, `conflicting`, and `unrecovered` owner paths. Inspect unrecovered files before retrying. Search failure or cancellation preserves an existing output destination. Retest these contracts when the installed version is older or differs from the version checked here.

Report workspace, package/version, project scope, changed or planned owner files, verification, restore result, warnings, and artifacts.
