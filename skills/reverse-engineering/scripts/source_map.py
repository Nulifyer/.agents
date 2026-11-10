"""Recover embedded sources from a local or inline v3 source map, without fetching URLs."""
import base64
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import unquote_to_bytes, urlparse

from case import fingerprint


def flatten_map(document):
    if not isinstance(document, dict) or document.get("version") != 3:
        raise ValueError("expected source-map version 3")
    if "sections" in document:
        if not isinstance(document["sections"], list):
            raise ValueError("sections must be a list")
        for section in document["sections"]:
            if not isinstance(section, dict) or "map" not in section:
                raise ValueError("indexed section URL is not fetched; supply an embedded map")
            yield from flatten_map(section["map"])
        return
    sources = document.get("sources")
    contents = document.get("sourcesContent", [None] * len(sources) if isinstance(sources, list) else [])
    if not isinstance(sources, list) or not isinstance(contents, list) or len(sources) != len(contents):
        raise ValueError("sources and sourcesContent must be equal-length lists")
    for source, content in zip(sources, contents):
        if not isinstance(source, str) or (content is not None and not isinstance(content, str)):
            raise ValueError("invalid embedded source entry")
        yield {"source": source, "source_root": document.get("sourceRoot", ""), "content": content}


def recover_map(args):
    artifact = args.artifact.resolve(strict=True)
    before = fingerprint(artifact)
    data = artifact.read_text(encoding="utf-8")
    references = re.findall(r"(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=\s*([^\s*]+)", data)
    reference = references[-1] if references else None
    map_path = None
    relationship = "explicit companion; generated-to-original correspondence unverified"
    if args.map:
        map_path = args.map.resolve(strict=True)
        map_bytes = map_path.read_bytes()
        if reference and not reference.startswith("data:"):
            parsed = urlparse(reference)
            if not parsed.scheme and not parsed.netloc and (artifact.parent / unquote_to_bytes(parsed.path).decode()).resolve() == map_path:
                relationship = "local sourceMappingURL resolves to supplied companion"
    elif reference and reference.startswith("data:"):
        header, payload = reference.split(",", 1)
        map_bytes = base64.b64decode(payload, validate=True) if ";base64" in header else unquote_to_bytes(payload)
        relationship = "source map embedded in hashed artifact"
    elif reference:
        parsed = urlparse(reference)
        if parsed.scheme or parsed.netloc:
            raise ValueError("remote source map is not fetched; supply a downloaded local map with --map")
        map_path = (artifact.parent / unquote_to_bytes(parsed.path).decode()).resolve(strict=True)
        if artifact.parent not in map_path.parents:
            raise ValueError("sourceMappingURL leaves artifact directory; use explicit --map for this companion")
        map_bytes = map_path.read_bytes()
        relationship = "local sourceMappingURL resolves to companion"
    else:
        raise ValueError("no sourceMappingURL found; supply --map")
    document = json.loads(map_bytes)
    entries = list(flatten_map(document))
    # Artifact-controlled names never become destination paths.
    args.out.mkdir(parents=True, exist_ok=False)
    recovered = []
    missing = []
    for index, entry in enumerate(entries):
        content = entry.pop("content")
        if content is None:
            missing.append(entry)
            continue
        suffix = Path(urlparse(entry["source"]).path).suffix
        if not re.fullmatch(r"\.[A-Za-z0-9]{1,10}", suffix):
            suffix = ".txt"
        name = f"source-{index:06d}{suffix}"
        destination = args.out / name
        destination.write_bytes(content.encode("utf-8"))
        recovered.append({**entry, "path": name, "sha256": fingerprint(destination)})
    if fingerprint(artifact) != before or (map_path and map_path.read_bytes() != map_bytes):
        raise ValueError("input changed during source recovery; retained output is incomplete")
    result = {"version": 1, "artifact_sha256": before, "map_sha256": hashlib.sha256(map_bytes).hexdigest(),
              "relationship": relationship, "recovered": recovered, "missing": missing,
              "state": "partial" if missing else "complete", "network": False,
              "limit": "Embedded sources recovered verbatim; mappings and generated-code equivalence are not validated."}
    (args.out / "manifest.json").write_text(json.dumps(result, indent=2) + "\n")
    return {"output": str(args.out.resolve()), "state": result["state"], "recovered": len(recovered),
            "missing": len(missing), "relationship": relationship, "limit": result["limit"]}
