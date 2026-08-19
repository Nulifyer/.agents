import { type Node as SyntaxNode, Parser, Query } from "web-tree-sitter";
import { detectLanguage, loadShapeLanguage, type LanguageSpec, supportedLanguages } from "./languages.ts";

const DEFAULT_MAX_ITEMS = 200;
const MAX_EXTRACTED_ITEMS = 2_000;
const MAX_SIGNATURE_LENGTH = 240;
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

export type CodeSymbol = {
  kind: SymbolKind;
  name: string;
  signature: string;
  startLine: number;
  endLine: number;
  startIndex: number;
  endIndex: number;
  children: CodeSymbol[];
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
    const key = firstDescendant(node, ["bare_key", "quoted_key"]);
    return key ? cleanName(key.text) : "section";
  }
  if (language === "css" && kind === "section") {
    return node.text.slice(0, node.text.indexOf("{") >= 0 ? node.text.indexOf("{") : undefined).trim();
  }
  if (language === "vue" && kind === "section") return firstDescendant(node, "tag_name")?.text ?? "section";
  if (language === "embedded-template") return node.text.replace(/\s+/g, " ").trim();
  if (language === "razor" && kind === "section") {
    return node.type === "razor_block" ? "code" : node.text.replace(/\s+/g, " ").trim();
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
    return cleanName(nested?.text ?? direct.text);
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

function bodyStart(node: SyntaxNode, spec: LanguageSpec): number | undefined {
  const language = spec.id;
  const direct = node.childForFieldName("body");
  if (direct) return direct.startIndex;

  if (node.type === "pair" || node.type.endsWith("_pair")) {
    const value = node.childForFieldName("value") ?? node.namedChildren.at(-1);
    if (value && ["object", "array", "block_mapping", "block_sequence", "flow_mapping", "flow_sequence"].includes(value.type)) {
      return value.startIndex;
    }
  }

  if (["element", "script_element", "style_element", "template_element"].includes(node.type)) {
    const startTag = firstDescendant(node, ["start_tag", "self_closing_tag"]);
    if (startTag) return startTag.endIndex;
  }

  if (node.type === "table" || node.type === "table_array_element") {
    const pair = firstDescendant(node, "pair");
    if (pair) return pair.startIndex;
  }

  if (language === "elisp" && ["function_definition", "macro_definition"].includes(node.type)) {
    return node.childForFieldName("parameters")?.endIndex;
  }

  if (language === "objective-c" && ["class_interface", "class_implementation"].includes(node.type)) {
    return firstDescendant(node, ["method_declaration", "method_definition", "property_declaration"])?.startIndex;
  }

  if (language === "julia") {
    const signature = node.type === "function_definition" ? firstDescendant(node, "signature") : undefined;
    if (signature) return signature.endIndex;
    const name = node.childForFieldName("name") ?? firstDescendant(node, ["identifier", "type_head"]);
    const next = name ? node.namedChildren.find((child) => child && child.startIndex >= name.endIndex) : undefined;
    if (next) return next.startIndex;
  }

  if (language === "haskell" && node.type === "function") return node.childForFieldName("match")?.startIndex;

  if (language === "razor" && node.type === "razor_block") {
    const brace = node.text.indexOf("{");
    if (brace >= 0) return node.startIndex + brace;
  }

  if (node.type === "variable_declarator") {
    const value = node.childForFieldName("value");
    const body = value?.childForFieldName("body");
    if (body) return body.startIndex;
  }

  if (language === "go" && node.type === "type_spec") {
    const type = node.childForFieldName("type");
    const brace = type?.text.indexOf("{") ?? -1;
    if (type && brace >= 0) return type.startIndex + brace;
  }

  if (["typescript", "tsx"].includes(language) && node.type === "type_alias_declaration") {
    const objectType = firstDescendant(node, "object_type");
    if (objectType) return objectType.startIndex;
  }

  const defaultBodyTypes: Record<string, string[]> = {
    bash: ["compound_statement"],
    go: ["field_declaration_list", "block"],
    kotlin: ["class_body", "enum_class_body", "function_body", "block"],
    rust: ["declaration_list", "field_declaration_list", "ordered_field_declaration_list", "enum_variant_list", "block"],
    tsx: ["class_body", "interface_body", "enum_body", "statement_block"],
    typescript: ["class_body", "interface_body", "enum_body", "statement_block"],
  };
  return firstDescendant(node, spec.bodyTypes ?? defaultBodyTypes[language] ?? [])?.startIndex;
}

function signatureFor(source: string, item: SyntaxNode, definition: SyntaxNode, spec: LanguageSpec): string {
  const bodyIndex = bodyStart(definition, spec);
  const endIndex = bodyIndex && bodyIndex > item.startIndex ? bodyIndex : item.endIndex;
  const normalized = source
    .slice(item.startIndex, endIndex)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[;{]\s*$/, "")
    .trim();
  if (normalized.length <= MAX_SIGNATURE_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_SIGNATURE_LENGTH - 1).trimEnd()}…`;
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

function nestSymbols(symbols: CodeSymbol[]): CodeSymbol[] {
  const roots: CodeSymbol[] = [];
  const stack: CodeSymbol[] = [];
  for (const symbol of symbols) {
    while (stack.length > 0) {
      const parent = stack.at(-1) as CodeSymbol;
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

function flatten(symbols: CodeSymbol[]): CodeSymbol[] {
  const result: CodeSymbol[] = [];
  const visit = (items: CodeSymbol[]) => {
    for (const item of items) {
      result.push(item);
      visit(item.children);
    }
  };
  visit(symbols);
  return result;
}

function findPath(roots: CodeSymbol[], target: CodeSymbol): CodeSymbol[] {
  const path: CodeSymbol[] = [];
  const visit = (items: CodeSymbol[]): boolean => {
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

function formatSymbols(roots: CodeSymbol[], depth: number, maxItems: number): { lines: string[]; shown: number; omitted: number } {
  const lines: string[] = [];
  let shown = 0;
  let omitted = 0;
  const visit = (items: CodeSymbol[], level: number) => {
    for (const symbol of items) {
      if (shown >= maxItems || level > depth) {
        omitted += flatten([symbol]).length;
        continue;
      }
      const range = symbol.startLine === symbol.endLine ? `${symbol.startLine}` : `${symbol.startLine}-${symbol.endLine}`;
      lines.push(`${"  ".repeat(level)}${symbol.signature || `${symbol.kind} ${symbol.name}`} [${range}]`);
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
  if (signal?.aborted) throw new Error("code_shape was cancelled");
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
    if (!tree) throw new Error(signal?.aborted ? "code_shape was cancelled" : "Tree-sitter parse budget exceeded");
    if (signal?.aborted || Date.now() > deadline) {
      tree.delete();
      throw new Error(signal?.aborted ? "code_shape was cancelled" : "Tree-sitter parse budget exceeded");
    }
    try {
      query = new Query(language, spec.query);
      const captures = query.captures(tree.rootNode, {
        matchLimit: MAX_EXTRACTED_ITEMS * 4,
        timeoutMicros: PARSE_BUDGET_MS * 1_000,
        progressCallback: () => signal?.aborted === true,
      });
      const seen = new Set<string>();
      const symbols: CodeSymbol[] = [];
      for (const capture of captures) {
        if (symbols.length >= MAX_EXTRACTED_ITEMS) break;
        const definition = capture.node;
        const capturedKind = capture.name as SymbolKind;
        const name = symbolName(definition, capturedKind, spec.id);
        if (!name) continue;
        const kind = adjustedKind(definition, capturedKind, spec.id, name);
        const item = expandedNode(definition, spec.id);
        const key = `${item.startIndex}:${item.endIndex}`;
        if (seen.has(key)) continue;
        seen.add(key);
        symbols.push({
          kind,
          name,
          signature: signatureFor(source, item, definition, spec),
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
        selectedRoots = flat.filter((symbol) => symbol.name === options.symbol);
        focus = `symbol ${options.symbol}`;
      } else if (options.line !== undefined) {
        const candidates = flat
          .filter((symbol) => symbol.startLine <= (options.line as number) && (options.line as number) <= symbol.endLine)
          .sort((left, right) => left.endIndex - left.startIndex - (right.endIndex - right.startIndex));
        const target = candidates[0];
        selectedRoots = target ? [target] : [];
        focus = target ? findPath(roots, target).map((symbol) => symbol.name).join(" > ") : `line ${options.line}`;
      }

      const formatted = formatSymbols(selectedRoots, depth, maxItems);
      const parseErrors = countParseErrors(tree.rootNode);
      const lineCount = logicalLineCount(source);
      const header = `${path}\n${spec.id} | ${lineCount.toLocaleString()} lines | ${flat.length.toLocaleString()} definitions | parse: ${parseErrors ? `${parseErrors} recovered errors` : "clean"}`;
      const focusLine = focus ? `\nfocus: ${focus}` : "";
      const noMatches = selectedRoots.length === 0 ? "\n\n[No matching definitions]" : "";
      const outline = formatted.lines.length ? `\n\n${formatted.lines.join("\n")}` : "";
      const omitted = formatted.omitted + Math.max(0, flat.length - symbols.length);
      const limit = omitted > 0 ? `\n\n[${omitted} definitions omitted; narrow with symbol or line]` : "";
      const queryLimited = query.didExceedMatchLimit() || symbols.length >= MAX_EXTRACTED_ITEMS;
      const incomplete = queryLimited ? "\n\n[Tree-sitter query limit reached; outline may be incomplete]" : "";
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
        symbols: selectedRoots,
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
