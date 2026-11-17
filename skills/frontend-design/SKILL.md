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

Start with the affected component or flow and its governing tokens and design guidance; widen to shared components and representative screens when decisions are unclear or the change affects broader conventions. Distinguish established conventions from isolated inconsistencies.

- **Project foundations** (type roles, spacing scale, color roles and themes, radii, elevation, icon family, control sizes, motion): reuse them. Revisit only for a requested redesign or a supported defect within the task.
- **Screen or flow** (hierarchy, grouping, density, layout, navigation, primary actions, feedback): derive from the current task within those foundations.
- **Verification:** check the affected content, states, themes, widths, and interactions after each coherent change, including reused foundations in their new context.

When foundations are incomplete, establish only what the task needs, try it with representative content and states, and record it at its shared owner, creating the smallest one needed. Keep local layout decisions local. Report inherited defects outside scope with measurements; leave them unchanged, including page-local overrides. Shared changes require task scope, including needed generic variants. For an audit, produce findings without editing the UI unless fixes are requested.

## Establish direction

Scale planning to the change. For a small adjustment, name the task it serves and the states it touches, then build. For a new screen, flow, or redesign, work through this section first.

Start from the user story, even when the brief is informal. Identify the user, what brings them here, their desired outcome, why it matters, and the success condition. Give each screen a clear purpose within that story. Note how often they do it, their expertise and device, and the cost of a mistake. Label assumptions; do not invent user research, or requirements and limits that could stop a person finishing.

Map the workflow before choosing the layout: what the user needs to know, the decisions and actions in order, and the result. Include feedback and recovery where the task can fail. Derive content, controls, navigation, and visual priority from that flow. Choose screen boundaries around coherent user decisions, and put information beside the decision it supports. Name the states each step needs, such as empty, loading, saving, saved, and failed.

Get the model right before building. State the rules and states the screen depends on, including combinations that can never happen, and the condition that finishes the task and each item in it. An item leaves the remaining work only when that condition is met, not at a step toward it such as a comment added. Completed items update the remaining-work counts and stay findable, with reversal where supported. Reopening and merging preserve decisions, history and unfinished work, including into finished records. Undo checks the version it reverses. Label actions that discard work. Check failed saves, reloads, reopening, undo after later changes, the last available item, and expired deadlines. Fix the model before tests or UI.

Design to reduce the person's work:

- Do the work the product can do. When it can work out a likely answer, apply it to the control, show briefly why, and name the outcome on the action: "File under Travel," not "File." Accepting it is one action; a suggestion beside an empty control does not count. When a known fact such as today's date or the person's role decides what is relevant, open already filtered, ordered, or grouped by it; a filter the person must switch on does not count. Reveal matches outside automatic defaults without removing explicit filters. If the default is empty, offer the next useful set. On each item, state the conclusion ("Renews in 3 days"), not dates or ranges to work out. Reserve their attention for real judgments.
- Omit inapplicable options. If people expect an unavailable option or it is their current value, show it and say why it is unavailable.
- Draw attention only to what needs action. Information that changes nothing stays available on demand.
- Show what the current task needs, and keep the rest a step away.
- Prefer good defaults over settings. Add a setting only when people genuinely differ in what they need.
- Use the person's language, not the system's. Do not expose internal codes or transformed values; show an identifier only where people use it to find or discuss a record. When people compare things, put them side by side in the form they recognize, and state the deciding differences before they choose.

Build the screen that was asked for, under a plain title that names the task. Unless asked for or already in the product, leave out a brand bar, slogan, sidebar, breadcrumb, avatars, footer, and badges. At the smallest device the brief targets, show a real task choice and its usable action. Move optional framing below the task or into details until they fit; keep decision-critical conditions beside the action. Lead with an image only when it is itself the task.

For new visual identities, derive choices from the subject's materials, imagery, and vocabulary. Spend boldness in one memorable place; keep its surroundings disciplined.

Before settling a new screen's layout, name the arrangement this kind of screen usually gets, such as a list beside a detail pane or tiles above a chart, and keep it when it serves this task's decisions. Otherwise organize the screen around what the person is trying to do. One departure from the subject's content is enough. Repeat graphics only when they aid comparison. Read [visual departures](references/visual-departures.md) when creating a new identity or page.

For dashboards, analysis tools, and data visuals, decide what question the person must answer and what action may follow before choosing charts or tables. Read [data tools](references/data-tools.md) before building or auditing one.

Before coding, identify which conventions apply and which task decisions remain open. When new foundations are needed, settle a compact direction for the relevant palette, type roles, spacing, and component treatments. For substantial work, define observable acceptance criteria around representative tasks and screens.

