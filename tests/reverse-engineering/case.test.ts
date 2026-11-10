import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const source = resolve("skills/reverse-engineering/scripts/case.py");
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspace() {
  const root = mkdtempSync(join(tmpdir(), "re-case-test-"));
  roots.push(root);
  const artifact = join(root, "original.bin");
  const record = join(root, "case.json");
  writeFileSync(artifact, "original bytes");
  return { root, artifact, record };
}

function run(script: string, args: string[]) {
  const result = Bun.spawnSync(["python3", "-B", script, ...args]);
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
}

function initialize(script: string, record: string, artifact: string) {
  return run(script, ["init", record, artifact, "--mode", "rebuild", "--question", "Find caller contract", "--scope", "Pinned ABI", "--stop", "One validated owner"]);
}

describe("reverse-engineering case public CLI", () => {
  test("clean installed script records inputs without modifying or executing them", () => {
    const { root, artifact, record } = workspace();
    const install = join(root, "installed");
    mkdirSync(install);
    const script = join(install, "case.py");
    copyFileSync(source, script);
    expect(initialize(script, record, artifact).code).toBe(0);
    expect(run(script, ["check", record]).code).toBe(0);
    expect(readFileSync(artifact, "utf8")).toBe("original bytes");
    expect(initialize(script, record, artifact).code).toBe(2);
    const evidence = join(root, "reference.txt");
    writeFileSync(evidence, "recorded observation");
    expect(run(script, ["track", record, evidence, "--id", "reference", "--role", "reference-result", "--origin", "Pinned reference fixture"]).code).toBe(0);
    expect(run(script, ["track", record, evidence, "--id", "reference", "--role", "reference-result", "--origin", "Pinned reference fixture"]).code).toBe(2);
    writeFileSync(evidence, "changed observation");
    const changed = run(script, ["check", record]);
    expect(changed.code).toBe(1);
    expect(changed.out).toContain("reference: changed SHA-256");
    expect(run(script, ["track", record, artifact, "--id", "next", "--role", "trace", "--origin", "test"]).code).toBe(2);
  });

  test("missing input and unsupported schema fail closed", () => {
    const { artifact, record } = workspace();
    expect(initialize(source, record, artifact).code).toBe(0);
    rmSync(artifact);
    expect(run(source, ["check", record]).code).toBe(1);
    writeFileSync(record, '{"version":99}');
    expect(run(source, ["check", record]).code).toBe(2);
  });

  test("verified findings require resolvable locators and verification evidence", () => {
    const { artifact, record } = workspace();
    initialize(source, record, artifact);
    const data = JSON.parse(readFileSync(record, "utf8"));
    data.findings = [{ id: "claim", claim: "Behavior", scope: "one path", provenance: "verified", locators: [{ input: "missing", location: "RVA 0x10" }] }];
    writeFileSync(record, JSON.stringify(data));
    const result = run(source, ["check", record]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("invalid evidence locator");
    expect(result.out).toContain("verified claim needs tracked verification inputs");
  });

  test("rebuild checks reject false-green bookkeeping and stale comparator", () => {
    const { root, artifact, record } = workspace();
    initialize(source, record, artifact);
    expect(run(source, ["check", record, "--rebuild"]).code).toBe(1);
    for (const [id, role] of [["fixture", "fixture"], ["reference", "reference-result"], ["candidate", "candidate-result"], ["build", "build-receipt"], ["comparator", "comparator"]]) {
      const path = join(root, `${id}.txt`);
      writeFileSync(path, `${id} evidence`);
      expect(run(source, ["track", record, path, "--id", id!, "--role", role!, "--origin", "test evidence"]).code).toBe(0);
    }
    const data = JSON.parse(readFileSync(record, "utf8"));
    data.validation = { scope: "20 ordered records", fixture: "fixture", reference: "reference", candidate: "candidate", build: "build", comparator: "comparator", complete: true, exit_code: 0, counts: { total: 20, passed: 20, failed: 0, unknown: 0 } };
    writeFileSync(record, JSON.stringify(data));
    expect(run(source, ["check", record, "--rebuild"]).code).toBe(0);
    for (const counts of [{ total: 20, passed: 20, failed: 1, unknown: 0 }, { total: 20, passed: 19, failed: 0, unknown: 1 }, { total: 0, passed: 0, failed: 0, unknown: 0 }, { total: 20, passed: true, failed: 0, unknown: 0 }]) {
      data.validation.counts = counts;
      writeFileSync(record, JSON.stringify(data));
      expect(run(source, ["check", record, "--rebuild"]).code).toBe(1);
    }
    data.validation.counts = { total: 20, passed: 20, failed: 0, unknown: 0 };
    data.validation.complete = false;
    writeFileSync(record, JSON.stringify(data));
    expect(run(source, ["check", record, "--rebuild"]).code).toBe(1);
    data.validation.complete = true;
    data.validation.reference = "candidate";
    writeFileSync(record, JSON.stringify(data));
    expect(run(source, ["check", record, "--rebuild"]).code).toBe(1);
    writeFileSync(join(root, "comparator.txt"), "changed comparison rules");
    expect(run(source, ["check", record, "--rebuild"]).out).toContain("comparator: changed SHA-256");
  });

  test("self-reference and mutation through an invalid baseline are refused", () => {
    const { artifact, record } = workspace();
    expect(initialize(source, artifact, artifact).code).toBe(2);
    expect(readFileSync(artifact, "utf8")).toBe("original bytes");
    initialize(source, record, artifact);
    expect(run(source, ["track", record, record, "--id", "self", "--role", "trace", "--origin", "test"]).code).toBe(2);
    expect(run(source, ["track", record, artifact, "--id", "", "--role", "trace", "--origin", "test"]).code).toBe(2);
    expect(run(source, ["track", record, artifact, "--id", "bad-origin", "--role", "trace", "--origin", " "]).code).toBe(2);
    expect(run(source, ["check", record]).code).toBe(0);
  });
});
