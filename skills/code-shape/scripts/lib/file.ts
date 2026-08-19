import { readFile, stat } from "node:fs/promises";
import { shapeSource, type ShapeOptions, type ShapeResult } from "./code-shape.ts";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export async function shapeFile(
  filePath: string,
  options: ShapeOptions = {},
  signal?: AbortSignal,
  displayPath = filePath,
): Promise<ShapeResult> {
  const metadata = await stat(filePath);
  if (!metadata.isFile()) throw new Error(`Not a regular file: ${displayPath}`);
  if (metadata.size > MAX_FILE_BYTES) {
    throw new Error(`File exceeds the ${MAX_FILE_BYTES.toLocaleString()} byte code_shape limit`);
  }

  const source = await readFile(filePath, "utf8");
  if (Buffer.byteLength(source, "utf8") > MAX_FILE_BYTES) {
    throw new Error(`File exceeds the ${MAX_FILE_BYTES.toLocaleString()} byte code_shape limit`);
  }
  return shapeSource(displayPath, source, options, signal);
}
