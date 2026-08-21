#!/usr/bin/env bun

import { createHash, randomUUID } from "node:crypto";
import {
	mkdir,
	readdir,
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
	parse,
	relative,
	resolve,
	sep,
} from "node:path";

const CACHE_VERSION = "5";
const DOCLING_VERSION = "2.117.0";
const DOCLING_OPENCV_PACKAGE =
	"docling-ibm-models[opencv-python-headless]==3.13.0";
const MARKITDOWN_VERSION = "0.1.7";
const DEFAULT_PREVIEW_CHARS = 4_000;
const MAX_PREVIEW_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1_000;
const MIN_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 30 * 60 * 1_000;
const MAX_STDOUT_BYTES = 64 * 1024 * 1024;
const MAX_STDERR_BYTES = 4 * 1024 * 1024;
const MAX_MARKDOWN_BYTES = 64 * 1024 * 1024;
const MAX_JSON_BYTES = 128 * 1024 * 1024;
const MAX_OUTLINE_ITEMS = 100;
const MAX_PICTURES = 100;

export type RequestedEngine = "auto" | "docling" | "markitdown";
export type Engine = Exclude<RequestedEngine, "auto">;
export type OcrMode = "auto" | "off" | "force";
export type RequestedImageMode = "auto" | "none" | "extract" | "describe";
type ResolvedImageMode = Exclude<RequestedImageMode, "auto">;
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
	engine?: RequestedEngine;
	ocr?: OcrMode;
	images?: RequestedImageMode;
	pages?: string | PageRange;
	/** Compatibility alias for images: "extract". */
	extractImages?: boolean;
	maxChars?: number;
	timeoutMs?: number;
	cacheDir?: string;
	refresh?: boolean;
	uvxPath?: string;
}

