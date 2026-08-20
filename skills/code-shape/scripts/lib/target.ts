import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { type ShapeOptions, type ShapeResult, validateMatchPattern } from "./code-shape.ts";
import { shapeFile, UnshapableFileError } from "./file.ts";
import { detectLanguage } from "./languages.ts";

const DEFAULT_DIRECTORY_ITEMS = 200;
const MAX_DOCS_PER_DIRECTORY = 40;
const MAX_MATCHES_PER_DIRECTORY = 12;
const MAX_DIRECTORY_FILES = 100;
const DIRECTORY_BUDGET_MS = 5_000;
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor",
]);

export type ShapeTargetOptions = ShapeOptions & {
  glob?: string;
};

export type DirectoryShapeResult = {
  path: string;
  fileCount: number;
  shownFileCount: number;
  omittedFileCount: number;
  definitionCount: number;
  shownCount: number;
  omittedCount: number;
  parseErrors: number;
  focus?: "match";
  matchCount?: number;
  omittedMatchCount?: number;
  files: ShapeResult[];
  text: string;
};

export type ShapeTargetResult = ShapeResult | DirectoryShapeResult;

function splitGlobs(value: string): string[] {
  const patterns: string[] = [];
  let start = 0;
  let depth = 0;
  let escaped = false;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "{" || character === "[") depth++;
    if (character === "}" || character === "]") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      patterns.push(value.slice(start, index));
      start = index + 1;
    }
  }
  patterns.push(value.slice(start));
  return patterns.map((pattern) => pattern.trim()).filter(Boolean);
}

function ignored(path: string): boolean {
  return path.split("/").some((part) => IGNORED_DIRECTORIES.has(part));
}

async function shapeDirectory(
  directoryPath: string,
  displayPath: string,
  options: ShapeTargetOptions,
  signal?: AbortSignal,
): Promise<DirectoryShapeResult> {
  if (options.line !== undefined) throw new Error("--line requires a file path");
  if (options.docs && !options.symbol && options.match === undefined) {
    throw new Error("docs on a folder requires an exact symbol or match");
  }
  if (options.params && !options.symbol && options.match === undefined) {
    throw new Error("params on a folder requires an exact symbol or match");
  }
  if (options.match !== undefined) await validateMatchPattern(options.match, signal);
  const patterns = splitGlobs(options.glob ?? "**/*");
  if (patterns.length === 0) throw new Error("glob must not be empty");

  const paths = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for (const match of glob.scanSync({ cwd: directoryPath, onlyFiles: true, followSymlinks: false })) {
      const relativePath = match.replaceAll("\\", "/");
      if (!ignored(relativePath) && detectLanguage(relativePath, "")) paths.add(relativePath);
    }
  }

  const matches = [...paths].sort();
  const files: ShapeResult[] = [];
  const notes: string[] = [];
  const deadline = Date.now() + DIRECTORY_BUDGET_MS;
  const detailed = options.docs || options.params;
  const defaultItems = options.match !== undefined
    ? MAX_MATCHES_PER_DIRECTORY
    : detailed
      ? MAX_DOCS_PER_DIRECTORY
      : DEFAULT_DIRECTORY_ITEMS;
  const maxItems = Math.max(
    1,
    Math.min(
      options.maxItems ?? defaultItems,
      options.match !== undefined ? MAX_MATCHES_PER_DIRECTORY : detailed ? MAX_DOCS_PER_DIRECTORY : 500,
    ),
  );
  let shownCount = 0;
  let definitionCount = 0;
  let omittedCount = 0;
  let parseErrors = 0;
  let processedCount = 0;

  for (const relativePath of matches.slice(0, MAX_DIRECTORY_FILES)) {
    if (signal?.aborted) throw new Error("shape was cancelled");
    if (Date.now() > deadline || (options.match === undefined && shownCount >= maxItems)) break;
    processedCount++;
    try {
      const result = await shapeFile(
        resolve(directoryPath, relativePath),
        {
          symbol: options.symbol,
          match: options.match,
          docs: options.docs,
          params: options.params,
          depth: options.depth ?? 2,
          maxItems: options.match !== undefined ? maxItems : Math.min(40, maxItems - shownCount),
        },
        signal,
        relativePath,
      );
      definitionCount += result.definitionCount;
      omittedCount += result.omittedCount;
      parseErrors += result.parseErrors;
      if (result.shownCount > 0 || (options.match === undefined && result.parseErrors > 0)) {
        files.push(result);
        shownCount += result.shownCount;
      }
    } catch (error) {
      if (error instanceof UnshapableFileError) notes.push(`${relativePath} [${error.reason}]`);
      else throw error;
    }
  }

  const omittedFileCount = Math.max(0, matches.length - processedCount);
  if (options.match !== undefined) {
    const candidateLines = files.flatMap((file) => file.text.split("\n").slice(0, file.shownCount));
    const selectedLines = candidateLines.slice(0, maxItems);
    const matchCount = files.reduce((count, file) => count + (file.matchCount ?? 0), 0);
    const omittedMatches = Math.max(0, matchCount - selectedLines.length);
    let remaining = selectedLines.length;
    let shownFileCount = 0;
    for (const file of files) {
      if (remaining <= 0) break;
      if (file.shownCount > 0) shownFileCount++;
      remaining -= Math.min(remaining, file.shownCount);
    }
    const body = selectedLines.join("\n") || "[no match]";
    const ownerLimit = omittedMatches ? `\n[+${omittedMatches} owners]` : "";
    const fileLimit = omittedFileCount ? `\n[+${omittedFileCount} files]` : "";
    const errors = parseErrors ? `\n[errors=${parseErrors}]` : "";
    const incomplete = files.some((file) => file.queryLimited) ? "\n[incomplete]" : "";
    return {
      path: displayPath,
      fileCount: matches.length,
      shownFileCount,
      omittedFileCount,
      definitionCount,
      shownCount: selectedLines.length,
      omittedCount: omittedMatches,
      parseErrors,
      focus: "match",
      matchCount,
      omittedMatchCount: omittedMatches,
      files,
      text: `${body}${ownerLimit}${fileLimit}${errors}${incomplete}`,
    };
  }
  const body = [...files.map((file) => file.text), ...notes].join("\n");
  const empty = options.symbol ? "[no match]" : "[no shape]";
  const limit = omittedFileCount ? `\n[+${omittedFileCount} files]` : "";
  return {
    path: displayPath,
    fileCount: matches.length,
    shownFileCount: files.length,
    omittedFileCount,
    definitionCount,
    shownCount,
    omittedCount,
    parseErrors,
    files,
    text: `${displayPath} ${matches.length} files\n${body || empty}${limit}`,
  };
}

export async function shapeTarget(
  targetPath: string,
  options: ShapeTargetOptions = {},
  signal?: AbortSignal,
  displayPath = targetPath,
): Promise<ShapeTargetResult> {
  const focusCount =
    Number(Boolean(options.symbol)) + Number(options.line !== undefined) + Number(options.match !== undefined);
  if (focusCount > 1) throw new Error("Use only one of symbol, line, or match focus");
  const absolutePath = isAbsolute(targetPath) ? targetPath : resolve(targetPath);
  const metadata = await stat(absolutePath);
  if (metadata.isFile()) {
    if (options.glob) throw new Error("glob requires a directory path");
    return shapeFile(absolutePath, options, signal, displayPath);
  }
  if (metadata.isDirectory()) return shapeDirectory(absolutePath, displayPath, options, signal);
  throw new Error(`Not a regular file or directory: ${displayPath}`);
}
