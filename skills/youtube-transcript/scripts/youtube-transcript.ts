#!/usr/bin/env bun

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { YouTubeTranscriptApi } from "@hallelx/youtube-transcript";

const TOOL_VERSION = "1";
const TRANSCRIPT_PACKAGE = "@hallelx/youtube-transcript@0.2.0";
const DEFAULT_MAX_CHARS = 4_000;
const MAX_MAX_CHARS = 20_000;
const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_SECONDS = 300;
const DEFAULT_TIMESTAMP_INTERVAL = 30;
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"music.youtube.com",
	"youtu.be",
	"www.youtu.be",
	"youtube-nocookie.com",
	"www.youtube-nocookie.com",
]);

type TrackKind = "any" | "manual" | "generated";

export interface TranscriptOptions {
	languages?: string[];
	kind?: TrackKind;
	translate?: string;
	list?: boolean;
	maxChars?: number;
	timeoutSeconds?: number;
	timestampInterval?: number;
	cacheDir?: string;
	refresh?: boolean;
	client?: TranscriptClient;
}

export interface TranscriptSegment {
	text: string;
	start: number;
	duration: number;
}

export interface TranscriptTrack {
	language: string;
	languageCode: string;
	isGenerated: boolean;
	isTranslatable: boolean;
}

export interface TranscriptResult {
	operation: "youtube_transcript";
	videoId: string;
	videoUrl: string;
	language: string;
	languageCode: string;
	sourceLanguageCode: string;
	isGenerated: boolean;
	isTranslated: boolean;
	segmentCount: number;
	durationSeconds: number;
	package: string;
	cacheHit: boolean;
	timeoutSeconds: number;
	markdownPath: string;
	segmentsPath: string;
	previewMaxChars: number;
	text: string;
	textLength: number;
	textTruncated: boolean;
	warnings: string[];
}

export interface TranscriptListResult {
	operation: "youtube_transcript_list";
	videoId: string;
	videoUrl: string;
	package: string;
	tracks: TranscriptTrack[];
	trackCount: number;
	warnings: string[];
}

interface TranscriptDocument {
	videoId: string;
	language: string;
	languageCode: string;
	sourceLanguageCode: string;
	isGenerated: boolean;
	isTranslated: boolean;
	segments: TranscriptSegment[];
}

interface ProviderFetchedTranscript {
	language: string;
	languageCode: string;
	snippets: TranscriptSegment[];
}

interface CaptionTrack {
	language: string;
	languageCode: string;
	isGenerated: boolean;
	isTranslatable: boolean;
	fetch(): Promise<ProviderFetchedTranscript>;
	translate(languageCode: string): CaptionTrack;
}

export interface TranscriptClient {
	list(videoId: string): Promise<Iterable<CaptionTrack>>;
}

interface CacheManifest {
	version: string;
	markdownFile: string;
	segmentsFile: string;
	videoId: string;
	language: string;
	languageCode: string;
	sourceLanguageCode: string;
	isGenerated: boolean;
	isTranslated: boolean;
	segmentCount: number;
	durationSeconds: number;
	transcriptText: string;
}

interface CachedTranscript {
	manifest: CacheManifest;
	markdownPath: string;
	segmentsPath: string;
}

function usage(): string {
	return [
		"Usage: youtube-transcript <youtube-url-or-id> [options]",
		"",
		"Options:",
		"  --languages CODE [CODE...]       Preferred language codes in order",
		"  --kind any|manual|generated      Caption type (default: any)",
		"  --translate CODE                 Translate the selected caption track",
		"  --list                           List tracks without fetching text",
		"  --max-chars N                    Preview size, 1000-20000 (default: 4000)",
		"  --timeout N                      Request timeout in seconds, 5-300 (default: 30)",
		"  --timestamp-interval N           Seconds per Markdown group, 5-300 (default: 30)",
		"  --cache-dir PATH                 Transcript cache root",
		"  --refresh                        Fetch instead of reading cached artifacts",
		"  --pretty                         Pretty-print JSON",
		"  -h, --help                       Show this help",
		"",
		"Environment:",
		"  YOUTUBE_TRANSCRIPT_CACHE_DIR     Default cache root",
		"  HTTP_PROXY / HTTPS_PROXY         Optional proxy for YouTube requests",
	].join("\n");
}

