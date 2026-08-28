// Internal source-code implementation for the unified shape adapter registry.
import { type Node as SyntaxNode, Parser, Query } from "web-tree-sitter";
import { detectLanguage, loadShapeLanguage, supportedLanguages } from "./languages.ts";

export const DEFAULT_OUTPUT_CHARS = 800;
export const MAX_OUTPUT_CHARS = 100_000;
const MAX_DOC_CHARS = 200;
const MAX_MATCH_PATTERN_CHARS = 500;
const RG_BATCH_FILES = 400;
const MAX_PARAMETERS_PER_SYMBOL = 12;
const MAX_QUERY_CAPTURES = 100_000;
const PARSE_BUDGET_MS = 2_000;

type SymbolKind =
  | "class"
  | "constant"
  | "constructor"
  | "enum"
  | "field"
  | "function"
  | "implementation"
  | "interface"
  | "macro"
  | "method"
  | "module"
  | "namespace"
  | "object"
  | "property"
  | "section"
  | "selector"
  | "struct"
  | "trait"
  | "type"
  | "key"
  | "element";

export type ShapeKind = "elem" | "fn" | "impl" | "key" | "mod" | "prop" | "sec" | "sel" | "type" | "var";

const SHAPE_KIND: Record<SymbolKind, ShapeKind> = {
  class: "type",
  constant: "var",
  constructor: "fn",
  element: "elem",
  enum: "type",
  field: "prop",
  function: "fn",
  implementation: "impl",
  interface: "type",
  key: "key",
  macro: "fn",
  method: "fn",
  module: "mod",
  namespace: "mod",
  object: "type",
  property: "prop",
  section: "sec",
  selector: "sel",
  struct: "type",
  trait: "type",
  type: "type",
};

export type CodeSymbol = {
  kind: ShapeKind;
  name: string;
  startLine: number;
  endLine: number;
  doc?: string;
  parameters?: string[];
  omittedParameterCount?: number;
  children: CodeSymbol[];
};

type IndexedSymbol = {
  kind: SymbolKind;
  name: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  startIndex: number;
  endIndex: number;
  doc?: string;
  parameters?: string[];
  omittedParameterCount?: number;
  children: IndexedSymbol[];
};

export type ShapeResult = {
  path: string;
  language: string;
  lineCount: number;
  parseErrors: number;
  definitionCount: number;
  shownCount: number;
  omittedCount: number;
  queryLimited: boolean;
  focus?: string;
  docCount?: number;
  omittedDocCount?: number;
  matchCount?: number;
  omittedMatchCount?: number;
  matches?: ShapeMatch[];
  symbols: CodeSymbol[];
  text: string;
};

export type ShapeMatch = {
  path: string;
  line: number;
  kind: ShapeKind | "file";
  name?: string;
  startLine?: number;
  endLine?: number;
  doc?: string;
  parameters?: string[];
  omittedParameterCount?: number;
};

export type ShapeOptions = {
  symbol?: string;
  line?: number;
  match?: string;
  depth?: number;
  maxOutput?: number;
  docs?: boolean;
  params?: boolean;
};

export type ShapeSourceContext = {
  byteBase: number;
  lineBase: number;
  matches: SourceMatch[];
  fullLineCount?: number;
  forceByteRanges?: boolean;
  incomplete?: boolean;
};

function logicalLineCount(source: string): number {
  if (!source) return 0;
  const newlines = source.match(/\n/g)?.length ?? 0;
  return newlines + (source.endsWith("\n") ? 0 : 1);
}

function shouldUseByteRanges(source: string): boolean {
  const bytes = Buffer.from(source);
  if (bytes.byteLength < 200) return false;
  let longest = 0;
  let lineStart = 0;
  for (let index = 0; index < bytes.byteLength; index++) {
    if (bytes[index] !== 0x0a) continue;
    longest = Math.max(longest, index - lineStart);
    lineStart = index + 1;
  }
  longest = Math.max(longest, bytes.byteLength - lineStart);
  return longest === bytes.byteLength || (longest >= 4_096 && longest / bytes.byteLength >= 0.8);
}

export type SourceMatch = {
  startIndex: number;
  length: number;
  line: number;
  text?: string;
  variants?: number[];
};

type RipgrepMatch = {
  type: "match";
  data: {
    absolute_offset: number;
    line_number: number;
    path?: { text?: string };
    submatches: Array<{ start: number; end: number; match?: { text?: string } }>;
  };
};

export type DirectorySourceMatches = {
  files: Map<string, SourceMatch[]>;
};

function validateMatch(pattern: string, signal?: AbortSignal): void {
  if (!pattern) throw new Error("--match requires a regex");
  if (pattern.length > MAX_MATCH_PATTERN_CHARS) {
    throw new Error(`--match regex exceeds ${MAX_MATCH_PATTERN_CHARS} characters`);
  }
  if (signal?.aborted) throw new Error("shape was cancelled");
}

function splitRegexAlternatives(pattern: string): string[] {
  const alternatives: string[] = [];
  let start = 0;
  let depth = 0;
  let inClass = false;
  let escaped = false;
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "[" && !inClass) inClass = true;
    else if (character === "]" && inClass) inClass = false;
    else if (!inClass && character === "(") depth++;
    else if (!inClass && character === ")") depth = Math.max(0, depth - 1);
    else if (!inClass && depth === 0 && character === "|") {
      alternatives.push(pattern.slice(start, index));
      start = index + 1;
    }
  }
  alternatives.push(pattern.slice(start));
  const values = alternatives.map((value) => value.trim()).filter(Boolean);
  return values.length > 1 ? values : [pattern];
}

function variantClassifier(alternatives: string[]): (text: string | undefined) => number[] {
  const expressions = alternatives.map((alternative) => {
    try {
      return new RegExp(alternative, "iu");
    } catch {
      return undefined;
    }
  });
  return (text) => {
    if (text === undefined) return [0];
    const variants = expressions.flatMap((expression, index) => expression?.test(text) ? [index] : []);
    return variants.length ? variants : [0];
  };
}

async function* ripgrepEvents(
  args: string[],
  pattern: string,
  signal?: AbortSignal,
  stdin?: Buffer,
  cwd?: string,
): AsyncGenerator<RipgrepMatch> {
  validateMatch(pattern, signal);
  const process = (() => {
    try {
      return Bun.spawn(
        [
          "rg",
          "--json",
          "--only-matching",
          "--ignore-case",
          "-e",
          pattern,
          ...args,
        ],
        {
          ...(stdin ? { stdin } : {}),
          ...(cwd ? { cwd } : {}),
          stdout: "pipe",
          stderr: "pipe",
          signal,
        },
      );
    } catch {
      throw new Error("--match requires ripgrep (rg)");
    }
  })();

  const stderrPromise = new Response(process.stderr).text();
  const reader = process.stdout.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    let newline = pending.indexOf("\n");
    while (newline >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      if (line) {
        const event = JSON.parse(line) as { type: string } | RipgrepMatch;
        if (event.type === "match") yield event as RipgrepMatch;
      }
      newline = pending.indexOf("\n");
    }
  }
  pending += decoder.decode();
  if (pending) {
    const event = JSON.parse(pending) as { type: string } | RipgrepMatch;
    if (event.type === "match") yield event as RipgrepMatch;
  }
  const [exitCode, stderr] = await Promise.all([process.exited, stderrPromise]);
  if (signal?.aborted) throw new Error("shape was cancelled");
  if (exitCode === 1) return;
  if (exitCode !== 0) {
    const reason = stderr
      .trim()
      .split("\n")
      .findLast((line) => line.trim().startsWith("error:"))
      ?.replace(/^error:\s*/, "");
    throw new Error(`Invalid --match regex${reason ? `: ${reason}` : ""}`);
  }
}

async function ripgrepMatches(
  args: string[],
  pattern: string,
  signal?: AbortSignal,
  stdin?: Buffer,
): Promise<SourceMatch[]> {
  const matches = new Map<string, SourceMatch>();
  const classify = variantClassifier(splitRegexAlternatives(pattern));
  for await (const match of ripgrepEvents(args, pattern, signal, stdin)) {
    for (const submatch of match.data.submatches) {
      const startIndex = match.data.absolute_offset + submatch.start;
      const length = submatch.end - submatch.start;
      const key = `${startIndex}:${length}`;
      const text = submatch.match?.text;
      const existing = matches.get(key);
      if (existing) {
        existing.variants = [...new Set([...(existing.variants ?? []), ...classify(text)])];
        continue;
      }
      matches.set(key, {
        startIndex,
        length,
        line: match.data.line_number,
        text,
        variants: classify(text),
      });
    }
  }
  return [...matches.values()];
}

