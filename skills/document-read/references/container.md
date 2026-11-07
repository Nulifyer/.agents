# Document-read container

Use this reference to prepare, build or verify the sole extraction backend. The Alpine image contains Bun, Xberg, Tesseract, qpdf, Poppler, FFmpeg, Whisper.cpp and llama.cpp, plus English OCR data, Whisper tiny and SmolVLM2 model files. Tests run on Linux amd64 with Docker. Podman and other architectures remain unqualified.

Ship and set up one complete image. Document parsing and OCR use the native tools, local audio/video transcription starts Whisper, and `--images describe` starts the vision model. These operations need no separate model installation or service. Ordinary document extraction does not start either inference tool. Prebuilding avoids package and model downloads at job time; each inference job still loads its model into memory.

## Setup

Install Bun and either Docker or Podman. Start the selected runtime if it requires a service. From this skill's directory, run:

```bash
bun run setup
```

Setup selects a reachable runtime, reuses a local image or pulls `ghcr.io/nulifyer/document-read:experimental`, and verifies it. The package must be published before another machine can pull it. Before initial publication, build locally first:

```bash
bun run container:build
bun run setup
```

Run `bun run check:setup` to verify an existing image without pulling or building. Checks and conversions use `--pull=never --network=none --rm`, a read-only root, a non-root user and temporary storage in tmpfs. Checks cover document formats, full-page OCR, page selection, saved image bytes, audio/video transcription, generated captions, blocked external requests, tool versions, absence of compilers and automatic removal. Fixtures, checks and models are included in the image. No host OCR, Python, Office, media or compiler tools are needed.

Conversions stream input through stdin and return artifacts through stdout. They mount no host directories. Named containers are removed on success and failure; an in-container watchdog also limits jobs if the host wrapper disappears. Only conversion artifacts and cache metadata persist on the host. Containers have a 3 GiB memory limit with no additional swap allowance.

Set `DOCUMENT_READ_CONTAINER_RUNTIME` to `docker` or `podman` to select a runtime. Set `DOCUMENT_READ_CONTAINER_IMAGE` to use another image tag or an immutable digest. The equivalent command options are `--runtime` and `--image`.

## Build freshness

This skill's `package.json` owns its setup, check and build commands. The build files, runtime helpers and fixtures live under `scripts/container/`. Xberg is installed only into the image, so setup installs no native OCR dependencies on the host. The skill works independently of the repository's development tooling.

Every local or CI build resolves current stable Bun, Xberg, Tesseract, qpdf, Whisper.cpp and llama.cpp releases, plus current OCR and model revisions. It pulls current Alpine and Bun images, records exact digests, disables build-cache reuse, upgrades all Alpine packages, and installs current compatible package dependencies. Model downloads use immutable revisions and must match the published SHA-256 hashes. Failed resolution, download or verification stops the build.

Tesseract, qpdf, Whisper.cpp and llama.cpp compile from upstream releases in a separate stage. Compilers and Linux headers stay in that stage. The final image contains runtime files, model data and license notices. It rejects pending Alpine package upgrades and records source release versions, base digests, source/model checksums and OS packages in `/usr/local/share/document-read/build-info.json`. Xberg's package manifest and lockfile remain under `/opt/document-read/`. Libraries bundled inside upstream binaries follow those upstream releases and are not independently rebuilt here.

The build runs the offline checks before reporting success. Local reports go under `.container/` in the skill directory and are ignored by Git. Updating packages happens during builds; conversions use the fixed image without network access.

If a builder needs network or DNS overrides, pass `--network NAME` or repeat `--add-host HOST:IP` to `container:build`. Resolve addresses for the current machine. No machine-specific IP addresses are stored in the package.

## CPU acceleration

Tesseract [detects available CPU instructions at startup](https://github.com/tesseract-ocr/tesseract/blob/5.5.4/src/arch/simddetect.cpp), including AVX variants on x86 and NEON on supported ARM builds. OpenMP is enabled for CPU parallelism. Setup reports the capabilities detected by the running binary.

`GRAPHICS_DISABLED=ON` removes the ScrollView debugging display. `ENABLE_NATIVE=OFF` avoids specializing Tesseract for the builder's CPU while preserving runtime instruction selection. Whisper.cpp and llama.cpp also build CPU variants for runtime selection. Their ggml libraries remain private to each tool to avoid ABI conflicts. This image uses CPU inference and does not configure GPU access.

## GitHub package

The repository's **Document-read container** workflow builds and checks the image. Run it manually with publication disabled to validate a build. Enable its publication input to push the qualified experimental image to GHCR. The image source label associates the package with this repository. Set package visibility to public before expecting unauthenticated pulls on other machines.

The `experimental` tag is the current package name. Its initial publication remains a separate action; local qualification does not publish an image. Keep platform and format claims within the checks that actually ran.
