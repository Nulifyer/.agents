import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export type ShapeDomain = "api" | "binary" | "code" | "data" | "database" | "document" | "web";
export type ShapeAccess = "declared" | "metadata" | "observed" | "rendered";
export type NameDisclosure = "show" | "hash" | "omit";

export type ShapeLocator =
  | { type: "line"; start: number; end?: number }
  | { type: "byte"; start: number; end?: number }
  | { type: "page"; page: number }
  | { type: "cell"; sheet: string; range?: string }
  | { type: "pointer"; value: string }
  | { type: "dom"; value: string }
  | { type: "catalog"; value: string };

export type ShapeNode = {
  kind: string;
  name?: string;
  label?: string;
  dataType?: string;
  traits?: string[];
  locator?: ShapeLocator;
  children?: ShapeNode[];
};

export type ShapeResult = {
  source: string;
  domain: ShapeDomain;
  format: string;
  access: ShapeAccess;
  nodes: ShapeNode[];
  incomplete?: boolean;
  notes?: string[];
};

export type CommonOptions = {
  maxOutput: number;
  json: boolean;
  names: NameDisclosure;
  source: NameDisclosure;
  labels: boolean;
  access?: ShapeAccess;
};

export type ParsedCommonArgs = {
  options: CommonOptions;
  rest: string[];
};

export const DEFAULT_OUTPUT_CHARS = 800;
const MIN_OUTPUT_CHARS = 120;
const MAX_OUTPUT_CHARS = 100_000;

function integer(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_OUTPUT_CHARS || parsed > MAX_OUTPUT_CHARS) {
    throw new Error(`${flag} must be an integer in ${MIN_OUTPUT_CHARS}-${MAX_OUTPUT_CHARS}`);
  }
  return parsed;
}

export function parseCommonArgs(args: string[]): ParsedCommonArgs {
  const rest: string[] = [];
  let maxOutput = DEFAULT_OUTPUT_CHARS;
  let json = false;
  let names: NameDisclosure = "show";
  let source: NameDisclosure = "show";
  let labels = false;
  let access: ShapeAccess | undefined;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "-j" || argument === "--json") {
      json = true;
    } else if (argument === "-o" || argument === "--max-output") {
      maxOutput = integer(args[++index], argument);
    } else if (argument === "--names") {
      const value = args[++index];
      if (value !== "show" && value !== "hash" && value !== "omit") {
        throw new Error("--names must be show, hash, or omit");
      }
      names = value;
    } else if (argument === "--source") {
      const value = args[++index];
      if (value !== "show" && value !== "hash" && value !== "omit") {
        throw new Error("--source must be show, hash, or omit");
      }
      source = value;
    } else if (argument === "--labels") {
      labels = true;
    } else if (argument === "--access") {
      const value = args[++index];
      if (value !== "declared" && value !== "metadata" && value !== "observed" && value !== "rendered") {
        throw new Error("--access must be declared, metadata, observed, or rendered");
      }
      access = value;
    } else {
      rest.push(argument as string);
    }
  }
  return { options: { maxOutput, json, names, source, labels, access }, rest };
}

export function safeText(value: string, maximum = 100): string {
  const printable = [...value].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("");
  const normalized = printable.replace(/\s+/g, " ").trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, Math.max(0, maximum - 1))}…`;
}

export function disclosedName(value: string | undefined, mode: NameDisclosure): string | undefined {
  if (!value || mode === "omit") return undefined;
  if (mode === "show") return safeText(value);
  return `#${createHash("sha256").update(value).digest("hex").slice(0, 10)}`;
}

const PUBLIC_TYPE_WORDS = new Set([
  "array", "bigint", "bigserial", "bit", "blob", "bool", "boolean", "byte", "bytes", "char", "character",
  "date", "decimal", "double", "enum", "float", "int", "integer", "interval", "json", "jsonb", "long", "map",
  "null", "number", "numeric", "object", "precision", "real", "record", "ref", "serial", "short", "smallint",
  "smallserial", "string", "text", "time", "timestamp", "tinyint", "unknown", "untyped", "uuid", "varchar",
  "varying", "void", "without", "with", "zone",
]);

function dataTypeText(value: string | undefined, mode: NameDisclosure): string {
  if (!value) return "";
  if (mode === "show") return safeText(value, 80);
  return safeText(value, 80).replace(/[A-Za-z_][A-Za-z0-9_]*/g, (word) => {
    if (PUBLIC_TYPE_WORDS.has(word.toLowerCase())) return word;
    return disclosedName(word, mode) ?? "type";
  });
}

function traitText(value: string, mode: NameDisclosure): string {
  const trait = safeText(value, 60);
  if (mode === "show" || !trait.includes("=")) return trait;
  if (/^[^=]+=[+-]?\d+(?:\.\d+)?$/.test(trait)) return trait;
  if (/^range=[A-Z]+\d+(?::[A-Z]+\d+)?$/i.test(trait)) return trait;
  if (/^origin=[cup]$/.test(trait)) return trait;
  if (/^(?:runtime|version)=v?\d+(?:\.\d+)*(?:[-+][A-Za-z0-9.-]+)?$/i.test(trait)) return trait;
  const separator = trait.indexOf("=");
  const key = trait.slice(0, separator);
  const raw = trait.slice(separator + 1);
  if (key === "fk") {
    const disclosed = raw.split(".").map((part) => disclosedName(part, mode)).filter(Boolean);
    return disclosed.length ? `${key}=${disclosed.join(".")}` : key;
  }
  const disclosed = disclosedName(raw, mode);
  return disclosed ? `${key}=${disclosed}` : key;
}

