# Container qualification fixtures

These fixtures contain synthetic documents and public upstream test data, not user documents. The image includes them so checks require no host document-generation or media tools.

## Synthetic fixtures

- `scan.png` contains "Document read recognizes this sentence."
- `mixed.pdf` has native text and that scanned figure on page 1, plus a scanned page 2. Figures start at PDF x-coordinate 50. Verification uses qpdf to select page 2 into a separate scan fixture.
- `headings.docx` contains a heading "First paragraph" and one text paragraph.
- `pictures.docx` adds the scan image to the synthetic Word document.
- `tables.xlsx` contains Name/Age columns and an Anton/44 row.
- `mail.eml`, `book.epub`, `notes.rtf`, `notes.odt`, `notes.ods` and `notes.odp` contain short qualification messages.

## Apache POI fixtures

These files were retrieved from [Apache POI test data](https://github.com/apache/poi/tree/trunk/test-data), retaining their original bytes. They use the Apache License 2.0. See `LICENSE-APACHE-2.0.txt` and `NOTICE-POI.txt`.

| Local file | Upstream path |
| --- | --- |
| `sample.doc` | `document/SampleDoc.doc` |
| `slides.ppt` | `slideshow/basic_test_ppt_file.ppt` |
| `slides.pptx` | `slideshow/SampleShow.pptx` |
| `dates.xls` | `spreadsheet/1900DateWindowing.xls` |
| `mail.msg` | `hsmf/simple_test_msg.msg` |

## Speech fixture

`speech.wav` is the historical JFK speech sample from [Whisper.cpp v1.9.5](https://github.com/ggml-org/whisper.cpp/blob/v1.9.5/samples/jfk.wav). Its spoken phrase includes "my fellow Americans". The upstream project's license is included in `WHISPER-LICENSE.txt`. Verification generates a short video from this audio and the synthetic scan using only the container's FFmpeg.
