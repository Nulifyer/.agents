import { type Node as SyntaxNode, Parser, Query } from "web-tree-sitter";
import { detectLanguage, loadShapeLanguage, supportedLanguages } from "./languages.ts";

const DEFAULT_MAX_ITEMS = 200;
const DEFAULT_MATCH_ITEMS = 12;
const MAX_DOCS = 40;
const MAX_DOC_CHARS = 200;
const MAX_MATCH_PATTERN_CHARS = 500;
const MAX_SOURCE_MATCHES = 2_000;
const MAX_PARAMETERS_PER_SYMBOL = 12;
const MAX_EXTRACTED_ITEMS = 2_000;
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
  maxItems?: number;
  docs?: boolean;
  params?: boolean;
};

function logicalLineCount(source: string): number {
  if (!source) return 0;
  const newlines = source.match(/\n/g)?.length ?? 0;
  return newlines + (source.endsWith("\n") ? 0 : 1);
}

type SourceMatch = {
  startIndex: number;
  line: number;
};

type RipgrepMatch = {
  type: "match";
  data: {
    absolute_offset: number;
    line_number: number;
    submatches: Array<{ start: number }>;
  };
};

async function sourceMatches(source: string, pattern: string, signal?: AbortSignal): Promise<SourceMatch[]> {
  if (!pattern) throw new Error("--match requires a regex");
  if (pattern.length > MAX_MATCH_PATTERN_CHARS) {
    throw new Error(`--match regex exceeds ${MAX_MATCH_PATTERN_CHARS} characters`);
  }
  if (signal?.aborted) throw new Error("shape was cancelled");

  const process = (() => {
    try {
      return Bun.spawn(
        ["rg", "--json", "--ignore-case", "--max-count", String(MAX_SOURCE_MATCHES), "-e", pattern, "-"],
        {
          stdin: Buffer.from(source),
          stdout: "pipe",
          stderr: "pipe",
          signal,
        },
      );
    } catch {
      throw new Error("--match requires ripgrep (rg)");
    }
  })();

  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  if (signal?.aborted) throw new Error("shape was cancelled");
  if (exitCode === 1) return [];
  if (exitCode !== 0) {
    const reason = stderr
      .trim()
      .split("\n")
      .findLast((line) => line.trim().startsWith("error:"))
      ?.replace(/^error:\s*/, "");
    throw new Error(`Invalid --match regex${reason ? `: ${reason}` : ""}`);
  }

  const matches: SourceMatch[] = [];
  for (const line of stdout.split("\n")) {
    if (!line || matches.length >= MAX_SOURCE_MATCHES) break;
    const event = JSON.parse(line) as { type: string } | RipgrepMatch;
    if (event.type !== "match") continue;
    const match = event as RipgrepMatch;
    for (const submatch of match.data.submatches) {
      matches.push({
        startIndex: match.data.absolute_offset + submatch.start,
        line: match.data.line_number,
      });
      if (matches.length >= MAX_SOURCE_MATCHES) break;
    }
  }
  return matches;
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
  if (captured !== "function") return captured;
  if (language === "rust" && ancestor(node, new Set(["impl_item", "trait_item"]))) return "method";
  if (language === "python" && ancestor(node, new Set(["class_definition"]))) return "method";
  if (language === "kotlin" && ancestor(node, new Set(["class_declaration", "object_declaration"]))) return "method";
  if (language === "cpp" && ancestor(node, new Set(["class_specifier", "struct_specifier"]))) return "method";
  if (language === "scala" && ancestor(node, new Set(["class_definition", "trait_definition", "object_definition"]))) return "method";
  if (language === "swift" && ancestor(node, new Set(["class_declaration", "protocol_declaration"]))) return "method";
  return captured;
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

function publicSymbols(symbols: IndexedSymbol[]): CodeSymbol[] {
  return symbols.map(({ kind, name, startLine, endLine, doc, parameters, omittedParameterCount, children }) => ({
    kind: SHAPE_KIND[kind],
    name,
    startLine,
    endLine,
    ...(doc ? { doc } : {}),
    ...(parameters ? { parameters } : {}),
    ...(omittedParameterCount ? { omittedParameterCount } : {}),
    children: publicSymbols(children),
  }));
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

function matchedOwners(
  path: string,
  roots: IndexedSymbol[],
  flat: IndexedSymbol[],
  sourceMatches: SourceMatch[],
  maxItems: number,
  useByteRanges: boolean,
): { matches: ShapeMatch[]; lines: string[]; omitted: number } {
  const candidates: Array<{ match: ShapeMatch; startIndex?: number; endIndex?: number }> = [];
  const seen = new Set<string>();
  for (const match of sourceMatches) {
    const owner = deepestOwner(flat, match.startIndex);
    const key = owner ? `${owner.startIndex}:${owner.endIndex}:${owner.name}` : `file:${match.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(
      owner
        ? {
            startIndex: owner.startIndex,
            endIndex: owner.endIndex,
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
        : { match: { path, line: match.line, kind: "file" } },
    );
  }

  const selected = candidates.slice(0, maxItems);
  const lines = selected.map(({ match, startIndex, endIndex }) => {
    const parameters = match.parameters
      ? `(${match.parameters.join(",")}${match.omittedParameterCount ? `,+${match.omittedParameterCount}` : ""})`
      : "";
    const label = match.kind === "file" ? "file" : `${match.kind} ${match.name}${parameters}`;
    const range = match.startLine === undefined
      ? ""
      : useByteRanges
        ? ` [b${startIndex}-${endIndex}]`
        : ` [${match.startLine === match.endLine ? match.startLine : `${match.startLine}-${match.endLine}`}]`;
    return `${path}:${match.line} ${label}${range}${match.doc ? ` | ${match.doc}` : ""}`;
  });
  return {
    matches: selected.map((candidate) => candidate.match),
    lines,
    omitted: Math.max(0, candidates.length - selected.length),
  };
}

function formatSymbols(
  roots: IndexedSymbol[],
  depth: number,
  maxItems: number,
  useByteRanges: boolean,
): { lines: string[]; shown: number; omitted: number; docsShown: number; docsOmitted: number } {
  const lines: string[] = [];
  let shown = 0;
  let omitted = 0;
  let docsShown = 0;
  let docsOmitted = 0;
  const visit = (items: IndexedSymbol[], level: number) => {
    for (const symbol of items) {
      if (shown >= maxItems || level > depth) {
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
      let doc = "";
      if (symbol.doc) {
        if (docsShown < MAX_DOCS) {
          doc = ` | ${symbol.doc}`;
          docsShown++;
        } else {
          docsOmitted++;
        }
      }
      lines.push(`${"  ".repeat(level)}${label} [${range}]${doc}`);
      shown++;
      visit(symbol.children, level + 1);
    }
  };
  visit(roots, 0);
  return { lines, shown, omitted, docsShown, docsOmitted };
}

export async function shapeSource(
  path: string,
  source: string,
  options: ShapeOptions = {},
  signal?: AbortSignal,
): Promise<ShapeResult> {
  const focusCount = Number(Boolean(options.symbol)) + Number(options.line !== undefined) + Number(options.match !== undefined);
  if (focusCount > 1) throw new Error("Use only one of symbol, line, or match focus");
  if (signal?.aborted) throw new Error("shape was cancelled");
  const spec = detectLanguage(path, source);
  if (!spec) throw new Error(`Unsupported source language for ${path}. Supported: ${supportedLanguages().join(", ")}`);
  const regexMatches = options.match !== undefined ? await sourceMatches(source, options.match, signal) : undefined;

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
        matchLimit: MAX_EXTRACTED_ITEMS * 4,
        timeoutMicros: PARSE_BUDGET_MS * 1_000,
        progressCallback: () => signal?.aborted === true,
      });
      const seen = new Set<string>();
      const symbols: IndexedSymbol[] = [];
      for (const capture of captures) {
        if (symbols.length >= MAX_EXTRACTED_ITEMS) break;
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
          startLine: item.startPosition.row + 1,
          endLine: inclusiveEndLine(item),
          startColumn: item.startPosition.column,
          startIndex: item.startIndex,
          endIndex: item.endIndex,
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
      symbols.sort((left, right) => left.startIndex - right.startIndex || right.endIndex - left.endIndex);
      if (spec.id === "haskell") mergeHaskellFunctions(symbols);
      const roots = nestSymbols(symbols);
      const flat = flatten(roots);
      const depth = Math.max(0, Math.min(options.depth ?? 4, 12));
      const maxItems = Math.max(
        1,
        Math.min(options.maxItems ?? (options.match !== undefined ? DEFAULT_MATCH_ITEMS : DEFAULT_MAX_ITEMS), 500),
      );

      const parseErrors = countParseErrors(tree.rootNode);
      const lineCount = logicalLineCount(source);
      const useByteRanges = lineCount === 1 && Buffer.byteLength(source, "utf8") >= 200;
      if (regexMatches) {
        const matched = matchedOwners(path, roots, flat, regexMatches, maxItems, useByteRanges);
        const queryLimited =
          query.didExceedMatchLimit() ||
          symbols.length >= MAX_EXTRACTED_ITEMS ||
          regexMatches.length >= MAX_SOURCE_MATCHES;
        const body = matched.lines.length ? matched.lines.join("\n") : "[no match]";
        const limit = matched.omitted ? `\n[+${matched.omitted} owners]` : "";
        const errors = parseErrors ? `\n[errors=${parseErrors}]` : "";
        const incomplete = queryLimited ? "\n[incomplete]" : "";
        return {
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
          text: `${body}${limit}${errors}${incomplete}`,
        };
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

      const formatted = formatSymbols(selectedRoots, depth, maxItems, useByteRanges);
      const header = `${path} ${spec.id} ${lineCount.toLocaleString()}L${parseErrors ? ` errors=${parseErrors}` : ""}`;
      const focusLine = options.line !== undefined && focus ? `\n@ ${focus}` : "";
      const noMatches = selectedRoots.length === 0 ? "\n[no match]" : "";
      const outline = formatted.lines.length ? `\n${formatted.lines.join("\n")}` : "";
      const omitted = formatted.omitted + Math.max(0, flat.length - symbols.length);
      const limit = omitted > 0 ? `\n[+${omitted} omitted]` : "";
      const docLimit = formatted.docsOmitted > 0 ? `\n[+${formatted.docsOmitted} docs omitted]` : "";
      const queryLimited = query.didExceedMatchLimit() || symbols.length >= MAX_EXTRACTED_ITEMS;
      const incomplete = queryLimited ? "\n[incomplete]" : "";
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
        symbols: publicSymbols(selectedRoots),
        text: `${header}${focusLine}${noMatches}${outline}${limit}${docLimit}${incomplete}`,
      };
    } finally {
      tree.delete();
    }
  } finally {
    query?.delete();
    parser.delete();
  }
}