function locatorText(locator: ShapeLocator | undefined, mode: NameDisclosure): string {
  if (!locator) return "";
  if (locator.type === "line") {
    return ` [${locator.start}${locator.end && locator.end !== locator.start ? `-${locator.end}` : ""}]`;
  }
  if (locator.type === "byte") return ` [b${locator.start}${locator.end !== undefined ? `-${locator.end}` : ""}]`;
  if (locator.type === "page") return ` [page ${locator.page}]`;
  if (locator.type === "cell") {
    const sheet = disclosedName(locator.sheet, mode);
    if (!sheet) return locator.range ? ` [cells ${safeText(locator.range, 40)}]` : " [cells]";
    return ` [${sheet}${locator.range ? `!${safeText(locator.range, 40)}` : ""}]`;
  }
  if (mode === "show") return ` [${safeText(locator.value, 140)}]`;
  const value = disclosedName(locator.value, mode);
  return value ? ` [${locator.type} ${safeText(value, 140)}]` : ` [${locator.type}]`;
}

function nodeLine(node: ShapeNode, level: number, options: CommonOptions): string {
  const name = disclosedName(node.name, options.names);
  const label = options.labels ? safeText(node.label ?? "") : "";
  const identity = [name, label && label !== name ? JSON.stringify(label) : ""].filter(Boolean).join(" ");
  const dataType = node.dataType ? ` ${dataTypeText(node.dataType, options.names)}` : "";
  const traits = node.traits?.length ? ` {${node.traits.map((trait) => traitText(trait, options.names)).join(",")}}` : "";
  return `${"  ".repeat(level)}${safeText(node.kind, 30)}${identity ? ` ${identity}` : ""}${dataType}${traits}${locatorText(node.locator, options.names)}`;
}

function allLines(nodes: ShapeNode[], options: CommonOptions, level = 0): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    lines.push(nodeLine(node, level, options));
    lines.push(...allLines(node.children ?? [], options, level + 1));
  }
  return lines;
}

export function renderShape(result: ShapeResult, options: CommonOptions): string {
  const source = disclosedName(result.source, options.source) ?? "<source>";
  const header = `${safeText(source, 160)} ${result.domain} ${result.format} access=${result.access} names=${options.names} source=${options.source}${options.labels ? " labels=show" : ""}`;
  const body = allLines(result.nodes, options);
  const fixedNotes = [
    ...(result.notes ?? []).map((note) => `[${safeText(note, 120)}]`),
    ...(result.incomplete ? ["[incomplete]"] : []),
  ];
  const lines = [header];
  let used = header.length;
  let omitted = false;
  for (const line of body) {
    if (used + line.length + 1 + "\n[more]".length + fixedNotes.join("\n").length > options.maxOutput) {
      omitted = true;
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  if (omitted) lines.push("[more]");
  lines.push(...fixedNotes);
  let text = lines.join("\n");
  while (text.length > options.maxOutput && lines.length > 1) {
    const incompleteIndex = lines.lastIndexOf("[incomplete]");
    const removeIndex = incompleteIndex > 0 ? incompleteIndex - 1 : lines.length - 1;
    lines.splice(removeIndex, 1);
    if (!lines.includes("[more]")) lines.splice(1, 0, "[more]");
    text = lines.join("\n");
  }
  if (!options.json) return text;
  let encoded = JSON.stringify(text);
  while (encoded.length > options.maxOutput && lines.length > 1) {
    const removable = lines.findLastIndex((line, index) => index > 0 && line !== "[more]" && line !== "[incomplete]");
    if (removable < 1) return JSON.stringify("[more]");
    lines.splice(removable, 1);
    if (!lines.includes("[more]")) lines.splice(1, 0, "[more]");
    text = lines.join("\n");
    encoded = JSON.stringify(text);
  }
  return encoded.length <= options.maxOutput ? encoded : JSON.stringify("[more]");
}

export async function readTarget(path: string, virtualName?: string): Promise<{ name: string; bytes: Buffer }> {
  if (path !== "-") return { name: path, bytes: await readFile(path) };
  if (!virtualName) throw new Error("stdin requires a virtual filename");
  return { name: virtualName, bytes: Buffer.from(await Bun.stdin.arrayBuffer()) };
}

export async function runCommand(command: string[]): Promise<string> {
  const process = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(safeText(stderr || `${command[0]} exited ${exitCode}`, 300));
  return stdout;
}

export function lineAt(source: string, index: number): number {
  let line = 1;
  for (let offset = 0; offset < index; offset++) if (source.charCodeAt(offset) === 10) line++;
  return line;
}

export function xmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