function parseNumber(value: string | undefined, option: string): number {
	if (!value || !/^\d+$/.test(value))
		throw new Error(`${option} expects an integer`);
	return Number(value);
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

export function parseArgs(args: string[]): {
	video?: string;
	options: TranscriptOptions;
	pretty: boolean;
	help: boolean;
} {
	const options: TranscriptOptions = {};
	let video: string | undefined;
	let pretty = false;
	let help = false;
	for (let index = 0; index < args.length; index++) {
		const argument = args[index];
		if (argument === "-h" || argument === "--help") help = true;
		else if (argument === "--list") options.list = true;
		else if (argument === "--refresh") options.refresh = true;
		else if (argument === "--pretty") pretty = true;
		else if (argument === "--languages") {
			const languages: string[] = [];
			while (args[index + 1] && !args[index + 1]?.startsWith("-")) {
				for (const language of (args[++index] ?? "").split(",")) {
					if (language.trim()) languages.push(language.trim());
				}
			}
			if (languages.length === 0)
				throw new Error("--languages expects one or more codes");
			options.languages = languages;
		} else if (argument === "--kind") {
			const value = args[++index];
			if (value !== "any" && value !== "manual" && value !== "generated") {
				throw new Error("--kind expects any, manual, or generated");
			}
			options.kind = value;
		} else if (argument === "--translate") {
			const value = args[++index];
			if (!value) throw new Error("--translate expects a language code");
			options.translate = value;
		} else if (argument === "--max-chars")
			options.maxChars = parseNumber(args[++index], argument);
		else if (argument === "--timeout")
			options.timeoutSeconds = parseNumber(args[++index], argument);
		else if (argument === "--timestamp-interval")
			options.timestampInterval = parseNumber(args[++index], argument);
		else if (argument === "--cache-dir") {
			const value = args[++index];
			if (!value) throw new Error("--cache-dir expects a path");
			options.cacheDir = value;
		} else if (argument?.startsWith("-"))
			throw new Error(`unknown option: ${argument}`);
		else if (video) throw new Error("expected one YouTube video URL or ID");
		else video = argument;
	}
	return { video, options, pretty, help };
}

export function parseVideoId(value: string): string {
	const candidate = value.trim();
	if (VIDEO_ID_PATTERN.test(candidate)) return candidate;
	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		throw new Error("expected a YouTube video URL or 11-character video ID");
	}
	if (
		(parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
		!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())
	) {
		throw new Error("expected a YouTube video URL or 11-character video ID");
	}
	let videoId: string | undefined;
	if (
		parsed.hostname.toLowerCase() === "youtu.be" ||
		parsed.hostname.toLowerCase() === "www.youtu.be"
	) {
		videoId = parsed.pathname.split("/").filter(Boolean)[0];
	} else if (parsed.pathname.replace(/\/$/, "") === "/watch") {
		videoId = parsed.searchParams.get("v") ?? undefined;
	} else {
		const parts = parsed.pathname.split("/").filter(Boolean);
		if (
			parts.length >= 2 &&
			["embed", "live", "shorts"].includes(parts[0] ?? "")
		)
			videoId = parts[1];
	}
	if (!videoId || !VIDEO_ID_PATTERN.test(videoId))
		throw new Error("YouTube URL does not contain a valid video ID");
	return videoId;
}

export function normalizedVideoUrl(
	videoId: string,
	startSeconds?: number,
): string {
	const url = new URL("https://www.youtube.com/watch");
	url.searchParams.set("v", videoId);
	if (startSeconds && startSeconds > 0)
		url.searchParams.set("t", `${Math.trunc(startSeconds)}s`);
	return url.toString();
}

function environmentVariable(name: string): string | undefined {
	return process.env[name];
}