export interface ConversionPlan {
	kind: DocumentKind;
	engines: Engine[];
	imageMode: ResolvedImageMode;
	ocrMode: OcrMode;
	pageRange?: PageRange;
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

export interface ExtractResult {
	operation: "document_read";
	filePath: string;
	fileName: string;
	fileSize: number;
	markdownPath: string;
	documentJsonPath?: string;
	engineRequested: RequestedEngine;
	engineUsed: Engine;
	fallbackUsed: boolean;
	converterPackage: string;
	converterDependencies: string[];
	documentKind: DocumentKind;
	cacheHit: boolean;
	timeoutMs: number;
	ocrMode: OcrMode;
	ocrUsed: boolean;
	imageMode: ResolvedImageMode;
	imagePlaceholderCount: number;
	imagePathCount: number;
	imagePaths: string[];
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

interface CacheManifest {
	version: string;
	markdownFile: string;
	jsonFile?: string;
	engine: Engine;
	converterPackage: string;
	converterDependencies: string[];
	fallbackUsed: boolean;
	kind: DocumentKind;
	imageMode: ResolvedImageMode;
	ocrMode: OcrMode;
	ocrUsed: boolean;
	warnings: string[];
	pageCount?: number;
	pictures: PictureEvidence[];
	picturesTruncated: boolean;
}

interface CachedConversion {
	markdown: string;
	markdownPath: string;
	documentJsonPath?: string;
	imagePaths: string[];
	manifest: CacheManifest;
}

interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

interface ConvertedDocument {
	markdown: string;
	markdownPath: string;
	jsonPath?: string;
	warnings: string[];
	pageCount?: number;
	pictures: PictureEvidence[];
	picturesTruncated: boolean;
	ocrUsed: boolean;
}

interface LooseRecord {
	[key: string]: unknown;
	$ref?: unknown;
	b?: unknown;
	bbox?: unknown;
	bottom?: unknown;
	captions?: unknown;
	image?: unknown;
	l?: unknown;
	left?: unknown;
	page_no?: unknown;
	pages?: unknown;
	pictures?: unknown;
	prov?: unknown;
	r?: unknown;
	right?: unknown;
	self_ref?: unknown;
	t?: unknown;
	text?: unknown;
	texts?: unknown;
	top?: unknown;
	uri?: unknown;
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

function usage(): string {
	return [
		"Usage: document-read <file> [options]",
		"",
		"Options:",
		"  --engine auto|docling|markitdown  Converter routing (default: auto)",
		"  --ocr auto|off|force             OCR policy (default: auto)",
		"  --images auto|none|extract|describe",
		"                                      Embedded-image policy (default: auto)",
		"  --pages START-END                Convert an inclusive page range with Docling",
		"  --extract-images                 Alias for --images extract",
		"  --max-chars N                    Preview size, 1000-20000 (default: 4000)",
		"  --timeout-ms N                   Timeout, 30000-1800000 (default: 600000)",
		"  --cache-dir PATH                 Conversion cache root",
		"  --refresh                        Reconvert instead of reading a cached result",
		"  --pretty                         Pretty-print the JSON result",
		"  -h, --help                       Show this help",
		"",
		"Environment:",
		"  DOCUMENT_READ_UVX_PATH           Path to uvx when it is not on PATH",
		"  DOCUMENT_READ_CACHE_DIR          Default cache root",
	].join("\n");
}

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
			Number.isInteger(value.start) &&
			Number.isInteger(value.end) &&
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
	if (start < 1 || end < start)
		throw new Error(
			"--pages expects START-END with positive, increasing page numbers",
		);
	return { start, end };
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
		else if (argument === "--engine") {
			const value = args[++index];
			if (value !== "auto" && value !== "docling" && value !== "markitdown")
				throw new Error("--engine expects auto, docling, or markitdown");
			options.engine = value;
		} else if (argument === "--ocr") {
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

export function selectConversionPlan(
	filePath: string,
	options: ExtractOptions = {},
): ConversionPlan {
	const kind = documentKind(filePath);
	const engine = options.engine ?? "auto";
	const pageRange =
		options.pages === undefined ? undefined : parsePageRange(options.pages);
	const requestedImages = options.extractImages
		? "extract"
		: (options.images ?? "auto");
	const imageMode: ResolvedImageMode =
		requestedImages === "auto"
			? kind === "pdf" && engine !== "markitdown"
				? "extract"
				: "none"
			: requestedImages;
	const ocrMode = options.ocr ?? "auto";
	if (
		engine === "markitdown" &&
		(pageRange || imageMode !== "none" || ocrMode === "force")
	) {
		throw new Error(
			"MarkItDown does not support page ranges, extracted images, or forced OCR; use --engine docling",
		);
	}
	if (engine !== "auto")
		return { kind, engines: [engine], imageMode, ocrMode, pageRange };
	if (requestedImages === "extract")
		return { kind, engines: ["docling"], imageMode, ocrMode, pageRange };
	if (pageRange || imageMode === "describe" || ocrMode === "force")
		return { kind, engines: ["docling"], imageMode, ocrMode, pageRange };
	switch (kind) {
		case "office":
		case "email":
		case "epub":
			return {
				kind,
				engines:
					imageMode === "extract"
						? ["docling", "markitdown"]
						: ["markitdown", "docling"],
				imageMode,
				ocrMode,
				pageRange,
			};
		case "audio":
		case "video":
			return {
				kind,
				engines: ["docling"],
				imageMode: "none",
				ocrMode: "off",
				pageRange,
			};
		case "legacy-office":
			return {
				kind,
				engines: ["docling"],
				imageMode,
				ocrMode,
				pageRange,
			};
		default:
			return {
				kind,
				engines: ["docling", "markitdown"],
				imageMode,
				ocrMode,
				pageRange,
			};
	}
}

function doclingExtras(
	kind: DocumentKind,
	imageMode: ResolvedImageMode,
	ocrMode: OcrMode,
): string[] {
	let extras: string[];
	switch (kind) {
		case "pdf":
		case "image":
			extras = ["cli", "convert-core", "format-pdf", "models-local"];
			if (ocrMode !== "off") extras.push("feat-ocr-rapidocr");
			break;
		case "office":
		case "legacy-office":
			extras = ["standard"];
			break;
		case "opendocument":
			extras = ["standard", "format-opendocument"];
			break;
		case "email":
			extras = ["standard"];
			break;
		case "audio":
			extras = ["standard", "format-audio"];
			break;
		case "video":
			extras = ["standard", "format-video"];
			break;
		default:
			extras = ["standard"];
	}
	if (imageMode === "describe") extras.push("models-vlm-inline");
	return [...new Set(extras)].sort();
}

export function converterPackage(
	engine: Engine,
	kind: DocumentKind = "unknown",
	imageMode: ResolvedImageMode = "none",
	ocrMode: OcrMode = "auto",
	fileExtension = "",
): string {
	if (engine === "markitdown") {
		const extras =
			kind === "office"
				? fileExtension === ".docx"
					? ["docx"]
					: fileExtension === ".pptx"
						? ["pptx"]
						: fileExtension === ".xlsx"
							? ["xlsx"]
							: ["docx", "pptx", "xlsx"]
				: kind === "email"
					? ["outlook"]
					: kind === "pdf"
						? ["pdf"]
						: [];
		return extras.length > 0
			? `markitdown[${extras.join(",")}]==${MARKITDOWN_VERSION}`
			: `markitdown==${MARKITDOWN_VERSION}`;
	}
	return `docling-slim[${doclingExtras(kind, imageMode, ocrMode).join(",")}]==${DOCLING_VERSION}`;
}

export function converterDependencies(
	engine: Engine,
	kind: DocumentKind = "unknown",
): string[] {
	return engine === "docling" && (kind === "pdf" || kind === "image")
		? [DOCLING_OPENCV_PACKAGE]
		: [];
}

function safeFileName(fileName: string, extension = ".md"): string {
	const parsed = parse(fileName);
	const printable = [...parsed.name]
		.map((character) => (character.charCodeAt(0) < 32 ? "_" : character))
		.join("");
	const stem = printable.replace(/[<>:"/\\|?*]/g, "_").trim() || "document";
	return `${stem}${extension}`;
}

function environmentVariable(name: string): string | undefined {
	return process.env[name];
}

function containsPath(root: string, filePath: string): boolean {
	const child = relative(root, filePath);
	return (
		child === "" ||
		(!child.startsWith(`..${sep}`) && child !== ".." && !isAbsolute(child))
	);
}

function findUvx(configured?: string): string {
	const candidate =
		configured?.trim() || environmentVariable("DOCUMENT_READ_UVX_PATH")?.trim();
	if (candidate) return candidate;
	const discovered = Bun.which("uvx");
	if (discovered) return discovered;
	throw new Error(
		"uvx is required; install Astral uv or set DOCUMENT_READ_UVX_PATH",
	);
}

function converterWarnings(stderr: string): string[] {
	const lines = stderr
		.split(/[\r\n]+/)
		.map((line) => line.trim())
		.filter(
			(line) =>
				line &&
				!/^(?:Loading weights:\s*)?\d+%\|/.test(line) &&
				!/^(?:Downloading|Downloaded|Installed)\s/.test(line),
		)
		.map((line) =>
			line.replace(/^\d{4}-\d{2}-\d{2}[^\t]*\t[A-Z]+\t[^:]+:\s*/, ""),
		);
	const unique = [...new Set(lines)];
	const warnings = unique
		.slice(0, 20)
		.map((line) => (line.length > 1_000 ? `${line.slice(0, 1_000)}…` : line));
	if (unique.length > warnings.length)
		warnings.push(
			`${unique.length - warnings.length} more warning line(s) omitted`,
		);
	return warnings;
}

function conciseError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.length > 1_000 ? `${message.slice(0, 1_000)}…` : message;
}

async function readStreamLimited(
	stream: ReadableStream<Uint8Array>,
	maxBytes: number,
	label: string,
): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes)
				throw new Error(`${label} exceeded ${maxBytes} bytes`);
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const output = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(output);
}

async function runCommand(
	command: string[],
	timeoutMs: number,
): Promise<CommandResult> {
	const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		child.kill();
	}, timeoutMs);
	try {
		const [stdout, stderr, exitCode] = await Promise.all([
			readStreamLimited(child.stdout, MAX_STDOUT_BYTES, "converter stdout"),
			readStreamLimited(child.stderr, MAX_STDERR_BYTES, "converter stderr"),
			child.exited,
		]);
		if (timedOut) throw new Error(`converter timed out after ${timeoutMs} ms`);
		return { stdout, stderr, exitCode };
	} catch (error) {
		child.kill();
		await child.exited.catch(() => undefined);
		throw error;
	} finally {
		clearTimeout(timer);
	}
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

async function findOutput(
	outputDir: string,
	expectedPath: string,
	extension: string,
	label: string,
): Promise<string> {
	try {
		const info = await stat(expectedPath);
		if (info.isFile()) return expectedPath;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const entries = await readdir(outputDir, { withFileTypes: true });
	const matches = entries.filter(
		(entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension),
	);
	if (matches.length !== 1)
		throw new Error(
			`expected one Docling ${label} output, found ${matches.length}`,
		);
	const found = join(outputDir, matches[0]?.name ?? "");
	await rename(found, expectedPath);
	return expectedPath;
}

export async function collectReferencedImages(
	markdown: string,
	outputDir: string,
): Promise<string[]> {
	const candidates: string[] = [];
	for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
		let target =
			match[1]?.trim().replace(/\s+(?:"[^"]*"|'[^']*')\s*$/, "") ?? "";
		if (target.startsWith("<") && target.endsWith(">"))
			target = target.slice(1, -1);
		if (/^(?:data:|https?:|file:)/i.test(target)) continue;
		try {
			target = decodeURIComponent(target.split("#", 1)[0] ?? target);
		} catch {
			// Keep the literal path when percent-decoding fails.
		}
		const imagePath = resolve(outputDir, target);
		if (containsPath(outputDir, imagePath)) candidates.push(imagePath);
	}
	const existing: string[] = [];
	for (const imagePath of new Set(candidates)) {
		try {
			if ((await stat(imagePath)).isFile()) existing.push(imagePath);
		} catch {
			// Ignore stale Markdown references.
		}
	}
	return existing;
}

function asRecord(value: unknown): LooseRecord | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as LooseRecord)
		: undefined;
}

function numericTuple(
	value: unknown,
): [number, number, number, number] | undefined {
	if (
		Array.isArray(value) &&
		value.length >= 4 &&
		value.slice(0, 4).every((item) => typeof item === "number")
	)
		return value.slice(0, 4) as [number, number, number, number];
	const record = asRecord(value);
	if (!record) return undefined;
	const tuple = [
		record.l ?? record.left,
		record.t ?? record.top,
		record.r ?? record.right,
		record.b ?? record.bottom,
	];
	return tuple.every((item) => typeof item === "number")
		? (tuple as [number, number, number, number])
		: undefined;
}

async function summarizeDoclingJson(
	jsonPath: string,
	outputDir: string,
): Promise<
	Pick<ConvertedDocument, "pageCount" | "pictures" | "picturesTruncated">
> {
	const document = asRecord(
		JSON.parse(
			await readTextLimited(jsonPath, MAX_JSON_BYTES, "Docling JSON output"),
		),
	);
	if (!document) return { pictures: [], picturesTruncated: false };
	const pages = document.pages;
	const pageRecord = asRecord(pages);
	const pageCount = Array.isArray(pages)
		? pages.length
		: pageRecord
			? Object.keys(pageRecord).length
			: undefined;
	const textByRef = new Map<string, string>();
	if (Array.isArray(document.texts)) {
		for (const value of document.texts) {
			const item = asRecord(value);
			if (typeof item?.self_ref === "string" && typeof item.text === "string")
				textByRef.set(item.self_ref, item.text);
		}
	}
	const sourcePictures = Array.isArray(document.pictures)
		? document.pictures
		: [];
	const pictures: PictureEvidence[] = [];
	for (const value of sourcePictures.slice(0, MAX_PICTURES)) {
		const item = asRecord(value);
		if (!item) continue;
		const evidence: PictureEvidence = {};
		if (typeof item.self_ref === "string") evidence.ref = item.self_ref;
		const provenance = Array.isArray(item.prov)
			? asRecord(item.prov[0])
			: undefined;
		if (typeof provenance?.page_no === "number")
			evidence.page = provenance.page_no;
		const bbox = numericTuple(provenance?.bbox);
		if (bbox) evidence.bbox = bbox;
		const captionParts: string[] = [];
		for (const caption of Array.isArray(item.captions) ? item.captions : []) {
			if (typeof caption === "string")
				captionParts.push(textByRef.get(caption) ?? caption);
			else {
				const reference = asRecord(caption)?.$ref;
				if (typeof reference === "string" && textByRef.has(reference))
					captionParts.push(textByRef.get(reference) ?? "");
			}
		}
		const caption = captionParts.filter(Boolean).join(" ").trim();
		if (caption) evidence.caption = caption;
		const imageUri = asRecord(item.image)?.uri;
		if (
			typeof imageUri === "string" &&
			!/^(?:data:|https?:|file:)/i.test(imageUri)
		) {
			const imagePath = resolve(outputDir, imageUri);
			if (containsPath(outputDir, imagePath)) {
				try {
					if ((await stat(imagePath)).isFile())
						evidence.imagePath = relative(outputDir, imagePath);
				} catch {
					// A JSON image reference can be absent when placeholder mode is used.
				}
			}
		}
		pictures.push(evidence);
	}
	return {
		pageCount,
		pictures,
		picturesTruncated: sourcePictures.length > MAX_PICTURES,
	};
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
				title: match[2] ?? "",
				line: index + 1,
			});
	}
	return { outline, truncated: total > outline.length };
}

