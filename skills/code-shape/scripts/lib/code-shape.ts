import { type Node as SyntaxNode, Parser, Query } from "web-tree-sitter";
import { detectLanguage, loadShapeLanguage, supportedLanguages } from "./languages.ts";

const DEFAULT_MAX_ITEMS = 200;
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
  children: CodeSymbol[];
};

type IndexedSymbol = {
  kind: SymbolKind;
  name: string;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
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
  symbols: CodeSymbol[];
  text: string;
};

export type ShapeOptions = {
  symbol?: string;
  line?: number;
  depth?: number;
  maxItems?: number;
};

function logicalLineCount(source: string): number {
  if (!source) return 0;
  const newlines = source.match(/\n/g)?.length ?? 0;
  return newlines + (source.endsWith("\n") ? 0 : 1);
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
  const tag = firstDescendant(node, "tag_name")?.text;
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
    const keys = node
      .descendantsOfType(["bare_key", "quoted_key"])
      .filter((key): key is SyntaxNode => key !== null)
      .map((key) => cleanName(key.text));
    return keys.join(".") || "section";
  }
  if (language === "css" && kind === "section") {
    return node.type.replace(/_statement$/, "");
  }
  if (language === "vue" && kind === "section") return firstDescendant(node, "tag_name")?.text ?? "section";
  if (language === "embedded-template") return node.type === "output_directive" ? "output" : "directive";
  if (language === "razor" && kind === "section") {
    return node.type === "razor_block" ? "code" : node.type.replace(/^razor_|_directive$/g, "");
  }
  if (language === "tree-sitter-query") {
    if (node.type === "capture") return `@${firstDescendant(node, "identifier")?.text ?? "capture"}`;
    return firstDescendant(node, "identifier")?.text ?? node.type;
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
  return symbols.map(({ kind, name, startLine, endLine, children }) => ({
    kind: SHAPE_KIND[kind],
    name,
    startLine,
    endLine,
    children: publicSymbols(children),
  }));
}

function formatSymbols(
  roots: IndexedSymbol[],
  depth: number,
  maxItems: number,
  useByteRanges: boolean,
): { lines: string[]; shown: number; omitted: number } {
  const lines: string[] = [];
  let shown = 0;
  let omitted = 0;
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
      const label = symbol.name === symbol.kind && symbol.kind !== "constructor" ? shortKind : `${shortKind} ${symbol.name}`;
      lines.push(`${"  ".repeat(level)}${label} [${range}]`);
      shown++;
      visit(symbol.children, level + 1);
    }
  };
  visit(roots, 0);
  return { lines, shown, omitted };
}

export async function shapeSource(
  path: string,
  source: string,
  options: ShapeOptions = {},
  signal?: AbortSignal,
): Promise<ShapeResult> {
  if (options.symbol && options.line !== undefined) throw new Error("Use either symbol or line focus, not both");
  if (signal?.aborted) throw new Error("shape was cancelled");
  const spec = detectLanguage(path, source);
  if (!spec) throw new Error(`Unsupported source language for ${path}. Supported: ${supportedLanguages().join(", ")}`);

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
          startIndex: item.startIndex,
          endIndex: item.endIndex,
          children: [],
        });
      }
      symbols.sort((left, right) => left.startIndex - right.startIndex || right.endIndex - left.endIndex);
      const roots = nestSymbols(symbols);
      const flat = flatten(roots);
      const depth = Math.max(0, Math.min(options.depth ?? 4, 12));
      const maxItems = Math.max(1, Math.min(options.maxItems ?? DEFAULT_MAX_ITEMS, 500));

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

      const parseErrors = countParseErrors(tree.rootNode);
      const lineCount = logicalLineCount(source);
      const useByteRanges = lineCount === 1 && Buffer.byteLength(source, "utf8") >= 200;
      const formatted = formatSymbols(selectedRoots, depth, maxItems, useByteRanges);
      const header = `${path} ${spec.id} ${lineCount.toLocaleString()}L${parseErrors ? ` errors=${parseErrors}` : ""}`;
      const focusLine = options.line !== undefined && focus ? `\n@ ${focus}` : "";
      const noMatches = selectedRoots.length === 0 ? "\n[no match]" : "";
      const outline = formatted.lines.length ? `\n${formatted.lines.join("\n")}` : "";
      const omitted = formatted.omitted + Math.max(0, flat.length - symbols.length);
      const limit = omitted > 0 ? `\n[+${omitted} omitted]` : "";
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
        symbols: publicSymbols(selectedRoots),
        text: `${header}${focusLine}${noMatches}${outline}${limit}${incomplete}`,
      };
    } finally {
      tree.delete();
    }
  } finally {
    query?.delete();
    parser.delete();
  }
}
