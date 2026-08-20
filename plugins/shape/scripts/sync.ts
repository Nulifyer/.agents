#!/usr/bin/env bun

import { cp, mkdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const pluginRoot = resolve(import.meta.dir, "..");
const repositoryRoot = resolve(pluginRoot, "../..");
if (basename(pluginRoot) !== "shape" || basename(resolve(pluginRoot, "..")) !== "plugins") {
  throw new Error(`Refusing to sync unexpected plugin path: ${pluginRoot}`);
}

const skillNames = ["shape", "code-shape", "web-shape", "doc-shape", "data-shape", "db-shape", "api-shape"];
const skillsTarget = join(pluginRoot, "skills");
const packagesTarget = join(pluginRoot, "packages");

await rm(skillsTarget, { recursive: true, force: true });
await rm(packagesTarget, { recursive: true, force: true });
await mkdir(skillsTarget, { recursive: true });
await mkdir(packagesTarget, { recursive: true });

const filter = (source: string): boolean => !source.split("/").includes("node_modules") && !source.endsWith(".test.ts");
for (const skillName of skillNames) {
  await cp(join(repositoryRoot, "skills", skillName), join(skillsTarget, skillName), { recursive: true, filter });
}
await cp(join(repositoryRoot, "packages", "shape-core"), join(packagesTarget, "shape-core"), { recursive: true, filter });

console.log(`Synced ${skillNames.length} skills and shape-core into ${pluginRoot}`);
