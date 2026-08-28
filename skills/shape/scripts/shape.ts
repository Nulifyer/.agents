#!/usr/bin/env bun

import { open, type FileHandle } from "node:fs/promises";
import {
  adapterById,
  adapters,
  adaptersForDomain,
  normalizeDomain,
  probeBytes,
  probeName,
  routeByQuestion,
  selectEvidence,
  type AdapterDescriptor,
  type ProbeEvidence,
  type ShapeDomain,
} from "./registry.ts";

export { routeByQuestion, routeByTarget } from "./registry.ts";

function usage(): string {
  return [
    "Usage: shape <target> [--question <text>] [--as <domain>] [--adapter <id>] [adapter options]",
    "       shape --list [domain]",
    "       shape --help [domain|adapter]",
    "       shape <target> --probe",
    "",
    "--adapter skips routing. --as skips cross-domain routing but still selects a format adapter.",
  ].join("\n");
}

function list(domain?: ShapeDomain): string {
  const selected = domain ? adaptersForDomain(domain) : [...adapters];
  return selected.map((adapter) => `${adapter.id.padEnd(10)} ${adapter.domain.padEnd(9)} ${adapter.summary}`).join("\n");
}

async function header(target: string): Promise<Uint8Array> {
  if (target === "-" || /^(?:https?|postgres(?:ql)?):\/\//i.test(target)) return new Uint8Array();
  let file: FileHandle;
  try {
    file = await open(target, "r");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "EISDIR") return new Uint8Array();
    throw error;
  }
  try {
    const bytes = Buffer.alloc(4096);
    try {
      const result = await file.read(bytes, 0, bytes.length, 0);
      return bytes.subarray(0, result.bytesRead);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "EISDIR") return new Uint8Array();
      throw error;
    }
  } finally {
    await file.close();
  }
}

function describeEvidence(evidence: ProbeEvidence[]): string {
  if (!evidence.length) return "no adapter evidence";
  return evidence
    .sort((left, right) => right.confidence - left.confidence)
    .map((item) => `${item.adapter} ${(item.confidence * 100).toFixed(0)}%: ${item.reason}`)
    .join("\n");
}

async function invoke(adapter: AdapterDescriptor, forwarded: string[]): Promise<void> {
  const child = Bun.spawn([process.execPath, adapter.script, ...(adapter.extraArgs ?? []), ...forwarded], {
    stdin: forwarded.includes("-") ? "inherit" : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (exitCode !== 0) process.exitCode = exitCode;
}

function targetFrom(args: string[]): string | undefined {
  const flagsWithValues = new Set(["-o", "--max-output", "--names", "--source", "--access", "-m", "--match", "-s", "--symbol", "-l", "--line", "--table", "--format"]);
  for (let index = 0; index < args.length; index++) {
    const argument = args[index] as string;
    if (flagsWithValues.has(argument)) {
      index++;
      continue;
    }
    if (argument === "-" || !argument.startsWith("-")) return argument;
  }
  return undefined;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  if (!args.length) {
    console.log(usage());
    return;
  }
  if (args[0] === "--list") {
    const domain = args[1] ? normalizeDomain(args[1]) : undefined;
    if (args[1] && !domain) throw new Error(`Unknown domain: ${args[1]}`);
    console.log(list(domain));
    return;
  }
  if (args[0] === "--help" || args[0] === "-h") {
    const subject = args[1];
    if (!subject) {
      console.log(`${usage()}\n\nAdapters:\n${list()}`);
      return;
    }
    const adapter = adapterById(subject);
    const domain = normalizeDomain(subject);
    if (adapter) {
      console.log(`${adapter.id} (${adapter.domain}): ${adapter.summary}\nDirect: shape <target> --adapter ${adapter.id} [options]\n`);
      await invoke(adapter, ["--help"]);
      return;
    }
    if (domain) {
      console.log(list(domain));
      return;
    }
    throw new Error(`Unknown domain or adapter: ${subject}`);
  }

  const forwarded: string[] = [];
  let explicitAdapter: AdapterDescriptor | undefined;
  let explicitDomain: ShapeDomain | undefined;
  let question = "";
  let probeOnly = false;
  let explainRoute = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index] as string;
    if (argument === "--adapter") {
      const id = args[++index];
      explicitAdapter = id ? adapterById(id) : undefined;
      if (!explicitAdapter) throw new Error(`Unknown adapter: ${id ?? "<missing>"}`);
    } else if (argument === "--as") {
      const value = args[++index];
      explicitDomain = value ? normalizeDomain(value) : undefined;
      if (!explicitDomain) throw new Error(`Unknown domain: ${value ?? "<missing>"}`);
    } else if (argument === "--question") {
      question = args[++index] ?? "";
    } else if (argument === "--probe") {
      probeOnly = true;
    } else if (argument === "--explain-route") {
      explainRoute = true;
    } else {
      forwarded.push(argument);
    }
  }
  const target = targetFrom(forwarded);
  if (!target) throw new Error("A target is required");
  if (explicitAdapter?.extraArgs && forwarded.includes("--format")) {
    throw new Error("--adapter already fixes the format; remove --format or select the generic binary adapter");
  }
  const accessIndex = forwarded.indexOf("--access");
  const assertedAccess = accessIndex >= 0 ? forwarded[accessIndex + 1] : undefined;
  const questionDomain = routeByQuestion(question);
  const nameEvidence = explicitAdapter ? [] : probeName(target);
  const nameDomain = selectEvidence(nameEvidence);
  const routedNameDomain = nameDomain && nameDomain.confidence >= 0.7 ? adapterById(nameDomain.adapter)?.domain : undefined;
  const prospectiveDomain = explicitDomain ?? questionDomain ?? routedNameDomain;
  const needsFormatProbe = !explicitAdapter && (!prospectiveDomain || prospectiveDomain === "binary");
  if (needsFormatProbe && assertedAccess === "declared") {
    throw new Error("Automatic header probing uses metadata access; choose --adapter or a non-binary --as domain when --access declared is required");
  }
  const evidence = [
    ...(needsFormatProbe ? probeBytes(await header(target)) : []),
    ...nameEvidence,
  ];
  if (probeOnly) {
    console.log(describeEvidence(evidence));
    return;
  }

  const selected = selectEvidence(evidence);
  let adapter = explicitAdapter;
  if (!adapter && explicitDomain) {
    const withinDomain = evidence.map((item) => adapterById(item.adapter)).find((item) => item?.domain === explicitDomain);
    adapter = withinDomain ?? adapterById(explicitDomain) ?? adaptersForDomain(explicitDomain)[0];
  }
  if (!adapter && questionDomain) {
    const withinDomain = evidence.map((item) => adapterById(item.adapter)).find((item) => item?.domain === questionDomain);
    adapter = withinDomain ?? adapterById(questionDomain) ?? adaptersForDomain(questionDomain)[0];
  }
  adapter ??= selected ? adapterById(selected.adapter) : undefined;
  if (!adapter) throw new Error("Ambiguous target. Add --as, --adapter, or a more specific --question");
  if (explainRoute) {
    console.error(`selected ${adapter.id} (${adapter.domain})${explicitAdapter ? " by --adapter" : explicitDomain ? " within --as" : questionDomain ? " from --question and probes" : " from probes"}`);
    console.error(describeEvidence(evidence));
  }
  await invoke(adapter, forwarded);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
