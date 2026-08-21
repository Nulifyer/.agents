import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	normalizedVideoUrl,
	parseArgs,
	parseVideoId,
	readYouTubeTranscript,
	renderMarkdown,
	type TranscriptClient,
} from "./youtube-transcript.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "youtube-transcript-test-"));
	roots.push(root);
	return root;
}

function fakeClient(
	options: {
		isGenerated?: boolean;
		language?: string;
		languageCode?: string;
		segments?: Array<{ text: string; start: number; duration: number }>;
	} = {},
): TranscriptClient {
	const language = options.language ?? "English";
	const languageCode = options.languageCode ?? "en";
	const isGenerated = options.isGenerated ?? false;
	const segments = options.segments ?? [
		{ text: "First line", start: 0, duration: 2 },
		{ text: "Second line", start: 35, duration: 3 },
	];
	const track = {
		language,
		languageCode,
		isGenerated,
		isTranslatable: true,
		async fetch() {
			return { language, languageCode, snippets: segments };
		},
		translate(target: string) {
			return {
				...track,
				language: target,
				languageCode: target,
				async fetch() {
					return { language: target, languageCode: target, snippets: segments };
				},
			};
		},
	};
	return {
		async list() {
			return [track];
		},
	};
}

afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});

describe("youtube transcript", () => {
	test("parses supported video URLs and agent-facing options", () => {
		const videoId = "M7lc1UVf-VE";
		expect(parseVideoId(videoId)).toBe(videoId);
		expect(parseVideoId(`https://youtu.be/${videoId}?t=3`)).toBe(videoId);
		expect(parseVideoId(`https://youtube.com/shorts/${videoId}`)).toBe(videoId);
		expect(
			parseVideoId(`https://www.youtube.com/watch?v=${videoId}&list=ignored`),
		).toBe(videoId);
		expect(() =>
			parseVideoId(`https://example.com/watch?v=${videoId}`),
		).toThrow("YouTube");
		expect(
			parseArgs([
				videoId,
				"--languages",
				"de",
				"en-US",
				"--kind",
				"manual",
				"--translate",
				"fr",
				"--refresh",
			]),
		).toEqual({
			video: videoId,
			options: {
				languages: ["de", "en-US"],
				kind: "manual",
				translate: "fr",
				refresh: true,
			},
			pretty: false,
			help: false,
		});
	});

	test("renders readable timestamp groups with source links", () => {
		const videoId = "M7lc1UVf-VE";
		const markdown = renderMarkdown(
			{
				videoId,
				language: "English",
				languageCode: "en",
				sourceLanguageCode: "en",
				isGenerated: false,
				isTranslated: false,
			},
			[
				{ text: "Hello world", start: 0, duration: 2 },
				{ text: "Next", start: 12, duration: 2 },
				{ text: "Later", start: 31, duration: 3 },
			],
			30,
		);
		expect(markdown).toContain(
			`[00:00](${normalizedVideoUrl(videoId)}) Hello world Next`,
		);
		expect(markdown).toContain(
			`[00:31](${normalizedVideoUrl(videoId, 31)}) Later`,
		);
	});

	test("writes artifacts and reuses complete cache entries without another fetch", async () => {
		const root = temporaryRoot();
		const cacheDir = join(root, "cache");
		let listCalls = 0;
		const source = fakeClient();
		const client: TranscriptClient = {
			async list(videoId) {
				listCalls++;
				return source.list(videoId);
			},
		};
		const first = await readYouTubeTranscript("M7lc1UVf-VE", {
			cacheDir,
			client,
		});
		expect(first.operation).toBe("youtube_transcript");
		if (first.operation !== "youtube_transcript")
			throw new Error("expected transcript result");
		expect(first.cacheHit).toBe(false);
		expect(first.text).toBe("First line Second line");
		expect(first.segmentCount).toBe(2);
		expect(first.markdownPath).toEndWith("transcript.md");

		const cached = await readYouTubeTranscript("M7lc1UVf-VE", {
			cacheDir,
			client,
		});
		expect(cached.operation).toBe("youtube_transcript");
		if (cached.operation !== "youtube_transcript")
			throw new Error("expected transcript result");
		expect(cached.cacheHit).toBe(true);
		expect(cached.text).toBe(first.text);
		expect(listCalls).toBe(1);
	});

	test("returns structured track listings without transcript artifacts", async () => {
		const result = await readYouTubeTranscript("M7lc1UVf-VE", {
			list: true,
			client: fakeClient(),
		});
		expect(result).toMatchObject({
			operation: "youtube_transcript_list",
			trackCount: 1,
			tracks: [{ languageCode: "en", isGenerated: false }],
		});
	});

	test("prefers manual captions and can select generated or translated tracks", async () => {
		const root = temporaryRoot();
		const manual = fakeClient({
			segments: [{ text: "Manual", start: 0, duration: 1 }],
		});
		const generated = fakeClient({
			isGenerated: true,
			segments: [{ text: "Generated", start: 0, duration: 1 }],
		});
		const client: TranscriptClient = {
			async list(videoId) {
				return [
					...(await generated.list(videoId)),
					...(await manual.list(videoId)),
				];
			},
		};

		const preferred = await readYouTubeTranscript("M7lc1UVf-VE", {
			cacheDir: join(root, "preferred"),
			client,
		});
		expect(preferred).toMatchObject({
			operation: "youtube_transcript",
			isGenerated: false,
			text: "Manual",
		});

		const automatic = await readYouTubeTranscript("M7lc1UVf-VE", {
			cacheDir: join(root, "generated"),
			client,
			kind: "generated",
		});
		expect(automatic).toMatchObject({
			operation: "youtube_transcript",
			isGenerated: true,
			text: "Generated",
		});

		const translated = await readYouTubeTranscript("M7lc1UVf-VE", {
			cacheDir: join(root, "translated"),
			client,
			translate: "fr",
		});
		expect(translated).toMatchObject({
			operation: "youtube_transcript",
			languageCode: "fr",
			sourceLanguageCode: "en",
			isTranslated: true,
		});
	});
});