function redactProxyCredentials(message: string): string {
	let redacted = message;
	for (const name of [
		"HTTP_PROXY",
		"HTTPS_PROXY",
		"http_proxy",
		"https_proxy",
	]) {
		const value = environmentVariable(name);
		if (value) redacted = redacted.replaceAll(value, "[proxy redacted]");
	}
	return redacted.replace(
		/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi,
		"$1[credentials redacted]@",
	);
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function proxyFor(input: FetchInput): string | undefined {
	const url = input instanceof Request ? input.url : String(input);
	if (url.startsWith("https:")) {
		return (
			environmentVariable("HTTPS_PROXY") ??
			environmentVariable("https_proxy") ??
			environmentVariable("HTTP_PROXY") ??
			environmentVariable("http_proxy")
		);
	}
	return (
		environmentVariable("HTTP_PROXY") ??
		environmentVariable("http_proxy") ??
		environmentVariable("HTTPS_PROXY") ??
		environmentVariable("https_proxy")
	);
}

function timedFetch(timeoutSeconds: number): typeof fetch {
	const request = async (input: FetchInput, init: FetchInit = {}) => {
		const controller = new AbortController();
		const sourceSignal = init.signal;
		const forwardAbort = () => controller.abort(sourceSignal?.reason);
		if (sourceSignal?.aborted) forwardAbort();
		else sourceSignal?.addEventListener("abort", forwardAbort, { once: true });
		const timer = setTimeout(
			() =>
				controller.abort(
					new Error(
						`caption request timed out after ${timeoutSeconds} seconds`,
					),
				),
			timeoutSeconds * 1_000,
		);
		try {
			const proxy = proxyFor(input);
			return await Bun.fetch(
				input,
				proxy
					? { ...init, signal: controller.signal, proxy }
					: { ...init, signal: controller.signal },
			);
		} finally {
			clearTimeout(timer);
			sourceSignal?.removeEventListener("abort", forwardAbort);
		}
	};
	return request as typeof fetch;
}

function transcriptClient(timeoutSeconds: number): TranscriptClient {
	return new YouTubeTranscriptApi({ fetchFn: timedFetch(timeoutSeconds) });
}

function matchesLanguage(actual: string, requested: string): boolean {
	const actualCode = actual.toLowerCase();
	const requestedCode = requested.toLowerCase();
	return (
		actualCode === requestedCode || actualCode.startsWith(`${requestedCode}-`)
	);
}

function chooseTrack(
	tracks: CaptionTrack[],
	languages: string[],
	kind: TrackKind,
): CaptionTrack {
	const candidates = tracks.filter(
		(track) =>
			kind === "any" ||
			(kind === "generated" ? track.isGenerated : !track.isGenerated),
	);
	if (kind === "any")
		candidates.sort(
			(left, right) => Number(left.isGenerated) - Number(right.isGenerated),
		);
	if (candidates.length === 0)
		throw new Error(`no ${kind} transcript tracks are available`);
	for (const language of languages.length > 0 ? languages : ["en"]) {
		const selected = candidates.find((track) =>
			matchesLanguage(track.languageCode, language),
		);
		if (selected) return selected;
	}
	if (languages.length > 0)
		throw new Error(
			`none of the requested languages are available; tracks: ${candidates.map((track) => track.languageCode).join(", ")}`,
		);
	return candidates[0] as CaptionTrack;
}

function cleanSegments(rawSegments: TranscriptSegment[]): TranscriptSegment[] {
	const segments: TranscriptSegment[] = [];
	for (const raw of rawSegments) {
		const text = String(raw.text ?? "")
			.replace(/\s+/g, " ")
			.trim();
		const start = Number(raw.start);
		const duration = Number(raw.duration);
		if (!text || !Number.isFinite(start) || !Number.isFinite(duration))
			continue;
		segments.push({
			text,
			start: Math.max(0, start),
			duration: Math.max(0, duration),
		});
	}
	return segments;
}

function formatTimestamp(seconds: number): string {
	const total = Math.max(0, Math.trunc(seconds));
	const hours = Math.floor(total / 3_600);
	const minutes = Math.floor((total % 3_600) / 60);
	const remainder = total % 60;
	return hours > 0
		? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
		: `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function renderMarkdown(
	response: Omit<TranscriptDocument, "segments">,
	segments: TranscriptSegment[],
	timestampInterval: number,
): string {
	const lines = [
		`# YouTube transcript: ${response.videoId}`,
		"",
		`- Video: ${normalizedVideoUrl(response.videoId)}`,
		`- Language: ${response.language} (\`${response.languageCode}\`)`,
		`- Track: ${response.isGenerated ? "automatic" : "manual"}`,
	];
	if (response.isTranslated)
		lines.push(`- Translated from: \`${response.sourceLanguageCode}\``);
	lines.push("", "## Transcript", "");
	let groupStart: number | undefined;
	let groupText: string[] = [];
	const flush = () => {
		if (groupStart === undefined || groupText.length === 0) return;
		lines.push(
			`[${formatTimestamp(groupStart)}](${normalizedVideoUrl(response.videoId, groupStart)}) ${groupText.join(" ")}`,
			"",
		);
	};
	for (const segment of segments) {
		if (groupStart === undefined) groupStart = segment.start;
		else if (segment.start - groupStart >= timestampInterval) {
			flush();
			groupStart = segment.start;
			groupText = [];
		}
		groupText.push(segment.text);
	}
	flush();
	return `${lines.join("\n").trimEnd()}\n`;
}

function containsPath(root: string, filePath: string): boolean {
	const child = relative(root, filePath);
	return (
		child === "" ||
		(!child.startsWith(`..${sep}`) && child !== ".." && !isAbsolute(child))
	);
}

