import { cp, readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join, extname } from "node:path";

function requireCondition(condition, message) {
	if (!condition) throw new Error(message);
}

function command(args, allowFailure = false, stdin = "ignore") {
	const result = Bun.spawnSync(args, { stdin, maxBuffer: 128 * 1024 * 1024 });
	if (result.exitCode !== 0 && !allowFailure)
		throw new Error(result.stderr.toString().slice(0, 2000));
	return { stdout: result.stdout.toString().trim(), exitCode: result.exitCode };
}

const manifest = JSON.parse(
	await readFile("/usr/local/share/document-read/build-info.json", "utf8"),
);
const xberg = JSON.parse(
	await readFile(
		"/opt/document-read/node_modules/@xberg-io/xberg/package.json",
		"utf8",
	),
);
const tesseract = command(["tesseract", "--version"]).stdout;
const versions = {
	...manifest.versions,
	bun: Bun.version,
	xberg: xberg.version,
	tesseract: tesseract.split("\n")[0].replace("tesseract ", ""),
	qpdf: command(["qpdf", "--version"])
		.stdout.split("\n")[0]
		.replace("qpdf version ", ""),
	alpine: (await readFile("/etc/alpine-release", "utf8")).trim(),
};
for (const key of ["bun", "xberg", "tesseract", "qpdf"])
	requireCondition(
		versions[key] === manifest.versions[key],
		`${key} differs from the build manifest`,
	);
const buildTools = [
	"gcc",
	"g++",
	"make",
	"cmake",
	"ninja",
	"npm",
	"node",
].filter((tool) => Bun.which(tool));
requireCondition(
	buildTools.length === 0,
	`Unexpected build tools: ${buildTools}`,
);
const interfaces = Object.keys(networkInterfaces());
requireCondition(
	interfaces.every((name) => name === "lo"),
	`Unexpected network interfaces: ${interfaces}`,
);
const routes = (await readFile("/proc/net/route", "utf8"))
	.trim()
	.split("\n")
	.slice(1);
requireCondition(routes.length === 0, "Unexpected external IPv4 route");
const blockedRequests = [];
for (const url of ["http://1.1.1.1/", "https://example.com/"]) {
	let blocked = false;
	try {
		await fetch(url, { signal: AbortSignal.timeout(2000) });
	} catch {
		blocked = true;
	}
	requireCondition(blocked, `External request succeeded: ${url}`);
	blockedRequests.push(url);
}

