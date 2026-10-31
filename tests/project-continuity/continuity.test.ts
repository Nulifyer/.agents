import { afterEach, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const validator = resolve("skills/project-continuity/scripts/continuity.ts");
const bootstrap = resolve("skills/project-inception/scripts/bootstrap.ts");
const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspace() {
	const root = mkdtempSync(join(tmpdir(), "continuity-test-"));
	roots.push(root);
	return root;
}

function write(root: string, name: string, text: string) {
	const file = join(root, name);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, text);
}

function run(script: string, root: string, command: string[] = ["validate"]) {
	const result = Bun.spawnSync([process.execPath, script, ...command, "--project-root", root]);
	return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
}

const singleStatus = `# Current work
## Project state
API migration underway.
## Current batch
Accept imported records.
## In progress
Verify import behavior.
## Next action

Run the import fixture.
## Blockers
None.
## Verification
Fixtures are recorded under tests/.
`;

const parallelStatus = `# Current work
## Project state
Database and API migration underway.
## Active tasks
- [Database](work/database.md): Morgan owns schema migration.
- [API](work/api.md#current-state): Alex owns the endpoint.
- [Rollout](https://example.com/issues/3): awaiting integration.
## Next action

Prepare integration after both task acceptance checks pass.
## Blockers
Rollout depends on integration; database and API tasks may continue.
## Verification
Each task owns its evidence; project acceptance is pending.
`;

function project(root: string, status = singleStatus) {
	write(root, "AGENTS.md", "# Existing repository rules\nKeep user notes.\n");
	for (const [name, headings] of Object.entries({
		"README.md": ["Maintenance rules"],
		"PLAN.md": ["Goal", "Success conditions", "Scope", "Product boundaries", "Architecture boundaries", "Phases", "Open planning questions"],
		"DECISIONS.md": ["Binding decisions", "Open decisions", "Superseded decisions"],
		"TESTING.md": ["Evidence standard", "Fast checks", "Full checks", "Environment", "Known gaps"],
	})) {
		write(root, `.agents/${name}`, headings.map((heading) => `## ${heading}\nRecorded project context.\n`).join("\n"));
	}
	write(root, ".agents/STATUS.md", status);
}

test("single-task status remains valid and requires a nonempty next action", () => {
	const root = workspace();
	project(root);
	expect(run(validator, root).code).toBe(0);
	write(root, ".agents/STATUS.md", singleStatus.replace("Run the import fixture.", ""));
	const result = run(validator, root);
	expect(result.code).toBe(2);
	expect(result.out).toContain("Next action");
});

test("parallel status checks only linked task files and allows independent work", () => {
	const root = workspace();
	project(root, parallelStatus);
	write(root, ".agents/work/database.md", "# Database\nNext action: run the migration fixture.\n");
	write(root, ".agents/work/api.md", "# API\nNext action: verify the endpoint.\n");
	write(root, ".agents/work/historical.md", "Historical incomplete record, intentionally unlinked.\n");
	expect(run(validator, root).code).toBe(0);
	rmSync(join(root, ".agents/work/api.md"));
	const result = run(validator, root);
	expect(result.code).toBe(2);
	expect(result.out).toContain("work/api.md");
	expect(result.out).not.toContain("historical.md");
	expect(result.out).not.toContain("example.com");
});

test("inline task links accept angle destinations and check titled missing files", () => {
	const root = workspace();
	const original = "[API](work/api.md#current-state)";
	write(root, ".agents/work/database.md", "# Database\n");
	write(root, ".agents/work/api.md", "# API\n");
	write(root, ".agents/work/API notes.md", "# API notes\n");
	for (const link of [
		'[API](work/api.md "API task")',
		"[API](<work/api.md>)",
		'[API](<work/API notes.md> "API task")',
		"[API](work/API%20notes.md)",
	]) {
		project(root, parallelStatus.replace(original, link));
		expect(run(validator, root).code).toBe(0);
	}
	for (const link of ['[API](work/missing.md "API task")', "[API](<work/missing.md>)"]) {
		project(root, parallelStatus.replace(original, link));
		const result = run(validator, root);
		expect(result.code).toBe(2);
		expect(result.out).toContain("work/missing.md");
	}
});

test("status needs either single-task sections or an active-task view", () => {
	const root = workspace();
	project(root, singleStatus.replace(/## Current batch[\s\S]*?## Next action/, "## Next action"));
	expect(run(validator, root).code).toBe(2);
	project(root, parallelStatus.replace(/## Active tasks[\s\S]*?## Next action/, "## Active tasks\n\n## Next action"));
	expect(run(validator, root).code).toBe(2);
});

test("task-only records are not bootstrapped by the project validator", () => {
	const root = workspace();
	write(root, ".agents/work/import.md", "# Import\nNext action: inspect the fixture.\n");
	expect(run(validator, root).code).toBe(2);
	expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
	expect(existsSync(join(root, ".agents/PLAN.md"))).toBe(false);
});

test("clean installed scripts reject scaffold state and preserve existing records", () => {
	const install = workspace();
	const installedValidator = join(install, "project-continuity/scripts/continuity.ts");
	const installedBootstrap = join(install, "project-inception/scripts/bootstrap.ts");
	for (const [source, destination] of [[validator, installedValidator], [bootstrap, installedBootstrap]] as const) {
		mkdirSync(dirname(destination), { recursive: true });
		copyFileSync(source, destination);
	}
	const root = workspace();
	expect(run(installedBootstrap, root, []).code).toBe(0);
	expect(run(installedValidator, root).code).toBe(2);
	project(root, parallelStatus);
	write(root, ".agents/work/database.md", "# Database task\n");
	write(root, ".agents/work/api.md", "# API task\n");
	const before = readFileSync(join(root, ".agents/STATUS.md"), "utf8");
	expect(run(installedBootstrap, root, []).code).toBe(0);
	expect(readFileSync(join(root, ".agents/STATUS.md"), "utf8")).toBe(before);
	expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toContain("Keep user notes.");
	expect(run(installedValidator, root).code).toBe(0);
});
