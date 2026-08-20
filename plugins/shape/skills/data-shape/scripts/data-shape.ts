#!/usr/bin/env bun

import { extname } from "node:path";
import {
  parseCommonArgs,
  readTarget,
  renderShape,
  runCommand,
  type CommonOptions,
  type ShapeNode,
  type ShapeResult,
} from "../../../packages/shape-core/src/index.ts";

const MAX_DEPTH = 8;
const ARRAY_SAMPLE = 64;

function usage(): string {
  return "Usage: data-shape <file> [--no-header] [--names show|hash|omit] [-o <chars>] [-j]\n       data-shape - <name.ext> [options]";
}

function scalarType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function mergedType(values: unknown[]): string {
  const types = [...new Set(values.map(scalarType))].sort();
  return types.join("|") || "unknown";
}

function jsonNode(value: unknown, name: string | undefined, pointer: string, depth: number): ShapeNode {
  const locator = { type: "pointer" as const, value: pointer || "/" };
  if (depth >= MAX_DEPTH) return { kind: "value", name, dataType: scalarType(value), locator, traits: ["depth-limited"] };
  if (Array.isArray(value)) {
    const sample = value.slice(0, ARRAY_SAMPLE);
    if (sample.length === 0) return { kind: "array", name, dataType: "unknown[]", locator };
    if (sample.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) {
      const records = sample as Array<Record<string, unknown>>;
      const keys = [...new Set(records.flatMap((record) => Object.keys(record)))].sort();
      const children = keys.map((key) => {
        const present = records.filter((record) => Object.hasOwn(record, key));
        const values = present.map((record) => record[key]);
        const child = jsonNode(values[0], key, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, depth + 1);
        child.dataType = mergedType(values);
        child.traits = [...(child.traits ?? []), ...(present.length < records.length ? ["optional"] : [])];
        return child;
      });
      return {
        kind: "array",
        name,
        dataType: "object[]",
        locator,
        traits: value.length > ARRAY_SAMPLE ? [`sampled=${ARRAY_SAMPLE}`] : undefined,
        children,
      };
    }
    return {
      kind: "array",
      name,
      dataType: `${mergedType(sample)}[]`,
      locator,
      traits: value.length > ARRAY_SAMPLE ? [`sampled=${ARRAY_SAMPLE}`] : undefined,
      children: sample[0] !== undefined && typeof sample[0] === "object"
        ? [jsonNode(sample[0], "item", `${pointer}/0`, depth + 1)]
        : undefined,
    };
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      kind: "object",
      name,
      locator,
      children: entries.map(([key, child]) =>
        jsonNode(child, key, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, depth + 1)
      ),
    };
  }
  return { kind: "field", name, dataType: scalarType(value), locator };
}

function parseDelimitedRecords(source: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      fields.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index++;
      fields.push(field);
      if (fields.some((value) => value.length > 0)) records.push(fields);
      fields = [];
      field = "";
    } else field += character;
  }
  fields.push(field);
  if (fields.some((value) => value.length > 0)) records.push(fields);
  return records;
}

function textType(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "null";
  if (/^(?:true|false)$/i.test(trimmed)) return "boolean";
  if (/^[+-]?\d+$/.test(trimmed)) return "integer";
  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return "number";
  if (/^\d{4}-\d{2}-\d{2}(?:[T ][^\s]+)?$/.test(trimmed)) return "date-time";
  return "string";
}

function delimitedShape(name: string, source: string, delimiter: string, header: boolean): ShapeResult {
  const parsed = parseDelimitedRecords(source, delimiter).slice(0, ARRAY_SAMPLE + 1);
  if (parsed.length === 0) return { source: name, domain: "data", format: delimiter === "\t" ? "tsv" : "csv", access: "observed", nodes: [] };
  const first = parsed[0] as string[];
  const records = parsed.slice(header ? 1 : 0);
  const columns = first.map((value, index): ShapeNode => {
    const samples = records.map((record) => record[index] ?? "");
    const types = [...new Set(samples.map(textType))].sort();
    return {
      kind: "column",
      name: header ? value : `column_${index + 1}`,
      dataType: types.join("|") || "unknown",
      traits: samples.includes("") ? ["nullable"] : undefined,
      locator: { type: "pointer", value: `/columns/${index}` },
    };
  });
  return {
    source: name,
    domain: "data",
    format: delimiter === "\t" ? "tsv" : "csv",
    access: "observed",
    nodes: [{ kind: "table", traits: records.length >= ARRAY_SAMPLE ? [`sampled=${ARRAY_SAMPLE}`] : undefined, children: columns }],
  };
}

