#!/usr/bin/env bun
import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const skillRoot = resolve(import.meta.dir, "..");
const containerRoot = join(import.meta.dir, "container");
const reportRoot = join(skillRoot, ".container");
const defaultImage = "ghcr.io/nulifyer/document-read:experimental";
export type Runtime = "docker" | "podman";
type Action = "setup" | "build" | "check";

export interface ContainerOptions {
	action: Action;
	image: string;
	runtime?: Runtime;
	network?: string;
	addHosts: string[];
	help: boolean;
}

export function parseContainerArgs(args: string[]): ContainerOptions {
	const {
		DOCUMENT_READ_CONTAINER_IMAGE: configuredImage,
		DOCUMENT_READ_CONTAINER_RUNTIME: configuredRuntime,
	} = process.env;
	const options: ContainerOptions = {
		action: "check",
		image: configuredImage ?? defaultImage,
		addHosts: [],
		help: false,
	};
	if (configuredRuntime !== undefined)
		options.runtime = parseRuntime(configuredRuntime);
	let actionSeen = false;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--") continue;
		if (arg === "--help" || arg === "-h") options.help = true;
		else if (arg === "setup" || arg === "build" || arg === "check") {
			if (actionSeen)
				throw new Error("Expected one action: setup, build, or check");
			options.action = arg;
			actionSeen = true;
		} else if (arg === "--runtime")
			options.runtime = parseRuntime(args[++index]);
		else if (arg === "--image") options.image = value(args[++index], "--image");
		else if (arg === "--network")
			options.network = value(args[++index], "--network");
		else if (arg === "--add-host")
			options.addHosts.push(value(args[++index], "--add-host"));
		else throw new Error(`Unknown option: ${arg}`);
	}
	if (!options.image.trim() || options.image.startsWith("-"))
		throw new Error("Expected an image reference");
	if (
		options.action !== "build" &&
		(options.network || options.addHosts.length)
	)
		throw new Error(
			"--network and --add-host configure builds only; checks always run offline",
		);
	return options;
}

function parseRuntime(runtime: string | undefined): Runtime {
	if (runtime === "docker" || runtime === "podman") return runtime;
	throw new Error("--runtime expects docker or podman");
}

function value(text: string | undefined, option: string): string {
	if (!text || text.startsWith("--"))
		throw new Error(`${option} expects a value`);
	return text;
}

async function command(
	args: string[],
	{
		capture = true,
		timeoutMs = 30_000,
		allowFailure = false,
		stdin = "ignore" as Bun.BunFile | "ignore",
		maxOutputBytes = 8 * 1024 * 1024,
	} = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const child = Bun.spawn(args, {
		stdin,
		stdout: capture ? "pipe" : "inherit",
		stderr: capture ? "pipe" : "inherit",
	});
	let expired = false;
	const timer = setTimeout(() => {
		expired = true;
		child.kill("SIGKILL");
	}, timeoutMs);
	async function bounded(
		stream: ReadableStream<Uint8Array> | null,
	): Promise<string> {
		if (!stream) return "";
		const reader = stream.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				size += value.byteLength;
				if (size > maxOutputBytes) {
					child.kill("SIGKILL");
					throw new Error("Container command output exceeded its byte limit");
				}
				chunks.push(value);
			}
			return Buffer.concat(chunks).toString();
		} finally {
			reader.releaseLock();
		}
	}
	try {
		const [stdout, stderr, exitCode] = await Promise.all([
			capture
				? bounded(child.stdout as ReadableStream<Uint8Array>)
				: Promise.resolve(""),
			capture
				? bounded(child.stderr as ReadableStream<Uint8Array>)
				: Promise.resolve(""),
			child.exited,
		]);
		if (expired) throw new Error(`${args[0]} ${args[1]} timed out`);
		if (exitCode !== 0 && !allowFailure)
			throw new Error(
				`${args[0]} ${args[1]} failed: ${stderr.trim().slice(0, 4000) || `exit ${exitCode}`}`,
			);
		return { stdout, stderr, exitCode };
	} finally {
		clearTimeout(timer);
		await child.exited;
	}
}

