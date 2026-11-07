#!/usr/bin/env bun
import { join } from "node:path";

const skills = ["shape", "youtube-transcript", "document-read"];

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.includes("--help") || args.includes("-h")) {
		console.log(
			"Usage: bun setup.ts [--check] [shape|youtube-transcript|document-read ...]\nSets up all executable skills by default. --check verifies existing installations without downloads.\nEach skill can also run bun run setup or bun run check:setup independently.",
		);
		return;
	}
	const requested = args.filter((arg) => arg !== "--check");
	for (const name of requested) {
		if (!skills.includes(name)) throw new Error(`Unknown skill or option: ${name}`);
	}
	const selected = requested.length ? [...new Set(requested)] : skills;
	const action = args.includes("--check") ? "check:setup" : "setup";
	for (const name of selected) {
		console.log(`${name}: ${action}`);
		const child = Bun.spawn([process.execPath, "run", action], {
			cwd: join(import.meta.dir, "skills", name),
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		});
		const exitCode = await child.exited;
		if (exitCode !== 0) {
			process.exitCode = exitCode;
			return;
		}
	}
}

try {
	await main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
