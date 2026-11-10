"""Local Ghidra export and indexed, bounded reads. No target execution."""
import json
import hashlib
import os
from pathlib import Path
import shutil
import signal
import sqlite3
import subprocess
import tempfile
import time
from urllib.parse import quote

from case import fingerprint

HERE = Path(__file__).resolve().parent


def ghidra_location(explicit=None):
    candidates = []
    if explicit:
        candidates.append(Path(explicit))
    elif os.environ.get("RE_GHIDRA_HOME"):
        candidates.append(Path(os.environ["RE_GHIDRA_HOME"]))
    else:
        found = shutil.which("analyzeHeadless")
        if found:
            candidates.append(Path(found))
        candidates.extend([Path("/opt/ghidra"), Path("/usr/share/ghidra")])
    for candidate in candidates:
        launcher = candidate / "support/analyzeHeadless" if candidate.is_dir() else candidate
        if launcher.is_file() and os.access(launcher, os.X_OK):
            launcher = launcher.resolve()
            root = launcher.parent.parent
            properties = root / "Ghidra/application.properties"
            if properties.is_file():
                version = next((line.split("=", 1)[1] for line in properties.read_text().splitlines()
                                if line.startswith("application.version=")), "unknown")
                return {"launcher": str(launcher), "root": str(root), "version": version}
    return None


def doctor(explicit=None):
    commands = ["java", "llvm-readobj", "llvm-pdbutil", "objdump", "readelf",
                "ilspycmd", "jadx", "wasm2wat", "r2"]
    return {"ghidra": ghidra_location(explicit), "commands": {name: shutil.which(name) for name in commands},
            "bundled": ["ghidra-export", "bundle-search", "function-read", "call-graph", "pe-pdb-check", "source-map-recovery"],
            "limit": "Discovery does not install tools or certify their versions/formats; optional tools are not all wrapped."}


