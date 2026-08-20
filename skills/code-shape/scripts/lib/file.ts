import { readFile, stat } from "node:fs/promises";
import { shapeSource, type ShapeOptions, type ShapeResult } from "./code-shape.ts";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

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

export async function shapeFile(
  filePath: string,
  options: ShapeOptions = {},
  signal?: AbortSignal,
  displayPath = filePath,
): Promise<ShapeResult> {
  const metadata = await stat(filePath);
  if (!metadata.isFile()) throw new Error(`Not a regular file: ${displayPath}`);
  if (metadata.size > MAX_FILE_BYTES) {
    throw new Error(`File exceeds the ${MAX_FILE_BYTES.toLocaleString()} byte shape limit`);
  }

  const bytes = await readFile(filePath);
  const kind = binaryKind(bytes);
  if (kind) throw new UnshapableFileError(kind, displayPath);
  const source = bytes.toString("utf8");
  if (Buffer.byteLength(source, "utf8") > MAX_FILE_BYTES) {
    throw new Error(`File exceeds the ${MAX_FILE_BYTES.toLocaleString()} byte shape limit`);
  }
  return shapeSource(displayPath, source, options, signal);
}
