#!/usr/bin/env bun

import { resolve } from "node:path";
import { shapeFile, type ShapeOptions } from "./lib/index.ts";

type CliOptions = ShapeOptions & {
  path: string;
  json: boolean;
};

function usage(): string {
  return "Usage: code-shape <path> [--symbol <name> | --line <number>] [--depth <number>] [--max-items <number>] [--json]";
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
  let symbol: string | undefined;
  let line: number | undefined;
  let depth: number | undefined;
  let maxItems: number | undefined;
  let json = false;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return undefined;
    if (argument === "--json") {
      json = true;
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
    if (argument?.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    if (path) throw new Error(`Unexpected argument: ${argument}`);
    path = argument;
  }

  if (!path) throw new Error("A file path is required");
  if (symbol && line !== undefined) throw new Error("Use either --symbol or --line, not both");
  return { path, symbol, line, depth, maxItems, json };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.log(usage());
    return;
  }

  const { path, json, ...shapeOptions } = options;
  const result = await shapeFile(resolve(process.cwd(), path), shapeOptions, undefined, path);
  console.log(json ? JSON.stringify(result, null, 2) : result.text);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
  });
}
