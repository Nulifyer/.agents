#!/usr/bin/env python3
"""Record and recheck evidence identity. Never execute the recorded artifacts."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile


MODES = ("analysis", "source-recovery", "matching", "patching", "rebuild")
ROLES = ("artifact", "symbols", "specification", "source", "trace", "fixture",
         "reference-result", "candidate-result", "build-receipt", "comparator", "protected")
PROVENANCE = ("declared", "observed", "derived", "inferred", "verified")


def fingerprint(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_record(path, record, exclusive=False):
    data = json.dumps(record, indent=2, ensure_ascii=False) + "\n"
    if exclusive:
        with path.open("x", encoding="utf-8") as stream:
            stream.write(data)
        return
    descriptor, temporary = tempfile.mkstemp(prefix=".case-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(data)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def input_record(identifier, path, role, origin):
    if not identifier.strip() or not origin.strip():
        raise ValueError("input id and origin must be nonempty")
    path = path.resolve(strict=True)
    if not path.is_file():
        raise ValueError("input must be a regular file")
    return {"id": identifier, "path": str(path), "role": role,
            "origin": origin, "sha256": fingerprint(path)}


def read_record(path):
    with path.open(encoding="utf-8") as stream:
        record = json.load(stream)
    if not isinstance(record, dict) or record.get("version") != 1:
        raise ValueError("expected a version 1 case object")
    return record


def check_record(record, case_path, rebuild=False):
    errors = []
    if record.get("mode") not in MODES:
        errors.append("unknown mode")
    for key in ("question", "scope", "stop_condition"):
        if not isinstance(record.get(key), str) or not record[key].strip():
            errors.append(f"missing {key}")
    inputs = record.get("inputs")
    if not isinstance(inputs, list) or not inputs:
        return errors + ["inputs must be a nonempty list"]
    known = {}
    for item in inputs:
        if not isinstance(item, dict):
            errors.append("input must be an object")
            continue
        identifier = item.get("id")
        if not isinstance(identifier, str) or not identifier or identifier in known:
            errors.append("input ids must be nonempty and unique")
            continue
        known[identifier] = item
        if item.get("role") not in ROLES or not isinstance(item.get("origin"), str) or not item["origin"].strip():
            errors.append(f"{identifier}: missing role or origin")
        try:
            path = Path(item["path"])
            if not path.is_absolute():
                path = case_path.parent / path
            if path.resolve() == case_path.resolve():
                raise ValueError("case cannot record itself")
            if fingerprint(path) != item.get("sha256"):
                errors.append(f"{identifier}: changed SHA-256")
        except (OSError, ValueError, TypeError, KeyError) as error:
            errors.append(f"{identifier}: unavailable input ({error})")
    if not any(item.get("role") == "artifact" for item in known.values()):
        errors.append("missing original artifact")
    findings = record.get("findings", [])
    if not isinstance(findings, list):
        errors.append("findings must be a list")
        findings = []
    for finding in findings:
        if not isinstance(finding, dict):
            errors.append("finding must be an object")
            continue
        label = finding.get("id", "finding")
        if finding.get("provenance") not in PROVENANCE or not finding.get("scope") or not finding.get("claim"):
            errors.append(f"{label}: missing claim, provenance or scope")
        locators = finding.get("locators", [])
        if not isinstance(locators, list) or not locators:
            errors.append(f"{label}: missing evidence locators")
            continue
        for locator in locators:
            if not isinstance(locator, dict) or locator.get("input") not in known or not locator.get("location"):
                errors.append(f"{label}: invalid evidence locator")
        if finding.get("provenance") == "verified":
            checks = finding.get("verification_inputs", [])
            if not isinstance(checks, list) or not checks or any(identifier not in known for identifier in checks):
                errors.append(f"{label}: verified claim needs tracked verification inputs")
    if rebuild:
        validation = record.get("validation")
        if not isinstance(validation, dict):
            return errors + ["missing validation object; see case-record.md"]
        for key, role in (("fixture", "fixture"), ("reference", "reference-result"),
                          ("candidate", "candidate-result"), ("build", "build-receipt"),
                          ("comparator", "comparator")):
            item = known.get(validation.get(key))
            if not item or item.get("role") != role:
                errors.append(f"validation.{key}: needs a tracked {role}")
        if not validation.get("scope") or validation.get("complete") is not True:
            errors.append("validation needs scope and complete=true")
        counts = validation.get("counts", {})
        if not isinstance(counts, dict):
            counts = {}
        values = [counts.get(key) for key in ("total", "passed", "failed", "unknown")]
        if any(type(value) is not int or value < 0 for value in values):
            errors.append("validation counts must be nonnegative integers")
        else:
            total, passed, failed, unknown = values
            if total == 0 or passed + failed + unknown != total or failed or unknown:
                errors.append("validation counts are empty, inconsistent or contain failures/unknowns")
        if type(validation.get("exit_code")) is not int or validation["exit_code"] != 0:
            errors.append("validation comparator did not report exit_code=0")
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    initialize = commands.add_parser("init", help="create a case without overwriting a file")
    initialize.add_argument("case", type=Path)
    initialize.add_argument("artifact", type=Path)
    initialize.add_argument("--mode", choices=MODES, default="analysis")
    for flag in ("question", "scope", "stop"):
        initialize.add_argument("--" + flag, required=True)
    track = commands.add_parser("track", help="record a companion, source or result identity")
    track.add_argument("case", type=Path)
    track.add_argument("file", type=Path)
    track.add_argument("--id", required=True)
    track.add_argument("--role", choices=ROLES, required=True)
    track.add_argument("--origin", required=True)
    check = commands.add_parser("check", help="recheck hashes and evidence bookkeeping")
    check.add_argument("case", type=Path)
    check.add_argument("--rebuild", action="store_true", help="require differential validation references")
    args = parser.parse_args(argv)
    try:
        if args.command == "init":
            item = input_record("original", args.artifact, "artifact", "supplied original")
            record = {"version": 1, "mode": args.mode, "question": args.question,
                      "scope": args.scope, "stop_condition": args.stop, "inputs": [item],
                      "findings": [], "unknowns": [], "tools": []}
            errors = check_record(record, args.case)
            if errors:
                raise ValueError("; ".join(errors))
            write_record(args.case, record, exclusive=True)
            result = {"case": str(args.case), "artifact_sha256": item["sha256"]}
        elif args.command == "track":
            record = read_record(args.case)
            errors = check_record(record, args.case)
            if errors:
                raise ValueError("existing case needs repair: " + "; ".join(errors))
            if any(item["id"] == args.id for item in record["inputs"]):
                raise ValueError("input id already recorded; create a new case for a changed baseline")
            item = input_record(args.id, args.file, args.role, args.origin)
            if Path(item["path"]) == args.case.resolve():
                raise ValueError("case cannot record itself")
            record["inputs"].append(item)
            write_record(args.case, record)
            result = {"tracked": args.id, "sha256": item["sha256"]}
        else:
            errors = check_record(read_record(args.case), args.case, args.rebuild)
            result = {"identity_and_bookkeeping_ok": not errors, "errors": errors,
                      "limit": "Does not validate symbol matching, receipt contents, comparator correctness, runtime parity or clean-room independence."}
            print(json.dumps(result, ensure_ascii=False))
            return 1 if errors else 0
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (OSError, ValueError, TypeError, KeyError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