async function findRuntime(requested?: Runtime): Promise<Runtime> {
	const failures: string[] = [];
	for (const runtime of requested
		? [requested]
		: (["docker", "podman"] as Runtime[])) {
		if (!Bun.which(runtime)) {
			failures.push(`${runtime} is not on PATH`);
			continue;
		}
		try {
			await command([runtime, "info"], { timeoutMs: 5000 });
			return runtime;
		} catch (error) {
			failures.push(error instanceof Error ? error.message : String(error));
		}
	}
	throw new Error(
		`A working Docker or Podman runtime is required. ${failures.join("; ")}`,
	);
}

async function inspect(runtime: Runtime, image: string, allowFailure = false) {
	const result = await command([runtime, "image", "inspect", image], {
		allowFailure,
	});
	if (result.exitCode !== 0) return undefined;
	const images: { Id: string; RepoDigests?: string[]; Size: number }[] =
		JSON.parse(result.stdout);
	if (!images[0]?.Id)
		throw new Error("Container runtime returned no image identity");
	return images[0];
}

export interface ContainerContext {
	runtime: Runtime;
	image: string;
	imageId: string;
}

export async function resolveContainer(
	options: { runtime?: Runtime; image?: string } = {},
): Promise<ContainerContext> {
	const { DOCUMENT_READ_CONTAINER_RUNTIME, DOCUMENT_READ_CONTAINER_IMAGE } =
		process.env;
	const configuredRuntime = options.runtime ?? DOCUMENT_READ_CONTAINER_RUNTIME;
	const runtime = await findRuntime(
		configuredRuntime === undefined
			? undefined
			: parseRuntime(configuredRuntime),
	);
	const image = options.image ?? DOCUMENT_READ_CONTAINER_IMAGE ?? defaultImage;
	if (!image.trim() || image.startsWith("-"))
		throw new Error("Expected an image reference");
	const info = await inspect(runtime, image, true);
	if (!info)
		throw new Error(
			`Image ${image} is missing. From the document-read skill directory, run bun run setup or bun run container:build before initial publication.`,
		);
	return { runtime, image, imageId: info.Id };
}

async function assertRemoved(runtime: Runtime, name: string): Promise<void> {
	const result = await command([runtime, "container", "inspect", name], {
		allowFailure: true,
	});
	if (
		result.exitCode === 0 ||
		!/no such (?:container|object)|does not exist/i.test(result.stderr)
	)
		throw new Error(`Could not verify removal of container ${name}`);
}

async function isolatedJob(
	context: ContainerContext,
	args: string[],
	{
		timeoutMs = 60_000,
		stdin = "ignore" as Bun.BunFile | "ignore",
		maxOutputBytes = 8 * 1024 * 1024,
		check = false,
	} = {},
): Promise<string> {
	const { runtime, imageId } = context;
	const name = `document-read-${check ? "check" : "job"}-${randomUUID()}`;
	let failure: unknown;
	let output = "";
	try {
		await command([
			runtime,
			"create",
			"--rm",
			"--pull=never",
			"--network=none",
			"--read-only",
			"--memory=3g",
			"--memory-swap=3g",
			"--ulimit",
			"core=0",
			"--tmpfs",
			"/tmp:rw,mode=1777",
			"--user",
			"65532:65532",
			"--cap-drop=ALL",
			"--security-opt=no-new-privileges",
			"--name",
			name,
			"--label",
			`io.nulifyer.document-read.${check ? "check" : "job"}=true`,
			...(stdin === "ignore" ? [] : ["--interactive"]),
			"--entrypoint",
			"/usr/local/bin/bun",
			imageId,
			"--no-install",
			"/opt/document-read/watchdog.mjs",
			String(timeoutMs),
			...args,
		]);
		const identity = await command([runtime, "container", "inspect", name]);
		const jobs: {
			HostConfig: { NetworkMode: string; ReadonlyRootfs: boolean };
		}[] = JSON.parse(identity.stdout);
		if (
			jobs[0]?.HostConfig.NetworkMode !== "none" ||
			!jobs[0]?.HostConfig.ReadonlyRootfs
		)
			throw new Error("Container isolation settings were not applied");
		const result = await command(
			[
				runtime,
				"start",
				"--attach",
				...(stdin === "ignore" ? [] : ["--interactive"]),
				name,
			],
			{ stdin, timeoutMs: timeoutMs + 15_000, maxOutputBytes },
		);
		output = result.stdout;
		await assertRemoved(runtime, name);
	} catch (error) {
		failure = error;
	}
	try {
		await command([runtime, "rm", "--force", name], { allowFailure: true });
		await assertRemoved(runtime, name);
	} catch (error) {
		failure =
			failure === undefined
				? error
				: new AggregateError(
						[failure, error],
						"Container operation and cleanup failed",
					);
	}
	if (failure !== undefined) throw failure;
	return output;
}

