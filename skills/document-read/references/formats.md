<!-- Read this file only when the input format or escalation path is unclear. -->

# Format routing

The wrapper chooses an adapter and a pinned Python environment from the file extension and requested capabilities. `auto` is the normal choice. MarkItDown installs only the extras needed for the routed format, excluding its cloud, audio, video, and unrelated document integrations. The current Docling CLI imports its standard model stack even for non-PDF formats, so those fallback profiles use Docling's `standard` bundle; picture-description and ASR/video dependencies remain isolated. PDFs use a smaller tested profile with only their conversion, local-model, and optional OCR dependencies.

| Input | Default path | Escalate when |
|---|---|---|
| PDF | Docling, automatic OCR, referenced images, Markdown + JSON | Use `--ocr force` for a scan with weak text; `--pages` for a narrow rerun; `--images describe` only when figures themselves must be interpreted |
| DOCX, PPTX | MarkItDown | Use `--images extract` when embedded media or layout evidence matters; this routes through Docling |
| XLSX | `shape --as data` before conversion | Convert only when cell content is needed; query structured data directly when practical |
| DOC, PPT, XLS | Docling | LibreOffice must be installed for legacy Office conversion |
| ODT, ODP, ODS | Docling | Inspect extracted images only when they are evidence |
| EML, MSG, EPUB | MarkItDown, with Docling fallback where supported | Force Docling only when MarkItDown loses required structure |
| Document image | Native image inspection for one ordinary image; Docling when OCR or document structure is needed | Use `--ocr force` for a full-page scan |
| Audio | Docling ASR profile | This is a separate, heavier environment; increase the timeout for long recordings |
| Video | Docling video/ASR profile | Requires media tooling and may require a compiler; extract only when the user needs transcript content |
| Unknown binary | Docling, then MarkItDown | Verify the converter warning and output rather than assuming support |

## Option semantics

- `--ocr auto` first converts PDF and document images without OCR, then reruns with full-page OCR only when the text yield is clearly insufficient. This avoids OCR model startup for ordinary born-digital PDFs.
- `--ocr off` avoids OCR. Use it for known born-digital PDFs when startup cost matters.
- `--ocr force` requests full-page OCR and disables fallback to converters without OCR.
- `--images auto` extracts referenced PDF images but leaves images out of ordinary Office/email conversions. Extraction writes files; it does not place pixels in model context.
- `--images none` keeps placeholders only.
- `--images extract` returns local paths and Docling picture metadata where available.
- `--images describe` asks Docling's picture-description model to enrich the conversion. It is opt-in because it adds dependencies and inference cost.
- `--pages START-END` is one-based and inclusive. It requires Docling.

Docling conversions retain Markdown for reading and lossless JSON for page, bounding-box, caption, and picture provenance. MarkItDown conversions retain Markdown only.
