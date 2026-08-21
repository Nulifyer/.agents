import { afterEach, describe, expect, test } from "bun:test";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	collectReferencedImages,
	converterDependencies,
	converterPackage,
	extractDocument,
	parseArgs,
	parsePageRange,
	selectConversionPlan,
} from "./document-read.ts";

const roots: string[] = [];

function temporaryRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "document-read-test-"));
	roots.push(root);
	return root;
}

function executable(path: string, source: string): void {
	writeFileSync(path, source);
	chmodSync(path, 0o755);
}

afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});

describe("document read", () => {
	test("parses the staged agent-facing options and compatibility alias", () => {
		expect(
			parseArgs([
				"report.pdf",
				"--engine",
				"docling",
				"--ocr",
				"force",
				"--images",
				"describe",
				"--pages",
				"3-8",
				"--max-chars",
				"9000",
				"--timeout-ms",
				"45000",
				"--refresh",
			]),
		).toEqual({
			filePath: "report.pdf",
			options: {
				engine: "docling",
				ocr: "force",
				images: "describe",
				pages: { start: 3, end: 8 },
				maxChars: 9000,
				timeoutMs: 45000,
				refresh: true,
			},
			pretty: false,
			help: false,
		});
		expect(
			parseArgs(["report.pdf", "--extract-images"]).options.extractImages,
		).toBe(true);
		expect(parsePageRange("7")).toEqual({ start: 7, end: 7 });
		expect(() => parsePageRange("8-3")).toThrow("positive, increasing");
		expect(() => parseArgs(["a.pdf", "b.pdf"])).toThrow("one input file");
		expect(() => parseArgs(["a.pdf", "--engine", "other"])).toThrow(
			"auto, docling, or markitdown",
		);
	});

	test("routes cheap formats first and isolates heavyweight package profiles", () => {
		expect(selectConversionPlan("report.pdf")).toMatchObject({
			kind: "pdf",
			engines: ["docling", "markitdown"],
			imageMode: "extract",
			ocrMode: "auto",
		});
		expect(selectConversionPlan("brief.docx")).toMatchObject({
			kind: "office",
			engines: ["markitdown", "docling"],
			imageMode: "none",
		});
		expect(
			selectConversionPlan("brief.docx", { images: "extract" }).engines,
		).toEqual(["docling"]);
		expect(selectConversionPlan("recording.mp3")).toMatchObject({
			kind: "audio",
			engines: ["docling"],
			ocrMode: "off",
		});
		expect(
			selectConversionPlan("scan.pdf", { pages: "2-4", ocr: "force" }).engines,
		).toEqual(["docling"]);
		expect(
			selectConversionPlan("report.pdf", { engine: "markitdown" }),
		).toMatchObject({ engines: ["markitdown"], imageMode: "none" });

		const pdfPackage = converterPackage("docling", "pdf", "extract");
		expect(pdfPackage).toContain("convert-core");
		expect(converterDependencies("docling", "pdf")).toEqual([
			"docling-ibm-models[opencv-python-headless]==3.13.0",
		]);
		expect(converterDependencies("docling", "office")).toEqual([]);
		expect(converterPackage("markitdown", "office")).toBe(
			"markitdown[docx,pptx,xlsx]==0.1.7",
		);
		expect(
			converterPackage("markitdown", "office", "none", "auto", ".docx"),
		).toBe("markitdown[docx]==0.1.7");
		expect(converterPackage("markitdown", "email")).toBe(
			"markitdown[outlook]==0.1.7",
		);
		expect(converterPackage("markitdown", "epub")).toBe("markitdown==0.1.7");
		expect(pdfPackage).toContain("format-pdf");
		expect(pdfPackage).toContain("feat-ocr-rapidocr");
		expect(converterPackage("docling", "pdf", "none", "off")).not.toContain(
			"feat-ocr-rapidocr",
		);
		expect(pdfPackage).not.toContain("format-audio");
		expect(converterPackage("docling", "audio", "none")).toContain(
			"format-audio",
		);
		expect(converterPackage("docling", "office", "none")).toContain(
			"[standard]",
		);
		expect(converterPackage("docling", "pdf", "describe")).toContain(
			"models-vlm-inline",
		);
	});

	test("runs MarkItDown through configurable uvx and reuses complete cache entries", async () => {
		const root = temporaryRoot();
		const source = join(root, "Quarterly Report.docx");
		const fakeUvx = join(root, "uvx");
		const cacheDir = join(root, "cache");
		writeFileSync(source, "fixture");
		executable(
			fakeUvx,
			"#!/bin/sh\nprintf '# Report\\n\\n## Findings\\nConverted fixture'\n",
		);

		const first = await extractDocument(source, {
			engine: "markitdown",
			cacheDir,
			uvxPath: fakeUvx,
		});
		expect(first.cacheHit).toBe(false);
		expect(first.engineUsed).toBe("markitdown");
		expect(first.outline).toEqual([
			{ level: 1, title: "Report", line: 1 },
			{ level: 2, title: "Findings", line: 3 },
		]);
		expect(first.markdownPath).toEndWith("Quarterly Report.md");

		executable(fakeUvx, "#!/bin/sh\nexit 9\n");
		const second = await extractDocument(source, {
			engine: "markitdown",
			cacheDir,
			uvxPath: fakeUvx,
		});
		expect(second.cacheHit).toBe(true);
		expect(second.text).toBe(first.text);

		executable(fakeUvx, "#!/bin/sh\nprintf '# Refreshed'\n");
		const refreshed = await extractDocument(source, {
			engine: "markitdown",
			cacheDir,
			uvxPath: fakeUvx,
			refresh: true,
		});
		expect(refreshed.cacheHit).toBe(false);
		expect(refreshed.text).toBe("# Refreshed");
	});

	test("keeps Docling Markdown, lossless JSON, and picture provenance together", async () => {
		const root = temporaryRoot();
		const source = join(root, "report.pdf");
		const fakeUvx = join(root, "uvx");
		writeFileSync(source, "pdf fixture");
		executable(
			fakeUvx,
			[
				"#!/bin/sh",
				"out=''",
				'while [ "$#" -gt 0 ]; do',
				'  if [ "$1" = \'--output\' ]; then shift; out="$1"; fi',
				"  shift",
				"done",
				'mkdir -p "$out/images"',
				"printf 'image' > \"$out/images/chart.png\"",
				"printf '# Report\\n\\n![chart](images/chart.png)\\n' > \"$out/report.md\"",
				'printf \'%s\' \'{"pages":{"1":{}},"texts":[{"self_ref":"#/texts/0","text":"Revenue chart"}],"pictures":[{"self_ref":"#/pictures/0","prov":[{"page_no":1,"bbox":{"l":1,"t":2,"r":3,"b":4}}],"captions":[{"$ref":"#/texts/0"}],"image":{"uri":"images/chart.png"}}]}\' > "$out/report.json"',
			].join("\n"),
		);

		const result = await extractDocument(source, {
			engine: "docling",
			ocr: "off",
			cacheDir: join(root, "cache"),
			uvxPath: fakeUvx,
		});
		expect(result.engineUsed).toBe("docling");
		expect(result.documentJsonPath).toEndWith("report.json");
		expect(result.pageCount).toBe(1);
		expect(result.imagePaths).toHaveLength(1);
		expect(result.pictures).toEqual([
			{
				ref: "#/pictures/0",
				page: 1,
				bbox: [1, 2, 3, 4],
				caption: "Revenue chart",
				imagePath: result.imagePaths[0],
			},
		]);
		expect(result.ocrUsed).toBe(false);
	});

	test("stages automatic OCR only after a low-text first pass", async () => {
		const root = temporaryRoot();
		const source = join(root, "scan.pdf");
		const fakeUvx = join(root, "uvx");
		writeFileSync(source, "fixture");
		executable(
			fakeUvx,
			[
				"#!/bin/sh",
				'args="$*"',
				"out=''",
				'while [ "$#" -gt 0 ]; do if [ "$1" = \'--output\' ]; then shift; out="$1"; fi; shift; done',
				'case "$args" in *--no-ocr*) printf \'<!-- image -->\' > "$out/scan.md" ;; *) printf \'# Scanned invoice with readable OCR text\' > "$out/scan.md" ;; esac',
				'printf \'{"pages":{"1":{}},"pictures":[]}\' > "$out/scan.json"',
			].join("\n"),
		);

		const result = await extractDocument(source, {
			engine: "docling",
			cacheDir: join(root, "cache"),
			uvxPath: fakeUvx,
		});
		expect(result.ocrUsed).toBe(true);
		expect(result.text).toContain("readable OCR text");
		expect(result.warnings).toContain(
			"Low text yield without OCR; reran with full-page OCR",
		);
	});

	test("records a bounded automatic fallback when the preferred adapter fails", async () => {
		const root = temporaryRoot();
		const source = join(root, "memo.docx");
		const fakeUvx = join(root, "uvx");
		writeFileSync(source, "fixture");
		executable(
			fakeUvx,
			'#!/bin/sh\ncase "$*" in\n  *markitdown*) printf \'primary failure\' >&2; exit 7 ;;\n  *)\n    out=\'\'\n    while [ "$#" -gt 0 ]; do if [ "$1" = \'--output\' ]; then shift; out="$1"; fi; shift; done\n    printf \'# Fallback\' > "$out/memo.md"\n    printf \'{"pages":{},"pictures":[]}\' > "$out/memo.json"\n  ;;\nesac\n',
		);

		const result = await extractDocument(source, {
			cacheDir: join(root, "cache"),
			uvxPath: fakeUvx,
		});
		expect(result.engineRequested).toBe("auto");
		expect(result.engineUsed).toBe("docling");
		expect(result.fallbackUsed).toBe(true);
		expect(result.warnings[0]).toContain(
			"markitdown failed; used docling fallback",
		);
	});

	test("reports omitted PDF images when automatic fallback reaches MarkItDown", async () => {
		const root = temporaryRoot();
		const source = join(root, "report.pdf");
		const fakeUvx = join(root, "uvx");
		writeFileSync(source, "fixture");
		executable(
			fakeUvx,
			"#!/bin/sh\ncase \"$*\" in *docling*) printf 'layout failure' >&2; exit 7 ;; *) printf '# Text fallback' ;; esac\n",
		);

		const result = await extractDocument(source, {
			cacheDir: join(root, "cache"),
			uvxPath: fakeUvx,
		});
		expect(result.engineUsed).toBe("markitdown");
		expect(result.imageMode).toBe("none");
		expect(result.warnings.join("\n")).toContain(
			"fallback omitted requested or automatic image extraction",
		);
	});

	test("returns only local image references contained by the conversion directory", async () => {
		const root = temporaryRoot();
		const images = join(root, "images");
		mkdirSync(images);
		writeFileSync(join(images, "chart one.png"), "png");
		writeFileSync(join(root, "outside.png"), "png");
		const markdown = [
			"![chart](images/chart%20one.png)",
			"![remote](https://example.test/image.png)",
			"![escape](../outside.png)",
		].join("\n");
		expect(await collectReferencedImages(markdown, root)).toEqual([
			join(images, "chart one.png"),
		]);
	});
});
