import { afterEach, describe, expect, test } from "bun:test";
import {
	chmodSync,
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type ExtractOptions,
	type ExtractResult,
	parseArgs,
	parsePageRange,
} from "./document-read.ts";

const roots: string[] = [];
const { PATH: originalPath } = process.env;

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "document-container-test-"));
	roots.push(root);
	const state = join(root, "state.json");
	const response = {
		protocol: 1,
		ocrUsed: true,
		versions: { xberg: "1.3.10", whisper: "1.9.5" },
		document: {
			content: `# Report\n\n## Findings\n\n![chart](images/image_0.png)\n${"Bounded evidence. ".repeat(220)}`,
			pages: [{ pageNumber: 2 }],
			images: [
				{
					imagePath: "images/image_0.png",
					pageNumber: 2,
					boundingBox: { x0: 1, y0: 2, x1: 3, y1: 4 },
				},
			],
		},
		files: [
			{
				path: "images/image_0.png",
				base64: Buffer.from("image bytes").toString("base64"),
			},
		],
	};
	const configuration = {
		imageId: "sha256:fixture-one",
		response,
		fail: false,
		brokenIsolation: false,
	};
	function save() {
		writeFileSync(state, JSON.stringify(configuration));
	}
	save();
	const runtime = join(root, "docker");
	writeFileSync(
		runtime,
		`#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const state = process.env.DOCUMENT_READ_FAKE_RUNTIME;
const root = state.slice(0,state.lastIndexOf("/"));
const config = JSON.parse(readFileSync(state,"utf8"));
const args = process.argv.slice(2);
const marker = join(root,"container");
appendFileSync(join(root,"commands"),JSON.stringify(args)+"\\n");
if (args[0] === "info") process.exit(0);
if (args[0] === "image") { console.log(JSON.stringify([{Id:config.imageId,Size:1}])); process.exit(0); }
if (args[0] === "create") { writeFileSync(marker,"running"); console.log("fixture-container"); process.exit(0); }
if (args[0] === "container") {
    if (!existsSync(marker)) { console.error("Error: No such container"); process.exit(1); }
    console.log(JSON.stringify([{HostConfig:{NetworkMode:config.brokenIsolation ? "bridge" : "none",ReadonlyRootfs:true}}])); process.exit(0);
}
if (args[0] === "start") {
    const input = await Bun.stdin.arrayBuffer();
    writeFileSync(join(root,"input-size"),String(input.byteLength));
    if (config.fail) { console.error("conversion fixture failed"); process.exit(7); }
    rmSync(marker,{force:true});
    console.log(JSON.stringify(config.response)); process.exit(0);
}
if (args[0] === "rm") { rmSync(marker,{force:true}); process.exit(0); }
throw new Error("Unexpected fake runtime command");
`,
	);
	chmodSync(runtime, 0o755);
	const source = join(root, "Quarterly report, final.pdf");
	writeFileSync(source, "document input");
	const options = {
		image: "fixture:local",
		runtime: "docker" as const,
		cacheDir: join(root, "cache"),
	};
	const commands = () =>
		readFileSync(join(root, "commands"), "utf8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as string[]);
	return { root, source, options, configuration, save, commands };
}

async function convert(
	f: ReturnType<typeof fixture>,
	options: ExtractOptions,
): Promise<ExtractResult> {
	const target = new URL("./document-read.ts", import.meta.url).pathname;
	const code = `import {extractDocument} from ${JSON.stringify(target)}; console.log(JSON.stringify(await extractDocument(process.argv[1], JSON.parse(process.argv[2]))));`;
	const child = Bun.spawn(
		[process.execPath, "-e", code, f.source, JSON.stringify(options)],
		{
			env: {
				...process.env,
				PATH: `${f.root}:${originalPath ?? ""}`,
				DOCUMENT_READ_FAKE_RUNTIME: join(f.root, "state.json"),
			},
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (exitCode !== 0) throw new Error(stderr);
	return JSON.parse(stdout) as ExtractResult;
}

afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});

