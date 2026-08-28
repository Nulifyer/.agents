// Lazy Tree-sitter runtime initialization for the unified code adapter.
import { createRequire } from "node:module";
import { Parser } from "web-tree-sitter";

const require = createRequire(import.meta.url);
let initialization: Promise<void> | undefined;

export function initializeTreeSitter(): Promise<void> {
  initialization ??= Parser.init({ locateFile: () => require.resolve("web-tree-sitter/tree-sitter.wasm") });
  return initialization;
}
