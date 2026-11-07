#!/usr/bin/env bun
import { createHash, randomUUID } from "node:crypto";
import {
	lstat,
	mkdir,
	readFile,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
	basename,
	extname,
	isAbsolute,
	join,
	relative,
	resolve,
	sep,
} from "node:path";
import {
	resolveContainer,
	runContainerExtraction,
	type Runtime,
} from "./container.ts";

const CACHE_VERSION = "container-1";
const DEFAULT_PREVIEW_CHARS = 4000;
const MAX_PREVIEW_CHARS = 20000;
const DEFAULT_TIMEOUT_MS = 600000;
const MIN_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 1800000;
const MAX_MARKDOWN_BYTES = 64 * 1024 * 1024;
const MAX_JSON_BYTES = 128 * 1024 * 1024;
const MAX_OUTLINE_ITEMS = 100;
const MAX_PICTURES = 100;
export type OcrMode = "auto" | "off" | "force";
export type RequestedImageMode = "auto" | "none" | "extract" | "describe";
type ImageMode = "none" | "extract" | "describe";
type DocumentKind =
	| "pdf"
	| "image"
	| "office"
	| "legacy-office"
	| "opendocument"
	| "email"
	| "epub"
	| "audio"
	| "video"
	| "unknown";
export interface PageRange {
	start: number;
	end: number;
}
export interface ExtractOptions {
	ocr?: OcrMode;
	images?: RequestedImageMode;
	pages?: string | PageRange;
	extractImages?: boolean;
	maxChars?: number;
	timeoutMs?: number;
	cacheDir?: string;
	refresh?: boolean;
	runtime?: Runtime;
	image?: string;
}
export interface OutlineItem {
	level: number;
	title: string;
	line: number;
}
export interface PictureEvidence {
	ref?: string;
	page?: number;
	bbox?: [number, number, number, number];
	caption?: string;
	imagePath?: string;
}
interface Manifest {
	version: string;
	kind: DocumentKind;
	imageMode: ImageMode;
	ocrMode: OcrMode;
	ocrUsed: boolean;
	converterPackage: string;
	image: string;
	imageId: string;
	files: string[];
}
interface CachedConversion {
	markdown: string;
	markdownPath: string;
	documentJsonPath: string;
	imagePaths: string[];
	document: RawRecord;
	manifest: Manifest;
}
export interface ExtractResult {
	operation: "document_read";
	filePath: string;
	fileName: string;
	fileSize: number;
	markdownPath: string;
	documentJsonPath: string;
	engineUsed: "xberg" | "whisper.cpp";
	converterPackage: string;
	containerImage: string;
	containerImageId: string;
	documentKind: DocumentKind;
	cacheHit: boolean;
	timeoutMs: number;
	ocrMode: OcrMode;
	ocrUsed: boolean;
	imageMode: ImageMode;
	imagePlaceholderCount: number;
	imagePathCount: number;
	imagePaths: string[];
	imagePathsTruncated: boolean;
	pageCount?: number;
	outline: OutlineItem[];
	outlineTruncated: boolean;
	pictures: PictureEvidence[];
	picturesTruncated: boolean;
	warnings: string[];
	previewMaxChars: number;
	text: string;
	textLength: number;
	textTruncated: boolean;
}

function usage(): string {
	return "Usage: document-read <file> [--ocr auto|off|force] [--images auto|none|extract|describe] [--pages START-END] [--max-chars N] [--timeout-ms N] [--cache-dir PATH] [--refresh] [--runtime docker|podman] [--image REF] [--pretty]\nRequires Bun and a prepared container image. Conversion always runs offline.\nEnvironment: DOCUMENT_READ_CONTAINER_RUNTIME, DOCUMENT_READ_CONTAINER_IMAGE, DOCUMENT_READ_CACHE_DIR";
}

const EXTENSIONS: Record<
	Exclude<DocumentKind, "unknown">,
	ReadonlySet<string>
