# Retire a superseded path

## Prove the old path is removable

Identify the old path, its replacement, and the behavior each one owns. Remove
the old path when the replacement is implemented, relevant callers have moved,
and focused verification shows that supported behavior no longer depends on it.

Check beyond direct text references. Account for registration, reflection,
dynamic imports, plugins, generated code, build and packaging inputs,
deployment skew, persisted data, public interfaces, and downstream users. Use
the repository's language and dependency tools where they can prove
reachability. Search results are evidence, not proof by themselves.

Retain compatibility code only for a current requirement such as a supported
downstream consumer, staged migration, rollback contract, or required record.
Name the requirement, owner, and removal condition in the repository's normal
tracking system. A hypothetical future need is not a retention reason.

## Remove the whole path

Trace the old path outward and remove everything that exists only for it:

- implementation files, entrypoints, adapters, shims, exports, and callers;
- feature flags, configuration, environment variables, and fallback branches;
- tests, fixtures, snapshots, mocks, sample data, and benchmarks;
- direct dependencies, build steps, generators, scripts, package metadata, and
  lockfile entries;
- documentation, examples, diagrams, migration notes, comments, and operational
  instructions;
- generated output and other artifacts created only to develop or verify it.

Update surviving tests and documentation to describe the replacement as the
normal path. Preserve historical material only when readers still need it to
migrate, understand a compatibility limit, or operate a released version. Do
not leave dead code commented out, rename it to `legacy`, or move it to an
archive when version control already records it.

Before removing a dependency, confirm that no surviving build, runtime, test,
tooling, or platform-specific path uses it. Update the manifest and lockfile
with the project's package tooling.

## Verify retirement

Search for retired symbols, paths, configuration keys, dependency names, and
documentation terms. Explain intentional survivors. Run focused tests through
the replacement plus relevant build, package, or documentation checks. Deleted
legacy tests do not prove that the replacement works.
