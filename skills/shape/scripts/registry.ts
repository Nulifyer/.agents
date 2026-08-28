import { basename, extname, resolve } from "node:path";

export type ShapeDomain = "api" | "binary" | "code" | "data" | "database" | "document" | "web";

export type ProbeEvidence = {
  adapter: string;
  confidence: number;
  reason: string;
};

export type AdapterDescriptor = {
  id: string;
  domain: ShapeDomain;
  summary: string;
  script: string;
  extraArgs?: string[];
  extensions?: string[];
  fileNames?: string[];
};

const adaptersRoot = resolve(import.meta.dir, "adapters");

export const adapters: readonly AdapterDescriptor[] = [
  { id: "api", domain: "api", summary: "OpenAPI, JSON Schema, GraphQL SDL, and Protobuf contracts", script: resolve(adaptersRoot, "api.ts"), extensions: [".graphql", ".gql", ".graphqls", ".proto"] },
  { id: "code", domain: "code", summary: "Source symbols, nesting, ownership, and match windows", script: resolve(adaptersRoot, "code/cli.ts") },
  { id: "data", domain: "data", summary: "JSON, JSONL, XML, dotenv, CSV, TSV, and XLSX payload structure", script: resolve(adaptersRoot, "data.ts"), extensions: [".csv", ".tsv", ".jsonl", ".ndjson", ".xlsx"], fileNames: [".env"] },
  { id: "database", domain: "database", summary: "SQLite and PostgreSQL catalog metadata", script: resolve(adaptersRoot, "database.ts"), extensions: [".sqlite", ".sqlite3", ".db"] },
  { id: "document", domain: "document", summary: "Markdown, DOCX, and PDF outlines and containers", script: resolve(adaptersRoot, "document.ts"), extensions: [".md", ".mdx", ".markdown", ".docx", ".pdf"] },
  { id: "web", domain: "web", summary: "Static HTML semantic landmarks and controls", script: resolve(adaptersRoot, "web.ts"), extensions: [".html", ".htm", ".xhtml"] },
  { id: "binary", domain: "binary", summary: "Automatic PE, COFF, ELF, archive, and WebAssembly metadata", script: resolve(adaptersRoot, "binary.ts") },
  { id: "pe", domain: "binary", summary: "PE images, DLL markers, imports, exports, sections, and CLR metadata markers", script: resolve(adaptersRoot, "binary.ts"), extraArgs: ["--format", "pe"], extensions: [".exe", ".dll", ".sys", ".efi", ".ocx", ".cpl"] },
  { id: "coff", domain: "binary", summary: "COFF object-file headers and sections", script: resolve(adaptersRoot, "binary.ts"), extraArgs: ["--format", "coff"], extensions: [".obj"] },
  { id: "elf", domain: "binary", summary: "ELF headers, image markers, and sections", script: resolve(adaptersRoot, "binary.ts"), extraArgs: ["--format", "elf"], extensions: [".so", ".elf", ".ko"] },
  { id: "archive", domain: "binary", summary: "Unix and Windows static-library archive members", script: resolve(adaptersRoot, "binary.ts"), extraArgs: ["--format", "archive"], extensions: [".a", ".lib"] },
  { id: "wasm", domain: "binary", summary: "WebAssembly sections and custom-section names", script: resolve(adaptersRoot, "binary.ts"), extraArgs: ["--format", "wasm"], extensions: [".wasm"] },
] as const;

const aliases = new Map<string, string>([["db", "database"], ["doc", "document"]]);

export function normalizeDomain(value: string): ShapeDomain | undefined {
  const normalized = aliases.get(value) ?? value;
  return adapters.some((adapter) => adapter.domain === normalized) ? normalized as ShapeDomain : undefined;
}

export function adapterById(id: string): AdapterDescriptor | undefined {
  return adapters.find((adapter) => adapter.id === id);
}

export function adaptersForDomain(domain: ShapeDomain): AdapterDescriptor[] {
  return adapters.filter((adapter) => adapter.domain === domain);
}

