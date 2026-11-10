# Clean-room methods for study

Read this when comparing clean-room practices or when the task explicitly
requires source exclusion. Ordinary source-informed rebuilding stays on the
rebuild branch. Do not add an isolation requirement to it.

## What transfers to ordinary rebuilding

Keep a contract independent of the proposed implementation. Preserve original
observations, provenance, fixture identity and divergences. Give reviewers
enough evidence to challenge the implementation. These practices improve a
source-informed rebuild without requiring separate teams.

Use precise labels. Decompilation, source recovery, language translation,
source-informed reimplementation and a claimed clean-room reconstruction have
different information inputs. Reading implementation code and rewriting it in
another language does not establish source independence.

## What source exclusion adds

Specify permitted inputs before analysis: public specifications, licensed
black-box observations, interfaces and reviewed behavioral descriptions. Define
which role can access binaries, pseudocode, source, test internals and traces.
An analyst may require broader access than an implementer; the exact policy
depends on the project's purpose.

A reviewed handoff should describe behavior and evidence, with its version,
hash, reviewer, unknowns and source-use record. Review it for copied expressive
material and unnecessary implementation detail. Freeze the accepted handoff
before implementation and track revisions.

If the task requires enforced separation, use distinct contexts plus an actual
host-controlled filesystem, tool and network boundary. A fresh prompt, role
label, shared-workspace subagent or MCP allowlist cannot prove that other access
paths are blocked. Inherited history, shared indexes and persistent memory can
cross the intended separation. Record any accidental exposure instead of
silently continuing to claim independence.

Keep legal conclusions separate from engineering controls. A model's prior
training is not erased by a new session. Passing a conformance suite does not
establish copyright, license, contractual or asset rights. Study applicable
primary legal sources when making a legal claim; do not present a clean-room
tool or skill as a legal certificate.

## Evidence to demand from public claims

Check the permitted-input policy, accessible source/history, reviewed handoff,
enforcement mechanism, original oracle and tested scope. Treat a README's
clean-room label as an author claim until those records support it. Count one
creator once across several clones, repositories or language ports.
