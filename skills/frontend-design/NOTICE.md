# Sources and changes

Modified on 2026-10-31. This package combines the existing local skill with
Anthropic's frontend-design guidance and portable rules from T3 Code.
It is a mixed skill: operational instructions are compressed, while aesthetic
guidance and interface-copy examples retain normal prose.

- Local baseline: `skills/frontend-design/SKILL.md` at commit
  `143618cf3f6141242157d9574f7dbde89953664f`. Its instructions match the
  Anthropic source below, so they are deduplicated rather than treated as
  separate guidance.
- Anthropic: [frontend-design SKILL.md](https://github.com/anthropics/claude-plugins-official/blob/44490cccaf6d9f82fdeec9416fbf7c9bd72575dc/plugins/frontend-design/skills/frontend-design/SKILL.md),
  Apache-2.0, reproduced in [LICENSE.txt](LICENSE.txt).
  The plugin README credits Prithvi Rajasekaran and Alexander Bricken.
- T3 Code: [AGENTS.md](https://github.com/pingdotgg/t3code/blob/79f1fadfc6020b820d541ca4691d2feebb15dd1b/AGENTS.md),
  [Web UI](https://github.com/pingdotgg/t3code/blob/79f1fadfc6020b820d541ca4691d2feebb15dd1b/docs/internals/web-ui.md),
  and [UI consistency review](https://github.com/pingdotgg/t3code/blob/79f1fadfc6020b820d541ca4691d2feebb15dd1b/.macroscope/check-run-agents/ui-consistency.md),
  MIT, reproduced in [LICENSE-T3.txt](LICENSE-T3.txt).
  These are application-specific instructions, not a standalone design skill.

Changes preserve subject-led design, typography, restrained motion, meaningful
structure, interface-copy examples, and the brief's authority. They add component
ownership, composition, cascade discipline, state coverage, performance, and
evidence-based visual review. They remove duplicate prose, mandatory originality
gating, automatic confirmation, and an incorrect selector-type example. T3's
paths, named components, Tailwind mandate, tooling, and React-specific internals
are omitted so the skill follows each project's conventions.

Source URLs and license files are provenance, not runtime dependencies.
