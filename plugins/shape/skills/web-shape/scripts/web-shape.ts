#!/usr/bin/env bun

import {
  parseCommonArgs,
  readTarget,
  renderShape,
  safeText,
  type CommonOptions,
  type ShapeNode,
  type ShapeResult,
} from "../../../packages/shape-core/src/index.ts";

const SEMANTIC_TAGS = new Set([
  "a",
  "aside",
  "button",
  "details",
  "dialog",
  "fieldset",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "iframe",
  "img",
  "input",
  "main",
  "nav",
  "ol",
  "select",
  "summary",
  "table",
  "textarea",
  "ul",
]);
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

type Frame = { tag: string; node?: ShapeNode; text: string[]; hidden: boolean };

function usage(): string {
  return "Usage: web-shape <html-file|url> [--labels] [--names show|hash|omit] [-o <chars>] [-j]\n       web-shape - <name.html> [options]";
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of tag.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const name = match[1]?.toLowerCase();
    if (name && !name.startsWith("<")) result.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function sanitizedDestination(value: string | undefined): string | undefined {
  if (!value || /^(?:javascript|data):/i.test(value)) return undefined;
  try {
    const url = new URL(value, "https://shape.invalid");
    if (url.origin === "https://shape.invalid") return url.pathname;
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

function kindFor(tag: string, attrs: Map<string, string>): string {
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "a") return "link";
  if (tag === "input") {
    const type = attrs.get("type")?.toLowerCase() ?? "text";
    if (["button", "submit", "reset", "image"].includes(type)) return "button";
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    return "input";
  }
  if (tag === "ul" || tag === "ol") return "list";
  return tag;
}

function htmlShape(name: string, source: string): ShapeResult {
  const roots: ShapeNode[] = [];
  const stack: Frame[] = [];
  const counts = new Map<string, number>();
  const tokens = source.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+/g);
  for (const token of tokens) {
    const value = token[0];
    if (!value.startsWith("<")) {
      const text = safeText(value, 200);
      if (text) for (const frame of stack) if (frame.node) frame.text.push(text);
      continue;
    }
    if (/^<!/.test(value)) continue;
    const closing = /^<\//.test(value);
    const tag = /^<\/?\s*([A-Za-z][\w:-]*)/.exec(value)?.[1]?.toLowerCase();
    if (!tag) continue;
    if (closing) {
      let frame: Frame | undefined;
      do frame = stack.pop(); while (frame && frame.tag !== tag);
      if (frame?.node && !frame.node.label && ["button", "heading", "link", "summary"].includes(frame.node.kind)) {
        frame.node.label = safeText(frame.text.join(" "), 120) || undefined;
      }
      continue;
    }
    const attrs = attributes(value);
    const parentHidden = stack.some((frame) => frame.hidden);
    const hidden = parentHidden || attrs.has("hidden") || attrs.get("aria-hidden") === "true" || /display\s*:\s*none/i.test(attrs.get("style") ?? "");
    let node: ShapeNode | undefined;
    if (SEMANTIC_TAGS.has(tag) && !hidden) {
      const kind = kindFor(tag, attrs);
      const count = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, count);
      const structuralName = attrs.get("id") || attrs.get("name") || (tag === "a" ? sanitizedDestination(attrs.get("href")) : undefined);
      const traits: string[] = [];
      if (/^h[1-6]$/.test(tag)) traits.push(`level=${tag.slice(1)}`);
      const inputType = tag === "input" ? attrs.get("type") ?? "text" : undefined;
      if (inputType) traits.push(`type=${inputType}`);
      if (attrs.has("required")) traits.push("required");
      if (attrs.has("disabled")) traits.push("disabled");
      if (attrs.has("checked")) traits.push("checked");
      if (attrs.has("selected")) traits.push("selected");
      const destination = tag === "a" ? sanitizedDestination(attrs.get("href")) : undefined;
      if (destination) traits.push(`to=${destination}`);
      node = {
        kind,
        name: structuralName,
        label: attrs.get("aria-label") || attrs.get("alt") || attrs.get("title") || attrs.get("placeholder") || undefined,
        traits: traits.length ? traits : undefined,
        locator: { type: "dom", value: attrs.get("id") ? `#${attrs.get("id")}` : `${tag}[${count}]` },
      };
      const parent = [...stack].reverse().find((frame) => frame.node)?.node;
      if (parent) {
        parent.children ??= [];
        parent.children.push(node);
      } else roots.push(node);
    }
    if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(value)) stack.push({ tag, node, text: [], hidden });
  }
  return { source: name, domain: "web", format: "html-static", access: "observed", nodes: roots, incomplete: /<script\b/i.test(source) };
}

async function sourceFor(path: string, virtualName: string | undefined): Promise<{ name: string; source: string }> {
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    const response = await fetch(path, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status} while fetching page`);
    return { name: url.toString(), source: await response.text() };
  }
  const target = await readTarget(path, virtualName);
  return { name: target.name, source: target.bytes.toString("utf8") };
}

export async function shapeWeb(path: string, virtualName: string | undefined, options: CommonOptions): Promise<ShapeResult> {
  if (options.access === "rendered") throw new Error("Rendered web shape requires a Chromium adapter, which is not installed");
  if (options.access && options.access !== "observed") throw new Error("Static HTML requires --access observed");
  const target = await sourceFor(path, virtualName);
  return htmlShape(target.name, target.source);
}

async function main(): Promise<void> {
  const parsed = parseCommonArgs(process.argv.slice(2));
  if (parsed.rest.includes("--help") || parsed.rest.includes("-h")) {
    console.log(usage());
    return;
  }
  const path = parsed.rest[0];
  if (!path) throw new Error("An HTML file or URL is required");
  const result = await shapeWeb(path, path === "-" ? parsed.rest[1] : undefined, parsed.options);
  process.stdout.write(renderShape(result, parsed.options));
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
