#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

type Contract = Readonly<Record<string, readonly [readonly string[], number]>>;

const CONTRACT: Contract = {
	"README.md": [["Maintenance rules"], 80],
	"PLAN.md": [
		[
			"Goal",
			"Success conditions",
			"Scope",
			"Product boundaries",
			"Architecture boundaries",
			"Phases",
			"Open planning questions",
		],
		200,
	],
	"DECISIONS.md": [
		["Binding decisions", "Open decisions", "Superseded decisions"],
		200,
	],
	"STATUS.md": [
		[
			"Project state",
			"Current batch",
			"In progress",
			"Next action",
			"Blockers",
			"Verification",
		],
		100,
	],
	"TESTING.md": [
		[
			"Evidence standard",
			"Fast checks",
			"Full checks",
			"Environment",
			"Known gaps",
		],
		140,
	],
};

const PLACEHOLDERS: Readonly<Record<string, readonly string[]>> = {
	"PLAN.md": [
		"Describe the durable end state.",
		"Add observable completion conditions.",
		"Define included work.",
		"Define explicit exclusions.",
	],
	"STATUS.md": [
		"Updated: YYYY-MM-DD",
		"Summarize the current phase and verified project capability.",
		"Name the logical result currently being built.",
		"State one concrete action the active agent can start.",
	],
	"TESTING.md": [
		"Add the smallest useful development commands.",
		"Add milestone or release commands.",
	],
};

function sectionNames(text: string): Set<string> {
	return new Set(
		[...text.matchAll(/^##\s+(.+?)\s*$/gm)]
			.map((match) => match[1]?.trim())
			.filter((value): value is string => Boolean(value)),
	);
}

async function validate(
	root: string,
): Promise<{ errors: string[]; warnings: string[] }> {
	const errors: string[] = [];
	const warnings: string[] = [];
	if (!existsSync(path.join(root, "AGENTS.md")))
		errors.push("missing repository-root AGENTS.md");
	const state = path.join(root, ".agents");

	for (const [name, [required, limit]] of Object.entries(CONTRACT)) {
		const filePath = path.join(state, name);
		if (!existsSync(filePath)) {
			errors.push(`missing .agents/${name}`);
			continue;
		}
		const text = await readFile(filePath, "utf8");
		const found = sectionNames(text);
		for (const section of required) {
			if (!found.has(section))
				errors.push(`.agents/${name}: missing section '## ${section}'`);
		}
		const count = text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0);
		if (count > limit)
			errors.push(`.agents/${name}: ${count} lines exceeds maximum ${limit}`);
		for (const placeholder of PLACEHOLDERS[name] ?? []) {
			if (text.includes(placeholder))
				errors.push(`.agents/${name}: replace scaffold text '${placeholder}'`);
		}
	}

	const statusPath = path.join(state, "STATUS.md");
	if (existsSync(statusPath)) {
		const text = await readFile(statusPath, "utf8");
		const match = /^## Next action\s*$\n(.*?)(?=^##\s|\s*$)/ms.exec(text);
		if (!match?.[1]?.trim())
			errors.push(
				".agents/STATUS.md: Next action must contain one concrete action",
			);
	}
	return { errors, warnings };
}

function printValidation(result: {
	errors: readonly string[];
	warnings: readonly string[];
}): void {
	for (const item of result.errors) console.log(`ERROR: ${item}`);
	for (const item of result.warnings) console.log(`WARNING: ${item}`);
	if (result.errors.length === 0 && result.warnings.length === 0)
		console.log("project continuity files are valid");
}

function projectRootFromArgs(args: readonly string[]): string {
	if (args[0] !== "validate")
		throw new Error("usage: continuity.ts validate --project-root <directory>");
	const index = args.indexOf("--project-root");
	const value = index >= 0 ? args[index + 1] : undefined;
	if (!value) throw new Error("--project-root is required");
	// biome-ignore lint/complexity/useLiteralKeys: The shared TypeScript config requires index-signature access.
	return path.resolve(value.replace(/^~(?=$|\/)/, process.env["HOME"] ?? "~"));
}

async function main(): Promise<number> {
	const root = projectRootFromArgs(process.argv.slice(2));
	if (!(await stat(root).catch(() => undefined))?.isDirectory())
		throw new Error(`project root is not a directory: ${root}`);
	const result = await validate(root);
	printValidation(result);
	return result.errors.length > 0 ? 2 : 0;
}

process.exitCode = await main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	return 2;
});