export function routeByQuestion(question: string): ShapeDomain | undefined {
  const value = question.toLowerCase();
  if (/\b(dlls?|executables?|binaries|imports?|exports?|symbols?|elf|pe|coff|wasm|assembly metadata|clr metadata)\b/.test(value)) return "binary";
  if (/\b(endpoints?|operations?|openapi|swagger|graphql|protobuf|grpc|request schemas?|response schemas?|api contracts?)\b/.test(value)) return "api";
  if (/\b(datasets?|records?|spreadsheets?|workbooks?|sheets?|csv|parquet|arrays?|payloads?|response bod(?:y|ies)|request bod(?:y|ies)|dotenv|env files?|environment variable names?)\b/.test(value)) return "data";
  if (/\b(?:json|xml)\s+(?:shape|structure)\b/.test(value)) return "data";
  if (/\b(tables?|foreign keys?|indexes|database|catalog|relations?|schema migrations?)\b/.test(value)) return "database";
  if (/\b(buttons?|links?|forms?|click|accessible|landmarks?|page controls?|navigation)\b/.test(value)) return "web";
  if (/\b(documents?|outlines?|headings?|sections?|pages?|footnotes?|figures?|paragraphs?)\b/.test(value)) return "document";
  if (/\b(fields?|columns?)\b/.test(value)) return "data";
  if (/\b(implementations?|declarations?|callbacks?|functions?|classes|config|source|owners?|cte|sql statements?)\b/.test(value)) return "code";
  return undefined;
}

function hasMagic(bytes: Uint8Array, values: number[]): boolean {
  return values.every((value, index) => bytes[index] === value);
}

function plausibleCoff(bytes: Uint8Array): boolean {
  if (bytes.length < 60) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const machines = new Set([0x014c, 0x0166, 0x01c0, 0x01c2, 0x01c4, 0x01f0, 0x0200, 0x5064, 0x8664, 0xaa64]);
  const sectionCount = view.getUint16(2, true);
  const optionalSize = view.getUint16(16, true);
  if (!machines.has(view.getUint16(0, true)) || sectionCount < 1 || sectionCount > 96 || optionalSize !== 0) return false;
  if (20 + sectionCount * 40 > bytes.length) return false;
  for (let index = 0; index < sectionCount; index++) {
    const name = bytes.subarray(20 + index * 40, 28 + index * 40);
    if (![...name].every((value) => value === 0 || (value >= 0x20 && value <= 0x7e))) return false;
  }
  return true;
}

export function probeBytes(bytes: Uint8Array): ProbeEvidence[] {
  const evidence: ProbeEvidence[] = [];
  if (hasMagic(bytes, [0x4d, 0x5a])) evidence.push({ adapter: "pe", confidence: 1, reason: "DOS MZ header" });
  if (hasMagic(bytes, [0x7f, 0x45, 0x4c, 0x46])) evidence.push({ adapter: "elf", confidence: 1, reason: "ELF magic" });
  if (hasMagic(bytes, [0x00, 0x61, 0x73, 0x6d])) evidence.push({ adapter: "wasm", confidence: 1, reason: "WebAssembly magic" });
  if (new TextDecoder().decode(bytes.subarray(0, 8)) === "!<arch>\n") evidence.push({ adapter: "archive", confidence: 1, reason: "archive global header" });
  if (plausibleCoff(bytes)) evidence.push({ adapter: "coff", confidence: 0.9, reason: "plausible COFF object header" });
  if (bytes[0] === 0x23 && bytes[1] === 0x21) evidence.push({ adapter: "code", confidence: 0.95, reason: "script shebang" });
  return evidence;
}

export function probeName(target: string): ProbeEvidence[] {
  if (/^https?:\/\//i.test(target)) return [{ adapter: "web", confidence: 1, reason: "HTTP URL" }];
  if (/^postgres(?:ql)?:\/\//i.test(target)) return [{ adapter: "database", confidence: 1, reason: "PostgreSQL URI" }];
  const fileName = basename(target).toLowerCase();
  const extension = extname(fileName);
  const evidence: ProbeEvidence[] = [];
  for (const adapter of adapters) {
    if (adapter.fileNames?.some((name) => fileName === name || fileName.startsWith(`${name}.`))) {
      evidence.push({ adapter: adapter.id, confidence: 0.9, reason: `filename ${fileName}` });
    }
    if (extension && adapter.extensions?.includes(extension)) {
      evidence.push({ adapter: adapter.id, confidence: 0.75, reason: `extension ${extension}` });
    }
  }
  if (!extension && !evidence.length) evidence.push({ adapter: "code", confidence: 0.2, reason: "extensionless fallback" });
  if (!evidence.length && ![".json", ".xml", ".yaml", ".yml", ".sql"].includes(extension)) {
    evidence.push({ adapter: "code", confidence: 0.45, reason: extension ? `unclaimed extension ${extension}` : "source fallback" });
  }
  return evidence;
}

export function selectEvidence(evidence: ProbeEvidence[]): ProbeEvidence | undefined {
  return [...evidence].sort((left, right) => right.confidence - left.confidence)[0];
}

export function routeByTarget(target: string): ShapeDomain | undefined {
  const selected = selectEvidence(probeName(target));
  return selected ? adapterById(selected.adapter)?.domain : undefined;
}
