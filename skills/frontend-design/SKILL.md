---
name: frontend-design
description: Use when building, reshaping, or auditing frontend UI, layouts, styling, or interaction states. Do not use for behavior-only changes with no design decisions.
---

# Frontend design

## Establish direction

Start from the user story, even when the brief is informal. Identify the user, what brings them here, their desired outcome, why it matters, and the success condition. Give each screen a clear purpose within that story.

Map the workflow before choosing the layout: what the user needs to know, the decisions and actions in order, and the result. Include feedback and recovery where the task can fail. Derive content, controls, navigation, and visual priority from that flow. Choose screen boundaries around coherent user decisions.

For "invite a teammate," lead with the recipient and necessary access choices, then sending and visible confirmation. Make pending invitations and failed-send recovery easy to find.

Inspect nearby screens, shared components, and design tokens. Identify what already helps users and preserve it. Keep the product's visual language unless a redesign is requested. For an audit, produce findings without editing the UI unless fixes are requested.

For new visual identities, derive choices from the subject's materials, imagery, and vocabulary. Spend boldness in one memorable place; keep its surroundings disciplined. Open with what best expresses the subject: a headline, image, live demo, or useful interaction.

Before coding, settle a compact direction: palette, type roles, hierarchy, layout, alignment, and the defining choice. Reuse existing tokens. For substantial work, define observable acceptance criteria around representative tasks and screens. Scale planning and review to the change.

## Make deliberate visual choices

Typography carries personality. Use one family or two with distinct roles, an intentional type scale, and controlled weights and spacing. Verify that the intended fonts and weights actually render on supported platforms. Keep body lines under roughly 80 characters. Make expressive headline type earn its place.

Watch for defaults appearing regardless of subject:

- Cream `#F4F1EA`, display serif, clay `#D97757`; near-black with acid green; hairline newspaper columns.
- Identical rounded cards, uniform shadows, decorative gradients, and the same radius at every hierarchy level.
- All-caps eyebrows, unnecessary labels, monospace metadata, middle-dot strings, automatic link arrows, and one arbitrarily accented headline word.

These treatments are options, not bans. Follow explicit direction and established product conventions. Change choices that have no reason beyond habit. Number content only when it is a sequence; use borders, labels, and dividers to explain structure. Remove decoration that serves no purpose.

Give color a clear role in identity, action, or state. Quiet competing decoration while preserving useful recognition cues. Keep semantic meanings stable across themes. Make focus distinguishable from selection, and active controls distinguishable from disabled ones. Minimal color is not a goal by itself.

In dense tools, keep useful task context and status visible together. Let titles and primary actions lead, with metadata at a quieter but readable level. Remove repeated labels, blank rows, and competing chrome before removing useful information.

Align related icons, labels, values, counters, and actions into consistent columns. Reserve space for selection markers so rows do not shift. Give equivalent controls consistent treatment. Within a view, distinguish symbols for different operations, such as adding and expanding.

## Build within the product

- Reuse shared controls. Add a generic size or variant to their owner; keep feature-specific treatments local. Compose slots or smaller components instead of copying markup and styles.
- Let components own appearance and parents own placement. Avoid call-site overrides of control height, padding, radius, colors, or focus rings.
- Follow the project's styling system. Keep static styles with their owning component. Resolve cascade conflicts at the owner, including layer and theme precedence. Shared defaults must respect explicit variants and overrides.
- Cover relevant themes, content lengths, and loading, empty, error, success, disabled, and expanded states. Hiding apparently empty UI must preserve pending work, error messages, completion feedback, and access to actions. A zero counter alone does not prove emptiness.
- Use semantic controls, accessible names, readable contrast, and visible keyboard focus. Keep essential actions discoverable on touch and keyboard. Hover-only presentation needs an equivalent usable path.
- Prefer motion that explains a user's action. Use automatic motion sparingly; avoid repeated section entrances, gratuitous hover effects, and continuously repainting animations.
- When behavior changes, cover applicable entry points and clients, and provide the reverse action where needed. Do not redesign unrelated UI.

## Write usable interface copy

Name the user's task, not the implementation: "Notifications," not "Webhook configuration." Use plain verbs and sentence case. Match the brand without filler or sales claims.

Say what actions do: "Save changes," not "Submit." Keep vocabulary consistent: "Publish" produces "Published." Errors explain what happened and how to recover; empty states offer a useful next action. Give each text element one job.

## Verify and refine

Inspect the rendered result with available, permitted tools. Use realistic content and walk the user story from entry through completion and recovery. Check that each screen makes its purpose, next action, and result clear. Check the following where relevant:

- Resize through narrow, intermediate, and wide layouts. Check larger text, keyboards, fixed elements, and open panels for lost content, collisions, and sudden layout jumps.
- Preserve identifying text when truncating paths or titles. Check long-to-short updates, resizing in both directions, and expanded/collapsed variants. Confirm apparent screenshot clipping at native resolution.
- Measure contrast on actual composited backgrounds, including tinted rows, overlays, code, diffs, and changed-word highlights. Preserve meaningful distinctions between colors when improving contrast.
- Inspect simultaneous focus and selection, hover swaps, loading, failure, and completion. Exercise keyboard and touch paths. Check motion and reduced-motion behavior when affected.

Compare captures with equivalent content, viewport, theme, platform, and build conditions. Use references for concrete design questions, preserving the product's own purpose. Do not score unseen screens or competitors from memory.

For each finding, name the screen and state, evidence, user impact, and smallest useful correction. Separate defects from preferences. Prefer "The narrow panel hides the identifying filename" over "improve spacing." Record strengths to preserve. Identify a code cause only after inspecting it.

Fix the highest-impact supported defects, then inspect fresh renders of the affected states. Use focused tests for changed behavior or reusable calculations, such as stale clipping or layout continuity. Do not add tests that merely freeze copy or styling.

If scoring is requested, use stable criteria and tie deductions to findings. Keep blockers visible regardless of the average. For authorized independent reviews, give each reviewer the same evidence and constraints without target or previous scores. Recheck changed builds. Stop against the user's acceptance criteria and budget, and report gaps instead of chasing score drift.

Claim only the checks actually performed. Screenshots establish visible findings, not keyboard operation, accessible semantics, or complete UX quality.