def write_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def build_index(bundle):
    database = bundle / "index.sqlite"
    with sqlite3.connect(database) as connection:
        connection.executescript("""
            CREATE TABLE functions(entry TEXT PRIMARY KEY, rva TEXT, name TEXT, signature TEXT,
                symbol_source TEXT, signature_source TEXT, external INTEGER, thunk INTEGER,
                body_bytes INTEGER, status TEXT, error TEXT, code TEXT, assembly TEXT);
            CREATE INDEX function_names ON functions(name);
            CREATE INDEX function_rvas ON functions(rva);
            CREATE TABLE refs(caller TEXT, site TEXT, target TEXT, callee TEXT, target_name TEXT,
                kind TEXT, is_call INTEGER);
            CREATE INDEX ref_callers ON refs(caller);
            CREATE INDEX ref_callees ON refs(callee);
            CREATE INDEX ref_targets ON refs(target);
            CREATE TABLE strings(address TEXT PRIMARY KEY, value TEXT);
        """)
        keys = ["entry", "rva", "name", "signature", "symbol_source", "signature_source", "external",
                "thunk", "body_bytes", "status", "error", "code", "assembly"]
        with (bundle / "functions.jsonl").open() as stream:
            for line in stream:
                row = json.loads(line)
                connection.execute("INSERT INTO functions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [row[key] for key in keys])
        keys = ["caller", "site", "target", "callee", "target_name", "kind", "is_call"]
        with (bundle / "references.jsonl").open() as stream:
            for line in stream:
                row = json.loads(line)
                connection.execute("INSERT INTO refs VALUES (?,?,?,?,?,?,?)", [row[key] for key in keys])
        with (bundle / "strings.jsonl").open() as stream:
            for line in stream:
                row = json.loads(line)
                connection.execute("INSERT INTO strings VALUES (?,?)", [row["address"], row["value"]])


def export_native(args):
    if os.name != "posix":
        raise ValueError("Ghidra runner currently requires a POSIX host for process-group timeout cleanup")
    ghidra = ghidra_location(args.ghidra)
    if not ghidra:
        raise ValueError("Ghidra headless launcher unavailable; set --ghidra ROOT or RE_GHIDRA_HOME")
    original = args.artifact.resolve(strict=True)
    identity = {"artifact_sha256": fingerprint(original), "ghidra": ghidra,
                "scripts": {str(p.relative_to(HERE)): fingerprint(p) for p in
                            [*HERE.glob("*.py"), *(HERE / "ghidra").glob("*.java")]},
                "targets": sorted(set(args.function)), "analysis_timeout": args.analysis_timeout,
                "function_timeout": args.function_timeout, "job_timeout": args.job_timeout}
    symbol_record = None
    if args.pdb:
        from symbols import check_symbols
        symbol_record = check_symbols(original, args.pdb.resolve(strict=True))
        if symbol_record["match"] != "exact" and not (args.allow_partial_symbols and symbol_record["match"] == "guid-only"):
            raise ValueError("PDB identity not accepted: " + json.dumps(symbol_record))
        identity["pdb"] = symbol_record
    elif args.allow_partial_symbols:
        raise ValueError("--allow-partial-symbols requires --pdb")
    cache_key = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    args.out.mkdir(parents=True, exist_ok=True)
    bundle = args.out.resolve() / cache_key[:24]
    if bundle.exists():
        manifest = verify_bundle(bundle)
        if manifest.get("identity") != identity:
            raise ValueError("cache identity differs; use another output root")
        return {"bundle": str(bundle), "reused": True, "state": manifest["state"], "summary": manifest["summary"]}
    bundle.mkdir()
    manifest = {"version": 1, "state": "running", "identity": identity, "artifact_path": str(original),
                "target_execution": False, "symbol_policy": "explicit local PDB only; automatic PDB lookup disabled",
                "started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    write_json(bundle / "manifest.json", manifest)
    try:
        with tempfile.TemporaryDirectory(prefix="project-", dir=bundle) as project:
            snapshot = Path(project) / "artifact.bin"
            shutil.copyfile(original, snapshot)
            if fingerprint(snapshot) != identity["artifact_sha256"]:
                raise ValueError("original changed while creating analysis snapshot")
            local_pdb = "none"
            if args.pdb:
                copied_pdb = Path(project) / "symbols.pdb"
                shutil.copyfile(args.pdb, copied_pdb)
                if fingerprint(copied_pdb) != symbol_record["pdb_sha256"]:
                    raise ValueError("PDB changed while creating analysis snapshot")
                local_pdb = str(copied_pdb)
            targets = Path(project) / "targets.json"
            targets.write_text(json.dumps(identity["targets"]), encoding="utf-8")
            command = [ghidra["launcher"], project, "analysis", "-import", str(snapshot),
                       "-log", str(Path(project) / "application.log"),
                       "-scriptlog", str(Path(project) / "script.log"),
                       "-scriptPath", str(HERE / "ghidra"), "-preScript", "REConfigure.java", local_pdb,
                       "-analysisTimeoutPerFile", str(args.analysis_timeout), "-max-cpu", "2",
                       "-postScript", "REExport.java", str(bundle), str(args.function_timeout), str(targets),
                       "-deleteProject"]
            manifest["command"] = command
            environment = os.environ.copy()
            environment.update({"XDG_CONFIG_HOME": str(Path(project) / "config"),
                                "XDG_CACHE_HOME": str(Path(project) / "cache")})
            manifest["runtime_defaults"] = {name: environment[name] for name in
                                           ["XDG_CONFIG_HOME", "XDG_CACHE_HOME"]}
            write_json(bundle / "manifest.json", manifest)
            with (bundle / "headless.log").open("w") as log:
                process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
                                           cwd=project, env=environment)
                try:
                    code = process.wait(timeout=args.job_timeout)
                except (subprocess.TimeoutExpired, KeyboardInterrupt):
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
                    raise ValueError("Ghidra job stopped; incomplete output retained in " + str(bundle))
            manifest["exit_code"] = code
            if code != 0 or not (bundle / "summary.json").is_file():
                raise ValueError("Ghidra failed or exporter did not complete; inspect " + str(bundle / "headless.log"))
        if fingerprint(original) != identity["artifact_sha256"]:
            raise ValueError("original changed during analysis")
        if args.pdb and fingerprint(args.pdb) != symbol_record["pdb_sha256"]:
            raise ValueError("PDB changed during analysis")
        summary = json.loads((bundle / "summary.json").read_text())
        if not summary.get("export_completed") or summary["internal_functions"] == 0:
            raise ValueError("export incomplete or no functions discovered")
        if summary["internal_functions"] != summary["decompiled"] + summary["failed"] + summary["not_selected"]:
            raise ValueError("export counts inconsistent")
        if identity["targets"] and summary["decompiled"] + summary["failed"] == 0:
            raise ValueError("none of the selected functions matched")
        build_index(bundle)
        manifest["summary"] = summary
        diagnostics = [line for line in (bundle / "headless.log").read_text(errors="replace").splitlines()
                       if "WARN " in line or "ERROR " in line or "Could not apply" in line]
        manifest["diagnostics"] = {"count": len(diagnostics), "first_100": diagnostics[:100]}
        manifest["state"] = "partial" if summary["failed"] or summary["analysis_timed_out"] else "complete"
        manifest["outputs"] = {name: fingerprint(bundle / name) for name in
                               ["functions.jsonl", "references.jsonl", "strings.jsonl", "summary.json", "index.sqlite", "headless.log"]}
        write_json(bundle / "manifest.json", manifest)
        return {"bundle": str(bundle), "reused": False, "state": manifest["state"], "summary": summary}
    except BaseException as error:
        manifest["state"] = "failed"
        manifest["error"] = str(error)
        write_json(bundle / "manifest.json", manifest)
        raise


def verify_bundle(bundle):
    manifest = json.loads((bundle / "manifest.json").read_text())
    if manifest.get("version") != 1 or manifest.get("state") not in ("complete", "partial"):
        raise ValueError("bundle is incomplete; use a new output root after inspecting its failure")
    expected = manifest.get("outputs", {})
    outputs = {"functions.jsonl", "references.jsonl", "strings.jsonl", "summary.json", "index.sqlite", "headless.log"}
    if set(expected) != outputs:
        raise ValueError("bundle output identities are incomplete or unexpected")
    for name, checksum in expected.items():
        if fingerprint(bundle / name) != checksum:
            raise ValueError("changed bundle output: " + name)
    return manifest


def open_index(bundle):
    manifest = verify_bundle(bundle)
    connection = sqlite3.connect("file:" + quote(str((bundle / "index.sqlite").resolve()), safe="/") + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection, manifest


def choose_function(connection, selector):
    if selector.startswith("rva:"):
        rows = connection.execute("SELECT * FROM functions WHERE rva=?", ("0x" + format(int(selector[4:], 16), "x"),)).fetchall()
    elif selector.startswith("entry:"):
        rows = connection.execute("SELECT * FROM functions WHERE lower(entry)=lower(?)", (selector[6:],)).fetchall()
    else:
        rows = connection.execute("SELECT * FROM functions WHERE name=?", (selector,)).fetchall()
    if len(rows) != 1:
        raise ValueError(f"function selector matched {len(rows)} rows; search first and use entry:ADDRESS")
    return dict(rows[0])


def search_bundle(args):
    connection, manifest = open_index(args.bundle)
    with connection:
        needle = args.text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        if args.kind == "string":
            query = "SELECT address, value FROM strings WHERE value LIKE ? ESCAPE '\\' ORDER BY address"
        elif args.kind == "code":
            query = "SELECT entry,rva,name,status,substr(code,max(1,instr(lower(code),lower(?))-120),360) AS snippet FROM functions WHERE code LIKE ? ESCAPE '\\' ORDER BY entry"
        else:
            query = "SELECT entry,rva,name,signature,status,error FROM functions WHERE name LIKE ? ESCAPE '\\' ORDER BY entry"
        params = (args.text, "%" + needle + "%") if args.kind == "code" else ("%" + needle + "%",)
        total = connection.execute("SELECT count(*) FROM (" + query + ")", params).fetchone()[0]
        rows = [dict(row) for row in connection.execute(query + " LIMIT ? OFFSET ?", (*params, args.limit, args.offset))]
    connection.close()
    return {"state": manifest["state"], "artifact_sha256": manifest["identity"]["artifact_sha256"], "total_matches": total, "offset": args.offset,
            "symbol_match": manifest["identity"].get("pdb", {}).get("match", "not_supplied"),
            "rows": rows, "more": args.offset + len(rows) < total}


def show_function(args):
    connection, manifest = open_index(args.bundle)
    try:
        function = choose_function(connection, args.function)
        function.pop("assembly" if args.representation == "code" else "code")
        lines = function.pop(args.representation if args.representation == "code" else "assembly").splitlines()
        selected = lines[args.line - 1:args.line - 1 + args.lines]
        function.update({"state": manifest["state"], "artifact_sha256": manifest["identity"]["artifact_sha256"], "representation": args.representation,
                         "symbol_match": manifest["identity"].get("pdb", {}).get("match", "not_supplied"),
                         "start_line": args.line, "total_lines": len(lines), "text": "\n".join(selected),
                         "more": args.line - 1 + len(selected) < len(lines),
                         "limit": "Recovered code is derived; native instructions remain the cross-check."})
        return function
    finally:
        connection.close()


def references_to(args):
    connection, manifest = open_index(args.bundle)
    try:
        total = connection.execute("SELECT count(*) FROM refs WHERE target=?", (args.address,)).fetchone()[0]
        rows = [dict(row) for row in connection.execute(
            "SELECT refs.*,functions.name AS caller_name FROM refs LEFT JOIN functions ON functions.entry=refs.caller WHERE target=? ORDER BY site LIMIT ? OFFSET ?",
            (args.address, args.limit, args.offset))]
        return {"state": manifest["state"], "artifact_sha256": manifest["identity"]["artifact_sha256"],
                "target": args.address, "total_matches": total, "rows": rows, "offset": args.offset,
                "more": args.offset + len(rows) < total, "limit": "Recorded static instruction references; indirect and dynamically computed accesses can be absent."}
    finally:
        connection.close()


def graph_bundle(args):
    connection, manifest = open_index(args.bundle)
    try:
        function = choose_function(connection, args.function)
        frontier = [function["entry"]]
        seen = set(frontier)
        edges = []
        truncated = False
        for depth in range(args.depth):
            next_frontier = []
            for entry in frontier:
                field = "caller" if args.direction == "callees" else "callee"
                query = f"SELECT refs.*,f.name AS caller_name,g.name AS callee_name FROM refs LEFT JOIN functions f ON f.entry=refs.caller LEFT JOIN functions g ON g.entry=refs.callee WHERE refs.{field}=? AND is_call=1 ORDER BY site LIMIT ?"
                rows = connection.execute(query, (entry, args.limit - len(edges) + 1)).fetchall()
                for row in rows:
                    if len(edges) >= args.limit:
                        truncated = True
                        break
                    edge = dict(row)
                    edge["depth"] = depth + 1
                    edges.append(edge)
                    other = edge["callee"] if args.direction == "callees" else edge["caller"]
                    if other and other not in seen:
                        seen.add(other); next_frontier.append(other)
                if truncated:
                    break
            if truncated or not next_frontier:
                break
            frontier = next_frontier
        return {"state": manifest["state"], "artifact_sha256": manifest["identity"]["artifact_sha256"], "root": function["entry"], "direction": args.direction,
                "depth": args.depth, "edges": edges, "truncated": truncated,
                "limit": "Static call references only; indirect dispatch and runtime reachability can be incomplete."}
    finally:
        connection.close()