async function unzipEntry(path: string, entry: string): Promise<string> {
  return runCommand(["unzip", "-p", path, entry]);
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
}

async function xlsxShape(path: string): Promise<ShapeResult> {
  const workbook = await unzipEntry(path, "xl/workbook.xml");
  const nodes: ShapeNode[] = [];
  for (const match of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const sheetName = attribute(match[0], "name") ?? "sheet";
    nodes.push({ kind: "sheet", name: sheetName, locator: { type: "cell", sheet: sheetName } });
  }
  const entries = (await runCommand(["unzip", "-Z1", path])).split(/\r?\n/).filter((entry) => /^xl\/tables\/[^/]+\.xml$/.test(entry));
  for (const entry of entries) {
    const table = await unzipEntry(path, entry);
    const open = /<table\b[^>]*>/.exec(table)?.[0] ?? "";
    const tableName = attribute(open, "displayName") ?? attribute(open, "name") ?? entry;
    const range = attribute(open, "ref");
    const children = [...table.matchAll(/<tableColumn\b[^>]*>/g)].map((match, index): ShapeNode => ({
      kind: "column",
      name: attribute(match[0], "name") ?? `column_${index + 1}`,
      locator: { type: "pointer", value: `${entry}#tableColumn/${index + 1}` },
    }));
    nodes.push({ kind: "table", name: tableName, traits: range ? [`range=${range}`] : undefined, locator: { type: "pointer", value: entry }, children });
  }
  return { source: path, domain: "data", format: "xlsx", access: "metadata", nodes };
}

export async function shapeData(path: string, virtualName: string | undefined, header: boolean, options: CommonOptions): Promise<ShapeResult> {
  const name = path === "-" ? virtualName : path;
  if (!name) throw new Error("stdin requires a virtual filename");
  const extension = extname(name).toLowerCase();
  if (extension === ".xlsx") {
    if (path === "-") throw new Error("XLSX stdin is not supported");
    if (options.access && options.access !== "metadata") throw new Error("XLSX currently supports --access metadata only");
    return xlsxShape(path);
  }
  if (options.access && options.access !== "observed") {
    throw new Error(`${extension || "this format"} requires --access observed because its structure is stored in content`);
  }
  const target = await readTarget(path, virtualName);
  const source = target.bytes.toString("utf8");
  if (extension === ".json") {
    const value: unknown = JSON.parse(source);
    return { source: target.name, domain: "data", format: "json", access: "observed", nodes: [jsonNode(value, undefined, "", 0)] };
  }
  if (extension === ".jsonl" || extension === ".ndjson") {
    const lines = source.split(/\r?\n/).filter(Boolean);
    const values = lines.slice(0, ARRAY_SAMPLE).map((line) => JSON.parse(line) as unknown);
    const node = jsonNode(values, undefined, "", 0);
    if (lines.length > ARRAY_SAMPLE) node.traits = [...(node.traits ?? []), `sampled=${ARRAY_SAMPLE}`];
    return {
      source: target.name,
      domain: "data",
      format: "jsonl",
      access: "observed",
      nodes: [node],
      incomplete: lines.length > ARRAY_SAMPLE,
    };
  }
  if (extension === ".csv" || extension === ".tsv") return delimitedShape(target.name, source, extension === ".tsv" ? "\t" : ",", header);
  throw new Error(`Unsupported data format: ${extension || name}`);
}

async function main(): Promise<void> {
  const parsed = parseCommonArgs(process.argv.slice(2));
  if (parsed.rest.includes("--help") || parsed.rest.includes("-h")) {
    console.log(usage());
    return;
  }
  const header = !parsed.rest.includes("--no-header");
  const operands = parsed.rest.filter((argument) => argument !== "--no-header");
  const path = operands[0];
  if (!path) throw new Error("A data file is required");
  const virtualName = path === "-" ? operands[1] : undefined;
  const result = await shapeData(path, virtualName, header, parsed.options);
  process.stdout.write(renderShape(result, parsed.options));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