const root = await mkdtemp("/tmp/document-read-check-");
try {
	await cp(join(import.meta.dir, "fixtures"), root, { recursive: true });
	command([
		"qpdf",
		join(root, "mixed.pdf"),
		"--pages",
		".",
		"2",
		"--",
		join(root, "scan.pdf"),
	]);
	function convert(file, options = {}, allowFailure = false) {
		const request = {
			extension: extname(file),
			ocr: "auto",
			images: "extract",
			timeoutSecs: 120,
			...options,
		};
		const result = command(
			[
				"bun",
				"--no-install",
				"/opt/document-read/extract.mjs",
				JSON.stringify(request),
			],
			allowFailure,
			Bun.file(join(root, file)),
		);
		return result.exitCode === 0 ? JSON.parse(result.stdout) : result;
	}
	const expectations = {
		"scan.png": "Document read recognizes this sentence.",
		"scan.pdf": "Document read recognizes this sentence.",
		"mixed.pdf": "Native document heading",
		"headings.docx": "# First paragraph",
		"tables.xlsx": "| Anton | 44 |",
		"slides.pptx": "Title of the first slide",
		"sample.doc": "I am a test document",
		"dates.xls": "2000-01-01",
		"slides.ppt": "This is a test title",
		"mail.eml": "A local email survives offline extraction.",
		"mail.msg": "test message",
		"book.epub": "An EPUB chapter survives conversion.",
		"notes.odt": "Offline OpenDocument paragraph.",
		"notes.ods": "Offline cell",
		"notes.odp": "Offline presentation slide",
		"notes.rtf": "Container qualification text in RTF.",
		"pictures.docx": "Document read recognizes this sentence.",
	};
	const fixtures = Object.keys(expectations);
	const results = fixtures.map((file) => convert(file));
	for (const [index, result] of results.entries())
		requireCondition(
			result.protocol === 1 &&
				result.document.content.includes(expectations[fixtures[index]]),
			`Missing fixture text: ${fixtures[index]}`,
		);
	const mixed = results[2].document;
	requireCondition(
		mixed.pages.length === 2 &&
			mixed.images.length === 2 &&
			results[2].files.length === 2,
		"Mixed PDF lost pages or saved images",
	);
	requireCondition(
		mixed.images[0].boundingBox.x0 === 50 && mixed.images[1].pageNumber === 2,
		"Mixed PDF lost provenance",
	);
	requireCondition(
		results[2].files.every((file) =>
			Buffer.from(file.base64, "base64")
				.subarray(0, 2)
				.equals(Buffer.from([255, 216])),
		),
		"PDF figures are not valid JPEG bytes",
	);
	const off = convert("mixed.pdf", { ocr: "off" });
	requireCondition(
		!off.ocrUsed &&
			!off.document.content.includes("Document read recognizes this sentence."),
		"OCR off ran OCR",
	);
	const forced = convert("mixed.pdf", { ocr: "force" });
	requireCondition(
		forced.ocrUsed &&
			forced.document.content.includes("Native document heading") &&
			forced.document.content.includes(
				"Document read recognizes this sentence.",
			),
		"Full-page OCR lost text",
	);
	const selected = convert("mixed.pdf", { pages: { start: 2, end: 2 } });
	requireCondition(
		selected.document.pages.length === 1 &&
			selected.document.pages[0].pageNumber === 2 &&
			selected.document.images[0].pageNumber === 2,
		"Page selection lost source page numbers",
	);
	const none = convert("mixed.pdf", { images: "none" });
	requireCondition(
		none.files.length === 0 && none.document.content.includes("<!-- image -->"),
		"Image omission failed",
	);
	const speech = convert("speech.wav");
	requireCondition(
		/fellow americans/i.test(speech.document.content),
		"Audio transcription lost the spoken phrase",
	);
	fixtures.push("speech.wav");
	command([
		"ffmpeg",
		"-v",
		"error",
		"-nostdin",
		"-loop",
		"1",
		"-i",
		join(root, "scan.png"),
		"-i",
		join(root, "speech.wav"),
		"-t",
		"8",
		"-vf",
		"scale=320:80",
		"-c:v",
		"mpeg4",
		"-c:a",
		"aac",
		"-pix_fmt",
		"yuv420p",
		join(root, "speech.mp4"),
	]);
	const video = convert("speech.mp4");
	requireCondition(
		/fellow americans/i.test(video.document.content),
		"Video transcription lost the spoken phrase",
	);
	fixtures.push("speech.mp4");
	const described = convert("scan.pdf", { images: "describe" });
	requireCondition(
		described.document.images.some(
			(image) =>
				typeof image.caption === "string" && image.caption.trim().length > 10,
		),
		"Image description was empty",
	);
	fixtures.push("picture-description");
	await writeFile(join(root, "invalid.pdf"), "%PDF-1.4\nInvalid PDF fixture");
	requireCondition(
		convert("invalid.pdf", {}, true).exitCode !== 0,
		"Malformed PDF was accepted",
	);
	console.log(
		JSON.stringify({
			extractionProtocol: 1,
			fullPageOcrChecked: true,
			sourcePageSelectionChecked: true,
			versions,
			buildResolvedAt: manifest.resolvedAt,
			alpinePackageCount: manifest.apkPackages.length,
			cpuCapabilities: tesseract
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.startsWith("Found "))
				.map((line) => line.slice(6)),
			cpuInstructionSelection: "automatic",
			buildTools,
			interfaces,
			blockedRequests,
			passedFixtures: fixtures,
			malformedInputRejected: true,
		}),
	);
} finally {
	await rm(root, { recursive: true, force: true });
}
