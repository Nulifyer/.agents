#!/usr/bin/env bun

// biome-ignore-all lint/complexity/useLiteralKeys: Bracket access satisfies the repository's noPropertyAccessFromIndexSignature rule.

import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const FILES: Readonly<Record<string, string>> = {
	"README.md": `# Agent work state

Read the repository-root \`AGENTS.md\` first, then use this order:

1. \`PLAN.md\` for the agreed goal, scope, boundaries, and phases.
2. \`DECISIONS.md\` for binding choices and unresolved questions.
3. \`STATUS.md\` for current project state, current batch, and the next action.
4. \`TESTING.md\` for commands and evidence standards.

## Maintenance rules

- Keep these files short and current. Git owns history.
- Replace stale status. Do not append a chronological diary.
- Put choices future work must preserve in \`DECISIONS.md\`, never task completion.
- Put stable discoveries and facts under the repository's documentation convention, usually \`docs/\`.
- Keep exact run results in contracts or evidence artifacts, not \`STATUS.md\` or \`TESTING.md\`.
- Preserve user-added sections and notes.
- Resolve every continuity validation error before another batch.

## Delivery loop

When autonomous commits are authorized: address one logical result, update its owning records, validate and test it, review and stage only that batch, commit it, then repeat from the single next action.
`,
	"PLAN.md": `# Project plan

## Goal

Describe the durable end state.

## Success conditions

- [ ] Add observable completion conditions.

## Scope

### In

- Define included work.

### Out

- Define explicit exclusions.

## Product boundaries

Record platform, compatibility, feature, and user-experience boundaries.

## Architecture boundaries

Record ownership, interfaces, security, performance, and deployment constraints.

## Phases

1. Define the first milestone and its exit evidence.

## Open planning questions

- None recorded.

## Project notes

Add durable user notes that do not fit a standard section.
`,
	"DECISIONS.md": `# Project decisions

## Binding decisions

| ID | Decision | Reason | Evidence |
| --- | --- | --- | --- |

## Open decisions

- Record only choices that can materially change the implementation.

## Superseded decisions

- Link archived detail only when it still explains current work.

## Project notes

Add durable user notes that do not fit a standard section.
`,
	"STATUS.md": `# Project status

Updated: YYYY-MM-DD
State: discovery

## Project state

Summarize the current phase and verified project capability.

## Current batch

Name the logical result currently being built.

## In progress

- Record work that is actually underway.

## Next action

State one concrete action the active agent can start.

## Blockers

- None known.

## Verification

- Record only the latest checks needed to resume correctly and link exact evidence.

## Project notes

Add temporary user notes only while they affect current work.
`,
	"TESTING.md": `# Testing and evidence

## Evidence standard

Define what compilation, unit tests, integration tests, manual checks, or external oracles prove and do not prove.

## Fast checks

\`\`\`text
Add the smallest useful development commands.
\`\`\`

## Full checks

\`\`\`text
Add milestone or release commands.
\`\`\`

## Environment

- Record required tools, versions when material, services, fixtures, and platform constraints.

## Known gaps

- Record behavior that current checks do not cover.

## Project notes

Add durable testing notes that do not fit a standard section.
`,
};

const AGENTS_SECTION = `## Project continuity

For long-running work, read \`.agents/README.md\` and keep its indexed files current. Use \`project-continuity\` when resuming, closing a verified batch, recovering after compaction, or preparing a handoff. When autonomous commits are authorized, repeat one logical batch: implement and update owning records, validate and test, stage only that batch, commit, then continue from one next action.
`;

function projectRootFromArgs(args: readonly string[]): string {
	const index = args.indexOf("--project-root");
	const value = index >= 0 ? args[index + 1] : undefined;
	if (!value) throw new Error("usage: bootstrap.ts --project-root <directory>");
	return path.resolve(value.replace(/^~(?=$|\/)/, process.env["HOME"] ?? "~"));
}

async function writeIfMissing(
	filePath: string,
	content: string,
): Promise<boolean> {
	if (existsSync(filePath)) return false;
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, content, "utf8");
	return true;
}

async function main(): Promise<void> {
	const root = projectRootFromArgs(process.argv.slice(2));
	if (!(await stat(root).catch(() => undefined))?.isDirectory()) {
		throw new Error(`project root is not a directory: ${root}`);
	}

	const state = path.join(root, ".agents");
	const created: string[] = [];
	for (const [name, content] of Object.entries(FILES)) {
		const filePath = path.join(state, name);
		if (await writeIfMissing(filePath, content))
			created.push(path.relative(root, filePath));
	}

	const agentsPath = path.join(root, "AGENTS.md");
	if (!existsSync(agentsPath)) {
		await writeFile(
			agentsPath,
			`# Repository agent instructions\n\n${AGENTS_SECTION}`,
			"utf8",
		);
		created.push("AGENTS.md");
	} else if (
		!(await readFile(agentsPath, "utf8")).includes("## Project continuity")
	) {
		process.stdout.write(
			`NOTICE: add the following section to ${agentsPath} after reviewing existing rules:\n\n${AGENTS_SECTION}`,
		);
	}

	if (created.length === 0) {
		console.log("no files created; existing content was preserved");
	} else {
		console.log("created:");
		for (const item of created) console.log(`  ${item}`);
	}
}

await main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 2;
});
