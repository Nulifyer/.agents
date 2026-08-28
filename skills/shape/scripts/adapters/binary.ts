#!/usr/bin/env bun

import {
  parseCommonArgs,
  readTarget,
  renderShape,
  safeText,
  type CommonOptions,
  type ShapeNode,
  type ShapeResult,
} from "../lib/core.ts";

type BinaryFormat = "auto" | "pe" | "coff" | "elf" | "archive" | "wasm";

const machineNames = new Map<number, string>([
  [0x014c, "x86"],
  [0x8664, "x86-64"],
  [0x01c0, "arm"],
  [0xaa64, "arm64"],
  [0x5064, "riscv64"],
]);

const nativeOsOverrides = new Map<number, string>([
  [0x4644, "apple"],
  [0xadc4, "freebsd"],
  [0x7b79, "linux"],
  [0x1993, "netbsd"],
]);

function machineName(machine: number): string {
  const direct = machineNames.get(machine);
  if (direct) return direct;
  for (const [base, architecture] of machineNames) {
    for (const [override, operatingSystem] of nativeOsOverrides) {
      if ((base ^ override) === machine) return `${architecture}-${operatingSystem}`;
    }
  }
  return `machine-0x${machine.toString(16)}`;
}

function requireRange(bytes: Buffer, offset: number, size: number, label: string): void {
  if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || offset + size > bytes.length) {
    throw new Error(`Truncated ${label}`);
  }
}

function u16(bytes: Buffer, offset: number, little = true): number {
  requireRange(bytes, offset, 2, "16-bit field");
  return little ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset);
}

function u32(bytes: Buffer, offset: number, little = true): number {
  requireRange(bytes, offset, 4, "32-bit field");
  return little ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
}

function u64(bytes: Buffer, offset: number, little = true): number {
  requireRange(bytes, offset, 8, "64-bit field");
  const value = little ? bytes.readBigUInt64LE(offset) : bytes.readBigUInt64BE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Binary offset exceeds safe integer range");
  return Number(value);
}

function ascii(bytes: Buffer, offset: number, size: number): string {
  requireRange(bytes, offset, size, "string");
  const end = bytes.indexOf(0, offset);
  const bounded = end < 0 || end > offset + size ? offset + size : end;
  return safeText(bytes.toString("utf8", offset, bounded), size);
}

