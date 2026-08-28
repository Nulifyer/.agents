// Public implementation surface consumed by the unified code adapter.
export {
  DEFAULT_OUTPUT_CHARS,
  MAX_OUTPUT_CHARS,
  shapeSource,
  type CodeSymbol,
  type ShapeKind,
  type ShapeMatch,
  type ShapeOptions,
  type ShapeResult,
} from "./code-shape.ts";
export { MAX_FILE_BYTES, shapeBytes, shapeFile, UnshapableFileError } from "./file.ts";
export { supportedLanguages } from "./languages.ts";
export {
  shapeTarget,
  type DirectoryShapeResult,
  type ShapeTargetOptions,
  type ShapeTargetResult,
} from "./target.ts";
