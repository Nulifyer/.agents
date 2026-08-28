import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shapeBinary } from "./adapters/binary.ts";
import { renderShape, type CommonOptions } from "./lib/core.ts";
import { probeBytes } from "./registry.ts";

const roots: string[] = [];
const options: CommonOptions = { maxOutput: 8_000, json: false, names: "show", source: "show", labels: false };

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function peFixture(): Buffer {
  const bytes = Buffer.alloc(0x800);
  bytes.write("MZ");
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write("PE\0\0", 0x80, "binary");
  const coff = 0x84;
  bytes.writeUInt16LE(0x8664, coff);
  bytes.writeUInt16LE(1, coff + 2);
  bytes.writeUInt16LE(0xf0, coff + 16);
  bytes.writeUInt16LE(0x2002, coff + 18);
  const optional = coff + 20;
  bytes.writeUInt16LE(0x20b, optional);
  const directories = optional + 112;
  bytes.writeUInt32LE(0x2200, directories);
  bytes.writeUInt32LE(40, directories + 4);
  bytes.writeUInt32LE(0x2300, directories + 8);
  bytes.writeUInt32LE(40, directories + 12);
  bytes.writeUInt32LE(0x2000, directories + 14 * 8);
  bytes.writeUInt32LE(72, directories + 14 * 8 + 4);
  const section = optional + 0xf0;
  bytes.write(".text", section);
  bytes.writeUInt32LE(0x600, section + 8);
  bytes.writeUInt32LE(0x2000, section + 12);
  bytes.writeUInt32LE(0x600, section + 16);
  bytes.writeUInt32LE(0x200, section + 20);
  const cli = 0x200;
  bytes.writeUInt32LE(72, cli);
  bytes.writeUInt32LE(0x2100, cli + 8);
  bytes.writeUInt32LE(0x80, cli + 12);
  const metadata = 0x300;
  bytes.writeUInt32LE(0x424a5342, metadata);
  bytes.writeUInt32LE(12, metadata + 12);
  bytes.write("v4.0.30319\0\0", metadata + 16, "binary");
  bytes.writeUInt16LE(1, metadata + 30);
  bytes.writeUInt32LE(0x40, metadata + 32);
  bytes.writeUInt32LE(0x20, metadata + 36);
  bytes.write("#~\0", metadata + 40, "binary");
  const exports = 0x400;
  bytes.writeUInt32LE(0x2250, exports + 12);
  bytes.writeUInt32LE(3, exports + 20);
  bytes.writeUInt32LE(2, exports + 24);
  bytes.write("sample.dll\0", 0x450, "binary");
  const imports = 0x500;
  bytes.writeUInt32LE(0x2350, imports + 12);
  bytes.writeUInt32LE(1, imports + 16);
  bytes.write("KERNEL32.dll\0", 0x550, "binary");
  return bytes;
}