## Make deliberate visual choices

Use the following guidance to apply established conventions, fill gaps, or assess supported defects. Add reusable values at their shared owner. The numbers below are starting points when no system exists; adjust related choices together using rendered content.

**Hierarchy.** Before reading any label, visual weight should identify the current context, the main work, and the next action. Give each task region one distinct primary action; keep secondary actions quieter and destructive actions separated. Let titles and primary actions lead, with metadata at a quieter but readable level.

**Choices and fields.** One choice gets one control, not a row of buttons. Let people type values they supply or know. Offer autocomplete when suggestions save typing or help find a valid match. For up to about five alternatives people must weigh, show one radio group with each consequence visible. Use segments for frequent mode switches and checkboxes for independent choices. Use a native select to save space for roughly five to fifteen short, familiar labels, especially on touch. Offer a searchable picker when finding a record takes repeated scrolling at realistic peak volume on the target device. Use a command palette or quick-open for frequent navigation or commands. Equivalent tasks use the same control, and searches over the same records match the same way. Treat the counts as heuristics and try the longest labels on the smallest target screen: three saved addresses may need a recipient and street beside each radio, and a fixed directory of thousands needs search even if it never grows.

Show units, bounds, and consequences beside fields where they affect entry. For inherited or default settings, show the value in effect and its source. Accept familiar pasted formats and normalize only unambiguous ones. By default, show validation errors when the person tries to continue or submit; keep their input and explain the correction beside the field.

**Pickers and search.** Mark the current selection and let people browse before typing. Put the few facts that distinguish similar records beside each name and include them in what a screen reader announces. Group or order results by how people look them up. Search across the whole eligible set, including names and the facts people recognize. For names made of several words, let each word match in any order when that fits how people search. Show a match count when it helps narrow the list. Announce when nothing matches and offer a way to broaden the search. On phones, leave room for results and selection with the keyboard open, using the full screen if needed. When a long list allows multiple selections, filter a group of checkboxes or use a searchable multiselect listbox. Keep interactive controls outside listbox options. Preserve selections across filters and let people review and remove each one. In a command palette, show enough context to distinguish same-named destinations or actions; activating a result opens the destination or runs the command.

**Autocomplete.** Make clear whether people can enter a new value or must choose an existing record. Keep a new value when suggestions run out if the field accepts it. For a known identifier, resolve typed, pasted, or scanned input to the matching record. If a match is required, explain an unmatched entry when the person tries to use it. Preserve standard text-editing keys.

**Compact controls.** Join an action and its variants into one split button. Give each concept one name everywhere. Use a dismissible toast for a transient result with no other visible home, such as saved or copied. Show one at a time, clear of the control the person will use next at every width. Receipts, unfinished work, and undo also live on the item or page. Keep inline messages for conditions that persist until resolved. Prefer one page scroll; avoid independently scrolling regions side by side, and make a region sticky only when its content fits. For a list worked through item by item, expand the item in place or pair it with a viewport-fitting detail pane; reveal selected detail. Do not page a work queue to avoid scrolling. Reversible commits use one action with durable undo and advance to the next item. Identifier searches reveal filtered-out matches without clearing explicit filters. A long collection opens on the subset the person most likely wants, with the rest counted and one step away.

**Typography.** Choose a typeface for the product's character and readability, checked with real labels, numbers, and paragraphs at actual sizes for character distinction, language coverage, and wrapping. Settle text roles (family, size, weight, line height) before fine-tuning component dimensions.

Use one family or two with distinct roles, an intentional type scale, and controlled weights and spacing. In product UI, about four to six sizes and two or three weights are enough. Separate levels with one or two of size, weight, and color, not all three at once. Set sizes from who reads and where: 13–14px for dense tools used daily at a desk; 16px or more for reading text, for public or occasional users, and for item text at phone width when users are on phones; nothing a person must read below 12px at any width, including badges, table metadata, and chart labels after scaling. Use line height around 1.4–1.6 for body text and tighter for headings. Keep body lines under roughly 80 characters. Use tabular numerals for numbers that are compared or update in place, and right-align numeric columns. Set text in units that follow user zoom. Verify that the intended fonts and weights actually render on supported platforms, with a fallback of similar metrics so text does not jump on load. Make expressive headline type earn its place.

**Spacing and whitespace.** Pick spacing from a scale, commonly multiples of 4px. Spacing expresses structure: items in a group sit closer than groups do, and sections are separated further still. Uniform spacing flattens hierarchy as much as uniform type does. Use whitespace to clarify grouping, emphasis, and scanning; add or remove it where those relationships need to change.

