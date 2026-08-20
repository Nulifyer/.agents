#!/usr/bin/env bun

import { resolve } from "node:path";
import { DEFAULT_OUTPUT_CHARS, shapeBytes, shapeTarget, type ShapeTargetOptions } from "./lib/index.ts";

type CliOptions = ShapeTargetOptions & {
  path: string;
  json: boolean;
};

function usage(): string {
  return "Usage: shape <path> [glob] [-m <regex> | -s <name> | -l <line>] [-o <chars>] [--docs] [-p] [-j]\n       shape - <name> [-m <regex> | -s <name> | -l <line>] [-o <chars>] [--docs] [-p] [-j]";
}

function integer(value: string | undefined, flag: string, minimum: number, maximum?: number): number {
  const parsed = value === undefined ? Number.NaN : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || (maximum !== undefined && parsed > maximum)) {
    const range = maximum === undefined ? `at least ${minimum}` : `${minimum}-${maximum}`;
    throw new Error(`${flag} must be an integer in ${range}`);
  }
  return parsed;
}

function parseArgs(args: string[]): CliOptions | undefined {
  let path: string | undefined;
  let glob: string | undefined;
  let symbol: string | undefined;
  let line: number | undefined;
  let match: string | undefined;
  let depth: number | undefined;
  let maxOutput: number | undefined;
  let docs = false;
  let params = false;
  let json = false;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return undefined;
    if (argument === "--json" || argument === "-j") {
      json = true;
      continue;
    }
    if (argument === "--docs") {
      docs = true;
      continue;
    }
    if (argument === "--params" || argument === "-p") {
      params = true;
      continue;
    }
    if (argument === "--match" || argument === "-m") {
      match = args[++index];
      if (!match) throw new Error("--match requires a regex");
      continue;
    }
    if (argument === "--symbol" || argument === "-s") {
      symbol = args[++index];
      if (!symbol) throw new Error("--symbol requires a name");
      continue;
    }
    if (argument === "--line" || argument === "-l") {
      line = integer(args[++index], "--line", 1);
      continue;
    }
    if (argument === "--depth") {
      depth = integer(args[++index], "--depth", 0, 12);
      continue;
    }
    if (argument === "--max-output" || argument === "-o") {
      maxOutput = integer(args[++index], "--max-output", 120, 100_000);
      continue;
    }
    if (argument === "-" && !path) {
      path = argument;
      continue;
    }
    if (argument?.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    if (!path) path = argument;
    else if (!glob) glob = argument;
    else throw new Error(`Unexpected argument: ${argument}`);
  }

  if (!path) throw new Error("A file path is required");
  if (path === "-" && !glob) throw new Error("Stdin requires a filename for language detection");
  const focusCount = Number(Boolean(symbol)) + Number(line !== undefined) + Number(match !== undefined);
  if (focusCount > 1) throw new Error("Use only one of --match, --symbol, or --line");
  return { path, glob, symbol, line, match, depth, maxOutput, docs, params, json };
}

function jsonShape(text: string, maxOutput: number): string {
  let value = text;
  let encoded = JSON.stringify(value);
  if (encoded.length <= maxOutput) return encoded;
  const incomplete = value.split("\n").includes("[incomplete]");
  const lines = value.split("\n").filter((line) => line !== "[more]" && line !== "[incomplete]");
  do {
    const suffix = ["[more]", ...(incomplete ? ["[incomplete]"] : [])];
    value = [...lines, ...suffix].join("\n");
    encoded = JSON.stringify(value);
    if (encoded.length <= maxOutput) return encoded;
    lines.pop();
  } while (lines.length > 0);
  return JSON.stringify("[more]");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.log(usage());
    return;
  }

  const { path, json, ...shapeOptions } = options;
  const result = await (async () => {
    if (path !== "-") return shapeTarget(resolve(process.cwd(), path), shapeOptions, undefined, path);
    const { glob, ...sourceOptions } = shapeOptions;
    return shapeBytes(glob as string, Buffer.from(await Bun.stdin.arrayBuffer()), sourceOptions);
  })();
  if (!json) {
    process.stdout.write(result.text);
    return;
  }
  process.stdout.write(jsonShape(result.text, shapeOptions.maxOutput ?? DEFAULT_OUTPUT_CHARS));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
