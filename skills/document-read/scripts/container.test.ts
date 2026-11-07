import { describe, expect, test } from "bun:test";
import { parseContainerArgs } from "./container.ts";

describe("document-read container commands", () => {
	test("accepts build network settings without exposing arbitrary build overrides", () => {
		expect(
			parseContainerArgs([
				"build",
				"--runtime",
				"podman",
				"--image",
				"example/document-read:dev",
				"--network",
				"host",
				"--add-host",
				"mirror.example:192.0.2.1",
			]),
		).toMatchObject({
			action: "build",
			runtime: "podman",
			image: "example/document-read:dev",
			network: "host",
			addHosts: ["mirror.example:192.0.2.1"],
		});
		expect(() => parseContainerArgs(["build", "--no-cache=false"])).toThrow(
			"Unknown option",
		);
		expect(() =>
			parseContainerArgs(["build", "--build-arg", "XBERG_VERSION=old"]),
		).toThrow("Unknown option");
	});
	test("keeps setup and verification offline regardless of build networking options", () => {
		expect(
			parseContainerArgs(["setup", "--image", "local:tested"]).action,
		).toBe("setup");
		expect(() => parseContainerArgs(["check", "--network", "host"])).toThrow(
			"checks always run offline",
		);
		expect(() =>
			parseContainerArgs(["setup", "--add-host", "example:192.0.2.1"]),
		).toThrow("builds only");
	});
	test("rejects incomplete or ambiguous commands", () => {
		expect(() => parseContainerArgs(["build", "setup"])).toThrow(
			"Expected one action",
		);
		expect(() => parseContainerArgs(["check", "--runtime", "other"])).toThrow(
			"docker or podman",
		);
		expect(() => parseContainerArgs(["check", "--image"])).toThrow(
			"expects a value",
		);
		expect(() => parseContainerArgs(["check", "--image", "-invalid"])).toThrow(
			"image reference",
		);
	});
});
