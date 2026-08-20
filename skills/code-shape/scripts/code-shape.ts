#!/usr/bin/env bun

import { resolve } from "node:path";
import { shapeBytes, shapeTarget, type ShapeTargetOptions } from "./lib/index.ts";

type CliOptions = ShapeTargetOptions & {
  path: string;
  json: boolean;
};

function usage(): string {
  return "Usage: code-shape <path> [glob] [--match <regex> | --symbol <name> | --line <number>] [--docs] [--params]\n       code-shape - <name> [--match <regex> | --symbol <name> | --line <number>] [--docs] [--params]";
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
  let maxItems: number | undefined;
  let docs = false;
  let params = false;
  let json = false;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return undefined;
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--docs") {
      docs = true;
      continue;
    }
    if (argument === "--params") {
      params = true;
      continue;
    }
    if (argument === "--match") {
      match = args[++index];
      if (!match) throw new Error("--match requires a regex");
      continue;
    }
    if (argument === "--symbol") {
      symbol = args[++index];
      if (!symbol) throw new Error("--symbol requires a name");
      continue;
    }
    if (argument === "--line") {
      line = integer(args[++index], "--line", 1);
      continue;
    }
    if (argument === "--depth") {
      depth = integer(args[++index], "--depth", 0, 12);
      continue;
    }
    if (argument === "--max-items") {
      maxItems = integer(args[++index], "--max-items", 1, 500);
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
  return { path, glob, symbol, line, match, depth, maxItems, docs, params, json };
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
    console.log(result.text);
    return;
  }
  const { text: _text, ...structured } = result;
  console.log(JSON.stringify(structured));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