async function readTextLimited(filePath: string): Promise<string> {
	const info = await stat(filePath);
	if (!info.isFile() || info.size > MAX_ARTIFACT_BYTES)
		throw new Error(`invalid or oversized cache artifact: ${filePath}`);
	return readFile(filePath, "utf8");
}

function isManifest(value: Partial<CacheManifest>): value is CacheManifest {
	return (
		value.version === TOOL_VERSION &&
		typeof value.markdownFile === "string" &&
		typeof value.segmentsFile === "string" &&
		typeof value.videoId === "string" &&
		typeof value.language === "string" &&
		typeof value.languageCode === "string" &&
		typeof value.sourceLanguageCode === "string" &&
		typeof value.isGenerated === "boolean" &&
		typeof value.isTranslated === "boolean" &&
		typeof value.segmentCount === "number" &&
		typeof value.durationSeconds === "number" &&
		typeof value.transcriptText === "string"
	);
}

async function readCache(
	outputDir: string,
): Promise<CachedTranscript | undefined> {
	try {
		const manifest = JSON.parse(
			await readTextLimited(join(outputDir, "manifest.json")),
		) as Partial<CacheManifest>;
		if (!isManifest(manifest)) return undefined;
		const markdownPath = resolve(outputDir, manifest.markdownFile);
		const segmentsPath = resolve(outputDir, manifest.segmentsFile);
		if (
			!containsPath(outputDir, markdownPath) ||
			!containsPath(outputDir, segmentsPath)
		)
			return undefined;
		await readTextLimited(markdownPath);
		JSON.parse(await readTextLimited(segmentsPath));
		return { manifest, markdownPath, segmentsPath };
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
	replace: boolean,
): Promise<void> {
	if (!replace) {
		await rename(stagedDir, outputDir);
		return;
	}
	const staleDir = join(
		cacheRoot,
		`.${basename(outputDir)}.stale.${randomUUID()}`,
	);
	let movedStale = false;
	try {
		await rename(outputDir, staleDir);
		movedStale = true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	try {
		await rename(stagedDir, outputDir);
	} catch (error) {
		if (movedStale) await rename(staleDir, outputDir).catch(() => undefined);
		throw error;
	}
	if (movedStale) await rm(staleDir, { recursive: true, force: true });
}

function buildResult(
	cached: CachedTranscript,
	cacheHit: boolean,
	maxChars: number,
	timeoutSeconds: number,
): TranscriptResult {
	const text = cached.manifest.transcriptText;
	const truncated = text.length > maxChars;
	return {
		operation: "youtube_transcript",
		videoId: cached.manifest.videoId,
		videoUrl: normalizedVideoUrl(cached.manifest.videoId),
		language: cached.manifest.language,
		languageCode: cached.manifest.languageCode,
		sourceLanguageCode: cached.manifest.sourceLanguageCode,
		isGenerated: cached.manifest.isGenerated,
		isTranslated: cached.manifest.isTranslated,
		segmentCount: cached.manifest.segmentCount,
		durationSeconds: cached.manifest.durationSeconds,
		package: TRANSCRIPT_PACKAGE,
		cacheHit,
		timeoutSeconds,
		markdownPath: cached.markdownPath,
		segmentsPath: cached.segmentsPath,
		previewMaxChars: maxChars,
		text: truncated ? text.slice(0, maxChars) : text,
		textLength: text.length,
		textTruncated: truncated,
		warnings: [],
	};
}

export async function readYouTubeTranscript(
	input: string,
	options: TranscriptOptions = {},
): Promise<TranscriptResult | TranscriptListResult> {
	const videoId = parseVideoId(input);
	const languages =
		options.languages?.map((value) => value.trim()).filter(Boolean) ?? [];
	const translate = options.translate?.trim() || undefined;
	const kind = options.kind ?? "any";
	const list = options.list === true;
	const timeoutSeconds = boundedInteger(
		options.timeoutSeconds,
		DEFAULT_TIMEOUT_SECONDS,
		5,
		MAX_TIMEOUT_SECONDS,
	);
	const client = options.client ?? transcriptClient(timeoutSeconds);
	if (list) {
		const tracks = [...(await client.list(videoId))];
		return {
			operation: "youtube_transcript_list",
			videoId,
			videoUrl: normalizedVideoUrl(videoId),
			package: TRANSCRIPT_PACKAGE,
			tracks: tracks.map((track) => ({
				language: track.language,
				languageCode: track.languageCode,
				isGenerated: track.isGenerated,
				isTranslatable: track.isTranslatable,
			})),
			trackCount: tracks.length,
			warnings: [],
		};
	}

	const maxChars = boundedInteger(
		options.maxChars,
		DEFAULT_MAX_CHARS,
		1_000,
		MAX_MAX_CHARS,
	);
	const timestampInterval = boundedInteger(
		options.timestampInterval,
		DEFAULT_TIMESTAMP_INTERVAL,
		5,
		300,
	);
	const cacheRoot = resolve(
		options.cacheDir ??
			environmentVariable("YOUTUBE_TRANSCRIPT_CACHE_DIR") ??
			join(tmpdir(), "agent-tools", "youtube-transcript"),
	);
	const identity = JSON.stringify({
		version: TOOL_VERSION,
		package: TRANSCRIPT_PACKAGE,
		videoId,
		languages,
		kind,
		translate,
		timestampInterval,
	});
	const cacheKey = createHash("sha256")
		.update(identity)
		.digest("hex")
		.slice(0, 20);
	const outputDir = join(cacheRoot, cacheKey);
	if (!options.refresh) {
		const cached = await readCache(outputDir);
		if (cached) return buildResult(cached, true, maxChars, timeoutSeconds);
	}
	const tracks = [...(await client.list(videoId))];
	const source = chooseTrack(tracks, languages, kind);
	const selected = translate ? source.translate(translate) : source;
	const fetched = await selected.fetch();
	const response: TranscriptDocument = {
		videoId,
		language: fetched.language,
		languageCode: fetched.languageCode,
		sourceLanguageCode: source.languageCode,
		isGenerated: source.isGenerated,
		isTranslated: translate !== undefined,
		segments: fetched.snippets,
	};

	const segments = cleanSegments(response.segments);
	if (segments.length === 0)
		throw new Error("the selected transcript track returned no text");
	const transcriptText = segments.map((segment) => segment.text).join(" ");
	const durationSeconds = Math.max(
		...segments.map((segment) => segment.start + segment.duration),
	);
	const markdown = renderMarkdown(response, segments, timestampInterval);
	await mkdir(cacheRoot, { recursive: true });
	const stagedDir = join(
		cacheRoot,
		`.${cacheKey}.${process.pid}.${randomUUID()}`,
	);
	await mkdir(stagedDir);
	try {
		const markdownFile = "transcript.md";
		const segmentsFile = "segments.json";
		await writeFile(join(stagedDir, markdownFile), markdown, "utf8");
		await writeFile(
			join(stagedDir, segmentsFile),
			`${JSON.stringify(segments)}\n`,
			"utf8",
		);
		const manifest: CacheManifest = {
			version: TOOL_VERSION,
			markdownFile,
			segmentsFile,
			videoId,
			language: response.language,
			languageCode: response.languageCode,
			sourceLanguageCode: response.sourceLanguageCode,
			isGenerated: response.isGenerated,
			isTranslated: response.isTranslated,
			segmentCount: segments.length,
			durationSeconds: Math.round(durationSeconds * 1_000) / 1_000,
			transcriptText,
		};
		await writeFile(
			join(stagedDir, "manifest.json"),
			`${JSON.stringify(manifest)}\n`,
			"utf8",
		);
		const replace =
			options.refresh === true ||
			(await stat(outputDir)
				.then(() => true)
				.catch(() => false));
		try {
			await publishCache(stagedDir, outputDir, cacheRoot, replace);
		} catch (error) {
			const winner = await readCache(outputDir);
			if (winner) return buildResult(winner, true, maxChars, timeoutSeconds);
			throw error;
		}
		const cached = await readCache(outputDir);
		if (!cached)
			throw new Error("transcript completed without a readable cache entry");
		return buildResult(cached, false, maxChars, timeoutSeconds);
	} finally {
		await rm(stagedDir, { recursive: true, force: true });
	}
}

async function main(): Promise<void> {
	try {
		const parsed = parseArgs(process.argv.slice(2));
		if (parsed.help) {
			console.log(usage());
			return;
		}
		if (!parsed.video)
			throw new Error(`missing YouTube video URL or ID\n\n${usage()}`);
		const result = await readYouTubeTranscript(parsed.video, parsed.options);
		console.log(JSON.stringify(result, null, parsed.pretty ? 2 : undefined));
	} catch (error) {
		const message = redactProxyCredentials(
			error instanceof Error ? error.message : String(error),
		)
			.replace(/\s+/g, " ")
			.trim();
		console.error(
			`youtube-transcript: ${message.length > 2_000 ? `${message.slice(0, 2_000)}…` : message}`,
		);
		process.exitCode = 1;
	}
}

if (import.meta.main) await main();
