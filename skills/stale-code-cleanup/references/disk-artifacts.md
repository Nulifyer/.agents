# Clean disk artifacts

## Bound production and retention

Before an operation may create large files, choose a bounded artifact directory,
check available space when exhaustion is plausible, and identify the files that
must survive as evidence. Prefer disposable temporary directories and arrange
cleanup with the language's `finally`, `defer`, trap, fixture teardown, or test
cleanup mechanism.

After extracting the needed result, delete reproducible bulk data. Keep the
smallest useful evidence, such as a reduced fixture, checksum, command, summary,
or failure trace. If reproduction is expensive or impossible, decide retention
with the user or repository policy instead of assuming the data is disposable.

If disk pressure is already material, stop producing more data and identify the
exact space owners. Do not substitute a broad system or cache purge for scoped
artifact cleanup. If a tool repeatedly leaves large outputs, fix its output
location or teardown within the task's scope so the leak does not recur.

## Delete exact targets

Resolve and inspect targets before removing them. Never aim recursive cleanup
at a workspace root, home directory, unresolved variable, broad glob, shared
cache, container store, or volume. Preserve untracked files whose owner or
purpose is uncertain. Stop processes that still own an artifact before deleting
it. Prefer a recoverable move when source control does not protect the data and
immediate deletion is unnecessary.

Artifacts created inside the current task's bounded workspace may be cleaned up
as part of that task. Ask before deleting shared caches, external resources,
another task's outputs, or material user data that was not clearly disposable.

## Verify disk cleanup

Compare the exact target's size before and after, or report the sizes of removed
files. Do not claim reclaimed space from filenames or intended commands alone.