> = {
	pdf: new Set([".pdf"]),
	image: new Set([
		".bmp",
		".gif",
		".heic",
		".jpeg",
		".jpg",
		".png",
		".tif",
		".tiff",
		".webp",
	]),
	office: new Set([".docx", ".pptx", ".xlsx"]),
	"legacy-office": new Set([".doc", ".ppt", ".xls"]),
	opendocument: new Set([".odg", ".odp", ".ods", ".odt"]),
	email: new Set([".eml", ".msg"]),
	epub: new Set([".epub"]),
	audio: new Set([".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav"]),
	video: new Set([".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"]),
};

function boundedInteger(
	value: number | undefined,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	if (value === undefined || !Number.isFinite(value)) return fallback;
	return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

function parseNumber(value: string | undefined, option: string): number {
	if (!value || !/^\d+$/.test(value))
		throw new Error(`${option} expects an integer`);
	return Number(value);
}

export function parsePageRange(value: string | PageRange): PageRange {
	if (typeof value !== "string") {
		if (
			Number.isSafeInteger(value.start) &&
			Number.isSafeInteger(value.end) &&
			value.start > 0 &&
			value.end >= value.start
		)
			return value;
		throw new Error(
			"--pages expects START-END with positive, increasing page numbers",
		);
	}
	const match = /^(\d+)(?:-(\d+))?$/.exec(value.trim());
	if (!match)
		throw new Error(
			"--pages expects START-END with positive, increasing page numbers",
		);
	const start = Number(match[1]);
	const end = Number(match[2] ?? match[1]);
	if (
		!Number.isSafeInteger(start) ||
		!Number.isSafeInteger(end) ||
		start < 1 ||
		end < start
	)
		throw new Error(
			"--pages expects START-END with positive, increasing page numbers",
		);
	return { start, end };
}

function containsPath(root: string, filePath: string): boolean {
	const child = relative(root, filePath);
	return (
		child === "" ||
		(!child.startsWith(`..${sep}`) && child !== ".." && !isAbsolute(child))
	);
}

async function readTextLimited(
	filePath: string,
	maxBytes: number,
	label: string,
): Promise<string> {
	const info = await stat(filePath);
	if (!info.isFile()) throw new Error(`expected ${label} file: ${filePath}`);
	if (info.size > maxBytes)
		throw new Error(`${label} exceeded ${maxBytes} bytes`);
	return readFile(filePath, "utf8");
}

async function readMarkdown(filePath: string): Promise<string> {
	return readTextLimited(filePath, MAX_MARKDOWN_BYTES, "Markdown output");
}

function outlineFromMarkdown(markdown: string): {
	outline: OutlineItem[];
	truncated: boolean;
} {
	const outline: OutlineItem[] = [];
	let total = 0;
	let inFence = false;
	const lines = markdown.split("\n");
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index] ?? "";
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
		if (!match) continue;
		total++;
		if (outline.length < MAX_OUTLINE_ITEMS)
			outline.push({
				level: match[1]?.length ?? 1,
				title: (match[2] ?? "").slice(0, 500),
				line: index + 1,
			});
	}
	return { outline, truncated: total > outline.length };
}

