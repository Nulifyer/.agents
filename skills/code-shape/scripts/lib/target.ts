import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
  outputChars,
  rankDirectoryMatches,
  rankSourceMatchFiles,
  sourceMatchesFiles,
  type ShapeOptions,
  type ShapeResult,
  type SourceMatch,
  validateMatchPattern,
} from "./code-shape.ts";
import { shapeFile, UnshapableFileError } from "./file.ts";
import { detectLanguage } from "./languages.ts";

const DIRECTORY_PARSE_BUDGET_MS = 10_000;
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

  const candidatePaths = [...paths].sort();
  const files: ShapeResult[] = [];
  const notes: string[] = [];
  const maxOutput = outputChars(options);
  let shownCount = 0;
  let definitionCount = 0;
  let omittedCount = 0;
  let parseErrors = 0;
  let processedCount = 0;
  let parseLimited = false;
  let outputLimited = false;
  let precomputedMatches: Map<string, SourceMatch[]> | undefined;
  let pathsToProcess = candidatePaths;

  if (options.match !== undefined) {
    const searched = await sourceMatchesFiles(directoryPath, candidatePaths, options.match, signal);
    precomputedMatches = searched.files;
    pathsToProcess = rankSourceMatchFiles(searched.files);
  }

  const deadline = Date.now() + DIRECTORY_PARSE_BUDGET_MS;
  const header = `${displayPath} ${candidatePaths.length} files`;
  let plainOutputChars = header.length + 1;
  for (const relativePath of pathsToProcess) {
    if (signal?.aborted) throw new Error("shape was cancelled");
    if (Date.now() > deadline) {
      parseLimited = true;
      break;
    }
    if (options.match === undefined && plainOutputChars >= maxOutput - "\n[more]".length) {
      outputLimited = true;
      break;
    }
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
          maxOutput: options.match !== undefined
            ? maxOutput
            : Math.max(80, maxOutput - plainOutputChars - "\n[more]".length),
        },
        signal,
        relativePath,
        precomputedMatches?.get(relativePath),
      );
      definitionCount += result.definitionCount;
      omittedCount += result.omittedCount;
      parseErrors += result.parseErrors;
      if (result.shownCount > 0 || (options.match === undefined && result.parseErrors > 0)) {
        if (options.match !== undefined || plainOutputChars + result.text.length + 1 <= maxOutput - "\n[more]".length) {
          files.push(result);
          shownCount += result.shownCount;
          if (options.match === undefined) plainOutputChars += result.text.length + 1;
        } else {
          outputLimited = true;
          break;
        }
      }
    } catch (error) {
      if (error instanceof UnshapableFileError) {
        if (options.match !== undefined) {
          parseLimited = true;
        } else {
          const note = `${relativePath} [${error.reason}]`;
          if (plainOutputChars + note.length + 1 <= maxOutput - "\n[more]".length) {
            notes.push(note);
            plainOutputChars += note.length + 1;
          } else {
            outputLimited = true;
            break;
          }
        }
      } else if (error instanceof Error && error.message.includes("parse budget exceeded")) {
        parseLimited = true;
      } else throw error;
    }
  }

  const omittedFileCount = options.match !== undefined
    ? Math.max(0, pathsToProcess.length - processedCount)
    : Math.max(0, candidatePaths.length - processedCount);
  if (options.match !== undefined) {
    const incomplete = parseLimited || files.some((file) => file.queryLimited);
    const suffix = incomplete ? "\n[incomplete]" : "";
    const ranked = rankDirectoryMatches(files, Math.max(0, maxOutput - suffix.length));
    const body = ranked.lines.join("\n") || "[no match]";
    const ownerLimit = ranked.omittedMatches ? "\n[more]" : "";
    return {
      path: displayPath,
      fileCount: candidatePaths.length,
      shownFileCount: ranked.shownFileCount,
      omittedFileCount,
      definitionCount,
      shownCount: ranked.shownCount,
      omittedCount: ranked.omittedMatches,
      parseErrors,
      focus: "match",
      matchCount: ranked.matchCount,
      omittedMatchCount: ranked.omittedMatches,
      files: ranked.files,
      text: `${body}${ownerLimit}${suffix}`,
    };
  }
  const body = [...files.map((file) => file.text), ...notes].join("\n");
  const empty = options.symbol ? "[no match]" : "[no shape]";
  const limit = outputLimited ? "\n[more]" : "";
  const incomplete = parseLimited ? "\n[incomplete]" : "";
  return {
    path: displayPath,
    fileCount: candidatePaths.length,
    shownFileCount: files.length,
    omittedFileCount,
    definitionCount,
    shownCount,
    omittedCount,
    parseErrors,
    files,
    text: `${header}\n${body || empty}${limit}${incomplete}`,
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
