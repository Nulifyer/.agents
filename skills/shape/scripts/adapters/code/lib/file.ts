// File-boundary policy for the unified code adapter.
import { open, readFile, stat } from "node:fs/promises";
import {
  combineMatchResults,
  outputChars,
  shapeSource,
  sourceMatchesBytes,
  sourceMatchesFile,
  type ShapeOptions,
  type ShapeResult,
  type SourceMatch,
} from "./code-shape.ts";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_MATCH_FILE_BYTES = 128 * 1024 * 1024;
const MATCH_WINDOW_BYTES = [16 * 1024, 128 * 1024, 1024 * 1024] as const;

export class UnshapableFileError extends Error {
  readonly reason: string;

  constructor(reason: string, displayPath: string) {
    super(`${displayPath} [${reason}]`);
    this.reason = reason;
  }
}

function binaryKind(bytes: Buffer): string | undefined {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip";
  if (bytes.subarray(0, 6).equals(Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]))) return "xz";
  if (bytes.subarray(0, 3).toString("ascii") === "BZh") return "bzip2";
  if (bytes.subarray(0, 4).equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))) return "zstd";
  if (bytes.includes(0)) return "binary";
  return undefined;
}

type MatchWindow = {
  start: number;
  end: number;
  matches: SourceMatch[];
};

function rankMatches(matches: SourceMatch[]): SourceMatch[] {
  const ranked = [...matches].sort((left, right) => right.length - left.length || left.startIndex - right.startIndex);
  const selected: SourceMatch[] = [];
  const selectedSet = new Set<SourceMatch>();
  const covered = new Set<number>();
  const take = (match: SourceMatch) => {
    selected.push(match);
    selectedSet.add(match);
    for (const variant of match.variants ?? [0]) covered.add(variant);
  };
  if (ranked[0]) take(ranked[0]);
  const variants = [...new Set(ranked.flatMap((match) => match.variants ?? [0]))].sort((left, right) => left - right);
  for (const variant of variants) {
    if (covered.has(variant)) continue;
    const match = ranked.find((candidate) => !selectedSet.has(candidate) && (candidate.variants ?? [0]).includes(variant));
    if (match) take(match);
  }
  for (const match of ranked) if (!selectedSet.has(match)) selected.push(match);
  return selected;
}

function matchWindows(matches: SourceMatch[], fileSize: number, width: number, maxOutput: number): MatchWindow[] {
  const selected = rankMatches(matches).slice(0, maxOutput);
  const half = Math.floor(width / 2);
  const windows = selected
    .map((match) => ({
      start: Math.max(0, match.startIndex - half),
      end: Math.min(fileSize, match.startIndex + Math.max(match.length, 1) + half),
      matches: [match],
    }))
    .sort((left, right) => left.start - right.start);
  const merged: MatchWindow[] = [];
  for (const window of windows) {
    const previous = merged.at(-1);
    if (!previous || window.start > previous.end) {
      merged.push(window);
      continue;
    }
    previous.end = Math.max(previous.end, window.end);
    previous.matches.push(...window.matches);
  }
  return merged;
}

function expandWindow(window: MatchWindow, fileSize: number, width: number): MatchWindow {
  const matchStart = Math.min(...window.matches.map((match) => match.startIndex));
  const matchEnd = Math.max(...window.matches.map((match) => match.startIndex + Math.max(match.length, 1)));
  const extra = Math.max(0, width - (matchEnd - matchStart));
  return {
    start: Math.max(0, matchStart - Math.floor(extra / 2)),
    end: Math.min(fileSize, matchEnd + Math.ceil(extra / 2)),
    matches: window.matches,
  };
}

function isUtf8Continuation(byte: number | undefined): boolean {
  return byte !== undefined && (byte & 0xc0) === 0x80;
}

function alignUtf8Start(bytes: Buffer, index: number): number {
  while (index > 0 && isUtf8Continuation(bytes[index])) index--;
  return index;
}

function alignUtf8End(bytes: Buffer, index: number): number {
  while (index < bytes.byteLength && isUtf8Continuation(bytes[index])) index++;
  return index;
}

function newlineCount(bytes: Buffer): number {
  let count = 0;
  for (const byte of bytes) if (byte === 0x0a) count++;
  return count;
}

async function shapeLoadedWindow(
  displayPath: string,
  window: MatchWindow,
  loaded: Buffer,
  readStart: number,
  fileSize: number,
  options: ShapeOptions,
  signal?: AbortSignal,
): Promise<ShapeResult> {
  const localStart = alignUtf8Start(loaded, window.start - readStart);
  const localEnd = alignUtf8End(loaded, Math.min(loaded.byteLength, window.end - readStart));
  const sourceBytes = loaded.subarray(localStart, localEnd);
  const byteBase = readStart + localStart;
  const firstMatch = window.matches[0] as SourceMatch;
  const beforeMatch = sourceBytes.subarray(0, Math.max(0, firstMatch.startIndex - byteBase));
  const lineBase = Math.max(0, firstMatch.line - 1 - newlineCount(beforeMatch));
  return shapeSource(displayPath, sourceBytes.toString("utf8"), options, signal, {
    byteBase,
    lineBase,
    matches: window.matches,
    fullLineCount: Math.max(...window.matches.map((match) => match.line)),
    forceByteRanges: true,
    incomplete: byteBase > 0 || byteBase + sourceBytes.byteLength < fileSize,
  });
}

