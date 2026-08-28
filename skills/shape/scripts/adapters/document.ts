#!/usr/bin/env bun

import { extname } from "node:path";
import {
  parseCommonArgs,
  readTarget,
  renderShape,
  runCommand,
  safeText,
  xmlText,
  type CommonOptions,
  type ShapeNode,
  type ShapeResult,
} from "../lib/core.ts";

function usage(): string {
  return "Usage: doc-shape <markdown|docx|pdf file> [--labels] [--access metadata|observed] [--names show|hash|omit] [--source show|hash|omit] [-o <chars>] [-j]\n       doc-shape - <name.md> [options]";
}

function markdownShape(name: string, source: string): ShapeResult {
  const roots: ShapeNode[] = [];
  const stack: Array<{ level: number; node: ShapeNode }> = [];
  let fenced = false;
  let fenceStart = 0;
  let fenceLanguage = "";
  let inTable = false;
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const fence = /^\s*(```+|~~~+)\s*([^\s]*)/.exec(line);
    if (fence) {
      if (!fenced) {
        fenced = true;
        fenceStart = index + 1;
        fenceLanguage = fence[2] ?? "";
      } else {
        roots.push({ kind: "code-block", dataType: fenceLanguage || undefined, locator: { type: "line", start: fenceStart, end: index + 1 } });
        fenced = false;
      }
      continue;
    }
    if (fenced) continue;
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const node: ShapeNode = { kind: "section", label: heading[2], traits: [`level=${level}`], locator: { type: "line", start: index + 1 }, children: [] };
      while (stack.length && (stack.at(-1)?.level ?? 0) >= level) stack.pop();
      const parent = stack.at(-1)?.node;
      if (parent) {
        parent.children ??= [];
        parent.children.push(node);
      } else roots.push(node);
      stack.push({ level, node });
      inTable = false;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (!inTable) roots.push({ kind: "table", locator: { type: "line", start: index + 1 } });
      inTable = true;
    } else if (line.trim()) inTable = false;
  }
  if (fenced) roots.push({ kind: "code-block", dataType: fenceLanguage || undefined, locator: { type: "line", start: fenceStart }, traits: ["unterminated"] });
  return { source: name, domain: "document", format: "markdown", access: "observed", nodes: roots, incomplete: fenced };
}

function wordText(paragraph: string): string {
  return safeText([...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => xmlText(match[1] ?? "")).join(" "), 160);
}

async function docxShape(path: string): Promise<ShapeResult> {
  const document = await runCommand(["unzip", "-p", path, "word/document.xml"]);
  const nodes: ShapeNode[] = [];
  let paragraphIndex = 0;
  for (const match of document.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)) {
    paragraphIndex++;
    const paragraph = match[0];
    const style = /<w:pStyle\b[^>]*\bw:val="([^"]+)"/.exec(paragraph)?.[1];
    const levelMatch = style ? /(?:heading|title)\s*([1-9])?/i.exec(style) : undefined;
    if (!levelMatch) continue;
    const level = Number(levelMatch[1] ?? (style?.toLowerCase().includes("title") ? 1 : 2));
    nodes.push({ kind: "section", label: wordText(paragraph), traits: [`level=${level}`, `style=${style}`], locator: { type: "pointer", value: `/word/document.xml/body/p[${paragraphIndex}]` } });
  }
  let tableIndex = 0;
  for (const _match of document.matchAll(/<w:tbl(?:\s[^>]*)?>/g)) {
    tableIndex++;
    nodes.push({ kind: "table", locator: { type: "pointer", value: `/word/document.xml/body/tbl[${tableIndex}]` } });
  }
  let sectionIndex = 0;
  for (const _match of document.matchAll(/<w:sectPr(?:\s|\/?>)/g)) {
    sectionIndex++;
    nodes.push({ kind: "page-section", locator: { type: "pointer", value: `/word/document.xml/body/sectPr[${sectionIndex}]` } });
  }
  return { source: path, domain: "document", format: "docx", access: "observed", nodes };
}

function pdfInfoValue(info: string, key: string): string | undefined {
  return new RegExp(`^${key}:\\s*(.+)$`, "mi").exec(info)?.[1]?.trim();
}

async function pdfShape(path: string, options: CommonOptions): Promise<ShapeResult> {
  const info = await runCommand(["pdfinfo", path]);
  const pages = Number(pdfInfoValue(info, "Pages") ?? 0);
  const nodes: ShapeNode[] = [{ kind: "document", traits: pages ? [`pages=${pages}`] : undefined }];
  if (!options.labels) return { source: path, domain: "document", format: "pdf", access: "metadata", nodes, incomplete: true, notes: ["logical structure not inspected"] };
  if (options.access === "metadata") throw new Error("PDF labels require --access observed");
  const text = await runCommand(["pdftotext", "-layout", path, "-"]);
  const pageTexts = text.split("\f");
  const headings: ShapeNode[] = [];
  const seenHeadings = new Set<string>();
  for (let page = 0; page < pageTexts.length; page++) {
    const lines = (pageTexts[page] ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines.slice(0, 12)) {
      if (line.length > 100 || line.split(/\s+/).length > 12) continue;
      if (/^[\d\W]+$/.test(line)) continue;
      if (/^[A-Z\d][A-Z\d\s:.-]+$/.test(line) || /^\d+(?:\.\d+)*\s+\S/.test(line)) {
        const headingKey = line.toLowerCase().replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
        if (seenHeadings.has(headingKey)) continue;
        seenHeadings.add(headingKey);
        headings.push({ kind: "section", label: line, locator: { type: "page", page: page + 1 }, traits: ["inferred"] });
      }
    }
  }
  nodes.push(...headings);
  return { source: path, domain: "document", format: "pdf", access: "observed", nodes, incomplete: true, notes: ["outline inferred from layout"] };
}

export async function shapeDocument(path: string, virtualName: string | undefined, options: CommonOptions): Promise<ShapeResult> {
  const name = path === "-" ? virtualName : path;
  if (!name) throw new Error("stdin requires a virtual filename");
  const extension = extname(name).toLowerCase();
  if (extension === ".docx") {
    if (path === "-") throw new Error("DOCX stdin is not supported");
    if (options.access && options.access !== "observed") throw new Error("DOCX structural extraction currently requires --access observed");
    return docxShape(path);
  }
  if (extension === ".pdf") {
    if (path === "-") throw new Error("PDF stdin is not supported");
    return pdfShape(path, options);
  }
  if (options.access && options.access !== "observed") throw new Error("Text documents require --access observed");
  const target = await readTarget(path, virtualName);
  if ([".md", ".mdx", ".markdown"].includes(extension)) return markdownShape(target.name, target.bytes.toString("utf8"));
  throw new Error(`Unsupported document format: ${extension || name}`);
}

async function main(): Promise<void> {
  const parsed = parseCommonArgs(process.argv.slice(2));
  if (parsed.rest.includes("--help") || parsed.rest.includes("-h")) {
    console.log(usage());
    return;
  }
  const path = parsed.rest[0];
  if (!path) throw new Error("A document file is required");
  const result = await shapeDocument(path, path === "-" ? parsed.rest[1] : undefined, parsed.options);
  process.stdout.write(renderShape(result, parsed.options));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