async function convertWithMarkItDown(
	uvx: string,
	filePath: string,
	outputDir: string,
	markdownFile: string,
	timeoutMs: number,
	kind: DocumentKind,
): Promise<ConvertedDocument> {
	const result = await runCommand(
		[
			uvx,
			"--from",
			converterPackage("markitdown", kind, "none", "auto", extname(filePath)),
			"markitdown",
			filePath,
		],
		timeoutMs,
	);
	if (result.exitCode !== 0)
		throw new Error(
			result.stderr.trim() || `MarkItDown exited ${result.exitCode}`,
		);
	const markdownPath = join(outputDir, markdownFile);
	await writeFile(markdownPath, result.stdout, "utf8");
	return {
		markdown: result.stdout,
		markdownPath,
		warnings: converterWarnings(result.stderr),
		pictures: [],
		picturesTruncated: false,
		ocrUsed: false,
	};
}

async function runDoclingOnce(
	uvx: string,
	filePath: string,
	outputDir: string,
	markdownFile: string,
	jsonFile: string,
	plan: ConversionPlan,
	timeoutMs: number,
	actualOcr: "off" | "force",
): Promise<ConvertedDocument> {
	const command = [
		uvx,
		"--from",
		converterPackage("docling", plan.kind, plan.imageMode, plan.ocrMode),
	];
	for (const dependency of converterDependencies("docling", plan.kind))
		command.push("--with", dependency);
	command.push(
		"docling",
		"--quiet",
		"--to",
		"md",
		"--to",
		"json",
		"--html-image-fetch",
		"none",
		"--image-export-mode",
		plan.imageMode === "none" ? "placeholder" : "referenced",
		"--document-timeout",
		String(Math.max(1, Math.floor((timeoutMs - 5_000) / 1_000))),
	);
	if (plan.kind === "pdf" || plan.kind === "image") {
		if (actualOcr === "off") command.push("--no-ocr");
		else command.push("--ocr", "--ocr-mode", "full_page");
	}
	if (plan.pageRange)
		command.push(
			"--page-range",
			String(plan.pageRange.start),
			String(plan.pageRange.end),
		);
	if (plan.imageMode === "describe")
		command.push("--enrich-picture-description");
	command.push("--output", outputDir, filePath);
	const result = await runCommand(command, timeoutMs);
	if (result.exitCode !== 0)
		throw new Error(
			result.stderr.trim() || `Docling exited ${result.exitCode}`,
		);
	const markdownPath = await findOutput(
		outputDir,
		join(outputDir, markdownFile),
		".md",
		"Markdown",
	);
	const jsonPath = await findOutput(
		outputDir,
		join(outputDir, jsonFile),
		".json",
		"JSON",
	);
	const summary = await summarizeDoclingJson(jsonPath, outputDir);
	return {
		markdown: await readMarkdown(markdownPath),
		markdownPath,
		jsonPath,
		warnings: converterWarnings(result.stderr),
		ocrUsed: actualOcr === "force",
		...summary,
	};
}