describe("binary shape adapters", () => {
  test("maps PE DLL markers, imports, exports, sections, and CLR streams", () => {
    const output = renderShape(shapeBinary("sample", peFixture(), "auto", options), options);
    expect(output).toContain("binary pe access=metadata");
    expect(output).toContain("{x86-64,pe32+,dll}");
    expect(output).toContain("section .text");
    expect(output).toContain("exports sample.dll");
    expect(output).toContain("library KERNEL32.dll");
    expect(output).toContain("clr {runtime=v4.0.30319}");
    expect(output).toContain("stream #~");

    const nativeLinux = peFixture();
    nativeLinux.writeUInt16LE(0xfd1d, 0x84);
    expect(renderShape(shapeBinary("native-managed", nativeLinux, "auto", options), options)).toContain("{x86-64-linux,pe32+,dll}");
  });

  test("maps extension-independent ELF, COFF, archive, and WebAssembly headers", () => {
    const elf = Buffer.alloc(64);
    Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]).copy(elf);
    elf.writeUInt16LE(3, 16);
    elf.writeUInt16LE(62, 18);
    elf.writeUInt16LE(64, 52);
    elf.writeUInt16LE(64, 58);
    expect(renderShape(shapeBinary("elf-no-suffix", elf, "auto", options), options)).toContain("64-bit,little-endian,shared");

    const coff = Buffer.alloc(60);
    coff.writeUInt16LE(0x8664, 0);
    coff.writeUInt16LE(1, 2);
    coff.write(".text", 20);
    coff.writeUInt32LE(12, 36);
    expect(renderShape(shapeBinary("object", coff, "auto", options), options)).toContain("object {x86-64}");
    expect(probeBytes(coff)[0]).toEqual({ adapter: "coff", confidence: 0.9, reason: "plausible COFF object header" });

    const longCoff = Buffer.alloc(96);
    longCoff.writeUInt16LE(0x8664, 0);
    longCoff.writeUInt16LE(1, 2);
    longCoff.writeUInt32LE(60, 8);
    longCoff.write("/4", 20);
    longCoff.writeUInt32LE(12, 36);
    longCoff.writeUInt32LE(20, 60);
    longCoff.write(".llvm_addrsig\0", 64);
    expect(renderShape(shapeBinary("long-object", longCoff, "coff", options), options)).toContain("section .llvm_addrsig {bytes=12}");

    const member = Buffer.alloc(60, " ");
    member.write("one.o/          ", 0);
    member.write("4         ", 48);
    const archive = Buffer.concat([Buffer.from("!<arch>\n"), member, Buffer.from([1, 2, 3, 4])]);
    expect(renderShape(shapeBinary("library", archive, "auto", options), options)).toContain("member one.o {bytes=4}");

    const wasm = Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 0, 5, 4, 0x6e, 0x61, 0x6d, 0x65]);
    expect(renderShape(shapeBinary("module", wasm, "auto", options), options)).toContain("section name");
  });

  test("routes an extensionless binary by magic and supports direct adapter bypass", async () => {
    expect(probeBytes(peFixture())[0]).toEqual({ adapter: "pe", confidence: 1, reason: "DOS MZ header" });
    const root = mkdtempSync(join(tmpdir(), "shape-binary-"));
    roots.push(root);
    const target = join(root, "artifact");
    writeFileSync(target, Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
    const script = join(import.meta.dir, "shape.ts");
    const routed = Bun.spawnSync([process.execPath, script, target, "--explain-route"]);
    expect(routed.exitCode).toBe(0);
    expect(routed.stdout.toString()).toContain("binary wasm");
    expect(routed.stderr.toString()).toContain("selected wasm (binary)");
    const direct = Bun.spawnSync([process.execPath, script, target, "--adapter", "wasm"]);
    expect(direct.exitCode).toBe(0);
    expect(direct.stdout.toString()).toContain("binary wasm");
  });

  test("direct stdin adapters bypass probes and declared-only routing refuses metadata probes", () => {
    const script = join(import.meta.dir, "shape.ts");
    const direct = Bun.spawnSync([process.execPath, script, "-", "module", "--adapter", "wasm"], {
      stdin: Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]),
    });
    expect(direct.exitCode).toBe(0);
    expect(direct.stdout.toString()).toContain("module binary wasm");

    const refused = Bun.spawnSync([process.execPath, script, "missing.json", "--access", "declared"]);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr.toString()).toContain("Automatic header probing uses metadata access");
    expect(refused.stderr.toString()).not.toContain("ENOENT");

    const directRefusal = Bun.spawnSync([process.execPath, script, "missing", "--adapter", "pe", "--access", "observed"]);
    expect(directRefusal.exitCode).toBe(1);
    expect(directRefusal.stderr.toString()).toContain("binary adapters only support --access metadata");
    expect(directRefusal.stderr.toString()).not.toContain("ENOENT");
  });

  test("does not silently claim a non-metadata access boundary", () => {
    expect(() => shapeBinary("sample", peFixture(), "pe", { ...options, access: "observed" })).toThrow("only support --access metadata");
  });
});
