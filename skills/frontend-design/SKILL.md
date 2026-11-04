---
name: frontend-design
description: Use when building, reshaping, or auditing frontend UI, user flows, layouts, styling, or interaction states. Do not use for behavior-only changes with no design decisions.
---

# Frontend design

## What good UI does

At each step of a task, good UI lets a person answer:

- Where am I, and what is this for?
- What can I do here, and which action matters now?
- What will happen, and what will it change?
- Did it work, and where do I see the result?
- If something went wrong, how do I recover without starting over?

Minimize searching, remembering, and risk, not clicks. Visual design makes these answers visible: hierarchy shows what matters, grouping shows what belongs together, and consistency lets people predict what a control does. Use these questions to design, to check work before delivery, and to audit.

## Inherit project decisions

Start with the affected component or flow and its governing tokens and design guidance. Expand inspection to shared components and representative screens when decisions are unclear or changes affect broader conventions. Identify the sources of truth and distinguish established conventions from isolated inconsistencies.

Separate decisions by scope:

- **Project foundations:** type roles, spacing scale, color roles and themes, radii, elevation, icon family, control sizes, and motion conventions. Reuse established choices. Revisit them for a requested redesign or a supported defect within the task.
- **Screen or flow:** hierarchy, grouping, density, layout, navigation, primary actions, and feedback. Derive these from the current task within the project foundations.
- **Verification:** check the affected content, states, themes, widths, and interactions after each coherent change. Existing foundations still need checking in their new context.

When foundations are incomplete, establish only what the task needs. Try reusable choices with representative content and states, then record them in the tokens, shared components, or design guidance that owns them. If no owner exists, create the smallest shared home needed for reuse, following the project's organization. Keep local layout decisions local. When a local change exposes a defect outside its scope, report it instead of silently fixing it. For an audit, produce findings without editing the UI unless fixes are requested.

## Establish direction

Scale planning to the change. For a small adjustment, name the task it serves and the states it touches, then build. For a new screen, flow, or redesign, work through this section first.

Start from the user story, even when the brief is informal. Identify the user, what brings them here, their desired outcome, why it matters, and the success condition. Give each screen a clear purpose within that story. Note how often they do it, their expertise and device, and the cost of a mistake. Label assumptions; do not invent user research.

Map the workflow before choosing the layout: what the user needs to know, the decisions and actions in order, and the result. Include feedback and recovery where the task can fail. Derive content, controls, navigation, and visual priority from that flow. Choose screen boundaries around coherent user decisions, and put information beside the decision it supports. Name the states each step needs, such as empty, loading, saving, saved, and failed.

For "invite a teammate," lead with the recipient and necessary access choices, then sending and visible confirmation. Default to the safest role and say what each role grants. Make pending invitations and failed-send recovery easy to find.

For new visual identities, derive choices from the subject's materials, imagery, and vocabulary. Spend boldness in one memorable place; keep its surroundings disciplined. Open with what best expresses the subject: a headline, image, live demo, or useful interaction.

For consequential unresolved choices, use references to study specific qualities such as hierarchy, density, typography, or interaction behavior. Compare meaningfully different alternatives when needed, and explain the expected effect on the task. Preserve the product's purpose when borrowing a treatment.

Before coding, identify which conventions apply and which task decisions remain open. When new foundations are needed, settle a compact direction for the relevant palette, type roles, spacing, and component treatments. For substantial work, define observable acceptance criteria around representative tasks and screens.

## Make deliberate visual choices

Use the following guidance to apply established conventions, fill gaps, or assess supported defects. Add reusable values at their shared owner. The numbers below are starting points when no system exists; adjust related choices together using rendered content.

**Hierarchy.** Before reading any label, visual weight should identify the current context, the main work, and the next action. Give each task region one distinct primary action; keep secondary actions quieter and destructive actions separated. Let titles and primary actions lead, with metadata at a quieter but readable level.

**Typography.** Choose a typeface for the product's character as well as readability. Compare representative labels, paragraphs, numbers, and filenames at actual sizes. Check character distinction, language coverage, and wrapping. Define text roles through family, size, weight, and line height. Settle these before fine-tuning component dimensions; changing the font can change wrapping, control widths, and apparent spacing.