function detect(bytes: Buffer): Exclude<BinaryFormat, "auto"> {
  if (bytes.subarray(0, 2).equals(Buffer.from("MZ"))) return "pe";
  if (bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return "elf";
  if (bytes.subarray(0, 4).equals(Buffer.from([0x00, 0x61, 0x73, 0x6d]))) return "wasm";
  if (bytes.subarray(0, 8).toString("ascii") === "!<arch>\n") return "archive";
  if (bytes.length >= 20 && machineNames.has(bytes.readUInt16LE(0))) return "coff";
  throw new Error("Unsupported binary header; use --adapter or --format only when the format is known");
}

type Section = { name: string; virtualAddress: number; virtualSize: number; rawOffset: number; rawSize: number };

function peShape(source: string, bytes: Buffer): ShapeResult {
  requireRange(bytes, 0x3c, 4, "DOS header");
  const peOffset = u32(bytes, 0x3c);
  requireRange(bytes, peOffset, 24, "PE header");
  if (bytes.subarray(peOffset, peOffset + 4).toString("binary") !== "PE\u0000\u0000") throw new Error("Invalid PE signature");
  const coff = peOffset + 4;
  const machine = u16(bytes, coff);
  const sectionCount = u16(bytes, coff + 2);
  const optionalSize = u16(bytes, coff + 16);
  const characteristics = u16(bytes, coff + 18);
  const optional = coff + 20;
  requireRange(bytes, optional, optionalSize, "PE optional header");
  const magic = optionalSize >= 2 ? u16(bytes, optional) : 0;
  const pe32Plus = magic === 0x20b;
  const directories = optional + (pe32Plus ? 112 : 96);
  const sectionTable = optional + optionalSize;
  const sections: Section[] = [];
  for (let index = 0; index < Math.min(sectionCount, 512); index++) {
    const offset = sectionTable + index * 40;
    requireRange(bytes, offset, 40, "PE section table");
    sections.push({
      name: ascii(bytes, offset, 8) || `section-${index}`,
      virtualSize: u32(bytes, offset + 8),
      virtualAddress: u32(bytes, offset + 12),
      rawSize: u32(bytes, offset + 16),
      rawOffset: u32(bytes, offset + 20),
    });
  }
  const rvaOffset = (rva: number): number | undefined => {
    const section = sections.find((item) => rva >= item.virtualAddress && rva < item.virtualAddress + Math.max(item.virtualSize, item.rawSize));
    return section ? section.rawOffset + rva - section.virtualAddress : rva < bytes.length ? rva : undefined;
  };
  const directory = (index: number): { rva: number; size: number } | undefined => {
    if (directories + index * 8 + 8 > optional + optionalSize) return undefined;
    const rva = u32(bytes, directories + index * 8);
    const size = u32(bytes, directories + index * 8 + 4);
    return rva && size ? { rva, size } : undefined;
  };
  const nodes: ShapeNode[] = [
    { kind: "image", traits: [machineName(machine), pe32Plus ? "pe32+" : "pe32", characteristics & 0x2000 ? "dll" : "executable"] },
    ...sections.map((section) => ({ kind: "section", name: section.name, traits: [`bytes=${section.rawSize}`] })),
  ];
  const exportDirectory = directory(0);
  if (exportDirectory) {
    const offset = rvaOffset(exportDirectory.rva);
    if (offset !== undefined && offset + 40 <= bytes.length) {
      const nameOffset = rvaOffset(u32(bytes, offset + 12));
      nodes.push({
        kind: "exports",
        name: nameOffset === undefined ? undefined : ascii(bytes, nameOffset, Math.min(512, bytes.length - nameOffset)),
        traits: [`functions=${u32(bytes, offset + 20)}`, `names=${u32(bytes, offset + 24)}`],
      });
    }
  }
  const importDirectory = directory(1);
  if (importDirectory) {
    const offset = rvaOffset(importDirectory.rva);
    if (offset !== undefined) {
      const imports: ShapeNode[] = [];
      for (let index = 0; index < 256; index++) {
        const descriptor = offset + index * 20;
        if (descriptor + 20 > bytes.length) break;
        const nameRva = u32(bytes, descriptor + 12);
        const firstThunk = u32(bytes, descriptor + 16);
        if (!nameRva && !firstThunk) break;
        const nameOffset = rvaOffset(nameRva);
        if (nameOffset !== undefined) imports.push({ kind: "library", name: ascii(bytes, nameOffset, Math.min(512, bytes.length - nameOffset)) });
      }
      if (imports.length) nodes.push({ kind: "imports", children: imports });
    }
  }
  const clrDirectory = directory(14);
  if (clrDirectory) {
    const clrOffset = rvaOffset(clrDirectory.rva);
    const clr: ShapeNode = { kind: "clr", traits: ["managed"] };
    if (clrOffset !== undefined && clrOffset + 16 <= bytes.length) {
      const metadataOffset = rvaOffset(u32(bytes, clrOffset + 8));
      if (metadataOffset !== undefined && metadataOffset + 20 <= bytes.length && u32(bytes, metadataOffset) === 0x424a5342) {
        const versionLength = u32(bytes, metadataOffset + 12);
        const version = ascii(bytes, metadataOffset + 16, Math.min(versionLength, bytes.length - metadataOffset - 16));
        let cursor = metadataOffset + 16 + versionLength;
        cursor = (cursor + 3) & ~3;
        if (cursor + 4 <= bytes.length) {
          const streamCount = u16(bytes, cursor + 2);
          cursor += 4;
          const streams: ShapeNode[] = [];
          for (let index = 0; index < Math.min(streamCount, 64) && cursor + 8 <= bytes.length; index++) {
            const name = ascii(bytes, cursor + 8, Math.min(32, bytes.length - cursor - 8));
            streams.push({ kind: "stream", name });
            cursor += 8 + Math.ceil((Buffer.byteLength(name) + 1) / 4) * 4;
          }
          clr.children = streams;
        }
        clr.traits = [`runtime=${version || "unknown"}`];
      }
    }
    nodes.push(clr);
  }
  return { source, domain: "binary", format: "pe", access: "metadata", nodes, incomplete: sectionCount > 512 };
}

function coffShape(source: string, bytes: Buffer): ShapeResult {
  requireRange(bytes, 0, 20, "COFF header");
  const machine = u16(bytes, 0);
  const sectionCount = u16(bytes, 2);
  const optionalSize = u16(bytes, 16);
  const sectionTable = 20 + optionalSize;
  const symbolTable = u32(bytes, 8);
  const symbolCount = u32(bytes, 12);
  const stringTable = symbolTable + symbolCount * 18;
  const stringTableSize = symbolTable > 0 && stringTable + 4 <= bytes.length ? u32(bytes, stringTable) : 0;
  const sectionName = (offset: number): string => {
    const shortName = ascii(bytes, offset, 8);
    const longOffset = /^\/(\d+)$/.exec(shortName)?.[1];
    if (!longOffset || stringTableSize < 4) return shortName;
    const start = stringTable + Number(longOffset);
    if (start < stringTable + 4 || start >= stringTable + stringTableSize || start >= bytes.length) return shortName;
    return ascii(bytes, start, Math.min(256, stringTable + stringTableSize - start));
  };
  const children: ShapeNode[] = [];
  for (let index = 0; index < Math.min(sectionCount, 512); index++) {
    const offset = sectionTable + index * 40;
    requireRange(bytes, offset, 40, "COFF section table");
    children.push({ kind: "section", name: sectionName(offset), traits: [`bytes=${u32(bytes, offset + 16)}`] });
  }
  return {
    source,
    domain: "binary",
    format: "coff",
    access: "metadata",
    nodes: [{ kind: "object", traits: [machineName(machine)], children }],
    incomplete: sectionCount > 512,
  };
}

function elfShape(source: string, bytes: Buffer): ShapeResult {
  requireRange(bytes, 0, 16, "ELF identification");
  const width = bytes[4] === 2 ? 64 : bytes[4] === 1 ? 32 : 0;
  if (!width) throw new Error("Unsupported ELF class");
  const little = bytes[5] === 1;
  if (!little && bytes[5] !== 2) throw new Error("Unsupported ELF byte order");
  const readOffset = (offset: number) => width === 64 ? u64(bytes, offset, little) : u32(bytes, offset, little);
  const type = u16(bytes, 16, little);
  const machine = u16(bytes, 18, little);
  const sectionOffset = readOffset(width === 64 ? 40 : 32);
  const sectionEntrySize = u16(bytes, width === 64 ? 58 : 46, little);
  const sectionCount = u16(bytes, width === 64 ? 60 : 48, little);
  const stringIndex = u16(bytes, width === 64 ? 62 : 50, little);
  type ElfSection = { nameOffset: number; type: number; offset: number; size: number };
  const sections: ElfSection[] = [];
  for (let index = 0; index < Math.min(sectionCount, 1024); index++) {
    const base = sectionOffset + index * sectionEntrySize;
    requireRange(bytes, base, sectionEntrySize, "ELF section header");
    sections.push({
      nameOffset: u32(bytes, base, little),
      type: u32(bytes, base + 4, little),
      offset: readOffset(base + (width === 64 ? 24 : 16)),
      size: readOffset(base + (width === 64 ? 32 : 20)),
    });
  }
  const strings = sections[stringIndex];
  const name = (offset: number): string | undefined => {
    if (!strings || offset >= strings.size || strings.offset + offset >= bytes.length) return undefined;
    return ascii(bytes, strings.offset + offset, Math.min(256, strings.size - offset));
  };
  const typeNames = new Map([[1, "object"], [2, "executable"], [3, "shared"], [4, "core"]]);
  const imageType = type === 3 && sections.some((section) => name(section.nameOffset) === ".interp") ? "pie" : typeNames.get(type) ?? `type-${type}`;
  return {
    source,
    domain: "binary",
    format: "elf",
    access: "metadata",
    nodes: [{
      kind: "image",
      traits: [`${width}-bit`, little ? "little-endian" : "big-endian", imageType, `machine-${machine}`],
      children: sections.map((section) => ({ kind: "section", name: name(section.nameOffset), traits: [`type=${section.type}`, `bytes=${section.size}`] })),
    }],
    incomplete: sectionCount > 1024,
  };
}

function archiveShape(source: string, bytes: Buffer): ShapeResult {
  if (bytes.subarray(0, 8).toString("ascii") !== "!<arch>\n") throw new Error("Invalid archive signature");
  const children: ShapeNode[] = [];
  let longNames: Buffer | undefined;
  let offset = 8;
  while (offset + 60 <= bytes.length && children.length < 2048) {
    const rawName = bytes.toString("ascii", offset, offset + 16).trim();
    const size = Number(bytes.toString("ascii", offset + 48, offset + 58).trim());
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("Invalid archive member size");
    requireRange(bytes, offset + 60, size, "archive member");
    let name: string;
    if (rawName === "/") name = "<symbols>";
    else if (rawName === "//") {
      name = "<names>";
      longNames = bytes.subarray(offset + 60, offset + 60 + size);
    } else if (rawName === "/SYM64/") name = "<symbols-64>";
    else {
      const longOffset = /^\/(\d+)$/.exec(rawName)?.[1];
      if (longOffset && longNames) {
        const start = Number(longOffset);
        const end = longNames.indexOf(Buffer.from("/\n"), start);
        name = safeText(longNames.toString("utf8", start, end < 0 ? undefined : end));
      } else name = safeText(rawName.replace(/\/$/, ""));
    }
    children.push({ kind: "member", name, traits: [`bytes=${size}`], locator: { type: "byte", start: offset + 60, end: offset + 60 + size } });
    offset += 60 + size + (size % 2);
  }
  return { source, domain: "binary", format: "archive", access: "metadata", nodes: [{ kind: "archive", children }], incomplete: offset + 60 <= bytes.length };
}

function leb(bytes: Buffer, start: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let next = start;
  for (let count = 0; count < 5; count++) {
    requireRange(bytes, next, 1, "LEB128 value");
    const byte = bytes[next++] as number;
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return { value: value >>> 0, next };
    shift += 7;
  }
  throw new Error("Oversized LEB128 value");
}

function wasmName(bytes: Buffer, start: number): { value: string; next: number } {
  const length = leb(bytes, start);
  requireRange(bytes, length.next, length.value, "WebAssembly name");
  return { value: safeText(bytes.toString("utf8", length.next, length.next + length.value), 256), next: length.next + length.value };
}

function wasmShape(source: string, bytes: Buffer): ShapeResult {
  if (!bytes.subarray(0, 4).equals(Buffer.from([0, 0x61, 0x73, 0x6d]))) throw new Error("Invalid WebAssembly signature");
  const names = ["custom", "type", "import", "function", "table", "memory", "global", "export", "start", "element", "code", "data", "data-count", "tag"];
  const children: ShapeNode[] = [];
  let offset = 8;
  while (offset < bytes.length && children.length < 4096) {
    const id = bytes[offset++] as number;
    const size = leb(bytes, offset);
    offset = size.next;
    requireRange(bytes, offset, size.value, "WebAssembly section");
    const node: ShapeNode = { kind: "section", name: names[id] ?? `id-${id}`, traits: [`bytes=${size.value}`], locator: { type: "byte", start: offset, end: offset + size.value } };
    if (id === 0 && size.value) {
      const custom = wasmName(bytes, offset);
      node.name = custom.value;
    }
    children.push(node);
    offset += size.value;
  }
  return { source, domain: "binary", format: "wasm", access: "metadata", nodes: [{ kind: "module", children }], incomplete: offset < bytes.length };
}

export function shapeBinary(source: string, bytes: Buffer, requested: BinaryFormat, options: CommonOptions): ShapeResult {
  if (options.access && options.access !== "metadata") throw new Error("binary adapters only support --access metadata");
  const format = requested === "auto" ? detect(bytes) : requested;
  if (format === "pe") return peShape(source, bytes);
  if (format === "coff") return coffShape(source, bytes);
  if (format === "elf") return elfShape(source, bytes);
  if (format === "archive") return archiveShape(source, bytes);
  return wasmShape(source, bytes);
}

function usage(): string {
  return "Usage: shape <path> [virtual-name] [--format auto|pe|coff|elf|archive|wasm] [-o <chars>] [-j] [--names show|hash|omit] [--source show|hash|omit] [--access metadata]";
}

async function main(): Promise<void> {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    console.log(usage());
    return;
  }
  const formatIndex = raw.indexOf("--format");
  const formatValue = formatIndex >= 0 ? raw.splice(formatIndex, 2)[1] : "auto";
  if (!formatValue || !["auto", "pe", "coff", "elf", "archive", "wasm"].includes(formatValue)) {
    throw new Error("--format must be auto, pe, coff, elf, archive, or wasm");
  }
  const { options, rest } = parseCommonArgs(raw);
  if (options.access && options.access !== "metadata") {
    throw new Error("binary adapters only support --access metadata");
  }
  const [path, virtualName] = rest;
  if (!path) throw new Error(usage());
  const target = await readTarget(path, virtualName);
  console.log(renderShape(shapeBinary(target.name, target.bytes, formatValue as BinaryFormat, options), options));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
