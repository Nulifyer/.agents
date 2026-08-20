#!/usr/bin/env bun

import { extname, resolve } from "node:path";

type Domain = "api" | "code" | "data" | "db" | "doc" | "web";

function usage(): string {
  return "Usage: shape <target> --as <api|code|data|db|doc|web> [domain options]\n       shape <target> --question <text> [domain options]";
}

export function routeByQuestion(question: string): Domain | undefined {
  const value = question.toLowerCase();
  if (/\b(endpoints?|operations?|openapi|swagger|graphql|protobuf|grpc|request schemas?|response schemas?|api contracts?)\b/.test(value)) return "api";
  if (/\b(datasets?|records?|spreadsheets?|workbooks?|sheets?|csv|parquet|arrays?)\b/.test(value)) return "data";
  if (/\b(tables?|foreign keys?|indexes|database|catalog|relations?|schema migrations?)\b/.test(value)) return "db";
  if (/\b(buttons?|links?|forms?|click|accessible|landmarks?|page controls?|navigation)\b/.test(value)) return "web";
  if (/\b(documents?|outlines?|headings?|sections?|pages?|footnotes?|figures?|paragraphs?)\b/.test(value)) return "doc";
  if (/\b(fields?|columns?)\b/.test(value)) return "data";
  if (/\b(implementations?|declarations?|callbacks?|functions?|classes|config|source|owners?|cte|sql statements?)\b/.test(value)) return "code";
  return undefined;
}

export function routeByTarget(target: string): Domain | undefined {
  if (/^https?:\/\//i.test(target)) return "web";
  const extension = extname(target).toLowerCase();
  if ([".graphql", ".gql", ".graphqls", ".proto"].includes(extension)) return "api";
  if ([".csv", ".tsv", ".jsonl", ".ndjson", ".xlsx"].includes(extension)) return "data";
  if ([".sqlite", ".sqlite3", ".db"].includes(extension) || /^postgres(?:ql)?:\/\//i.test(target)) return "db";
  if ([".md", ".mdx", ".markdown", ".docx", ".pdf"].includes(extension)) return "doc";
  if ([".html", ".htm", ".xhtml", ".json", ".yaml", ".yml", ".sql"].includes(extension)) return undefined;
  return "code";
}

function domainScript(domain: Domain): string {
  const skills = resolve(import.meta.dir, "../..");
  const folder = domain === "db" ? "db-shape" : domain === "doc" ? "doc-shape" : `${domain}-shape`;
  return resolve(skills, folder, "scripts", `${folder}.ts`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    return;
  }
  const forwarded: string[] = [];
  let explicit: Domain | undefined;
  let question = "";
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--as") {
      const value = args[++index];
      if (!value || !["api", "code", "data", "db", "doc", "web"].includes(value)) {
        throw new Error("--as must be api, code, data, db, doc, or web");
      }
      explicit = value as Domain;
    } else if (argument === "--question") {
      question = args[++index] ?? "";
    } else forwarded.push(argument as string);
  }
  const target = forwarded.find((argument) => !argument.startsWith("-"));
  if (!target) throw new Error("A target is required");
  const domain = explicit ?? routeByQuestion(question) ?? routeByTarget(target);
  if (!domain) throw new Error("Ambiguous target. Add --as or a more specific --question; HTML, JSON, YAML, and SQL can have several shapes");
  if (domain === "code" && forwarded.some((argument) => ["--names", "--labels", "--access"].includes(argument))) {
    throw new Error("code-shape does not yet support --names, --labels, or --access");
  }
  const child = Bun.spawn([process.execPath, domainScript(domain), ...forwarded], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (exitCode !== 0) process.exitCode = exitCode;
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