Give equivalent controls the same height and padding, and match the heights of inputs and buttons that share a row. Derive padding from the intended control size and text or icon dimensions, accounting for borders. Allow calculated or optical exceptions to the spacing scale and keep them at the component owner. Usually give text controls more horizontal than vertical padding. Align to a few shared edges; each extra alignment line adds noise. Align text on baselines and center icons optically, not only by bounding box.

**Density.** Choose density from the task. Frequent, expert, or comparison-heavy work such as tables, logs, inboxes, and editors benefits from compact rows and more on screen. Occasional or high-stakes flows benefit from room and fewer choices per view. Do not give a tool marketing-page spacing or an onboarding flow tool density. In dense tools, keep useful task context and status visible together. Compact by removing repeated labels, card wrappers, unnecessary borders, blank rows, and oversized headers before shrinking type or removing useful information. Keep hit areas at least 24×24 CSS px even when the visible control is smaller, and larger for touch: 44pt on iOS, 48dp on Android.

Choose content widths and responsive changes using realistic content. Decide what wraps, stacks, scrolls, or remains visible as space decreases, keeping information beside the decision it supports.

**Iconography.** Use one icon set with a consistent stroke, fill, and corner style, at a few sizes matched to adjacent text. One icon means one thing across the product, and within a view, different operations such as adding and expanding get distinct symbols. Pair icons with text unless the symbol is unmistakable in context, such as close or search; icon-only buttons need an accessible name and a tooltip. Do not decorate every heading or row with an icon. Avoid emoji as interface icons because they render differently across platforms. Icons take their color from the text or state they belong to.

**Color and themes.** Define color roles for backgrounds, surfaces, text, borders, actions, selection, focus, and status, then map them to palette values in each theme. Check the actual foreground and background pairs, including overlays and tinted regions. Preserve hierarchy and state distinctions across themes; each theme may need different surface, border, and elevation treatments.

Give color a clear role in identity, action, or state. Quiet competing decoration while preserving useful recognition cues. Keep semantic meanings stable across themes. Make focus distinguishable from selection, and active controls distinguishable from disabled ones. Never rely on color alone for meaning. Minimal color is not a goal by itself.

**Shape and elevation.** Separate regions primarily with spacing, a background shift, or a border; add a second method only where the first fails. Tie radius to element size and nesting, so nested corners are smaller than their container's. Reserve shadows for layers that float above the page, such as menus, popovers, and dialogs.

**Alignment and stability.** Align related icons, labels, values, counters, and actions into consistent columns. Reserve space for selection markers, changing values, images, and loading content so rows and pages do not shift.

**Motion.** Reuse established motion conventions. Animate to explain a change, give feedback, or express character, starting from the element that caused it, with timing matched to distance and frequency; frequent keyboard actions respond immediately. Keep controls usable through interruption or reversal, avoid repeated entrances and continuous decorative animation, and honor reduced-motion settings.

Test for habitual defaults: would this headline, section, label, or ornament fit unchanged on a page about a different subject? If so, check whether the task or product convention justifies it. Replace or remove choices made only from habit. Common cases are a slogan headline, a lead-in line above a heading, one arbitrarily accented headline word, a stock palette and typeface pairing, decorative gradients, monospace metadata, middle-dot strings, summary tiles above every chart, a badge on most items, numbering on things that are not a sequence, and an arrow on every link.

Follow explicit direction and established product conventions. Use borders, labels, and dividers only where they explain structure.

## Build within the product

- Reuse shared controls. Add a generic size or variant to their owner; keep feature-specific treatments local. Compose slots or smaller components instead of copying markup and styles.
- Let components own appearance and parents own placement. Avoid call-site overrides of control height, padding, radius, colors, or focus rings.
- Follow the project's styling system. Keep static styles with their owning component. Resolve cascade conflicts at the owner, including layer and theme precedence. Shared defaults must respect explicit variants and overrides.
- Cover relevant themes, content lengths, and loading, empty, error, success, disabled, and expanded states. Show success only after the write succeeds, including local storage. On failure retain all choices and output, keep work unresolved, and offer retry without silently changing the submission. When a result arrives after the person has moved on, report it where they are, name the item with a way back to it, and mark the item itself. Hiding apparently empty UI must preserve pending work, error messages, completion feedback, and access to actions. A zero counter alone does not prove emptiness.
- Use semantic controls, accessible names, visible labels, readable contrast, and visible keyboard focus. Placeholders are not labels. Keep essential actions discoverable on touch and keyboard. Hover-only presentation needs an equivalent usable path.
- Validate imported or pasted data before it replaces what the person already has. On failure, keep the existing data and say what is wrong. Do not hard-code values the workflow depends on, such as today's date. Derive availability, deadlines and counts from current state; exclude expired options.
- A prototype completes requested flows with reopenable local records and real product labels. Simulate unavailable external effects. Disclose missing effects once beside commitment and once on the result. Say "Refund recorded," not "issued." Keep failure triggers and test lookup hints in documented developer tooling, outside the user flow.
- Write sample data as distinct records; do not fill a list by repeating or cycling a short set, except for duplicates the task calls for. Cover each case the brief names, make time-dependent fixtures reproducible with a documented clock, and make counts, flags, and rules agree with the records.
- When behavior changes, cover applicable entry points and clients, and provide the reverse action where needed. Do not redesign unrelated UI.