Use one family or two with distinct roles, an intentional type scale, and controlled weights and spacing. In product UI, about four to six sizes and two or three weights are enough. Separate levels with one or two of size, weight, and color, not all three at once. Use about 16px for reading text; 13–14px suits dense tools. Use line height around 1.4–1.6 for body text and tighter for headings. Keep body lines under roughly 80 characters. Use tabular numerals for numbers that are compared or update in place, and right-align numeric columns. Set text in units that follow user zoom. Verify that the intended fonts and weights actually render on supported platforms, with a fallback of similar metrics so text does not jump on load. Make expressive headline type earn its place.

**Spacing and whitespace.** Pick spacing from a scale, commonly multiples of 4px. Spacing expresses structure: items in a group sit closer than groups do, and sections are separated further still. Uniform spacing flattens hierarchy as much as uniform type does. Use whitespace to clarify grouping, emphasis, and scanning; add or remove it where those relationships need to change.

Give equivalent controls the same height and padding, and match the heights of inputs and buttons that share a row. Derive padding from the intended control size and text or icon dimensions, accounting for borders. For example, a 36px control with a 20px line box and two 1px borders needs 7px vertical padding. Allow calculated or optical exceptions to the spacing scale and keep them at the component owner. Usually give text controls more horizontal than vertical padding. Align to a few shared edges; each extra alignment line adds noise. Align text on baselines and center icons optically, not only by bounding box.

**Density.** Choose density from the task. Frequent, expert, or comparison-heavy work such as tables, logs, inboxes, and editors benefits from compact rows and more on screen. Occasional or high-stakes flows benefit from room and fewer choices per view. Do not give a tool marketing-page spacing or an onboarding flow tool density. In dense tools, keep useful task context and status visible together. Compact by removing repeated labels, card wrappers, unnecessary borders, blank rows, and oversized headers before shrinking type or removing useful information. Keep hit areas at least 24×24 CSS px even when the visible control is smaller, and larger for touch: 44pt on iOS, 48dp on Android.

Choose content widths and responsive changes using realistic content. Decide what wraps, stacks, scrolls, or remains visible as space decreases, keeping information beside the decision it supports.

**Iconography.** Use one icon set with a consistent stroke, fill, and corner style, at a few sizes matched to adjacent text. One icon means one thing across the product, and within a view, different operations such as adding and expanding get distinct symbols. Pair icons with text unless the symbol is unmistakable in context, such as close or search; icon-only buttons need an accessible name and a tooltip. Do not decorate every heading or row with an icon. Avoid emoji as interface icons because they render differently across platforms. Icons take their color from the text or state they belong to.

**Color and themes.** Define color roles for backgrounds, surfaces, text, borders, actions, selection, focus, and status, then map them to palette values in each theme. Check the actual foreground and background pairs, including overlays and tinted regions. Preserve hierarchy and state distinctions across themes; each theme may need different surface, border, and elevation treatments.

Give color a clear role in identity, action, or state. Quiet competing decoration while preserving useful recognition cues. Keep semantic meanings stable across themes. Make focus distinguishable from selection, and active controls distinguishable from disabled ones. Never rely on color alone for meaning. Minimal color is not a goal by itself.

**Shape and elevation.** Separate regions primarily with spacing, a background shift, or a border; add a second method only where the first fails. Tie radius to element size and nesting, so nested corners are smaller than their container's. Reserve shadows for layers that float above the page, such as menus, popovers, and dialogs.

**Alignment and stability.** Align related icons, labels, values, counters, and actions into consistent columns. Reserve space for selection markers, changing values, images, and loading content so rows and pages do not shift. Give equivalent controls consistent treatment.

**Motion.** Reuse motion conventions where established. Add animation when it helps explain a change, provide feedback, or express character at an appropriate frequency. For a new animation, choose its trigger, properties, origin, distance, duration, and easing. Make transitions explain the action, such as a popover appearing from its trigger. Match timing to distance and interaction frequency; frequent keyboard actions need immediate feedback. Let motion respond smoothly when an action is interrupted or reversed, and keep controls usable during transitions. Use automatic motion sparingly; avoid repeated section entrances, gratuitous hover effects, and continuously repainting animations. Honor reduced-motion settings.

Watch for defaults appearing regardless of subject:

- Cream `#F4F1EA`, display serif, clay `#D97757`; near-black with acid green; hairline newspaper columns.
- Identical rounded cards, uniform shadows, decorative gradients, and the same radius at every hierarchy level.
- All-caps eyebrows, unnecessary labels, monospace metadata, middle-dot strings, automatic link arrows, and one arbitrarily accented headline word.