async function shapeFileWindow(
  file: Awaited<ReturnType<typeof open>>,
  displayPath: string,
  window: MatchWindow,
  fileSize: number,
  options: ShapeOptions,
  signal?: AbortSignal,
): Promise<ShapeResult> {
  const readStart = Math.max(0, window.start - 3);
  const readEnd = Math.min(fileSize, window.end + 3);
  const bytes = Buffer.allocUnsafe(readEnd - readStart);
  const { bytesRead } = await file.read(bytes, 0, bytes.byteLength, readStart);
  return shapeLoadedWindow(
    displayPath,
    window,
    bytes.subarray(0, bytesRead),
    readStart,
    fileSize,
    options,
    signal,
  );
}

async function shapeMatchedWindows(
  displayPath: string,
  matches: SourceMatch[],
  fileSize: number,
  options: ShapeOptions,
  shapeWindow: (window: MatchWindow) => Promise<ShapeResult>,
): Promise<ShapeResult> {
  const candidateCapacity = Math.max(1, Math.ceil(outputChars(options) / 8));
  const initialWindows = matchWindows(matches, fileSize, MATCH_WINDOW_BYTES[0], candidateCapacity);
  const results = await Promise.all(initialWindows.map(async (window) => {
    let result = await shapeWindow(window);
    for (const width of MATCH_WINDOW_BYTES.slice(1)) {
      if (!result.matches?.some((match) => match.kind === "file")) break;
      result = await shapeWindow(expandWindow(window, fileSize, width));
    }
    return result;
  }));
  return combineMatchResults(displayPath, results, options, true);
}

async function shapeLargeBytes(
  displayPath: string,
  bytes: Buffer,
  options: ShapeOptions,
  signal?: AbortSignal,
  precomputedMatches?: SourceMatch[],
): Promise<ShapeResult> {
  if (bytes.byteLength > MAX_MATCH_FILE_BYTES) throw new UnshapableFileError("too large", displayPath);
  const matches = precomputedMatches ?? await sourceMatchesBytes(bytes, options.match as string, signal);
  if (matches.length === 0) return shapeSource(displayPath, "", options, signal);
  return shapeMatchedWindows(displayPath, matches, bytes.byteLength, options, async (window) => {
    const readStart = Math.max(0, window.start - 3);
    const readEnd = Math.min(bytes.byteLength, window.end + 3);
    return shapeLoadedWindow(
      displayPath,
      window,
      bytes.subarray(readStart, readEnd),
      readStart,
      bytes.byteLength,
      options,
      signal,
    );
  });
}

async function shapeLargeFile(
  filePath: string,
  fileSize: number,
  displayPath: string,
  options: ShapeOptions,
  signal?: AbortSignal,
  precomputedMatches?: SourceMatch[],
): Promise<ShapeResult> {
  if (fileSize > MAX_MATCH_FILE_BYTES) throw new UnshapableFileError("too large", displayPath);
  const file = await open(filePath, "r");
  try {
    const header = Buffer.allocUnsafe(Math.min(fileSize, 8_192));
    const { bytesRead } = await file.read(header, 0, header.byteLength, 0);
    const kind = binaryKind(header.subarray(0, bytesRead));
    if (kind) throw new UnshapableFileError(kind, displayPath);
    const matches = precomputedMatches ?? await sourceMatchesFile(filePath, options.match as string, signal);
    if (matches.length === 0) return shapeSource(displayPath, "", options, signal);

    return await shapeMatchedWindows(
      displayPath,
      matches,
      fileSize,
      options,
      (window) => shapeFileWindow(file, displayPath, window, fileSize, options, signal),
    );
  } finally {
    await file.close();
  }
}

export async function shapeBytes(
  displayPath: string,
  bytes: Buffer,
  options: ShapeOptions = {},
  signal?: AbortSignal,
  precomputedMatches?: SourceMatch[],
): Promise<ShapeResult> {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    if (options.match !== undefined) {
      const kind = binaryKind(bytes.subarray(0, 8_192));
      if (kind) throw new UnshapableFileError(kind, displayPath);
      return shapeLargeBytes(displayPath, bytes, options, signal, precomputedMatches);
    }
    throw new Error(`Input exceeds the ${MAX_FILE_BYTES.toLocaleString()} byte shape limit`);
  }
  const kind = binaryKind(bytes);
  if (kind) throw new UnshapableFileError(kind, displayPath);
  const source = bytes.toString("utf8");
  return shapeSource(
    displayPath,
    source,
    options,
    signal,
    precomputedMatches
      ? { byteBase: 0, lineBase: 0, matches: precomputedMatches }
      : undefined,
  );
}

export async function shapeFile(
  filePath: string,
  options: ShapeOptions = {},
  signal?: AbortSignal,
  displayPath = filePath,
  precomputedMatches?: SourceMatch[],
): Promise<ShapeResult> {
  const metadata = await stat(filePath);
  if (!metadata.isFile()) throw new Error(`Not a regular file: ${displayPath}`);
  if (metadata.size > MAX_FILE_BYTES) {
    if (options.match !== undefined) {
      return shapeLargeFile(filePath, metadata.size, displayPath, options, signal, precomputedMatches);
    }
    throw new Error(`File exceeds the ${MAX_FILE_BYTES.toLocaleString()} byte shape limit`);
  }

  return shapeBytes(displayPath, await readFile(filePath), options, signal, precomputedMatches);
}