function hasUsableExtractedText(markdown: string, pageCount?: number): boolean {
	const visible = markdown
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.match(/[\p{L}\p{N}]/gu)?.length;
	return (visible ?? 0) >= Math.max(24, (pageCount ?? 1) * 8);
}

async function convertWithDocling(
	uvx: string,
	filePath: string,
	outputDir: string,
	markdownFile: string,
	jsonFile: string,
	plan: ConversionPlan,
	timeoutMs: number,
): Promise<ConvertedDocument> {
	const ocrApplicable = plan.kind === "pdf" || plan.kind === "image";
	const firstOcr = ocrApplicable && plan.ocrMode === "force" ? "force" : "off";
	const first = await runDoclingOnce(
		uvx,
		filePath,
		outputDir,
		markdownFile,
		jsonFile,
		plan,
		timeoutMs,
		firstOcr,
	);
	if (
		!ocrApplicable ||
		plan.ocrMode !== "auto" ||
		hasUsableExtractedText(first.markdown, first.pageCount)
	)
		return first;

	await rm(outputDir, { recursive: true, force: true });
	await mkdir(outputDir);
	const withOcr = await runDoclingOnce(
		uvx,
		filePath,
		outputDir,
		markdownFile,
		jsonFile,
		plan,
		timeoutMs,
		"force",
	);
	return {
		...withOcr,
		warnings: [
			...first.warnings,
			"Low text yield without OCR; reran with full-page OCR",
			...withOcr.warnings,
		],
	};
}