export async function runContainerExtraction(
	context: ContainerContext,
	filePath: string,
	request: {
		extension: string;
		ocr: string;
		images: string;
		pages?: { start: number; end: number };
		timeoutSecs: number;
	},
	timeoutMs: number,
): Promise<unknown> {
	const output = await isolatedJob(
		context,
		[
			"bun",
			"--no-install",
			"/opt/document-read/extract.mjs",
			JSON.stringify(request),
		],
		{
			stdin: Bun.file(filePath),
			timeoutMs,
			maxOutputBytes: 128 * 1024 * 1024,
		},
	);
	return JSON.parse(output);
}

async function checkImage(runtime: Runtime, image: string): Promise<void> {
	const info = await inspect(runtime, image);
	if (!info)
		throw new Error(
			`Image ${image} is missing. Run bun run setup or bun run container:build.`,
		);
	const output = await isolatedJob(
		{ runtime, image, imageId: info.Id },
		["bun", "--no-install", "/opt/document-read/verify.mjs"],
		{ check: true, timeoutMs: 180_000 },
	);
	const report: unknown = JSON.parse(output.trim());
	if (!report || typeof report !== "object" || Array.isArray(report))
		throw new Error("Image returned an incomplete verification report");
	const {
		passedFixtures,
		malformedInputRejected,
		versions,
		extractionProtocol,
	} = report as Record<string, unknown>;
	if (
		!Array.isArray(passedFixtures) ||
		passedFixtures.length < 19 ||
		extractionProtocol !== 1 ||
		!["speech.wav", "speech.mp4", "picture-description"].every((name) =>
			passedFixtures.includes(name),
		) ||
		malformedInputRejected !== true ||
		!versions
	)
		throw new Error("Image returned an incomplete verification report");
	await mkdir(reportRoot, { recursive: true });
	const evidence = {
		...report,
		image,
		imageId: info.Id,
		runtime,
		checkedAt: new Date().toISOString(),
		containerRemoved: true,
	};
	await writeFile(
		join(reportRoot, "verification.json"),
		`${JSON.stringify(evidence, null, 2)}\n`,
	);
	console.log(JSON.stringify(evidence, null, 2));
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
	const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	const data: unknown = await response.json();
	if (!data || typeof data !== "object" || Array.isArray(data))
		throw new Error(`Expected an object from ${url}`);
	return data as Record<string, unknown>;
}

function release(data: Record<string, unknown>, key: string): string {
	const version = data[key];
	if (typeof version !== "string" || !/^[\da-z.-]+$/i.test(version))
		throw new Error(`Unexpected release ${key}`);
	const { prerelease, draft } = data;
	if (prerelease === true || draft === true)
		throw new Error("Expected a stable published release");
	return version;
}

