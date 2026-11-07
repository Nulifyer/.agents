import { readFile, writeFile } from "node:fs/promises";

const path = "/usr/local/share/document-read/build-info.json";
const manifest = JSON.parse(await readFile(path, "utf8"));
const packages = Bun.spawnSync(["apk", "list", "--installed"]);
if (packages.exitCode !== 0) throw new Error(packages.stderr.toString());
const xberg = JSON.parse(
	await readFile(
		"/opt/document-read/node_modules/@xberg-io/xberg/package.json",
		"utf8",
	),
);
if (
	Bun.version !== manifest.versions.bun ||
	xberg.version !== manifest.versions.xberg
)
	throw new Error(
		"Installed Bun/Xberg versions differ from resolved build inputs",
	);
manifest.alpine = (await readFile("/etc/alpine-release", "utf8")).trim();
manifest.apkPackages = packages.stdout.toString().trim().split("\n");
await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
