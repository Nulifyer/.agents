"""Check PE CodeView and local PDB GUID/age using LLVM parsers."""
import re
import shutil
import subprocess

from case import fingerprint


def llvm_output(command):
    if not shutil.which(command[0]):
        raise ValueError(f"{command[0]} unavailable; install LLVM tools or inspect companion identity manually")
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise ValueError(command[0] + " could not parse the input: " + result.stderr[-1500:])
    return result.stdout


def check_symbols(artifact, pdb):
    artifact_before = fingerprint(artifact)
    pdb_before = fingerprint(pdb)
    image_output = llvm_output(["llvm-readobj", "--coff-debug-directory", str(artifact)])
    pdb_output = llvm_output(["llvm-pdbutil", "dump", "--summary", str(pdb)])
    records = []
    for block in re.findall(r"PDBInfo\s*\{(.*?)\n\s*\}", image_output, re.S):
        guid = re.search(r"PDBGUID:\s*\{([0-9A-Fa-f-]+)\}", block)
        age = re.search(r"PDBAge:\s*(\d+)", block)
        if guid and age:
            records.append({"guid": guid[1].lower(), "age": int(age[1])})
    guid = re.search(r"^\s*GUID:\s*\{([0-9A-Fa-f-]+)\}", pdb_output, re.M)
    age = re.search(r"^\s*Age:\s*(\d+)", pdb_output, re.M)
    if not records or not guid or not age:
        raise ValueError("missing supported RSDS GUID/age identity; legacy or portable PDB needs its native identity route")
    companion = {"guid": guid[1].lower(), "age": int(age[1])}
    match = "exact" if companion in records else "guid-only" if any(row["guid"] == companion["guid"] for row in records) else "mismatch"
    if fingerprint(artifact) != artifact_before or fingerprint(pdb) != pdb_before:
        raise ValueError("input changed during symbol identity check")
    return {"match": match, "pe_codeview": records, "pdb_identity": companion,
            "artifact_sha256": artifact_before, "pdb_sha256": pdb_before,
            "pdb_stripped": bool(re.search(r"Is stripped:\s*true", pdb_output)),
            "tools": {tool: llvm_output([tool, "--version"]).strip() for tool in ["llvm-readobj", "llvm-pdbutil"]},
            "limit": "Exact means recorded GUID and age match; guid-only is navigation evidence, not validated type/layout identity."}