## Write usable interface copy

Name the user's task, not the implementation: "Notifications," not "Webhook configuration." Use plain verbs and sentence case. Match the brand without filler, slogans, or sales claims.

Say what actions do: "Save changes," not "Submit." Keep vocabulary consistent: "Publish" produces "Published." Errors explain what happened and how to recover; empty states say why they are empty and offer a useful next action; no matches is not finished work. Give each text element one job.

Keep the screen clean and compact, and show what needs to be shown. Labels, values, status, and actions carry most of the meaning. Cut explanatory sentences, restated headings, repeated definitions, and helper text people read once. Put optional explanations behind an (i) control beside the item they explain. Give that control an accessible name and make it open by click, tap, and keyboard, not hover alone. Never put errors, warnings, required instructions, or the consequences of an action behind (i).

Generated text that people copy or share leads with the point and names the specifics. It states each conclusion once, at the strength the evidence supports, and labels estimates and assumptions.

## Verify and audit

Verify in proportion to risk. Correctness comes from getting the model right; tests confirm the parts most likely to be wrong. For most changes, a few focused tests on the logic that decides outcomes and a rendered look at the affected states and widths are enough. Do not build large fixture sets, exhaustive interaction suites, or many screenshots unless a specific, named risk needs them. A test count is not evidence of quality.

Inspect the rendered result with available, permitted tools and realistic content. Scale verification to the affected component and states, including representative consumers when shared components change. For a local visual adjustment, check the affected states in context. For new screens or changes to a flow or behavior, walk the relevant user story from entry through completion and recovery, asking the five questions at each step. Check that the affected UI makes its purpose, next action, and result clear. Check the following where relevant:

- Resize through narrow, intermediate, and wide layouts. Check larger text, keyboards, fixed elements, and open panels for lost content, collisions, and sudden layout jumps.
- Preserve identifying text when truncating paths or titles. Check long-to-short updates, resizing in both directions, and expanded/collapsed variants. Confirm apparent screenshot clipping at native resolution.
- Measure contrast on actual composited backgrounds, including tinted rows, overlays, code, diffs, and changed-word highlights. Target WCAG AA: 4.5:1 for body text, 3:1 for large text and for the visual cues that identify controls and their states. Preserve meaningful distinctions between colors when improving contrast.
- Inspect simultaneous focus and selection, hover swaps, loading, failure, and completion. Exercise keyboard and touch paths: after a region redraws, focus stays put or moves deliberately to the next useful control, and no focusable control sits inside hidden content. Check motion and reduced-motion behavior when affected.

Before delivering a new or changed screen, review your own work as the person who will use it, then revise:

1. Open the rendered first screen at the narrowest target width. Measure the first choice and its action, and font sizes and hit areas after responsive and SVG scaling; fix failures within scope, report inherited defects, and inspect the diff for shared changes and page-local overrides. Each row keeps what identifies it, why it is listed, and its action together; move secondary columns into details before shrinking text. Then cut any sentence that does not change what the person does, or move it behind (i).
2. Look for work you are handing the person: questions the product could answer itself, options that cannot apply, notices about things that change nothing, and internal values shown as if they were meaningful. Try distinguishing similarly named records before selecting one.
3. Compare the result with the habitual defaults listed earlier and with the usual arrangement for this kind of screen. If it matches by habit rather than reason, try one alternative and keep the better.
4. Read the first screen and any copied output as the stated user, and write down the answer to each question they brought. Each needs an answer in their words, figures that reconcile, and any recommended action justified by the evidence. Where numbers drive a conclusion, check the number, population, period, denominator, and interpretation against an independent calculation; for group comparisons, retain the data-tools split table.
5. Fix the highest-impact problems, re-render the affected states, and stop.



For an audit or scored review, read [audit procedure](references/audit.md) first.

Claim only the checks actually performed. Screenshots establish visible findings, not keyboard operation, accessible semantics, or complete UX quality. If the UI cannot be rendered, say which states were not visually checked.
