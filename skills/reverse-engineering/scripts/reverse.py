#!/usr/bin/env python3
"""Static decompilation, symbol checks, source recovery and bounded evidence queries."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

from native import doctor, export_native, graph_bundle, references_to, search_bundle, show_function
from source_map import recover_map
from symbols import check_symbols


def positive(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def nonnegative(value):
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be nonnegative")
    return number


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    preflight = commands.add_parser("doctor", help="discover local analysis capabilities; no installs")
    preflight.add_argument("--ghidra")
    export = commands.add_parser("decompile", help="headless Ghidra export to a hash-bound indexed bundle")
    export.add_argument("artifact", type=Path)
    export.add_argument("--out", type=Path, required=True, help="bundle cache root")
    export.add_argument("--ghidra", help="Ghidra root or analyzeHeadless launcher")
    export.add_argument("--pdb", type=Path, help="explicit local native PDB; identity checked before applying")
    export.add_argument("--allow-partial-symbols", action="store_true", help="permit GUID-only PDB as navigation evidence")
    export.add_argument("--function", action="append", default=[], help="exact function name, entry or RVA; repeat to select")
    export.add_argument("--analysis-timeout", type=positive, default=600)
    export.add_argument("--function-timeout", type=positive, default=30)
    export.add_argument("--job-timeout", type=positive, default=1800)
    search = commands.add_parser("search", help="find function names or recovered strings")
    search.add_argument("bundle", type=Path)
    search.add_argument("text")
    search.add_argument("--kind", choices=["function", "code", "string"], default="function")
    search.add_argument("--limit", type=positive, default=20)
    search.add_argument("--offset", type=nonnegative, default=0)
    show = commands.add_parser("show", help="read one function's decompiled code or native instructions")
    show.add_argument("bundle", type=Path)
    show.add_argument("function", help="exact name, entry:ADDRESS or rva:0xOFFSET")
    show.add_argument("--representation", choices=["code", "assembly"], default="code")
    show.add_argument("--line", type=positive, default=1)
    show.add_argument("--lines", type=positive, default=120)
    show.add_argument("--max-chars", type=positive, default=16000)
    graph = commands.add_parser("graph", help="walk static caller/callee references with call sites")
    graph.add_argument("bundle", type=Path)
    graph.add_argument("function")
    graph.add_argument("--direction", choices=["callers", "callees"], default="callees")
    graph.add_argument("--depth", type=positive, default=2)
    graph.add_argument("--limit", type=positive, default=100)
    refs = commands.add_parser("refs", help="find static instruction references to an exact indexed address")
    refs.add_argument("bundle", type=Path)
    refs.add_argument("address", help="exact address returned by search or graph")
    refs.add_argument("--limit", type=positive, default=20)
    refs.add_argument("--offset", type=nonnegative, default=0)
    symbols = commands.add_parser("symbols", help="compare PE CodeView and PDB GUID plus age")
    symbols.add_argument("artifact", type=Path)
    symbols.add_argument("pdb", type=Path)
    source = commands.add_parser("recover-map", help="recover embedded sources from local or inline source maps")
    source.add_argument("artifact", type=Path)
    source.add_argument("--map", type=Path)
    source.add_argument("--out", type=Path, required=True, help="new output directory; never overwritten")
    args = parser.parse_args(argv)
    try:
        if args.command == "doctor":
            result = doctor(args.ghidra)
        elif args.command == "decompile":
            result = export_native(args)
        elif args.command == "search":
            result = search_bundle(args)
            for row in result["rows"]:
                if "value" in row and len(row["value"]) > 1000:
                    row["value"] = row["value"][:1000]
                    row["value_truncated"] = True
        elif args.command == "show":
            result = show_function(args)
            if len(result["text"]) > args.max_chars:
                result["text"] = result["text"][:args.max_chars]
                result["text_truncated"] = True
        elif args.command == "graph":
            result = graph_bundle(args)
        elif args.command == "refs":
            result = references_to(args)
        elif args.command == "symbols":
            result = check_symbols(args.artifact.resolve(strict=True), args.pdb.resolve(strict=True))
        else:
            result = recover_map(args)
        print(json.dumps(result, ensure_ascii=False))
        return 1 if result.get("match") in ("guid-only", "mismatch") or result.get("state") == "partial" else 0
    except (OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