These treatments are options, not bans. Follow explicit direction and established product conventions. Change choices that have no reason beyond habit. Number content only when it is a sequence; use borders, labels, and dividers only where they explain structure. Remove decoration that serves no purpose.

## Build within the product

- Reuse shared controls. Add a generic size or variant to their owner; keep feature-specific treatments local. Compose slots or smaller components instead of copying markup and styles.
- Let components own appearance and parents own placement. Avoid call-site overrides of control height, padding, radius, colors, or focus rings.
- Follow the project's styling system. Keep static styles with their owning component. Resolve cascade conflicts at the owner, including layer and theme precedence. Shared defaults must respect explicit variants and overrides.
- Cover relevant themes, content lengths, and loading, empty, error, success, disabled, and expanded states. Show success only after the system confirms it, and keep the user's input after a failure. Hiding apparently empty UI must preserve pending work, error messages, completion feedback, and access to actions. A zero counter alone does not prove emptiness.
- Use semantic controls, accessible names, visible labels, readable contrast, and visible keyboard focus. Placeholders are not labels. Keep essential actions discoverable on touch and keyboard. Hover-only presentation needs an equivalent usable path.
- When behavior changes, cover applicable entry points and clients, and provide the reverse action where needed. Do not redesign unrelated UI.

## Write usable interface copy

Name the user's task, not the implementation: "Notifications," not "Webhook configuration." Use plain verbs and sentence case. Match the brand without filler or sales claims.

Say what actions do: "Save changes," not "Submit." Keep vocabulary consistent: "Publish" produces "Published." Errors explain what happened and how to recover; empty states offer a useful next action. Give each text element one job.

## Verify and audit

Inspect the rendered result with available, permitted tools and realistic content. Scale verification to the affected component and states, including representative consumers when shared components change. For a local visual adjustment, check the affected states in context. For new screens or changes to a flow or behavior, walk the relevant user story from entry through completion and recovery, asking the five questions at each step. Check that the affected UI makes its purpose, next action, and result clear. Check the following where relevant:

- Resize through narrow, intermediate, and wide layouts. Check larger text, keyboards, fixed elements, and open panels for lost content, collisions, and sudden layout jumps.
- Preserve identifying text when truncating paths or titles. Check long-to-short updates, resizing in both directions, and expanded/collapsed variants. Confirm apparent screenshot clipping at native resolution.
- Measure contrast on actual composited backgrounds, including tinted rows, overlays, code, diffs, and changed-word highlights. Target WCAG AA: 4.5:1 for body text, 3:1 for large text and for the visual cues that identify controls and their states. Preserve meaningful distinctions between colors when improving contrast.
- Inspect simultaneous focus and selection, hover swaps, loading, failure, and completion. Exercise keyboard and touch paths. Check motion and reduced-motion behavior when affected.

Compare captures with equivalent content, viewport, theme, platform, and build conditions. Use references for concrete design questions, preserving the product's own purpose. Do not score unseen screens or competitors from memory.

For a workflow audit, walk representative tasks before inspecting visual detail: first use, the most frequent task, and one that fails. For a component or visual audit, inspect its task context and states within the requested scope. Spacing fixes do not repair a missing decision or lost input.

For each finding, name the screen and state, evidence, user impact, and smallest useful correction. Rate severity by task impact: blocker when the task cannot be completed or work is lost, major when mistakes or heavy friction are likely, minor when it slows or confuses, polish otherwise. Separate defects from preferences. Prefer "The narrow panel hides the identifying filename" over "improve spacing." Record strengths to preserve. Identify a code cause only after inspecting it.

When fixes are in scope, address the highest-impact supported defects, then inspect fresh renders of the affected states. Use focused tests for changed behavior or reusable calculations, such as stale clipping or layout continuity. Do not add tests that merely freeze copy or styling.

If scoring is requested, use stable criteria and tie deductions to findings. Keep blockers visible regardless of the average. For authorized independent reviews, give each reviewer the same evidence and constraints without target or previous scores. Recheck changed builds. Stop against the user's acceptance criteria and budget, and report gaps instead of chasing score drift.

Claim only the checks actually performed. Screenshots establish visible findings, not keyboard operation, accessible semantics, or complete UX quality. If the UI cannot be rendered, say which states were not visually checked.
