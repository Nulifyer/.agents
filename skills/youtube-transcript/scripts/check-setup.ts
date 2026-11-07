try {
	const { YouTubeTranscriptApi } = await import("@hallelx/youtube-transcript");
	if (typeof YouTubeTranscriptApi !== "function")
		throw new Error("YouTubeTranscriptApi is unavailable");
	console.log("YouTube transcript setup verified: caption client is available.");
} catch (error) {
	console.error(
		`YouTube transcript setup failed: ${error instanceof Error ? error.message : String(error)}`,
	);
	console.error("From the youtube-transcript skill directory, run bun run setup.");
	process.exitCode = 1;
}