async function publishCache(
	stagedDir: string,
	outputDir: string,
	cacheRoot: string,
	refresh: boolean,
): Promise<void> {
	if (!refresh) {
		await rename(stagedDir, outputDir);
		return;
	}
	const staleDir = join(
		cacheRoot,
		`.${basename(outputDir)}.stale.${randomUUID()}`,
	);
	let movedStale = false;
	let published = false;
	try {
		await rename(outputDir, staleDir);
		movedStale = true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	try {
		await rename(stagedDir, outputDir);
		published = true;
	} catch (error) {
		if (movedStale) {
			try {
				await rename(staleDir, outputDir);
				movedStale = false;
			} catch {
				// Leave the stale directory recoverable if another process occupied the cache path.
			}
		}
		throw error;
	} finally {
		if (published && movedStale)
			await rm(staleDir, { recursive: true, force: true });
	}
}

export function parseArgs(args: string[]): {
	filePath?: string;
	options: ExtractOptions;
	pretty: boolean;
	help: boolean;
} {
	const options: ExtractOptions = {};
	let filePath: string | undefined;
	let pretty = false;
	let help = false;
	for (let index = 0; index < args.length; index++) {
		const argument = args[index];
		if (argument === "-h" || argument === "--help") help = true;
		else if (argument === "--extract-images") options.extractImages = true;
		else if (argument === "--refresh") options.refresh = true;
		else if (argument === "--pretty") pretty = true;
		else if (argument === "--ocr") {
			const value = args[++index];
			if (value !== "auto" && value !== "off" && value !== "force")
				throw new Error("--ocr expects auto, off, or force");
			options.ocr = value;
		} else if (argument === "--images") {
			const value = args[++index];
			if (
				value !== "auto" &&
				value !== "none" &&
				value !== "extract" &&
				value !== "describe"
			)
				throw new Error("--images expects auto, none, extract, or describe");
			options.images = value;
		} else if (argument === "--runtime") {
			const value = args[++index];
			if (value !== "docker" && value !== "podman")
				throw new Error("--runtime expects docker or podman");
			options.runtime = value;
		} else if (argument === "--image") {
			const value = args[++index];
			if (!value || value.startsWith("-"))
				throw new Error("--image expects a container reference");
			options.image = value;
		} else if (argument === "--pages") options.pages = args[++index] ?? "";
		else if (argument === "--max-chars")
			options.maxChars = parseNumber(args[++index], argument);
		else if (argument === "--timeout-ms")
			options.timeoutMs = parseNumber(args[++index], argument);
		else if (argument === "--cache-dir") {
			const value = args[++index];
			if (!value) throw new Error("--cache-dir expects a path");
			options.cacheDir = value;
		} else if (argument?.startsWith("-"))
			throw new Error(`unknown option: ${argument}`);
		else if (filePath) throw new Error("expected one input file");
		else filePath = argument;
	}
	if (options.pages !== undefined)
		options.pages = parsePageRange(options.pages);
	if (
		options.extractImages &&
		options.images &&
		options.images !== "auto" &&
		options.images !== "extract"
	)
		throw new Error("--extract-images conflicts with --images");
	return { filePath, options, pretty, help };
}

function documentKind(filePath: string): DocumentKind {
	const extension = extname(filePath).toLowerCase();
	for (const [kind, extensions] of Object.entries(EXTENSIONS) as [
		Exclude<DocumentKind, "unknown">,
		ReadonlySet<string>,
	][]) {
		if (extensions.has(extension)) return kind;
	}
	return "unknown";
}

interface RawRecord extends Record<string, unknown> {
	base64?: unknown;
	boundingBox?: unknown;
	caption?: unknown;
	content?: unknown;
	converterPackage?: unknown;
	counts?: unknown;
	document?: unknown;
	extractionMethod?: unknown;
	files?: unknown;
	image?: unknown;
	imageId?: unknown;
	imageMode?: unknown;
	imagePath?: unknown;
	images?: unknown;
	message?: unknown;
	ocrMode?: unknown;
	ocrUsed?: unknown;
	pageNumber?: unknown;
	pages?: unknown;
	path?: unknown;
	processingWarnings?: unknown;
	protocol?: unknown;
	version?: unknown;
	versions?: unknown;
	whisper?: unknown;
	x0?: unknown;
	x1?: unknown;
	xberg?: unknown;
	y0?: unknown;
	y1?: unknown;
}

function record(value: unknown): RawRecord | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as RawRecord)
		: undefined;
}

function imageFile(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^images\/image_\d+\.(?:png|jpe?g|webp|gif|tiff?|bmp|svg|bin)$/.test(value)
	);
}

