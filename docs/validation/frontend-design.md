# Frontend design validation

Validated on 2026-10-31. The existing skill was revised in place. Automatic
selection remains the default. No scripts, host configuration, invocation
policy, or runtime dependencies were added.

## Synthesis and context budget

This is a mixed skill. Aesthetic guidance and interface-copy examples retain
normal prose. Operational instructions are compressed without dropping
conditions, ownership, scope, or evidence limits. The local and Anthropic
instructions were identical apart from license metadata, so their overlapping
content is represented once.

The synthesis retains subject-led direction, typography, specific default
treatments, the brief's authority, restrained motion, and usable copy. T3 adds
shared-component ownership, composition, local styling, state and entry-point
coverage, performance constraints, and rendered verification. T3-specific paths,
components, Tailwind requirements, and React internals were omitted.

Measured with tiktoken's `o200k_base`, including frontmatter and the modification
notice: 1,884 tokens before, 850 after, a 54.9% reduction. Token counts are
specific to this tokenizer; they do not establish equivalent costs in every host.

Upstream licenses and pinned source attribution are bundled with the skill.
They are not additional execution instructions or required runtime reads.

## Package checks

The Agent Skills reference validator accepted the source package and a
byte-identical copy in a clean temporary directory:

```text
uvx --from skills-ref agentskills validate skills/frontend-design
```

The Codex bundled `quick_validate.py` also accepted both copies. License bytes
were copied from the inspected upstream files. Final whitespace and relative-link
checks cover the skill, notices, and this report. No executable code changed,
so repository code tests were not run.

## Discovery and portability limits

The package uses only standard `name`, `description`, and `license` metadata.
Current primary documentation supports the shared personal-skill location for
[Codex](https://developers.openai.com/codex/skills),
[Copilot](https://docs.github.com/en/copilot/concepts/customizations/agent-skills),
and [OpenCode](https://opencode.ai/docs/skills/), and the fields follow the
[Agent Skills specification](https://agentskills.io/specification).

- Codex App Server `skills/list`, with `forceReload`, returned `frontend-design`
  enabled at the intended personal path with the revised description and no
  package errors.
- OpenCode v2.0.32 lacks the documented `debug skill` command. Its standalone
  `skill.list` request completed successfully but returned an empty catalog in a
  temporary directory. Runtime discovery is not established there. No existing
  service or global configuration was changed to work around this.
- Copilot CLI is absent. Its package and location contract were checked against
  documentation only.

No model-driven invocation or rendered implementation was tested across these
hosts. Package validity and Codex discovery do not establish cross-host routing
reliability or design quality.

## Manual scenario review

The author applied the revised instructions to these synthetic requests and
reviewed the resulting decisions. These are manual walkthroughs and
representative text outputs, not independent model evaluations or UI tests.

1. **New bicycle repair landing page.** Select the skill. Use a workshop photo
   as the focal point, a task-led booking layout, and one type family with a
   clear hierarchy. Example palette: Paper `#F5F7FA`, Ink `#18303C`, Blue
   `#2155CD`, Signal `#D94B27`. Example copy: "Book a repair" and "Choose a
   time for your bike." The plan uses subject matter and four named values,
   without inventing decorative statistics or repeated cards.
2. **Add notification settings to an established app.** Select the skill. Reuse
   its tokens, switches, buttons, spacing, and layout. Add a shared variant only
   for a reusable treatment. Example copy: "Email notifications," "Save
   changes," and "Changes saved." Preserve the product identity instead of
   introducing a new palette or hero.
3. **A requested cream-and-clay editorial page.** Select the skill. Honor that
   palette and editorial direction despite their inclusion in the defaults
   list. Use purposeful hierarchy and structure. Number only actual steps.
4. **A failed notification save and an empty repair schedule.** Example error:
   "Changes could not be saved. Check your connection and try again." Example
   empty state: "No repairs scheduled. Book a repair." The error's cause and
   recovery would need to match the actual failure. Both outputs name the user
   task and give a next action without backend terminology or apologies.
5. **Fix a clipped button label on mobile.** Select the skill. Resolve the
   component's sizing or layout ownership, inspect narrow and desktop widths,
   and use before/after captures. Avoid a call-site specificity workaround or a
   test that merely freezes class strings.
6. **Fix webhook retry backoff without changing UI.** Do not select the skill.
   The description excludes behavior-only work without design decisions.
7. **Browser tools unavailable.** Source review can support implementation
   findings, but does not establish visual verification. Report that rendered
   checks remain unavailable instead of marking them passed.

These reviews check intended routing, brief precedence, design-system reuse,
copy style, ownership, and evidence boundaries. They do not measure how reliably
another model follows the skill.

## Work preservation

The staged diff and unrelated tracked worktree diff retained their baseline
hashes. No staging or commits occurred during validation. Changes are confined to the
frontend-design package and this validation report.