export async function sourceMatchesFiles(
  directoryPath: string,
  paths: string[],
  pattern: string,
  signal?: AbortSignal,
): Promise<DirectorySourceMatches> {
  validateMatch(pattern, signal);
  const files = new Map<string, SourceMatch[]>();
  const matchIndex = new Map<string, Map<string, SourceMatch>>();
  const alternatives = splitRegexAlternatives(pattern);
  const classify = variantClassifier(alternatives);
  for (let start = 0; start < paths.length; start += RG_BATCH_FILES) {
    const batch = paths.slice(start, start + RG_BATCH_FILES);
    for await (const result of ripgrepEvents(["--", ...batch], pattern, signal, undefined, directoryPath)) {
      const path = result.data.path?.text?.replaceAll("\\", "/").replace(/^\.\/+/, "");
      if (!path) continue;
      let matches = files.get(path);
      if (!matches) {
        matches = [];
        files.set(path, matches);
        matchIndex.set(path, new Map());
      }
      const indexed = matchIndex.get(path) as Map<string, SourceMatch>;
      for (const submatch of result.data.submatches) {
        const startIndex = result.data.absolute_offset + submatch.start;
        const length = submatch.end - submatch.start;
        const key = `${startIndex}:${length}`;
        const text = submatch.match?.text;
        const variants = classify(text);
        const existing = indexed.get(key);
        if (existing) {
          existing.variants = [...new Set([...(existing.variants ?? []), ...variants])];
          continue;
        }
        const sourceMatch = { startIndex, length, line: result.data.line_number, text, variants };
        matches.push(sourceMatch);
        indexed.set(key, sourceMatch);
      }
    }
  }
  return { files };
}

export function rankSourceMatchFiles(files: Map<string, SourceMatch[]>): string[] {
  return [...files]
    .sort(([leftPath, leftMatches], [rightPath, rightMatches]) => {
      const leftSpan = Math.max(...leftMatches.map((match) => match.length));
      const rightSpan = Math.max(...rightMatches.map((match) => match.length));
      const leftVariants = new Set(leftMatches.flatMap((match) => match.variants ?? [0])).size;
      const rightVariants = new Set(rightMatches.flatMap((match) => match.variants ?? [0])).size;
      return rightVariants - leftVariants ||
        pathScore(rightPath) - pathScore(leftPath) ||
        rightSpan - leftSpan ||
        rightMatches.length - leftMatches.length ||
        leftPath.localeCompare(rightPath);
    })
    .map(([path]) => path);
}

async function sourceMatches(source: string, pattern: string, signal?: AbortSignal): Promise<SourceMatch[]> {
  return ripgrepMatches(["-"], pattern, signal, Buffer.from(source));
}

export async function sourceMatchesBytes(
  bytes: Buffer,
  pattern: string,
  signal?: AbortSignal,
): Promise<SourceMatch[]> {
  return ripgrepMatches(["-"], pattern, signal, bytes);
}

export async function sourceMatchesFile(
  filePath: string,
  pattern: string,
  signal?: AbortSignal,
): Promise<SourceMatch[]> {
  return ripgrepMatches(["--", filePath], pattern, signal);
}

export async function validateMatchPattern(pattern: string, signal?: AbortSignal): Promise<void> {
  await sourceMatches("", pattern, signal);
}