async function buildImage(
	runtime: Runtime,
	options: ContainerOptions,
): Promise<void> {
	const [
		bun,
		xberg,
		tesseract,
		qpdf,
		tessdata,
		whisper,
		llama,
		whisperModels,
		visionModels,
	] = await Promise.all([
		fetchJson("https://api.github.com/repos/oven-sh/bun/releases/latest"),
		fetchJson("https://registry.npmjs.org/@xberg-io/xberg/latest"),
		fetchJson(
			"https://api.github.com/repos/tesseract-ocr/tesseract/releases/latest",
		),
		fetchJson("https://api.github.com/repos/qpdf/qpdf/releases/latest"),
		fetchJson(
			"https://api.github.com/repos/tesseract-ocr/tessdata/commits/main",
		),
		fetchJson(
			"https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest",
		),
		fetchJson(
			"https://api.github.com/repos/ggml-org/llama.cpp/releases/latest",
		),
		fetchJson(
			"https://huggingface.co/api/models/ggerganov/whisper.cpp?blobs=true",
		),
		fetchJson(
			"https://huggingface.co/api/models/ggml-org/SmolVLM2-256M-Video-Instruct-GGUF?blobs=true",
		),
	]);
	const tesseractTag = release(tesseract, "tag_name");
	const qpdfTag = release(qpdf, "tag_name");
	const whisperTag = release(whisper, "tag_name");
	const llamaTag = release(llama, "tag_name");
	const versions = {
		bun: release(bun, "tag_name").replace(/^bun-v/, ""),
		xberg: release(xberg, "version"),
		tesseract: tesseractTag.replace(/^v/, ""),
		qpdf: qpdfTag.replace(/^v/, ""),
		tessdata: release(tessdata, "sha"),
		whisper: whisperTag.replace(/^v/, ""),
		llama: llamaTag.replace(/^v/, ""),
		whisperModel: release(whisperModels, "sha"),
		visionModel: release(visionModels, "sha"),
	};
	const modelSources = [
		{
			metadata: whisperModels,
			repo: "ggerganov/whisper.cpp",
			name: "ggml-tiny.bin",
			file: "whisper.bin",
			revision: versions.whisperModel,
		},
		{
			metadata: visionModels,
			repo: "ggml-org/SmolVLM2-256M-Video-Instruct-GGUF",
			name: "SmolVLM2-256M-Video-Instruct-Q8_0.gguf",
			file: "vision.gguf",
			revision: versions.visionModel,
		},
		{
			metadata: visionModels,
			repo: "ggml-org/SmolVLM2-256M-Video-Instruct-GGUF",
			name: "mmproj-SmolVLM2-256M-Video-Instruct-Q8_0.gguf",
			file: "projection.gguf",
			revision: versions.visionModel,
		},
	].map(({ metadata, repo, name, file, revision }) => {
		const { siblings } = metadata;
		const entry = Array.isArray(siblings)
			? siblings.find((item) => item?.rfilename === name)
			: undefined;
		const sha256: unknown = entry?.lfs?.sha256;
		if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256))
			throw new Error(`Missing model checksum: ${repo}/${name}`);
		return {
			file,
			url: `https://huggingface.co/${repo}/resolve/${revision}/${name}`,
			expectedSha256: sha256,
		};
	});
	console.log(`Resolved current stable releases: ${JSON.stringify(versions)}`);
	const bases: {
		alpine?: { tag: string; digest: string };
		bun?: { tag: string; digest: string };
	} = {};
	for (const [name, image] of [
		["alpine", "docker.io/library/alpine:latest"],
		["bun", `docker.io/oven/bun:${versions.bun}-alpine`],
	] as const) {
		await command([runtime, "pull", image], {
			capture: false,
			timeoutMs: 10 * 60_000,
		});
		const info = await inspect(runtime, image);
		const digest = info?.RepoDigests?.find((value) =>
			value.includes("@sha256:"),
		);
		if (!digest) throw new Error(`No resolved digest for ${image}`);
		bases[name] = { tag: image, digest };
	}
	const context = await mkdtemp(join(tmpdir(), "document-read-build-"));
	try {
		const sources = await Promise.all(
			(
				[
					[
						"tesseract.tar.gz",
						`https://codeload.github.com/tesseract-ocr/tesseract/tar.gz/refs/tags/${tesseractTag}`,
					],
					[
						"qpdf.tar.gz",
						`https://codeload.github.com/qpdf/qpdf/tar.gz/refs/tags/${qpdfTag}`,
					],
					[
						"whisper.tar.gz",
						`https://codeload.github.com/ggml-org/whisper.cpp/tar.gz/refs/tags/${whisperTag}`,
					],
					[
						"llama.tar.gz",
						`https://codeload.github.com/ggml-org/llama.cpp/tar.gz/refs/tags/${llamaTag}`,
					],
					[
						"eng.traineddata",
						`https://raw.githubusercontent.com/tesseract-ocr/tessdata/${versions.tessdata}/eng.traineddata`,
					],
					[
						"whisper-model-LICENSE.txt",
						"https://raw.githubusercontent.com/openai/whisper/main/LICENSE",
					],
					[
						"vision-model-README.md",
						`https://huggingface.co/ggml-org/SmolVLM2-256M-Video-Instruct-GGUF/resolve/${versions.visionModel}/README.md`,
					],
				] as const
			).map(async ([file, url]) => {
				const response = await fetch(url, {
					signal: AbortSignal.timeout(120_000),
				});
				if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
				const bytes = Buffer.from(await response.arrayBuffer());
				await writeFile(join(context, file), bytes);
				return {
					file: String(file),
					url: String(url),
					sha256: createHash("sha256").update(bytes).digest("hex"),
				};
			}),
		);
		for (const model of modelSources) {
			const response = await fetch(model.url, {
				signal: AbortSignal.timeout(600_000),
			});
			if (!response.ok)
				throw new Error(`${model.url}: HTTP ${response.status}`);
			const bytes = Buffer.from(await response.arrayBuffer());
			const sha256 = createHash("sha256").update(bytes).digest("hex");
			if (sha256 !== model.expectedSha256)
				throw new Error(`Model checksum mismatch: ${model.file}`);
			await writeFile(join(context, model.file), bytes);
			sources.push({ file: model.file, url: model.url, sha256 });
		}
		await cp(containerRoot, context, { recursive: true });
		const manifest = {
			resolvedAt: new Date().toISOString(),
			versions,
			bases,
			sources,
		};
		await writeFile(
			join(context, "build-info.json"),
			`${JSON.stringify(manifest, null, 2)}\n`,
		);
		const args = [
			runtime,
			"build",
			...(runtime === "podman"
				? ["--pull=always"]
				: ["--pull", "--progress=plain"]),
			"--no-cache",
			"--file",
			join(context, "Containerfile"),
			"--tag",
			options.image,
		];
		for (const [key, value] of Object.entries({
			ALPINE_IMAGE: bases.alpine?.digest,
			BUN_IMAGE: bases.bun?.digest,
			XBERG_VERSION: versions.xberg,
			TESSERACT_VERSION: versions.tesseract,
			QPDF_VERSION: versions.qpdf,
		})) {
			if (!value) throw new Error(`Missing build input: ${key}`);
			args.push("--build-arg", `${key}=${value}`);
		}
		if (options.network) args.push("--network", options.network);
		for (const host of options.addHosts) args.push("--add-host", host);
		args.push(context);
		await command(args, { capture: false, timeoutMs: 30 * 60_000 });
		await checkImage(runtime, options.image);
		const recorded = await command([
			runtime,
			"run",
			"--rm",
			"--pull=never",
			"--network=none",
			"--read-only",
			"--entrypoint",
			"cat",
			options.image,
			"/usr/local/share/document-read/build-info.json",
		]);
		await writeFile(
			join(reportRoot, "build-info.json"),
			`${JSON.stringify(JSON.parse(recorded.stdout), null, 2)}\n`,
		);
	} finally {
		await rm(context, { recursive: true, force: true });
	}
}