describe("container document extraction", () => {
	test("accepts document controls and rejects retired engines and invalid page numbers", () => {
		expect(
			parseArgs([
				"report.pdf",
				"--ocr",
				"force",
				"--images",
				"describe",
				"--pages",
				"2-4",
				"--runtime",
				"podman",
				"--image",
				"local:ready",
			]).options,
		).toEqual({
			ocr: "force",
			images: "describe",
			pages: { start: 2, end: 4 },
			runtime: "podman",
			image: "local:ready",
		});
		expect(parsePageRange("7")).toEqual({ start: 7, end: 7 });
		for (const value of ["8-3", "0", "99999999999999999999999999999"])
			expect(() => parsePageRange(value)).toThrow();
		expect(() => parseArgs(["file.pdf", "--engine", "host"])).toThrow(
			"unknown option",
		);
		expect(() => parseArgs(["one.pdf", "two.pdf"])).toThrow("one input file");
	});

	test("saves bounded previews, complete artifacts and source picture provenance", async () => {
		const f = fixture();
		const result = await convert(f, {
			...f.options,
			maxChars: 1000,
		});
		expect(result.engineUsed).toBe("xberg");
		expect(result.converterPackage).toBe("@xberg-io/xberg@1.3.10");
		expect(result.text).toHaveLength(1000);
		expect(result.textTruncated).toBe(true);
		expect(result.outline.map((item) => item.title)).toEqual([
			"Report",
			"Findings",
		]);
		expect(result.pictures[0]).toMatchObject({
			page: 2,
			bbox: [1, 2, 3, 4],
			imagePath: result.imagePaths[0],
		});
		expect(readFileSync(result.imagePaths[0] ?? "", "utf8")).toBe(
			"image bytes",
		);
		expect(readFileSync(result.markdownPath, "utf8").length).toBeGreaterThan(
			1000,
		);
		expect(
			JSON.parse(readFileSync(result.documentJsonPath, "utf8")).images[0]
				.pageNumber,
		).toBe(2);
		expect(readFileSync(join(f.root, "input-size"), "utf8")).toBe("14");
		const create = f.commands().find((args) => args[0] === "create") ?? [];
		for (const flag of [
			"--rm",
			"--network=none",
			"--read-only",
			"--pull=never",
			"--interactive",
		])
			expect(create).toContain(flag);
		expect(create).not.toContain("--mount");
		expect(create).toContain("sha256:fixture-one");
		expect(existsSync(join(f.root, "container"))).toBe(false);
	});

	test("reuses artifacts across preview sizes and invalidates the cache when the image changes", async () => {
		const f = fixture();
		const first = await convert(f, {
			...f.options,
			maxChars: 1000,
		});
		const cached = await convert(f, {
			...f.options,
			maxChars: 2000,
		});
		expect(cached.cacheHit).toBe(true);
		expect(cached.text).toHaveLength(2000);
		expect(cached.markdownPath).toBe(first.markdownPath);
		expect(f.commands().filter((args) => args[0] === "start")).toHaveLength(1);
		f.configuration.imageId = "sha256:fixture-two";
		f.save();
		const rebuilt = await convert(f, f.options);
		expect(rebuilt.cacheHit).toBe(false);
		expect(rebuilt.markdownPath).not.toBe(first.markdownPath);
		expect(rebuilt.containerImageId).toBe("sha256:fixture-two");
	});

	test("rebuilds missing or escaped artifacts without following cache symlinks", async () => {
		const f = fixture();
		const first = await convert(f, f.options);
		const outside = join(f.root, "outside.png");
		writeFileSync(outside, "unrelated image");
		const image = first.imagePaths[0] ?? "";
		unlinkSync(image);
		symlinkSync(outside, image);
		const restored = await convert(f, f.options);
		expect(restored.cacheHit).toBe(false);
		expect(readFileSync(restored.imagePaths[0] ?? "", "utf8")).toBe(
			"image bytes",
		);
		expect(readFileSync(outside, "utf8")).toBe("unrelated image");
		unlinkSync(restored.imagePaths[0] ?? "");
		expect((await convert(f, f.options)).cacheHit).toBe(false);
	});

	test("preserves a good cache after a failed refresh and cleans up the job", async () => {
		const f = fixture();
		const first = await convert(f, f.options);
		f.configuration.fail = true;
		f.save();
		await expect(convert(f, { ...f.options, refresh: true })).rejects.toThrow(
			"conversion fixture failed",
		);
		expect(existsSync(join(f.root, "container"))).toBe(false);
		expect((await convert(f, f.options)).cacheHit).toBe(true);
		expect(existsSync(first.markdownPath)).toBe(true);
		expect(
			readdirSync(f.options.cacheDir).filter((name) => name.startsWith(".")),
		).toEqual([]);
	});

	test("reports the media engine and keeps previews bounded around full transcripts", async () => {
		const f = fixture();
		f.source = join(f.root, "recording.wav");
		writeFileSync(f.source, "audio fixture");
		f.configuration.response.ocrUsed = false;
		f.configuration.response.files = [];
		f.configuration.response.document.images = [];
		Object.assign(f.configuration.response.document, {
			extractionMethod: "transcription",
		});
		f.save();
		const result = await convert(f, { ...f.options, maxChars: 1000 });
		expect(result.engineUsed).toBe("whisper.cpp");
		expect(result.converterPackage).toBe("whisper.cpp@1.9.5");
		expect(result.ocrMode).toBe("off");
		expect(result.ocrUsed).toBe(false);
		expect(result.imagePaths).toEqual([]);
		expect(result.textTruncated).toBe(true);
	});

	test("rejects invalid image paths and unisolated jobs without leaving partial results", async () => {
		const f = fixture();
		f.configuration.response.files = [
			{ path: "../outside.png", base64: "aW1hZ2U=" },
		];
		f.save();
		await expect(convert(f, f.options)).rejects.toThrow(
			"invalid image artifact",
		);
		expect(readdirSync(f.options.cacheDir)).toEqual([]);
		expect(existsSync(join(f.root, "container"))).toBe(false);
		f.configuration.brokenIsolation = true;
		f.save();
		await expect(convert(f, f.options)).rejects.toThrow("isolation settings");
		expect(existsSync(join(f.root, "container"))).toBe(false);
	});
});