function trimDoc(text: string): string | undefined {
  const summary = text.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? text;
  const lines: string[] = [];
  for (const rawLine of summary.replaceAll("\r", "").split("\n")) {
    let line = rawLine
      .replace(/^\s*\/\*\*?\s?/, "")
      .replace(/\s*\*\/\s*$/, "")
      .replace(/^\s*\*\s?/, "")
      .replace(/^\s*(?:\/\/[/!]?|--\s*\||--|---+|;;;+|##|#)\s?/, "")
      .trim();
    const proseTag = line.match(/^@(?:dev|notice|summary|description)\b\s*(.*)$/i);
    if (proseTag) line = proseTag[1]?.trim() ?? "";
    else if (/^(?:@\w+|<(?:param|returns?|remarks?|example|exception|typeparam)\b)/i.test(line)) break;
    if (!line && lines.length > 0) break;
    if (line) lines.push(line);
  }
  const value = lines
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return undefined;
  if (value.length <= MAX_DOC_CHARS) return value;
  const clipped = value.slice(0, MAX_DOC_CHARS + 1);
  const boundary = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("; "), clipped.lastIndexOf(" "));
  return `${clipped.slice(0, boundary > MAX_DOC_CHARS / 2 ? boundary + 1 : MAX_DOC_CHARS).trim()}...`;
}

function leadingDoc(item: SyntaxNode, language: string, source: string): string | undefined {
  const before = source.slice(Math.max(0, item.startIndex - 8_000), item.startIndex);
  const blockStart = before.lastIndexOf("/**");
  const block = blockStart >= 0
    ? before.slice(blockStart).match(/^\/\*\*([\s\S]*?)\*\/[ \t]*(?:\r?\n[ \t]*)?$/)
    : undefined;
  if (block?.[1]) return trimDoc(block[1]);

  if (language === "julia") {
    const string = before.match(/(?:^|\n)\s*(?:raw)?("""|''')([\s\S]*?)\1[ \t]*(?:\r?\n[ \t]*)?$/);
    if (string?.[2]) return trimDoc(string[2]);
  }

  const prefixes: Partial<Record<string, RegExp>> = {
    bash: /^\s*##\s?/,
    csharp: /^\s*\/\/\/\s?/,
    dart: /^\s*\/\/\/\s?/,
    elisp: /^\s*;;;+\s?/,
    go: /^\s*\/\/\s?/,
    haskell: /^\s*--(?:\s*\|)?\s?/,
    lua: /^\s*---+\s?/,
    "objective-c": /^\s*\/\/\/\s?/,
    razor: /^\s*\/\/\/\s?/,
    rescript: /^\s*\/\/\/\s?/,
    ruby: /^\s*#\s?/,
    rust: /^\s*\/\/[/!]\s?/,
    scala: /^\s*\/\/\/\s?/,
    solidity: /^\s*\/\/\/\s?/,
    swift: /^\s*\/\/\/\s?/,
    systemverilog: /^\s*\/\/\/\s?/,
    typescript: /^\s*\/\/\/\s?/,
    tsx: /^\s*\/\/\/\s?/,
  };
  const prefix = prefixes[language];
  if (!prefix) return undefined;
  const sourceLines = source.slice(0, item.startIndex).replaceAll("\r", "").split("\n");
  if (sourceLines.at(-1) === "") sourceLines.pop();
  const collected: string[] = [];
  for (let index = sourceLines.length - 1; index >= 0; index--) {
    const line = sourceLines[index] as string;
    if (!prefix.test(line)) break;
    collected.unshift(line.replace(prefix, ""));
  }
  return collected.length ? trimDoc(collected.join("\n")) : undefined;
}

function pythonDoc(definition: SyntaxNode): string | undefined {
  const body = definition.childForFieldName("body");
  const first = body?.namedChildren[0];
  if (first?.type !== "expression_statement") return undefined;
  const string = firstDescendant(first, ["string", "concatenated_string"]);
  if (!string) return undefined;
  const match = string.text.match(/^[rubf]*("""|''')([\s\S]*?)\1$/i);
  return match?.[2] ? trimDoc(match[2]) : undefined;
}

function elispDoc(definition: SyntaxNode): string | undefined {
  const docstring = definition.childForFieldName("docstring")?.text;
  if (!docstring) return undefined;
  return trimDoc(docstring.replace(/^"|"$/g, "").replaceAll("\\n", "\n"));
}

function documentationFor(item: SyntaxNode, definition: SyntaxNode, language: string, source: string): string | undefined {
  if (language === "python") return pythonDoc(definition) ?? leadingDoc(item, language, source);
  if (language === "elisp") return elispDoc(definition) ?? leadingDoc(item, language, source);
  return leadingDoc(item, language, source);
}

const PARAMETER_CONTAINERS = new Set([
  "argument_list",
  "formal_parameter_list",
  "formal_parameters",
  "function_value_parameters",
  "list",
  "method_parameters",
  "parameter_list",
  "parameters",
  "patterns",
  "tf_port_list",
]);

const PARAMETER_WRAPPERS = new Set([
  "optional_formal_parameters",
  "parameters",
  "required_formal_parameters",
]);

const PARAMETER_IDENTIFIER_TYPES = new Set([
  "field_identifier",
  "identifier",
  "name",
  "self",
  "simple_identifier",
  "symbol",
  "value_identifier",
  "value_name",
  "value_pattern",
  "variable",
  "variable_name",
]);

function parameterNodes(definition: SyntaxNode, language: string): SyntaxNode[] | undefined {
  const direct =
    definition.childForFieldName("parameters") ??
    definition.childForFieldName("patterns") ??
    (language === "julia" ? firstDescendant(definition, "argument_list") : undefined) ??
    firstDescendant(definition, [...PARAMETER_CONTAINERS].filter((type) => type !== "argument_list"));

  if (direct) {
    const children: SyntaxNode[] = [];
    for (const child of direct.namedChildren) {
      if (!child) continue;
      if (PARAMETER_WRAPPERS.has(child.type)) {
        children.push(...child.namedChildren.filter((item): item is SyntaxNode => item !== null));
      } else {
        children.push(child);
      }
    }
    return children;
  }

  const single = firstDescendant(definition, "arrow_function")?.childForFieldName("parameter");
  if (single) return [single];

  if (language === "rescript") {
    const parameter = firstDescendant(definition, "function")?.childForFieldName("parameter");
    if (parameter) return [parameter];
  }

  if (language === "ocaml") {
    const binding = firstDescendant(definition, "let_binding");
    const parameters = binding?.namedChildren.filter(
      (child): child is SyntaxNode => child !== null && child.type === "parameter",
    );
    if (parameters?.length) return parameters;
  }

  if (language === "objective-c") {
    const parameters = definition.namedChildren.filter(
      (child): child is SyntaxNode => child !== null && child.type === "method_parameter",
    );
    if (parameters.length) return parameters;
  }

  if (["solidity", "swift", "tlaplus"].includes(language)) {
    const fields = definition.childrenForFieldName("parameter").filter((child): child is SyntaxNode => child !== null);
    if (fields.length) return fields;
    return definition.namedChildren.filter((child): child is SyntaxNode => child !== null && child.type === "parameter");
  }
  return undefined;
}

function parameterIdentifiers(node: SyntaxNode): string[] {
  if (PARAMETER_IDENTIFIER_TYPES.has(node.type)) {
    const name = node.text.trim().replace(/^[$@]+/, "");
    return /^[\p{L}_][\p{L}\p{N}_$-]*$/u.test(name) ? [name] : [];
  }
  const direct = node.namedChildren.filter(
    (child): child is SyntaxNode => child !== null && PARAMETER_IDENTIFIER_TYPES.has(child.type),
  );
  const candidates = direct.length
    ? direct
    : node.descendantsOfType([...PARAMETER_IDENTIFIER_TYPES]).filter((child): child is SyntaxNode => child !== null);
  return candidates
    .map((candidate) => candidate.text.trim().replace(/^[$@]+/, ""))
    .filter((name) => /^[\p{L}_][\p{L}\p{N}_$-]*$/u.test(name));
}

function parameterNames(definition: SyntaxNode, language: string): { names: string[]; omitted: number } | undefined {
  const nodes = parameterNodes(definition, language);
  if (!nodes) return undefined;

  const names: string[] = [];
  let elispRest = false;
  for (const node of nodes) {
    if (language === "elisp" && node.type === "symbol" && node.text.startsWith("&")) {
      elispRest = node.text === "&rest";
      continue;
    }
    if (/^(?:comment|default_value|number_literal|operator|primitive_type|type_annotation|type_identifier|user_type)$/.test(node.type)) continue;

    const binding =
      node.childForFieldName("name") ??
      node.childForFieldName("pattern") ??
      node.childForFieldName("declarator") ??
      node;
    const destructured = /(?:array|dictionary|list|object|record|struct|tuple)_pattern/.test(binding.type)
      ? /(?:object|dictionary|record|struct)/.test(binding.type)
        ? "{}"
        : "[]"
      : undefined;
    const rest = elispRest || /(?:rest|spread|splat|vararg|variadic)/.test(`${node.type} ${binding.type}`);
    const found = destructured ? [destructured] : parameterIdentifiers(binding);
    const selected = language === "swift" && found.length > 1
      ? [found.at(-1) as string]
      : language === "julia" && found.length > 1
        ? [found[0] as string]
        : found;
    if (selected.length === 0 && rest) names.push("...");
    else names.push(...selected.map((name) => (rest && name !== "..." ? `...${name}` : name)));
    elispRest = false;
  }

  return {
    names: names.slice(0, MAX_PARAMETERS_PER_SYMBOL),
    omitted: Math.max(0, names.length - MAX_PARAMETERS_PER_SYMBOL),
  };
}

function inclusiveEndLine(node: SyntaxNode): number {
  const start = node.startPosition.row + 1;
  const end = node.endPosition.row + (node.endPosition.column > 0 ? 1 : 0);
  return Math.max(start, end);
}

function firstDescendant(node: SyntaxNode, types: string | string[]): SyntaxNode | undefined {
  return node.descendantsOfType(types).find((candidate): candidate is SyntaxNode => candidate !== null);
}

function ancestor(node: SyntaxNode, types: Set<string>): SyntaxNode | undefined {
  let current = node.parent;
  while (current) {
    if (types.has(current.type)) return current;
    current = current.parent;
  }
  return undefined;
}

function expandedNode(node: SyntaxNode, language: string): SyntaxNode {
  let current = node;
  if (language === "python" && current.parent?.type === "decorated_definition") current = current.parent;
  if (["typescript", "tsx", "javascript", "jsx"].includes(language)) {
    if (current.type === "variable_declarator" && /^(?:lexical|variable)_declaration$/.test(current.parent?.type ?? "")) {
      current = current.parent as SyntaxNode;
    }
    if (current.parent?.type === "export_statement") current = current.parent;
  }
  if (language === "go" && current.type === "type_spec" && current.parent?.type === "type_declaration") {
    current = current.parent;
  }
  if (language === "dart" && /_signature$/.test(current.type)) {
    while (current.parent && ["method_signature", "declaration"].includes(current.parent.type)) current = current.parent;
  }
  if (["c", "cpp", "objective-c"].includes(language) && current.parent?.type === "type_definition") {
    current = current.parent;
  }
  return current;
}

function cleanName(text: string): string {
  return text.trim().replace(/^(?:["']|\[\[?)/, "").replace(/(?:["']|\]\]?)$/, "");
}

function firstNamedChild(node: SyntaxNode): SyntaxNode | undefined {
  return node.namedChildren.find((child): child is SyntaxNode => child !== null);
}

function htmlName(node: SyntaxNode): string | undefined {
  const opening = node.text.match(/^<([\w:-]+)([^>]*)>/);
  const tag = firstDescendant(node, "tag_name")?.text ?? opening?.[1];
  if (!tag) return undefined;
  const startTag = firstDescendant(node, ["start_tag", "self_closing_tag"]);
  const attributes = startTag?.descendantsOfType("attribute") ?? [];
  let suffix = "";
  for (const attribute of attributes) {
    if (!attribute) continue;
    const name = firstDescendant(attribute, "attribute_name")?.text;
    const value = firstDescendant(attribute, "attribute_value")?.text;
    if (name === "id" && value) suffix += `#${value}`;
    if (name === "class" && value) suffix += value.split(/\s+/).filter(Boolean).map((item) => `.${item}`).join("");
  }
  if (attributes.length === 0 && opening?.[2]) {
    const id = opening[2].match(/\bid\s*=\s*["']([^"']+)["']/)?.[1];
    const classes = opening[2].match(/\bclass\s*=\s*["']([^"']+)["']/)?.[1];
    if (id) suffix += `#${id}`;
    if (classes) suffix += classes.split(/\s+/).filter(Boolean).map((item) => `.${item}`).join("");
  }
  return `${tag}${suffix}`;
}

function symbolName(node: SyntaxNode, kind: SymbolKind, language: string): string {
  if (kind === "constructor") return "constructor";
  if (language === "cpp" && kind === "function") {
    const operator = node.text.match(/([\p{L}_~][\p{L}\p{N}_~]*(?:::[\p{L}_~][\p{L}\p{N}_~]*)*::operator\s*(?:\(\)|\[\]|[^\s(]+))/u)?.[1];
    if (operator) return operator.replaceAll("::", ".").replace(/\s+/g, "");
  }
  if (node.type === "companion_object") return "companion object";
  if (node.type === "impl_item") {
    const trait = node.childForFieldName("trait")?.text;
    const type = node.childForFieldName("type")?.text;
    return trait && type ? `${trait} for ${type}` : (type ?? trait ?? "impl");
  }
  if (kind === "element") return htmlName(node) ?? "element";
  if (kind === "selector") return firstDescendant(node, "selectors")?.text.trim() ?? "selector";
  if (kind === "key") {
    const key = node.childForFieldName("key") ?? firstNamedChild(node);
    return key ? cleanName(key.text) : "key";
  }
  if (language === "toml" && kind === "section") {
    const heading = node.namedChildren.find((child) =>
      child ? ["bare_key", "quoted_key", "dotted_key"].includes(child.type) : false,
    );
    const keys = (heading?.type === "dotted_key" ? heading.descendantsOfType(["bare_key", "quoted_key"]) : [heading])
      .filter((key): key is SyntaxNode => key !== null && key !== undefined)
      .map((key) => cleanName(key.text));
    return keys.join(".") || "section";
  }
  if (language === "css" && kind === "section") {
    return node.type.replace(/_statement$/, "");
  }
  if (language === "vue" && kind === "section") return firstDescendant(node, "tag_name")?.text ?? "section";
  if (language === "embedded-template") return node.type === "output_directive" ? "output" : "directive";
  if (language === "razor" && kind === "section") {
    if (node.type === "razor_section") return firstDescendant(node, "identifier")?.text ?? "section";
    return node.type === "razor_block" ? "code" : node.type.replace(/^razor_|_directive$/g, "");
  }
  if (language === "tree-sitter-query") {
    if (node.type === "capture") return `@${firstDescendant(node, "identifier")?.text ?? "capture"}`;
    const captures = [...new Set(node.descendantsOfType("capture").map((capture) => capture?.text).filter(Boolean))];
    return captures.slice(0, 3).join(",") || firstDescendant(node, "identifier")?.text || node.type;
  }
  if (language === "haskell") {
    if (kind === "module") return node.text.replace(/\.$/, "");
    if (kind === "function") {
      const variable = firstDescendant(node, "variable");
      if (variable) return variable.text;
    }
  }
  if (language === "regex") return firstDescendant(node, "group_name")?.text ?? node.type;
  if (language === "systemrdl" && node.type === "component_named_def") {
    return node.childForFieldName("id")?.text.trim() ?? "component";
  }

  const direct =
    node.childForFieldName("name") ??
    node.childForFieldName("left") ??
    node.childForFieldName("declarator") ??
    (language === "kotlin" && node.type === "type_alias" ? node.childForFieldName("type") : null);
  if (direct) {
    if (language === "lua") return cleanName(direct.text);
    const nested = firstDescendant(direct, ["identifier", "field_identifier", "type_identifier"]);
    if (nested) return cleanName(nested.text);
    const candidate = cleanName(direct.text);
    return /^[\p{L}_$][\p{L}\p{N}_$.-]*$/u.test(candidate) ? candidate : kind;
  }

  if (node.type === "property_declaration") {
    const declaration = firstDescendant(node, "variable_declaration");
    const identifier = declaration ? firstDescendant(declaration, "identifier") : undefined;
    if (identifier) return identifier.text.trim();
  }

  const identifier = firstDescendant(node, [
    "identifier",
    "type_identifier",
    "field_identifier",
    "namespace_identifier",
    "module_name",
    "module_identifier",
    "module_type_name",
    "type_constructor",
    "value_name",
    "value_identifier",
    "method_name",
    "class_name",
    "constructor_name",
    "name",
    "symbol",
    "id",
    "simple_identifier",
    "word",
  ]);
  return cleanName(identifier?.text ?? kind);
}

function adjustedKind(node: SyntaxNode, captured: SymbolKind, language: string, name: string): SymbolKind {
  if (captured === "method" && name === "constructor") return "constructor";
  if (
    language === "swift" &&
    captured === "class" &&
    node.type === "class_declaration" &&
    node.children[0]?.type === "extension"
  ) {
    return "implementation";
  }
  if (captured !== "function") return captured;
  if (language === "rust" && ancestor(node, new Set(["impl_item", "trait_item"]))) return "method";
  if (language === "python" && ancestor(node, new Set(["class_definition"]))) return "method";
  if (language === "kotlin" && ancestor(node, new Set(["class_declaration", "object_declaration"]))) return "method";
  if (language === "cpp" && ancestor(node, new Set(["class_specifier", "struct_specifier"]))) return "method";
  if (language === "scala" && ancestor(node, new Set(["class_definition", "trait_definition", "object_definition"]))) return "method";
  if (language === "swift" && ancestor(node, new Set(["class_declaration", "protocol_declaration"]))) return "method";
  return captured;
}

const ECMASCRIPT_LANGUAGES = new Set(["javascript", "jsx", "typescript", "tsx"]);
const CALLBACK_TYPES = new Set(["arrow_function", "function_expression"]);

function sameNode(left: SyntaxNode | null | undefined, right: SyntaxNode): boolean {
  return left?.startIndex === right.startIndex && left.endIndex === right.endIndex;
}

function safeCallbackName(node: SyntaxNode | null | undefined): string | undefined {
  if (!node) return undefined;
  if (["identifier", "property_identifier", "private_property_identifier"].includes(node.type)) {
    return /^[\p{L}_$][\p{L}\p{N}_$-]*$/u.test(node.text) ? node.text : undefined;
  }
  if (["string", "string_fragment"].includes(node.type)) {
    const name = cleanName(node.text);
    return /^[\p{L}_$][\p{L}\p{N}_$-]*$/u.test(name) ? name : undefined;
  }
  if (["member_expression", "optional_chain"].includes(node.type)) {
    const object = safeCallbackName(node.childForFieldName("object"));
    const property = safeCallbackName(node.childForFieldName("property"));
    return object && property ? `${object}.${property}` : property ?? object;
  }
  return safeCallbackName(
    node.childForFieldName("name") ??
      node.childForFieldName("property") ??
      firstDescendant(node, ["identifier", "property_identifier", "private_property_identifier"]),
  );
}

function callbackValue(node: SyntaxNode | null | undefined): SyntaxNode | undefined {
  if (!node) return undefined;
  if (CALLBACK_TYPES.has(node.type)) return node;
  if (["parenthesized_expression", "jsx_expression", "as_expression", "satisfies_expression"].includes(node.type)) {
    return firstDescendant(node, [...CALLBACK_TYPES]);
  }
  return undefined;
}

type CallbackOwner = { callable: SyntaxNode; item: SyntaxNode; name: string };

function assignedCallbackOwner(node: SyntaxNode): CallbackOwner | undefined {
  if (node.type === "variable_declarator") {
    const callable = callbackValue(node.childForFieldName("value"));
    const name = safeCallbackName(node.childForFieldName("name"));
    if (callable && name) return { callable, item: node, name };
  }
  if (node.type === "pair") {
    const callable = callbackValue(node.childForFieldName("value"));
    const name = safeCallbackName(node.childForFieldName("key"));
    if (callable && name) return { callable, item: node, name };
  }
  if (["assignment_expression", "augmented_assignment_expression"].includes(node.type)) {
    const callable = callbackValue(node.childForFieldName("right"));
    const name = safeCallbackName(node.childForFieldName("left"));
    if (callable && name) return { callable, item: node, name };
  }
  if (["field_definition", "public_field_definition"].includes(node.type)) {
    const callable = callbackValue(node.childForFieldName("value"));
    const name = safeCallbackName(node.childForFieldName("property") ?? node.childForFieldName("name"));
    if (callable && name) return { callable, item: node, name };
  }
  if (node.type === "jsx_attribute") {
    const callable = callbackValue(node.childForFieldName("value") ?? node.namedChildren[1]);
    const name = safeCallbackName(node.childForFieldName("name") ?? node.namedChildren[0]);
    if (callable && name) return { callable, item: node, name };
  }
  return undefined;
}

function anonymousCallbackOwner(callable: SyntaxNode): CallbackOwner | undefined {
  let current = callable;
  while (current.parent && ["parenthesized_expression", "jsx_expression", "as_expression", "satisfies_expression"].includes(current.parent.type)) {
    current = current.parent;
  }
  const assigned = current.parent ? assignedCallbackOwner(current.parent) : undefined;
  if (assigned && sameNode(assigned.callable, callable)) return assigned;

  let parent = current.parent;
  while (parent && parent.type !== "arguments") parent = parent.parent;
  const call = parent?.parent;
  if (call?.type !== "call_expression" && call?.type !== "new_expression") return undefined;
  let assignedExpression: SyntaxNode = call;
  while (
    assignedExpression.parent &&
    ["await_expression", "parenthesized_expression", "as_expression", "satisfies_expression"].includes(
      assignedExpression.parent.type,
    )
  ) {
    assignedExpression = assignedExpression.parent;
  }
  const assignment = assignedExpression.parent;
  if (assignment) {
    const value = assignment.childForFieldName("value") ?? assignment.childForFieldName("right");
    const name = safeCallbackName(
      assignment.childForFieldName("name") ??
        assignment.childForFieldName("key") ??
        assignment.childForFieldName("left") ??
        assignment.childForFieldName("property"),
    );
    if (value && name && sameNode(value, assignedExpression)) {
      return { callable, item: assignment, name };
    }
  }
  const name = safeCallbackName(call.childForFieldName("function") ?? call.childForFieldName("constructor"));
  return name ? { callable, item: callable, name } : undefined;
}

function matchCallbackOwner(root: SyntaxNode, localIndex: number, length: number): CallbackOwner | undefined {
  let current = root.namedDescendantForIndex(localIndex, localIndex + Math.max(0, length - 1)) ?? undefined;
  while (current) {
    const assigned = assignedCallbackOwner(current);
    if (assigned) return assigned;
    if (CALLBACK_TYPES.has(current.type)) return anonymousCallbackOwner(current);
    current = current.parent ?? undefined;
  }
  return undefined;
}

function addMatchCallbackOwners(
  root: SyntaxNode,
  matches: SourceMatch[],
  symbols: IndexedSymbol[],
  language: string,
  source: string,
  options: ShapeOptions,
  byteBase: number,
  lineBase: number,
): void {
  if (!ECMASCRIPT_LANGUAGES.has(language)) return;
  const sourceBytes = Buffer.byteLength(source, "utf8");
  for (const match of matches) {
    const localIndex = match.startIndex - byteBase;
    if (localIndex < 0 || localIndex >= sourceBytes) continue;
    const owner = matchCallbackOwner(root, localIndex, match.length);
    if (!owner) continue;
    const startIndex = owner.item.startIndex + byteBase;
    const endIndex = owner.item.endIndex + byteBase;
    const extracted = options.params ? parameterNames(owner.callable, language) : undefined;
    const existing = symbols.find(
      (symbol) => symbol.name === owner.name && symbol.startIndex <= startIndex && endIndex <= symbol.endIndex,
    );
    if (existing) {
      existing.kind = "function";
      if (extracted) {
        existing.parameters = extracted.names;
        existing.omittedParameterCount = extracted.omitted || undefined;
      }
      continue;
    }
    symbols.push({
      kind: "function",
      name: owner.name,
      startLine: owner.item.startPosition.row + 1 + lineBase,
      endLine: inclusiveEndLine(owner.item) + lineBase,
      startColumn: owner.item.startPosition.column,
      startIndex,
      endIndex,
      doc: options.docs ? documentationFor(owner.item, owner.callable, language, source) : undefined,
      ...(extracted
        ? { parameters: extracted.names, omittedParameterCount: extracted.omitted || undefined }
        : {}),
      children: [],
    });
  }
}

function countParseErrors(root: SyntaxNode): number {
  let count = 0;
  const cursor = root.walk();
  try {
    while (true) {
      const node = cursor.currentNode;
      if (node.isError || node.isMissing) count++;
      if (cursor.gotoFirstChild()) continue;
      while (!cursor.gotoNextSibling()) {
        if (!cursor.gotoParent()) return count;
      }
    }
  } finally {
    cursor.delete();
  }
}

function nestSymbols(symbols: IndexedSymbol[]): IndexedSymbol[] {
  const roots: IndexedSymbol[] = [];
  const stack: IndexedSymbol[] = [];
  for (const symbol of symbols) {
    while (stack.length > 0) {
      const parent = stack.at(-1) as IndexedSymbol;
      if (parent.startIndex <= symbol.startIndex && symbol.endIndex <= parent.endIndex) break;
      stack.pop();
    }
    const parent = stack.at(-1);
    if (parent && (parent.startIndex !== symbol.startIndex || parent.endIndex !== symbol.endIndex)) {
      parent.children.push(symbol);
    } else {
      roots.push(symbol);
    }
    stack.push(symbol);
  }
  return roots;
}

function mergeHaskellFunctions(symbols: IndexedSymbol[]): void {
  const merged: IndexedSymbol[] = [];
  for (const symbol of symbols) {
    const previous = merged.findLast(
      (candidate) =>
        candidate.kind === "function" &&
        candidate.name === symbol.name &&
        candidate.startColumn === symbol.startColumn,
    );
    if (
      previous?.kind === "function" &&
      symbol.kind === "function" &&
      previous.name === symbol.name &&
      symbol.startLine <= previous.endLine + 2
    ) {
      previous.endLine = Math.max(previous.endLine, symbol.endLine);
      previous.endIndex = Math.max(previous.endIndex, symbol.endIndex);
      if (previous.parameters === undefined && symbol.parameters !== undefined) {
        previous.parameters = symbol.parameters;
        previous.omittedParameterCount = symbol.omittedParameterCount;
      }
      continue;
    }
    merged.push(symbol);
  }
  symbols.splice(0, symbols.length, ...merged);
}

function flatten(symbols: IndexedSymbol[]): IndexedSymbol[] {
  const result: IndexedSymbol[] = [];
  const visit = (items: IndexedSymbol[]) => {
    for (const item of items) {
      result.push(item);
      visit(item.children);
    }
  };
  visit(symbols);
  return result;
}

function findPath(roots: IndexedSymbol[], target: IndexedSymbol): IndexedSymbol[] {
  const path: IndexedSymbol[] = [];
  const visit = (items: IndexedSymbol[]): boolean => {
    for (const item of items) {
      path.push(item);
      if (item === target || visit(item.children)) return true;
      path.pop();
    }
    return false;
  };
  visit(roots);
  return path;
}

function deepestOwner(symbols: IndexedSymbol[], startIndex: number): IndexedSymbol | undefined {
  return symbols
    .filter((symbol) => symbol.startIndex <= startIndex && startIndex < symbol.endIndex)
    .sort((left, right) => left.endIndex - left.startIndex - (right.endIndex - right.startIndex))[0];
}

function qualifiedName(roots: IndexedSymbol[], symbol: IndexedSymbol): string {
  return findPath(roots, symbol)
    .map((item) => item.name)
    .join(".");
}

type MatchPriority = {
  coverage: number;
  kind: number;
  name: number;
  span: number;
  owned: number;
  occurrences: number;
  path: number;
};

type MatchCandidate = {
  match: ShapeMatch;
  chain: IndexedSymbol[];
  matchIndex: number;
  sourceOrder: number;
  priority: MatchPriority;
  variants: number[];
};

type MatchData = {
  candidates: MatchCandidate[];
  useByteRanges: boolean;
};

const MATCH_DATA = new WeakMap<ShapeResult, MatchData>();

function compareCandidates(left: MatchCandidate, right: MatchCandidate): number {
  return right.priority.owned - left.priority.owned ||
    right.priority.kind - left.priority.kind ||
    right.priority.name - left.priority.name ||
    right.priority.path - left.priority.path ||
    right.priority.coverage - left.priority.coverage ||
    right.priority.span - left.priority.span ||
    right.priority.occurrences - left.priority.occurrences ||
    left.match.path.localeCompare(right.match.path) ||
    left.sourceOrder - right.sourceOrder;
}

export function outputChars(options: ShapeOptions): number {
  return Math.max(120, Math.min(options.maxOutput ?? DEFAULT_OUTPUT_CHARS, MAX_OUTPUT_CHARS));
}

function ownerKindScore(kind: ShapeKind | "file"): number {
  if (kind === "fn" || kind === "type" || kind === "impl") return 3;
  if (kind === "var" || kind === "prop" || kind === "mod") return 2;
  if (kind !== "file") return 1;
  return 0;
}

function pathScore(path: string): number {
  const normalized = `/${path.toLowerCase().replaceAll("\\", "/")}`;
  const fileName = normalized.split("/").at(-1) ?? normalized;
  let score = /\/(?:src|lib|app|source)\//.test(normalized) ? 2 : 0;
  if (
    /(?:^|\/)(?:__mocks__|__tests__|test|tests|testing|testdata|spec|specs|fixtures?|mocks?|stubs?|fakes?|examples?|docs?)(?:\/|$)/
      .test(normalized)
  ) {
    score -= 2;
  }
  if (
    /(?:^|[._-])(?:test|tests|spec|specs|mock|mocks|stub|stubs|fake|fakes)(?:[._-]|$)/.test(fileName) ||
    /^(?:test|tests|spec|mock|stub|fake)|(?:test|tests|spec|specs|mock|mocks|stub|stubs|fake|fakes)\.[^.]+$/
      .test(fileName)
  ) {
    score -= 2;
  }
  if (/(?:^|\/)(?:i18n|l10n|locales?|translations?)(?:\/|$)/.test(normalized)) score -= 3;
  if (/(?:^|\/)(?:gen|generated)(?:\/|$)|(?:\.gen\.|\.generated\.|\.min\.|\.map$|\.d\.ts$)/.test(normalized)) {
    score -= 3;
  }
  return score;
}

function ownerNameScore(owner: IndexedSymbol | undefined, match: SourceMatch): number {
  if (!owner || !match.text) return 0;
  const name = owner.name.split(".").at(-1)?.toLowerCase() ?? "";
  const text = match.text.toLowerCase();
  if (name === text) return 2;
  const compact = (value: string) => value.replace(/[^\p{L}\p{N}]+/gu, "");
  return compact(name) === compact(text) ? 1 : 0;
}

function applyFileCoverage(candidates: MatchCandidate[]): void {
  const coverage = new Set(candidates.flatMap((candidate) => candidate.variants)).size;
  for (const candidate of candidates) candidate.priority.coverage = coverage;
}

function diverseCandidates<T extends { candidate: MatchCandidate }>(entries: T[]): T[] {
  const ranked = [...entries].sort((left, right) => compareCandidates(left.candidate, right.candidate));
  if (ranked.length < 2) return ranked;
  const selected: T[] = [];
  const selectedSet = new Set<T>();
  const covered = new Set<number>();
  const take = (entry: T) => {
    selected.push(entry);
    selectedSet.add(entry);
    for (const variant of entry.candidate.variants) covered.add(variant);
  };
  take(ranked[0] as T);
  const variants = [...new Set(ranked.flatMap((entry) => entry.candidate.variants))].sort((left, right) => left - right);
  for (const variant of variants) {
    if (covered.has(variant)) continue;
    const entry = ranked.find((candidate) => !selectedSet.has(candidate) && candidate.candidate.variants.includes(variant));
    if (entry) take(entry);
  }
  for (const entry of ranked) if (!selectedSet.has(entry)) selected.push(entry);
  return selected;
}

function symbolLabel(symbol: IndexedSymbol): string {
  const parameters = symbol.parameters
    ? `(${symbol.parameters.join(",")}${symbol.omittedParameterCount ? `,+${symbol.omittedParameterCount}` : ""})`
    : "";
  const kind = SHAPE_KIND[symbol.kind];
  return symbol.name === symbol.kind && symbol.kind !== "constructor"
    ? `${kind}${parameters}`
    : `${kind} ${symbol.name}${parameters}`;
}

function symbolRange(symbol: IndexedSymbol, useByteRanges: boolean): string {
  if (useByteRanges) return `b${symbol.startIndex}-${symbol.endIndex}`;
  return symbol.startLine === symbol.endLine ? `${symbol.startLine}` : `${symbol.startLine}-${symbol.endLine}`;
}

type MatchBranch = {
  symbol: IndexedSymbol;
  direct?: MatchCandidate;
  best: MatchCandidate;
  children: Map<IndexedSymbol, MatchBranch>;
};

function renderMatchTree(
  path: string,
  candidates: MatchCandidate[],
  useByteRanges: boolean,
): { lines: string[]; matches: ShapeMatch[] } {
  const roots = new Map<IndexedSymbol, MatchBranch>();
  const fileCandidates: MatchCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.chain.length === 0) {
      fileCandidates.push(candidate);
      continue;
    }
    let branches = roots;
    for (const [index, symbol] of candidate.chain.entries()) {
      let branch = branches.get(symbol);
      if (!branch) {
        branch = { symbol, best: candidate, children: new Map() };
        branches.set(symbol, branch);
      } else if (compareCandidates(candidate, branch.best) < 0) {
        branch.best = candidate;
      }
      if (index === candidate.chain.length - 1) branch.direct = candidate;
      branches = branch.children;
    }
  }

  const lines = [path];
  const orderedMatches: ShapeMatch[] = [];
  const renderBranch = (branch: MatchBranch, level: number) => {
    const direct = branch.direct;
    const location = direct
      ? useByteRanges
        ? ` @b${direct.matchIndex}`
        : direct.match.line === branch.symbol.startLine
          ? ""
          : ` @${direct.match.line}`
      : "";
    lines.push(
      `${"  ".repeat(level)}${symbolLabel(branch.symbol)} [${symbolRange(branch.symbol, useByteRanges)}]${location}` +
        `${branch.symbol.doc ? ` | ${branch.symbol.doc}` : ""}`,
    );
    if (direct) orderedMatches.push(direct.match);
    const children = [...branch.children.values()].sort(
      (left, right) => compareCandidates(left.best, right.best) || left.symbol.startIndex - right.symbol.startIndex,
    );
    for (const child of children) renderBranch(child, level + 1);
  };

  const rootItems: Array<
    | { kind: "branch"; best: MatchCandidate; sourceOrder: number; branch: MatchBranch }
    | { kind: "file"; best: MatchCandidate; sourceOrder: number; candidate: MatchCandidate }
  > = [
    ...[...roots.values()].map((branch) => ({
      kind: "branch" as const,
      best: branch.best,
      sourceOrder: branch.symbol.startIndex,
      branch,
    })),
    ...fileCandidates.map((candidate) => ({
      kind: "file" as const,
      best: candidate,
      sourceOrder: candidate.sourceOrder,
      candidate,
    })),
  ];
  rootItems.sort(
    (left, right) => compareCandidates(left.best, right.best) || left.sourceOrder - right.sourceOrder,
  );
  for (const item of rootItems) {
    if (item.kind === "branch") {
      renderBranch(item.branch, 1);
      continue;
    }
    lines.push(`  file ${useByteRanges ? `@b${item.candidate.matchIndex}` : `@${item.candidate.match.line}`}`);
    orderedMatches.push(item.candidate.match);
  }
  return { lines, matches: orderedMatches };
}

function matchedOwners(
  path: string,
  roots: IndexedSymbol[],
  flat: IndexedSymbol[],
  sourceMatches: SourceMatch[],
  maxOutput: number,
  useByteRanges: boolean,
): { candidates: MatchCandidate[]; matches: ShapeMatch[]; lines: string[]; omitted: number } {
  const candidateByOwner = new Map<string, MatchCandidate>();
  for (const match of sourceMatches) {
    const owner = deepestOwner(flat, match.startIndex);
    const key = owner ? `${owner.startIndex}:${owner.endIndex}:${owner.name}` : `file:${match.line}`;
    const existing = candidateByOwner.get(key);
    if (existing) {
      existing.priority.occurrences++;
      existing.variants = [...new Set([...existing.variants, ...(match.variants ?? [])])];
      existing.priority.name = Math.max(existing.priority.name, ownerNameScore(owner, match));
      if (match.length > existing.priority.span) {
        existing.priority.span = match.length;
        existing.match.line = match.line;
        existing.matchIndex = match.startIndex;
      }
      continue;
    }
    candidateByOwner.set(
      key,
      owner
        ? {
            chain: findPath(roots, owner),
            matchIndex: match.startIndex,
            sourceOrder: owner.startIndex,
            priority: {
              coverage: 0,
              kind: ownerKindScore(SHAPE_KIND[owner.kind]),
              name: ownerNameScore(owner, match),
              span: match.length,
              owned: 1,
              occurrences: 1,
              path: pathScore(path),
            },
            variants: match.variants ?? [0],
            match: {
            path,
            line: match.line,
            kind: SHAPE_KIND[owner.kind],
            name: qualifiedName(roots, owner),
            startLine: owner.startLine,
            endLine: owner.endLine,
            ...(owner.doc ? { doc: owner.doc } : {}),
            ...(owner.parameters !== undefined ? { parameters: owner.parameters } : {}),
            ...(owner.omittedParameterCount ? { omittedParameterCount: owner.omittedParameterCount } : {}),
            },
          }
        : {
            chain: [],
            matchIndex: match.startIndex,
            sourceOrder: match.startIndex,
            priority: {
              coverage: 0,
              kind: 0,
              name: 0,
              span: match.length,
              owned: 0,
              occurrences: 1,
              path: pathScore(path),
            },
            variants: match.variants ?? [0],
            match: { path, line: match.line, kind: "file" },
          },
    );
  }

  const candidates = [...candidateByOwner.values()];
  applyFileCoverage(candidates);
  const ordered = diverseCandidates(candidates.map((candidate) => ({ candidate }))).map((entry) => entry.candidate);
  const all = ordered.length ? renderMatchTree(path, ordered, useByteRanges) : { lines: [], matches: [] };
  let selected = ordered;
  let rendered = all;
  if (all.lines.join("\n").length > maxOutput) {
    selected = [];
    rendered = { lines: [], matches: [] };
    const bodyBudget = Math.max(0, maxOutput - "\n[more]".length);
    for (const candidate of ordered) {
      const trialCandidates = [...selected, candidate];
      const trial = renderMatchTree(path, trialCandidates, useByteRanges);
      if (trial.lines.join("\n").length > bodyBudget) break;
      selected = trialCandidates;
      rendered = trial;
    }
  }
  return {
    candidates,
    matches: rendered.matches,
    lines: rendered.lines,
    omitted: Math.max(0, candidates.length - selected.length),
  };
}

export type DirectoryMatchSelection = {
  files: ShapeResult[];
  lines: string[];
  shownCount: number;
  shownFileCount: number;
  matchCount: number;
  omittedMatches: number;
};

function renderDirectoryEntries(
  entries: Array<{ file: ShapeResult; candidate: MatchCandidate; data: MatchData }>,
): { files: ShapeResult[]; lines: string[] } {
  const grouped = new Map<ShapeResult, { candidates: MatchCandidate[]; data: MatchData }>();
  for (const entry of entries) {
    const group = grouped.get(entry.file);
    if (group) group.candidates.push(entry.candidate);
    else grouped.set(entry.file, { candidates: [entry.candidate], data: entry.data });
  }
  const groups = [...grouped].sort(([leftFile, left], [rightFile, right]) => {
    const leftBest = left.candidates.reduce((best, candidate) =>
      compareCandidates(candidate, best) < 0 ? candidate : best
    );
    const rightBest = right.candidates.reduce((best, candidate) =>
      compareCandidates(candidate, best) < 0 ? candidate : best
    );
    return compareCandidates(leftBest, rightBest) ||
      right.candidates.length - left.candidates.length ||
      leftFile.path.localeCompare(rightFile.path);
  });

  const lines: string[] = [];
  const selectedFiles: ShapeResult[] = [];
  for (const [file, group] of groups) {
    const rendered = renderMatchTree(file.path, group.candidates, group.data.useByteRanges);
    lines.push(...rendered.lines);
    selectedFiles.push({
      ...file,
      shownCount: rendered.matches.length,
      omittedCount: 0,
      matchCount: group.data.candidates.length,
      omittedMatchCount: 0,
      matches: rendered.matches,
      text: rendered.lines.join("\n"),
    });
  }
  return { files: selectedFiles, lines };
}

export function rankDirectoryMatches(files: ShapeResult[], maxOutput: number): DirectoryMatchSelection {
  const entries = files.flatMap((file) => {
    const data = MATCH_DATA.get(file);
    return data ? data.candidates.map((candidate) => ({ file, candidate, data })) : [];
  });
  const ordered = diverseCandidates(entries);
  let selected = ordered;
  let rendered = renderDirectoryEntries(selected);
  if (rendered.lines.join("\n").length > maxOutput) {
    selected = [];
    rendered = { files: [], lines: [] };
    const bodyBudget = Math.max(0, maxOutput - "\n[more]".length);
    for (const entry of ordered) {
      const trialEntries = [...selected, entry];
      const trial = renderDirectoryEntries(trialEntries);
      if (trial.lines.join("\n").length > bodyBudget) break;
      selected = trialEntries;
      rendered = trial;
    }
  }
  return {
    files: rendered.files,
    lines: rendered.lines,
    shownCount: selected.length,
    shownFileCount: rendered.files.length,
    matchCount: entries.length,
    omittedMatches: Math.max(0, entries.length - selected.length),
  };
}

export function combineMatchResults(
  path: string,
  results: ShapeResult[],
  options: ShapeOptions,
  incomplete = true,
): ShapeResult {
  const candidateByOwner = new Map<string, MatchCandidate>();
  let useByteRanges = false;
  for (const result of results) {
    const data = MATCH_DATA.get(result);
    if (!data) continue;
    useByteRanges ||= data.useByteRanges;
    for (const candidate of data.candidates) {
      const owner = candidate.chain.at(-1);
      const overlappingOwner = owner
        ? [...candidateByOwner.entries()].find(([, existingCandidate]) => {
            const existingOwner = existingCandidate.chain.at(-1);
            if (!existingOwner || existingOwner.name !== owner.name || existingOwner.kind !== owner.kind) return false;
            const overlap = Math.min(existingOwner.endIndex, owner.endIndex) - Math.max(existingOwner.startIndex, owner.startIndex);
            const shorter = Math.min(
              existingOwner.endIndex - existingOwner.startIndex,
              owner.endIndex - owner.startIndex,
            );
            return overlap > 0 && overlap / shorter >= 0.8;
          })?.[0]
        : undefined;
      const key = overlappingOwner ?? (owner
        ? `${owner.startIndex}:${owner.endIndex}:${owner.name}`
        : `file:${candidate.match.line}:${candidate.matchIndex}`);
      const existing = candidateByOwner.get(key);
      if (!existing) {
        candidateByOwner.set(key, {
          ...candidate,
          chain: [...candidate.chain],
          priority: { ...candidate.priority },
          variants: [...candidate.variants],
          match: { ...candidate.match },
        });
        continue;
      }
      existing.priority.occurrences += candidate.priority.occurrences;
      existing.priority.kind = Math.max(existing.priority.kind, candidate.priority.kind);
      existing.priority.name = Math.max(existing.priority.name, candidate.priority.name);
      existing.priority.path = Math.max(existing.priority.path, candidate.priority.path);
      existing.variants = [...new Set([...existing.variants, ...candidate.variants])];
      if (candidate.priority.span > existing.priority.span) {
        existing.priority.span = candidate.priority.span;
        existing.matchIndex = candidate.matchIndex;
        existing.match.line = candidate.match.line;
      }
    }
  }

  const candidates = [...candidateByOwner.values()];
  applyFileCoverage(candidates);
  const parseErrors = results.reduce((sum, result) => sum + result.parseErrors, 0);
  const queryLimited = incomplete || results.some((result) => result.queryLimited);
  const suffix = queryLimited ? "\n[incomplete]" : "";
  const maxOutput = Math.max(0, outputChars(options) - suffix.length);
  const ordered = diverseCandidates(candidates.map((candidate) => ({ candidate }))).map((entry) => entry.candidate);
  let selected = ordered;
  let rendered = selected.length ? renderMatchTree(path, selected, useByteRanges) : { lines: [], matches: [] };
  if (rendered.lines.join("\n").length > maxOutput) {
    selected = [];
    rendered = { lines: [], matches: [] };
    const bodyBudget = Math.max(0, maxOutput - "\n[more]".length);
    for (const candidate of ordered) {
      const trialCandidates = [...selected, candidate];
      const trial = renderMatchTree(path, trialCandidates, useByteRanges);
      if (trial.lines.join("\n").length > bodyBudget) break;
      selected = trialCandidates;
      rendered = trial;
    }
  }
  const omitted = Math.max(0, candidates.length - selected.length);
  const body = rendered.lines.length ? rendered.lines.join("\n") : "[no match]";
  const limit = omitted ? "\n[more]" : "";
  const result: ShapeResult = {
    path,
    language: results[0]?.language ?? "unknown",
    lineCount: Math.max(0, ...results.map((item) => item.lineCount)),
    parseErrors,
    definitionCount: results.reduce((sum, item) => sum + item.definitionCount, 0),
    shownCount: rendered.matches.length,
    omittedCount: omitted,
    queryLimited,
    focus: "match",
    ...(options.docs
      ? {
          docCount: rendered.matches.filter((match) => match.doc).length,
          omittedDocCount: 0,
        }
      : {}),
    matchCount: candidates.length,
    omittedMatchCount: omitted,
    matches: rendered.matches,
    symbols: [],
    text: `${body}${limit}${suffix}`,
  };
  MATCH_DATA.set(result, { candidates, useByteRanges });
  return result;
}

function formatSymbols(
  roots: IndexedSymbol[],
  depth: number,
  maxChars: number,
  useByteRanges: boolean,
): {
  lines: string[];
  shown: number;
  omitted: number;
  docsShown: number;
  docsOmitted: number;
  included: Set<IndexedSymbol>;
} {
  const lines: string[] = [];
  let shown = 0;
  let omitted = 0;
  let docsShown = 0;
  let docsOmitted = 0;
  let used = 0;
  const included = new Set<IndexedSymbol>();
  const visit = (items: IndexedSymbol[], level: number) => {
    for (const symbol of items) {
      if (level > depth) {
        omitted += flatten([symbol]).length;
        continue;
      }
      const range = useByteRanges
        ? `b${symbol.startIndex}-${symbol.endIndex}`
        : symbol.startLine === symbol.endLine
          ? `${symbol.startLine}`
          : `${symbol.startLine}-${symbol.endLine}`;
      const shortKind = SHAPE_KIND[symbol.kind];
      const parameters = symbol.parameters
        ? `(${symbol.parameters.join(",")}${symbol.omittedParameterCount ? `,+${symbol.omittedParameterCount}` : ""})`
        : "";
      const label = symbol.name === symbol.kind && symbol.kind !== "constructor"
        ? `${shortKind}${parameters}`
        : `${shortKind} ${symbol.name}${parameters}`;
      const prefix = `${"  ".repeat(level)}${label} [${range}]`;
      let line = `${prefix}${symbol.doc ? ` | ${symbol.doc}` : ""}`;
      const lineCost = (lines.length ? 1 : 0) + line.length;
      if (used + lineCost > maxChars && symbol.doc) {
        line = prefix;
        docsOmitted++;
      }
      const cost = (lines.length ? 1 : 0) + line.length;
      if (used + cost > maxChars) {
        omitted += flatten([symbol]).length;
        continue;
      }
      lines.push(line);
      used += cost;
      shown++;
      included.add(symbol);
      if (symbol.doc && line !== prefix) docsShown++;
      visit(symbol.children, level + 1);
    }
  };
  visit(roots, 0);
  return { lines, shown, omitted, docsShown, docsOmitted, included };
}

function publicIncludedSymbols(roots: IndexedSymbol[], included: Set<IndexedSymbol>): CodeSymbol[] {
  return roots.flatMap((symbol): CodeSymbol[] => {
    if (!included.has(symbol)) return [];
    return [{
      kind: SHAPE_KIND[symbol.kind],
      name: symbol.name,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      ...(symbol.doc ? { doc: symbol.doc } : {}),
      ...(symbol.parameters !== undefined ? { parameters: symbol.parameters } : {}),
      ...(symbol.omittedParameterCount ? { omittedParameterCount: symbol.omittedParameterCount } : {}),
      children: publicIncludedSymbols(symbol.children, included),
    }];
  });
}

export async function shapeSource(
  path: string,
  source: string,
  options: ShapeOptions = {},
  signal?: AbortSignal,
  context?: ShapeSourceContext,
): Promise<ShapeResult> {
  const focusCount = Number(Boolean(options.symbol)) + Number(options.line !== undefined) + Number(options.match !== undefined);
  if (focusCount > 1) throw new Error("Use only one of symbol, line, or match focus");
  if (signal?.aborted) throw new Error("shape was cancelled");
  const spec = detectLanguage(path, source);
  if (!spec) throw new Error(`Unsupported source language for ${path}. Supported: ${supportedLanguages().join(", ")}`);
  const byteBase = context?.byteBase ?? 0;
  const lineBase = context?.lineBase ?? 0;
  const regexMatches = options.match !== undefined
    ? context?.matches ?? await sourceMatches(source, options.match, signal)
    : undefined;

  const language = await loadShapeLanguage(spec);
  const parser = new Parser();
  let query: Query | undefined;
  const deadline = Date.now() + PARSE_BUDGET_MS;
  try {
    parser.setLanguage(language);
    const tree = spec.packageName
      ? parser.parse(source, null, {
          progressCallback: () => signal?.aborted === true || Date.now() > deadline,
        })
      : parser.parse(source);
    if (!tree) throw new Error(signal?.aborted ? "shape was cancelled" : "Tree-sitter parse budget exceeded");
    if (signal?.aborted || Date.now() > deadline) {
      tree.delete();
      throw new Error(signal?.aborted ? "shape was cancelled" : "Tree-sitter parse budget exceeded");
    }
    try {
      query = new Query(language, spec.query);
      const captures = query.captures(tree.rootNode, {
        matchLimit: MAX_QUERY_CAPTURES,
        timeoutMicros: PARSE_BUDGET_MS * 1_000,
        progressCallback: () => signal?.aborted === true,
      });
      const seen = new Set<string>();
      const symbols: IndexedSymbol[] = [];
      for (const capture of captures) {
        const definition = capture.node;
        const capturedKind = capture.name as SymbolKind;
        const name = symbolName(definition, capturedKind, spec.id);
        if (!name) continue;
        const kind = adjustedKind(definition, capturedKind, spec.id, name);
        const item = expandedNode(definition, spec.id);
        const key = `${item.startIndex}:${item.endIndex}:${name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        symbols.push({
          kind,
          name,
          startLine: item.startPosition.row + 1 + lineBase,
          endLine: inclusiveEndLine(item) + lineBase,
          startColumn: item.startPosition.column,
          startIndex: item.startIndex + byteBase,
          endIndex: item.endIndex + byteBase,
          doc: options.docs ? documentationFor(item, definition, spec.id, source) : undefined,
          ...(() => {
            if (!options.params || SHAPE_KIND[kind] !== "fn") return {};
            const extracted = parameterNames(definition, spec.id);
            return extracted
              ? { parameters: extracted.names, omittedParameterCount: extracted.omitted || undefined }
              : {};
          })(),
          children: [],
        });
      }
      if (regexMatches) {
        addMatchCallbackOwners(tree.rootNode, regexMatches, symbols, spec.id, source, options, byteBase, lineBase);
      }
      symbols.sort((left, right) => left.startIndex - right.startIndex || right.endIndex - left.endIndex);
      if (spec.id === "haskell") mergeHaskellFunctions(symbols);
      const roots = nestSymbols(symbols);
      const flat = flatten(roots);
      const depth = Math.max(0, Math.min(options.depth ?? 4, 12));

      const parseErrors = context?.incomplete ? 0 : countParseErrors(tree.rootNode);
      const lineCount = context?.fullLineCount ?? logicalLineCount(source);
      const useByteRanges = context?.forceByteRanges === true || shouldUseByteRanges(source);
      if (regexMatches) {
        const queryLimited =
          query.didExceedMatchLimit() ||
          context?.incomplete === true;
        const suffix = queryLimited ? "\n[incomplete]" : "";
        const matched = matchedOwners(
          path,
          roots,
          flat,
          regexMatches,
          Math.max(0, outputChars(options) - suffix.length),
          useByteRanges,
        );
        const body = matched.lines.length ? matched.lines.join("\n") : "[no match]";
        const limit = matched.omitted ? "\n[more]" : "";
        const result: ShapeResult = {
          path,
          language: spec.id,
          lineCount,
          parseErrors,
          definitionCount: flat.length,
          shownCount: matched.matches.length,
          omittedCount: matched.omitted,
          queryLimited,
          focus: "match",
          ...(options.docs
            ? {
                docCount: matched.matches.filter((match) => match.doc).length,
                omittedDocCount: 0,
              }
            : {}),
          matchCount: matched.matches.length + matched.omitted,
          omittedMatchCount: matched.omitted,
          matches: matched.matches,
          symbols: [],
          text: `${body}${limit}${suffix}`,
        };
        MATCH_DATA.set(result, { candidates: matched.candidates, useByteRanges });
        return result;
      }

      let selectedRoots = roots;
      let focus: string | undefined;
      if (options.symbol) {
        const matches = flat.filter((symbol) => symbol.name === options.symbol);
        const matchSet = new Set(matches);
        selectedRoots = matches.filter((symbol) =>
          findPath(roots, symbol)
            .slice(0, -1)
            .every((ancestor) => !matchSet.has(ancestor)),
        );
        focus = `symbol ${options.symbol}`;
      } else if (options.line !== undefined) {
        const candidates = flat
          .filter((symbol) => symbol.startLine <= (options.line as number) && (options.line as number) <= symbol.endLine)
          .sort((left, right) => left.endIndex - left.startIndex - (right.endIndex - right.startIndex));
        const target = candidates[0];
        selectedRoots = target ? [target] : [];
        focus = target ? findPath(roots, target).map((symbol) => symbol.name).join(" > ") : `line ${options.line}`;
      }

      const header = `${path} ${spec.id} ${lineCount.toLocaleString()}L${parseErrors ? ` errors=${parseErrors}` : ""}`;
      const focusLine = options.line !== undefined && focus ? `\n@ ${focus}` : "";
      const noMatches = selectedRoots.length === 0 ? "\n[no match]" : "";
      const queryLimited = query.didExceedMatchLimit();
      const fixedSuffix = `${queryLimited ? "\n[incomplete]" : ""}`;
      const outputBudget = Math.max(
        0,
        outputChars(options) - header.length - focusLine.length - noMatches.length - fixedSuffix.length -
          "\n[more]".length - (selectedRoots.length ? 1 : 0),
      );
      const formatted = formatSymbols(selectedRoots, depth, outputBudget, useByteRanges);
      const outline = formatted.lines.length ? `\n${formatted.lines.join("\n")}` : "";
      const omitted = formatted.omitted;
      const limit = omitted > 0 || formatted.docsOmitted > 0 ? "\n[more]" : "";
      return {
        path,
        language: spec.id,
        lineCount,
        parseErrors,
        definitionCount: flat.length,
        shownCount: formatted.shown,
        omittedCount: omitted,
        queryLimited,
        focus,
        ...(options.docs ? { docCount: formatted.docsShown, omittedDocCount: formatted.docsOmitted } : {}),
        symbols: publicIncludedSymbols(selectedRoots, formatted.included),
        text: `${header}${focusLine}${noMatches}${outline}${limit}${fixedSuffix}`,
      };
    } finally {
      tree.delete();
    }
  } finally {
    query?.delete();
    parser.delete();
  }
}