async function main(): Promise<void> {
	const options = parseContainerArgs(process.argv.slice(2));
	if (options.help) {
		console.log(
			"Usage: container.ts setup|build|check [--runtime docker|podman] [--image REF]\nBuild only: [--network NAME] [--add-host HOST:IP]\nEnvironment: DOCUMENT_READ_CONTAINER_RUNTIME, DOCUMENT_READ_CONTAINER_IMAGE\nSetup pulls a missing image. Build resolves fresh stable inputs. Check runs offline.",
		);
		return;
	}
	const runtime = await findRuntime(options.runtime);
	if (options.action === "build") await buildImage(runtime, options);
	else {
		if (!(await inspect(runtime, options.image, true))) {
			if (options.action === "check")
				throw new Error(
					`Image ${options.image} is missing. From the document-read skill directory, run bun run setup or bun run container:build.`,
				);
			try {
				await command([runtime, "pull", options.image], {
					capture: false,
					timeoutMs: 10 * 60_000,
				});
			} catch {
				throw new Error(
					`Could not pull ${options.image}. Before initial publication, run bun run container:build in the document-read directory. Then rerun setup.`,
				);
			}
		}
		await checkImage(runtime, options.image);
	}
	console.log(
		"Complete document-read image verified: documents, OCR, local transcription and opt-in picture descriptions. Jobs run offline in disposable containers.",
	);
}

if (import.meta.main) {
	try {
		await main();
	} catch (error) {
		console.error(
			`Document-read container setup failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exitCode = 1;
	}
}
