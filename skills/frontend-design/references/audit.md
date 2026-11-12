# Audit procedure

For a workflow audit, walk representative tasks before inspecting visual detail: first use, the most frequent task, and one that fails. For a component or visual audit, inspect its task context and states within the requested scope. Spacing fixes do not repair a missing decision or lost input.

For each finding, name the screen and state, evidence, user impact, and smallest useful correction. Rate severity by task impact: blocker when the task cannot be completed or work is lost, major when mistakes or heavy friction are likely, minor when it slows or confuses, polish otherwise. Separate defects from preferences. Prefer "The narrow panel hides the identifying filename" over "improve spacing." Record strengths to preserve. Identify a code cause only after inspecting it.

When fixes are in scope, address the highest-impact supported defects, then inspect fresh renders of the affected states. Use focused tests for changed behavior or reusable calculations, such as stale clipping or layout continuity. Do not add tests that merely freeze copy or styling.

If scoring is requested, use stable criteria, tie deductions to findings, and keep blockers visible regardless of the average. Give authorized independent reviewers the same evidence and constraints without previous or target scores. Stop against the user's acceptance criteria and budget, and report gaps.

Compare captures with equivalent content, viewport, theme, platform, and build conditions. Use references for concrete design questions, preserving the product's own purpose. Do not score unseen screens or competitors from memory.
