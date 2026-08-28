import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { Database } from "bun:sqlite";

type Fixture = {
  path: string;
  decodedName: string;
  source: string;
  revision: string;
  sha256: string;
  license: string;
  purpose: string;
};

const workspace = resolve(import.meta.dir, "../..");
const fixtureRoot = join(import.meta.dir, "fixtures");
const shapeScript = join(workspace, "skills/shape/scripts/shape.ts");
const manifest = JSON.parse(readFileSync(join(fixtureRoot, "manifest.json"), "utf8")) as { schemaVersion: number; fixtures: Fixture[] };
const materialized = new Map<string, string>();
let temporaryRoot = "";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function command(commandLine: string[], cwd = workspace): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync(commandLine, { cwd, stdout: "pipe", stderr: "pipe" });
  return { stdout: result.stdout.toString(), stderr: result.stderr.toString(), exitCode: result.exitCode };
}

function shape(target: string, ...args: string[]): string {
  const result = command([process.execPath, shapeScript, target, ...args]);
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

function requireCommand(commandLine: string[], cwd = workspace): void {
  const result = command(commandLine, cwd);
  if (result.exitCode !== 0) throw new Error(`${commandLine.join(" ")} failed:\n${result.stderr || result.stdout}`);
}

beforeAll(() => {
  temporaryRoot = mkdtempSync(join(tmpdir(), "shape-real-"));
  for (const fixture of manifest.fixtures) {
    const stored = readFileSync(join(fixtureRoot, fixture.path));
    const bytes = fixture.path.endsWith(".b64") ? Buffer.from(stored.toString("ascii").replace(/\s/g, ""), "base64") : stored;
    const destination = join(temporaryRoot, fixture.decodedName);
    writeFileSync(destination, bytes);
    materialized.set(fixture.decodedName, destination);
  }

  const databasePath = join(temporaryRoot, "catalog.sqlite");
  const database = new Database(databasePath, { create: true });
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE accounts (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE events (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), payload BLOB);
    CREATE INDEX events_account_id ON events(account_id);
    CREATE VIEW account_events AS SELECT account_id, count(*) AS event_count FROM events GROUP BY account_id;
  `);
  database.close();

  const largeSchema = Array.from({ length: 7_000 }, (_, index) => `\"\"\"The type of record returned here; union Ghost${index} is prose.\"\"\"\ntype Record${index} { id: ID! value: String }`).join("\n");
  writeFileSync(join(temporaryRoot, "large.graphql"), largeSchema);
});

afterAll(() => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

describe("repository-local real shape corpus", () => {
  test("pins upstream bytes, provenance, licenses, and checksums", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(readFileSync(join(fixtureRoot, "LICENSE-APACHE-2.0.txt"), "utf8")).toContain("Apache License");
    expect(readFileSync(join(fixtureRoot, "NOTICE-POI.txt"), "utf8")).toContain("Apache POI");
    for (const fixture of manifest.fixtures) {
      const path = materialized.get(fixture.decodedName);
      expect(path).toBeDefined();
      expect(sha256(readFileSync(path as string))).toBe(fixture.sha256);
      expect(fixture.source).toContain(fixture.revision);
      expect(fixture.license).toBe("Apache-2.0");
      expect(fixture.purpose.length).toBeGreaterThan(20);
    }
  });

  test("routes declared GraphQL and Protobuf without metadata probing", () => {
    const graphql = shape(join(fixtureRoot, "generated/described-schema.graphql"), "--access", "declared", "--source", "omit", "--names", "show", "-o", "3000");
    expect(graphql).toContain("api graphql-sdl access=declared");
    expect(graphql).toContain("type Account");
    expect(graphql).toContain("scalar Timestamp");
    expect(graphql).not.toContain("type of");
    expect(graphql).not.toContain("type Phantom");

    const protobuf = shape(join(fixtureRoot, "generated/service.proto"), "--access", "declared", "--source", "omit", "--names", "show", "-o", "2000");
    expect(protobuf).toContain("api protobuf access=declared");
    expect(protobuf).toContain("service Directory");
    expect(protobuf).toContain("rpc Lookup LookupRequest -> LookupReply");
  });

  test("parses description-heavy GraphQL in bounded time without prose declarations", () => {
    const started = performance.now();
    const output = shape(join(temporaryRoot, "large.graphql"), "--access", "declared", "--source", "omit", "--names", "show", "-o", "1200");
    const elapsed = performance.now() - started;
    expect(output).toContain("type Record0");
    expect(output).not.toContain("type of");
    expect(elapsed).toBeLessThan(4_000);
  });

  test("maps pinned OpenAPI with RFC 6901 locators through --as", () => {
    const output = shape(materialized.get("petstore.yaml") as string, "--as", "api", "--access", "declared", "--source", "omit", "--names", "show", "-o", "5000");
    expect(output).toContain("endpoint /pets [/paths/~1pets]");
    expect(output).toContain("operation listPets {GET} [/paths/~1pets/get]");
    expect(output).toContain("application/json Pets {required} [/paths/~1pets/get/responses/200/content/application~1json/schema]");
    expect(output).toContain("field id integer {required} [/components/schemas/Pet/properties/id]");
  });

  test("maps pinned Office packages through the public CLI", () => {
    const document = shape(materialized.get("heading123.docx") as string, "--source", "omit", "--names", "show", "--labels", "-o", "2000");
    expect(document).toContain('section "First paragraph" {level=1,style=Heading1}');
    expect(document).toContain('section "Third paragraph" {level=3,style=Heading3}');
    const workbook = shape(materialized.get("ExcelTables.xlsx") as string, "--source", "omit", "--names", "show", "-o", "2000");
    expect(workbook).toContain("sheet ExcelTable");
    expect(workbook).toContain("table TableName {range=G1:I4}");
    expect(workbook).toContain("column AgeGroup");
  });

  test("maps a database generated by SQLite without reading rows", () => {
    const output = shape(join(temporaryRoot, "catalog.sqlite"), "--access", "metadata", "--source", "omit", "--names", "show", "-o", "3000");
    expect(output).toContain("table accounts");
    expect(output).toContain("table events");
    expect(output).toContain("fk=accounts.id");
    expect(output).toContain("view account_events");
  });

  test("bounds ragged, trailing-empty CSV records to useful columns", () => {
    const output = shape(join(fixtureRoot, "generated/ragged.csv"), "--source", "omit", "--names", "show", "-o", "2000");
    expect(output).toContain("column Network_Count");
    expect(output).toContain("column column_5");
    expect(output).not.toContain("column column_6");
  });

  test.skipIf(!Bun.which("gcc") || !Bun.which("ar"))("maps GCC ELF and ar output, including PIE and symbol members", () => {
    const source = join(temporaryRoot, "native.c");
    const executable = join(temporaryRoot, "native-elf");
    const object = join(temporaryRoot, "native.o");
    const archive = join(temporaryRoot, "libnative.a");
    writeFileSync(source, "int shape_add(int a, int b) { return a + b; }\nint main(void) { return shape_add(1, 2); }\n");
    requireCommand([Bun.which("gcc") as string, source, "-o", executable]);
    requireCommand([Bun.which("gcc") as string, "-c", source, "-o", object]);
    requireCommand([Bun.which("ar") as string, "rcs", archive, object]);
    expect(shape(executable, "--source", "omit", "--names", "show", "-o", "1800")).toContain("little-endian,pie,machine-62");
    const archiveOutput = shape(archive, "--source", "omit", "--names", "show", "-o", "1800");
    expect(archiveOutput).toContain("member <symbols>");
    expect(archiveOutput).toContain(`member ${basename(object)}`);
  });

  test.skipIf(!Bun.which("zig"))("maps Zig COFF, PE DLL, and WebAssembly output through auto and direct routes", () => {
    const source = join(temporaryRoot, "cross.c");
    const coff = join(temporaryRoot, "cross-object");
    const dll = join(temporaryRoot, "cross.dll");
    const wasm = join(temporaryRoot, "cross.wasm");
    writeFileSync(source, "int shape_add(int a, int b) { return a + b; }\n");
    const zig = Bun.which("zig") as string;
    requireCommand([zig, "cc", "-target", "x86_64-windows-gnu", "-c", source, "-o", coff]);
    requireCommand([zig, "cc", "-target", "x86_64-windows-gnu", "-shared", source, "-o", dll]);
    requireCommand([zig, "cc", "-target", "wasm32-freestanding", "-fno-sanitize=undefined", "-nostdlib", "-Wl,--no-entry", "-Wl,--export=shape_add", source, "-o", wasm]);

    const automaticCoff = shape(coff, "--source", "omit", "--names", "show", "-o", "2500");
    expect(automaticCoff).toContain("binary coff");
    expect(automaticCoff).toContain("section .llvm_addrsig");
    expect(shape(coff, "--adapter", "coff", "--source", "omit", "--names", "show", "-o", "1200")).toContain("object {x86-64}");

    const anonymousDll = shape(dll, "--source", "omit", "--names", "omit", "-o", "3000");
    expect(anonymousDll).toMatch(/section \{bytes=\d+\}/);
    expect(anonymousDll).toMatch(/exports \{functions=\d+,names=\d+\}/);
    expect(anonymousDll).not.toContain("bytes=#");

    const wasmOutput = shape(wasm, "--source", "omit", "--names", "show", "-o", "2500");
    expect(wasmOutput).toContain("section name");
    expect(wasmOutput).toContain("section producers");
  });
});