function isValidManifest(
	value: Partial<CacheManifest>,
): value is CacheManifest {
	return (
		value.version === CACHE_VERSION &&
		typeof value.markdownFile === "string" &&
		(value.engine === "docling" || value.engine === "markitdown") &&
		typeof value.converterPackage === "string" &&
		typeof value.fallbackUsed === "boolean" &&
		typeof value.kind === "string" &&
		(value.imageMode === "none" ||
			value.imageMode === "extract" ||
			value.imageMode === "describe") &&
		(value.ocrMode === "auto" ||
			value.ocrMode === "off" ||
			value.ocrMode === "force") &&
		typeof value.ocrUsed === "boolean" &&
		Array.isArray(value.warnings) &&
		Array.isArray(value.converterDependencies) &&
		Array.isArray(value.pictures) &&
		typeof value.picturesTruncated === "boolean"
	);
}

async function readCache(
	outputDir: string,
): Promise<CachedConversion | undefined> {
	try {
		const manifest = JSON.parse(
			await readFile(join(outputDir, "manifest.json"), "utf8"),
		) as Partial<CacheManifest>;
		if (!isValidManifest(manifest)) return undefined;
		const markdownPath = resolve(outputDir, manifest.markdownFile);
		if (!containsPath(outputDir, markdownPath)) return undefined;
		const markdown = await readMarkdown(markdownPath);
		let documentJsonPath: string | undefined;
		if (manifest.jsonFile) {
			const candidate = resolve(outputDir, manifest.jsonFile);
			if (
				!containsPath(outputDir, candidate) ||
				!(await stat(candidate)).isFile()
			)
				return undefined;
			documentJsonPath = candidate;
		}
		const pictures = await Promise.all(
			manifest.pictures.map(async (picture) => {
				if (!picture.imagePath) return picture;
				const candidate = resolve(outputDir, picture.imagePath);
				if (!containsPath(outputDir, candidate))
					return { ...picture, imagePath: undefined };
				try {
					return (await stat(candidate)).isFile()
						? { ...picture, imagePath: candidate }
						: { ...picture, imagePath: undefined };
				} catch {
					return { ...picture, imagePath: undefined };
				}
			}),
		);
		const markdownImages = await collectReferencedImages(markdown, outputDir);
		const pictureImages = pictures.flatMap((picture) =>
			picture.imagePath ? [picture.imagePath] : [],
		);
		const imagePaths = [
			...new Set([...markdownImages, ...pictureImages]),
		].filter((path) => containsPath(outputDir, path));
		return {
			markdown,
			markdownPath,
			documentJsonPath,
			imagePaths,
			manifest: { ...manifest, pictures },
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

export async function extractDocument(
	inputPath: string,
	options: ExtractOptions = {},
): Promise<ExtractResult> {
	if (/^[a-z][a-z\d+.-]*:\/\//i.test(inputPath))
		throw new Error("expected a local file path, not a URL");
	const filePath = await realpath(resolve(inputPath));
	const info = await stat(filePath);
	if (!info.isFile()) throw new Error(`expected a file: ${filePath}`);
	const requestedEngine = options.engine ?? "auto";
	const plan = selectConversionPlan(filePath, options);
	const maxChars = boundedInteger(
		options.maxChars,
		DEFAULT_PREVIEW_CHARS,
		1_000,
		MAX_PREVIEW_CHARS,
	);
	const timeoutMs = boundedInteger(
		options.timeoutMs,
		DEFAULT_TIMEOUT_MS,
		MIN_TIMEOUT_MS,
		MAX_TIMEOUT_MS,
	);
	const cacheRoot = resolve(
		options.cacheDir ??
			environmentVariable("DOCUMENT_READ_CACHE_DIR") ??
			join(tmpdir(), "agent-tools", "document-read"),
	);
	const cacheIdentity = JSON.stringify({
		cacheVersion: CACHE_VERSION,
		doclingVersion: DOCLING_VERSION,
		markitdownVersion: MARKITDOWN_VERSION,
		doclingOpenCvPackage: DOCLING_OPENCV_PACKAGE,
		requestedEngine,
		plan,
		filePath,
		modified: info.mtimeMs,
		size: info.size,
	});
	const hash = createHash("sha256")
		.update(cacheIdentity)
		.digest("hex")
		.slice(0, 20);
	const outputDir = join(cacheRoot, hash);
	if (!options.refresh) {
		const cached = await readCache(outputDir);
		if (cached)
			return buildResult(
				cached,
				true,
				filePath,
				info.size,
				requestedEngine,
				maxChars,
				timeoutMs,
			);
	}
	await mkdir(cacheRoot, { recursive: true });
	const workRoot = join(cacheRoot, `.${hash}.${process.pid}.${randomUUID()}`);
	await mkdir(workRoot);
	const fallbackWarnings: string[] = [];
	try {
		const uvx = findUvx(options.uvxPath);
		for (let index = 0; index < plan.engines.length; index++) {
			const engine = plan.engines[index] as Engine;
			const stagedDir = join(workRoot, `attempt-${index + 1}-${engine}`);
			await mkdir(stagedDir);
			const markdownFile = safeFileName(basename(filePath));
			const jsonFile = safeFileName(basename(filePath), ".json");
			try {
				const converted =
					engine === "docling"
						? await convertWithDocling(
								uvx,
								filePath,
								stagedDir,
								markdownFile,
								jsonFile,
								plan,
								timeoutMs,
							)
						: await convertWithMarkItDown(
								uvx,
								filePath,
								stagedDir,
								markdownFile,
								timeoutMs,
								plan.kind,
							);
				const manifest: CacheManifest = {
					version: CACHE_VERSION,
					markdownFile,
					jsonFile: converted.jsonPath ? jsonFile : undefined,
					engine,
					converterPackage: converterPackage(
						engine,
						plan.kind,
						plan.imageMode,
						plan.ocrMode,
						extname(filePath),
					),
					converterDependencies: converterDependencies(engine, plan.kind),
					fallbackUsed: index > 0,
					kind: plan.kind,
					imageMode: engine === "markitdown" ? "none" : plan.imageMode,
					ocrMode: plan.ocrMode,
					ocrUsed: converted.ocrUsed,
					warnings: [...fallbackWarnings, ...converted.warnings],
					pageCount: converted.pageCount,
					pictures: converted.pictures,
					picturesTruncated: converted.picturesTruncated,
				};
				await writeFile(
					join(stagedDir, "manifest.json"),
					`${JSON.stringify(manifest)}\n`,
					"utf8",
				);
				try {
					await publishCache(
						stagedDir,
						outputDir,
						cacheRoot,
						options.refresh === true,
					);
				} catch (error) {
					if (options.refresh) throw error;
					const winner = await readCache(outputDir);
					if (winner)
						return buildResult(
							winner,
							true,
							filePath,
							info.size,
							requestedEngine,
							maxChars,
							timeoutMs,
						);
					throw error;
				}
				const cached = await readCache(outputDir);
				if (!cached)
					throw new Error(
						"conversion completed without a readable cache entry",
					);
				return buildResult(
					cached,
					false,
					filePath,
					info.size,
					requestedEngine,
					maxChars,
					timeoutMs,
				);
			} catch (error) {
				await rm(stagedDir, { recursive: true, force: true });
				if (index === plan.engines.length - 1) throw error;
				fallbackWarnings.push(
					`${engine} failed; used ${plan.engines[index + 1]} fallback: ${conciseError(error)}`,
				);
				if (
					plan.engines[index + 1] === "markitdown" &&
					plan.imageMode !== "none"
				)
					fallbackWarnings.push(
						"MarkItDown fallback omitted requested or automatic image extraction",
					);
			}
		}
		throw new Error("no converter was selected");
	} finally {
		await rm(workRoot, { recursive: true, force: true });
	}
}

function buildResult(
	conversion: CachedConversion,
	cacheHit: boolean,
	filePath: string,
	fileSize: number,
	requestedEngine: RequestedEngine,
	maxChars: number,
	timeoutMs: number,
): ExtractResult {
	const markdown = conversion.markdown.trim();
	const textTruncated = markdown.length > maxChars;
	const outline = outlineFromMarkdown(markdown);
	const imagePlaceholderCount = (markdown.match(/<!--\s*image\s*-->/gi) ?? [])
		.length;
	const warnings = [...conversion.manifest.warnings];
	if (imagePlaceholderCount > 0 && conversion.manifest.imageMode === "none")
		warnings.push(
			`${imagePlaceholderCount} image placeholder(s) were not interpreted`,
		);
	return {
		operation: "document_read",
		filePath,
		fileName: basename(filePath),
		fileSize,
		markdownPath: conversion.markdownPath,
		documentJsonPath: conversion.documentJsonPath,
		engineRequested: requestedEngine,
		engineUsed: conversion.manifest.engine,
		fallbackUsed: conversion.manifest.fallbackUsed,
		converterPackage: conversion.manifest.converterPackage,
		converterDependencies: conversion.manifest.converterDependencies,
		documentKind: conversion.manifest.kind,
		cacheHit,
		timeoutMs,
		ocrMode: conversion.manifest.ocrMode,
		ocrUsed: conversion.manifest.ocrUsed,
		imageMode: conversion.manifest.imageMode,
		imagePlaceholderCount,
		imagePathCount: conversion.imagePaths.length,
		imagePaths: conversion.imagePaths,
		pageCount: conversion.manifest.pageCount,
		outline: outline.outline,
		outlineTruncated: outline.truncated,
		pictures: conversion.manifest.pictures,
		picturesTruncated: conversion.manifest.picturesTruncated,
		warnings: [...new Set(warnings)],
		previewMaxChars: maxChars,
		text: textTruncated ? markdown.slice(0, maxChars) : markdown,
		textLength: markdown.length,
		textTruncated,
	};
}

async function main(): Promise<void> {
	try {
		const parsed = parseArgs(process.argv.slice(2));
		if (parsed.help) {
			console.log(usage());
			return;
		}
		if (!parsed.filePath) throw new Error(`missing input file\n\n${usage()}`);
		console.log(
			JSON.stringify(
				await extractDocument(parsed.filePath, parsed.options),
				null,
				parsed.pretty ? 2 : undefined,
			),
		);
	} catch (error) {
		console.error(
			`document-read: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exitCode = 1;
	}
}

if (import.meta.main) await main();
