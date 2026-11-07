<!-- Read this file only when the input format or escalation path is unclear. -->

# Format routing

All conversion runs in the prepared container. Unsupported or malformed inputs fail with a converter diagnostic. There is no host conversion fallback.

| Input | Processing route | Escalate when |
| --- | --- | --- |
| YouTube URL | Use the `youtube-transcript` skill to retrieve captions online | If captions are unavailable, report that result; local transcription requires an audio or video file |
| PDF | Xberg native text, Tesseract OCR, structured JSON and referenced images | Use `--ocr force` for a weak text layer, `--pages` for a narrow rerun, and `--images describe` for generated captions |
| DOCX, PPTX, XLSX | Native Office parsing | Use `--images extract` for embedded media; inspect spreadsheet structure with `shape` before extracting cell content |
| DOC, PPT, XLS | Native legacy Office parsing | Check warnings and extracted text; no host LibreOffice installation is required |
| ODT, ODP, ODS | Native OpenDocument parsing | Extract and inspect pictures when they are evidence |
| EML, MSG, EPUB, RTF | Native parsing | Check message fields, book headings and warnings when exact structure matters |
| Document scan | Tesseract with baked English OCR data | Use the host's image-inspection capability for an ordinary standalone image |
| Audio | Whisper tiny with automatic language detection | Increase the timeout for longer recordings and verify precise wording against the recording |
| Video | FFmpeg audio decoding, then Whisper | This returns a transcript, not a visual account of the frames |

The same image includes Whisper tiny for local transcription and SmolVLM2 256M for opt-in picture descriptions. Its captions can omit details or invent content. Prefer direct image inspection for precision and Tesseract OCR for text extraction. All model files are baked into the image; conversion has no network access.

From this skill's directory, use the same command for each local operation:

```bash
bun scripts/document-read.ts /path/to/recording.wav
bun scripts/document-read.ts /path/to/video.mp4
bun scripts/document-read.ts /path/to/report.pdf --images describe
```

## Option semantics

- `--ocr auto` uses native text where possible and OCR for weak pages and embedded image text. `--ocr off` disables OCR. `--ocr force` renders each selected PDF page and OCRs the full page, retaining the original native text in structured JSON.
- `--images auto` saves PDF pictures and omits image files for other formats. `--images none` returns placeholders instead of image files. OCR is controlled separately.
- `--images extract` saves image files and returns their page and bounding-box provenance where the source supports it.
- `--images describe` also adds generated captions to Markdown and JSON. It runs the baked local vision model and takes longer than extraction alone.
- `--pages START-END` is one-based and inclusive, applies only to PDFs, and preserves original source page numbers. Out-of-range requests fail.
- `--max-chars` bounds the preview, not the Markdown artifact. Outline, picture and image-path summaries are also bounded; the JSON artifact retains the complete records.
- `--timeout-ms` bounds the conversion job. Timeout or conversion failure removes its container and staging files. A failed refresh preserves the previous successful cache entry.

Markdown supports semantic reading and search. Structured JSON retains native metadata, page content, tables, picture coordinates, generated captions and transcript segments. Image bytes live in separate files referenced by JSON. Consult the recorded coordinate frame before interpreting bounding boxes.

The tested image targets Linux amd64 with Docker. Other architectures, Podman execution, and formats outside the qualification fixtures need their own checks before promising support. OCR uses English data; Whisper's multilingual tiny model and the small vision model have their own accuracy limits.
