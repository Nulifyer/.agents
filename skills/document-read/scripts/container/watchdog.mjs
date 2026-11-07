// Keep the supervisor as PID 1 so its child can always be force-killed.
const timeoutMs = Number(process.argv[2]);
const command = process.argv.slice(3);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !command.length)
	throw new Error("Expected a positive timeout and a command");

const child = Bun.spawn(command, {
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
});
let failure;
let failureStatus;
let forceKill;
function stop(message, status) {
	if (failure) return;
	failure = message;
	failureStatus = status;
	child.kill("SIGTERM");
	forceKill = setTimeout(() => child.kill("SIGKILL"), 5000);
}
const timer = setTimeout(
	() => stop(`Container job timed out after ${timeoutMs} ms`, 124),
	timeoutMs,
);
process.on("SIGTERM", () => stop("Container job terminated", 143));
process.on("SIGINT", () => stop("Container job interrupted", 130));
const exitCode = await child.exited;
clearTimeout(timer);
clearTimeout(forceKill);
if (failure) console.error(failure);
process.exit(failureStatus ?? exitCode);
