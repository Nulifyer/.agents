---
name: frontend-design
description: Use when building or reshaping frontend UI, layouts, styling, or interaction states. Do not use for behavior-only changes with no design decisions.
license: See LICENSE.txt, LICENSE-T3.txt, and NOTICE.md.
---

# Frontend design

<!-- Modified 2026-10-31: condensed Anthropic guidance and integrated portable T3 UI rules. See NOTICE.md for sources. -->

## Establish direction

Inspect the brief, audience, primary task, nearby screens, shared components, and design tokens. Preserve the product's visual language unless a redesign is requested. Ask only when missing context blocks a meaningful decision; otherwise state a reasonable assumption and proceed.

For new visual identities, derive choices from the subject's materials, imagery, and vocabulary. Spend boldness in one memorable place; keep its surroundings disciplined. Open with what best expresses the subject: a headline, image, live demo, or useful interaction.

Before coding, settle a compact direction: palette, type roles, hierarchy, layout, alignment, and the defining choice. Reuse existing tokens; for a new palette, name 4–6 hex values. Use wireframes when comparing layouts helps. Keep planning proportional to the change.

## Make deliberate visual choices

Typography carries personality. Use one family or two with distinct roles, an intentional type scale, and controlled weights and spacing. Keep body lines under roughly 80 characters; give serif body text more leading. Make expressive headline type earn its place.

Watch for defaults appearing regardless of subject:

- Cream `#F4F1EA`, display serif, clay `#D97757`; near-black with acid green; hairline newspaper columns.
- Identical rounded cards, uniform shadows, decorative gradients, and the same radius at every hierarchy level.
- All-caps eyebrows, unnecessary labels, monospace metadata, middle-dot strings, automatic link arrows, and one arbitrarily accented headline word.

These treatments are options, not bans. Follow explicit direction and established product conventions. Change choices that have no reason beyond habit. Number content only when it is a sequence; use borders, labels, and dividers to explain structure. Remove decoration that serves no purpose.

## Build within the product

- Reuse shared controls. Add a generic size or variant to their owner; keep feature-specific treatments local. Compose slots or smaller components instead of copying markup and styles.
- Let components own appearance and parents own placement. Avoid call-site overrides of control height, padding, radius, colors, or focus rings.
- Follow the project's styling system. Keep static styles with their owning component. Reserve global CSS for themes, generated content, animations, or integration needs that local styles cannot express. Resolve cascade conflicts at the owner instead of escalating specificity.
- Account for narrow screens, themes, long content, and loading, empty, error, success, disabled, and expanded states where relevant. Use semantic controls, accessible names, readable contrast, and visible keyboard focus. Respect reduced motion.
- Prefer motion that explains a user's action. Use automatic motion sparingly; avoid repeated section entrances, gratuitous hover effects, and continuously repainting animations.
- When behavior changes, cover applicable entry points and clients, and provide the reverse action where needed. Do not redesign unrelated UI.

## Write usable interface copy

Name the user's task, not the implementation: "Notifications," not "Webhook configuration." Use plain verbs and sentence case. Match the brand without filler or sales claims.

Say what actions do: "Save changes," not "Submit." Keep vocabulary consistent: "Publish" produces "Published." Errors explain what happened and how to recover; empty states offer a useful next action. Give each text element one job.

## Verify and refine

When browser tools are available, inspect the rendered result at desktop and narrow widths, exercise changed interactions, and check relevant states, keyboard focus, and motion. Review screenshots for hierarchy, spacing, clipping, contrast, and consistency; fix observed defects.

Use before/after captures to support visual fixes. Run focused tests for changed logic; do not add tests that merely freeze copy or styling. State what was inspected and any unavailable checks. Do not claim visual verification from source review alone.