async function containedFile(
	root: string,
	path: string,
): Promise<string | undefined> {
	const candidate = resolve(root, path);
	if (!containsPath(root, candidate)) return undefined;
	try {
		const actual = await realpath(candidate);
		return containsPath(await realpath(root), actual) &&
			(await stat(actual)).isFile()
			? candidate
			: undefined;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

async function readCache(
	outputDir: string,
): Promise<CachedConversion | undefined> {
	try {
		if (!(await lstat(outputDir)).isDirectory()) return undefined;
		const value: unknown = JSON.parse(
			await readTextLimited(
				join(outputDir, "manifest.json"),
				1024 * 1024,
				"cache manifest",
			),
		);
		const item = record(value);
		if (
			!item ||
			item.version !== CACHE_VERSION ||
			!Array.isArray(item.files) ||
			!item.files.every(imageFile) ||
			typeof item.ocrUsed !== "boolean" ||
			typeof item.converterPackage !== "string" ||
			typeof item.imageId !== "string" ||
			typeof item.image !== "string" ||
			!["none", "extract", "describe"].includes(String(item.imageMode)) ||
			!["auto", "off", "force"].includes(String(item.ocrMode))
		)
			return undefined;
		const markdownPath = await containedFile(outputDir, "document.md");
		const documentJsonPath = await containedFile(outputDir, "document.json");
		if (!markdownPath || !documentJsonPath) return undefined;
		const document = record(
			JSON.parse(
				await readTextLimited(
					documentJsonPath,
					MAX_JSON_BYTES,
					"document JSON",
				),
			),
		);
		if (!document) return undefined;
		const imagePaths: string[] = [];
		for (const path of item.files) {
			const image = await containedFile(outputDir, path);
			if (!image) return undefined;
			imagePaths.push(image);
		}
		return {
			markdown: await readMarkdown(markdownPath),
			markdownPath,
			documentJsonPath,
			document,
			imagePaths,
			manifest: item as unknown as Manifest,
		};
	} catch (error) {
		if (
			(error as NodeJS.ErrnoException).code === "ENOENT" ||
			error instanceof SyntaxError
		)
			return undefined;
		throw error;
	}
}

async function saveConversion(
	value: unknown,
	outputDir: string,
): Promise<{
	document: RawRecord;
	files: string[];
	ocrUsed: boolean;
	converterPackage: string;
}> {
	const response = record(value);
	const document = record(response?.document);
	const versions = record(response?.versions);
	const files = response?.files;
	if (
		response?.protocol !== 1 ||
		!document ||
		typeof document.content !== "string" ||
		!Array.isArray(files) ||
		typeof response.ocrUsed !== "boolean" ||
		typeof versions?.xberg !== "string"
	)
		throw new Error(
			"Container returned an incomplete conversion result; rebuild the image with bun run container:build",
		);
	if (Buffer.byteLength(document.content) > MAX_MARKDOWN_BYTES)
		throw new Error("Markdown output exceeded 64 MiB");
	await mkdir(join(outputDir, "images"));
	const paths: string[] = [];
	for (const entry of files) {
		const file = record(entry);
		if (
			!file ||
			!imageFile(file.path) ||
			typeof file.base64 !== "string" ||
			file.base64.length % 4 !== 0 ||
			!/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64) ||
			paths.includes(file.path)
		)
			throw new Error("Container returned an invalid image artifact");
		await writeFile(
			join(outputDir, file.path),
			Buffer.from(file.base64, "base64"),
			{ flag: "wx" },
		);
		paths.push(file.path);
	}
	const json = JSON.stringify(document);
	if (Buffer.byteLength(json) > MAX_JSON_BYTES)
		throw new Error("Document JSON exceeded 128 MiB");
	await writeFile(join(outputDir, "document.md"), document.content);
	await writeFile(join(outputDir, "document.json"), json);
	return {
		document,
		files: paths,
		ocrUsed: response.ocrUsed,
		converterPackage:
			document.extractionMethod === "transcription"
				? `whisper.cpp@${versions.whisper}`
				: `@xberg-io/xberg@${versions.xberg}`,
	};
}

function buildResult(
	conversion: CachedConversion,
	cacheHit: boolean,
	filePath: string,
	fileSize: number,
	maxChars: number,
	timeoutMs: number,
): ExtractResult {
	const { manifest, document } = conversion;
	const markdown = conversion.markdown.trim();
	const outline = outlineFromMarkdown(markdown);
	const sourceImages = Array.isArray(document.images) ? document.images : [];
	const pictures = sourceImages
		.slice(0, MAX_PICTURES)
		.flatMap((value, index) => {
			const image = record(value);
			if (!image) return [];
			const box = record(image.boundingBox);
			const tuple = [box?.x0, box?.y0, box?.x1, box?.y1];
			const imagePath = image.imagePath;
			return [
				{
					ref: `#/images/${index}`,
					page:
						typeof image.pageNumber === "number" ? image.pageNumber : undefined,
					bbox: tuple.every((value) => typeof value === "number")
						? (tuple as [number, number, number, number])
						: undefined,
					caption:
						typeof image.caption === "string"
							? image.caption.slice(0, 1000)
							: undefined,
					imagePath:
						imageFile(imagePath) && manifest.files.includes(imagePath)
							? resolve(conversion.markdownPath, "..", imagePath)
							: undefined,
				},
			];
		});
	const warningItems = Array.isArray(document.processingWarnings)
		? document.processingWarnings
		: [];
	const warnings = warningItems.slice(0, 20).map((value) => {
		const message = typeof value === "string" ? value : record(value)?.message;
		return typeof message === "string"
			? message.slice(0, 1000)
			: "Converter reported a processing warning";
	});
	const imagePlaceholderCount = (markdown.match(/<!--\s*image\s*-->/gi) ?? [])
		.length;
	if (imagePlaceholderCount)
		warnings.push(
			`${imagePlaceholderCount} image placeholder(s) have no saved image file`,
		);
	const pages = document.pages;
	const count = record(document.counts)?.pages;
	return {
		operation: "document_read",
		filePath,
		fileName: basename(filePath),
		fileSize,
		markdownPath: conversion.markdownPath,
		documentJsonPath: conversion.documentJsonPath,
		engineUsed:
			document.extractionMethod === "transcription" ? "whisper.cpp" : "xberg",
		converterPackage: manifest.converterPackage,
		containerImage: manifest.image,
		containerImageId: manifest.imageId,
		documentKind: manifest.kind,
		cacheHit,
		timeoutMs,
		ocrMode: manifest.ocrMode,
		ocrUsed: manifest.ocrUsed,
		imageMode: manifest.imageMode,
		imagePlaceholderCount,
		imagePathCount: conversion.imagePaths.length,
		imagePaths: conversion.imagePaths.slice(0, MAX_PICTURES),
		imagePathsTruncated: conversion.imagePaths.length > MAX_PICTURES,
		pageCount: Array.isArray(pages)
			? pages.length
			: typeof count === "number" && count > 0
				? count
				: undefined,
		outline: outline.outline,
		outlineTruncated: outline.truncated,
		pictures,
		picturesTruncated: sourceImages.length > MAX_PICTURES,
		warnings: [...new Set(warnings)],
		previewMaxChars: maxChars,
		text: markdown.slice(0, maxChars),
		textLength: markdown.length,
		textTruncated: markdown.length > maxChars,
	};
}

export async function extractDocument(
	inputPath: string,
	options: ExtractOptions = {},
): Promise<ExtractResult> {
	if (/^[a-z][a-z\d+.-]*:\/\//i.test(inputPath))
		throw new Error("expected a local file path, not a URL");
	const filePath = await realpath(resolve(inputPath));
	const info = await stat(filePath);
	if (!info.isFile()) throw new Error(`expected a file: ${filePath}`);
	if (!info.size || info.size > 512 * 1024 * 1024)
		throw new Error("Document must contain 1 byte to 512 MiB");
	const kind = documentKind(filePath);
	const media = kind === "audio" || kind === "video";
	if (
		options.extractImages &&
		options.images &&
		options.images !== "auto" &&
		options.images !== "extract"
	)
		throw new Error("--extract-images conflicts with --images");
	const requestedImages = options.extractImages
		? "extract"
		: (options.images ?? "auto");
	const imageMode =
		requestedImages === "auto"
			? kind === "pdf"
				? "extract"
				: "none"
			: requestedImages;
	const ocrMode = media ? "off" : (options.ocr ?? "auto");
	if (media && (imageMode !== "none" || options.ocr === "force"))
		throw new Error(
			"Media extraction transcribes audio only; OCR and image extraction require a document",
		);
	if (
		!["auto", "off", "force"].includes(ocrMode) ||
		!["none", "extract", "describe"].includes(imageMode)
	)
		throw new Error("Invalid OCR or image policy");
	const pages =
		options.pages === undefined ? undefined : parsePageRange(options.pages);
	if (pages && kind !== "pdf") throw new Error("--pages requires a PDF");
	const maxChars = boundedInteger(
		options.maxChars,
		DEFAULT_PREVIEW_CHARS,
		1000,
		MAX_PREVIEW_CHARS,
	);
	const timeoutMs = boundedInteger(
		options.timeoutMs,
		DEFAULT_TIMEOUT_MS,
		MIN_TIMEOUT_MS,
		MAX_TIMEOUT_MS,
	);
	const context = await resolveContainer(options);
	const { DOCUMENT_READ_CACHE_DIR: configuredCacheDir } = process.env;
	const cacheRoot = resolve(
		options.cacheDir ??
			configuredCacheDir ??
			join(tmpdir(), "agent-tools", "document-read"),
	);
	const hash = createHash("sha256")
		.update(
			JSON.stringify({
				version: CACHE_VERSION,
				imageId: context.imageId,
				filePath,
				modified: info.mtimeMs,
				size: info.size,
				imageMode,
				ocrMode,
				pages,
			}),
		)
		.digest("hex")
		.slice(0, 20);
	const outputDir = join(cacheRoot, hash);
	let replaceCache = options.refresh === true;
	if (!options.refresh) {
		const cached = await readCache(outputDir);
		if (cached)
			return buildResult(
				cached,
				true,
				filePath,
				info.size,
				maxChars,
				timeoutMs,
			);
	}
	if (!options.refresh) {
		try {
			await lstat(outputDir);
			replaceCache = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
	await mkdir(cacheRoot, { recursive: true });
	const workRoot = join(cacheRoot, `.${hash}.${randomUUID()}`);
	const stagedDir = join(workRoot, "result");
	await mkdir(stagedDir, { recursive: true });
	try {
		const value = await runContainerExtraction(
			context,
			filePath,
			{
				extension: extname(filePath).toLowerCase() || ".bin",
				ocr: ocrMode,
				images: imageMode,
				pages,
				timeoutSecs: Math.max(1, Math.floor(timeoutMs / 1000) - 1),
			},
			timeoutMs,
		);
		const converted = await saveConversion(value, stagedDir);
		const manifest: Manifest = {
			version: CACHE_VERSION,
			kind,
			imageMode,
			ocrMode,
			ocrUsed: converted.ocrUsed,
			converterPackage: converted.converterPackage,
			image: context.image,
			imageId: context.imageId,
			files: converted.files,
		};
		await writeFile(join(stagedDir, "manifest.json"), JSON.stringify(manifest));
		try {
			await publishCache(stagedDir, outputDir, cacheRoot, replaceCache);
		} catch (error) {
			if (!options.refresh) {
				const winner = await readCache(outputDir);
				if (winner)
					return buildResult(
						winner,
						true,
						filePath,
						info.size,
						maxChars,
						timeoutMs,
					);
			}
			throw error;
		}
		const cached = await readCache(outputDir);
		if (!cached)
			throw new Error("Conversion completed without readable artifacts");
		return buildResult(cached, false, filePath, info.size, maxChars, timeoutMs);
	} finally {
		await rm(workRoot, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	try {
		const parsed = parseArgs(process.argv.slice(2));
		if (parsed.help) console.log(usage());
		else {
			if (!parsed.filePath) throw new Error(`missing input file\n${usage()}`);
			console.log(
				JSON.stringify(
					await extractDocument(parsed.filePath, parsed.options),
					null,
					parsed.pretty ? 2 : undefined,
				),
			);
		}
	} catch (error) {
		console.error(
			`document-read: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exitCode = 1;
	}
}
