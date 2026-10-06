---
name: clear-technical-writing
description: Use when writing or revising technical documentation, procedures, runbooks, architecture or decision records, API or CLI docs, reports, release notes, project continuity files, or technical explanations. Makes technical prose easy to understand with an ASD-STE100-inspired style; do not use for code, exact quotations, casual prose, or claims of formal STE compliance.
---

# Clear technical writing

Write for a reader who must understand the information or do the task correctly
on the first reading. This skill uses most of the practical discipline of
ASD-STE100, but it does not claim formal compliance.

## Write clearly

- Preserve the technical meaning, evidence strength, risk, and requirement
  level. Do not turn `may`, `should`, or `must` into a different obligation.
- Keep commands, code, paths, identifiers, API names, UI labels, error text,
  and quotations exact.
- Prefer common, concrete words. Use each word with one clear meaning in its
  context. Remove filler and abstract noun phrases.
- Use the approved project or domain term for an item. Repeat that term instead
  of cycling through synonyms. Define an abbreviation at first use when the
  reader might not know it.
- Prefer active voice and name the actor. Use passive voice when the actor is
  unknown, unimportant, or less useful than the affected item.
- Prefer simple verb forms. Use a complex tense only when the time relationship
  matters.
- Target no more than 20 words for an instruction and 25 words for a
  descriptive sentence. Split a sentence when it contains separate ideas.
- Put one instruction in each sentence unless actions must occur at the same
  time. Use the imperative form for direct instructions.
- Put a condition before the action: "If the cache is stale, regenerate it."
- Give information gradually. Keep one topic in each paragraph and target no
  more than six sentences. Use a vertical list when prose hides a sequence or
  set of items.
- Do not use contractions or semicolons in technical documentation. Do not hide
  instructions, limits, or safety requirements in notes.
- Start safety text with the action or condition. Then state the specific
  consequence.

Clarity takes priority over conversational variety. When `unslop` also applies,
keep its concrete language and human judgment, but do not add personality,
synonyms, or rhythmic variation that makes technical meaning less stable.

## Rewrite in this order

1. Decide whether the text is procedural, descriptive, reference material, or
   a mixture.
2. Mark the facts, conditions, actors, requirements, and exact technical terms
   that must not change.
3. Rewrite the structure first. Then simplify the words without changing the
   marked content.
4. Read the result as a new reader. Remove ambiguous pronouns, missing actors,
   hidden conditions, inconsistent terms, and sentences that require a second
   reading.

Examples:

```text
Before: The loader performs validation of the manifest before initialization.
After:  The loader validates the manifest before initialization.

Before: If the cache is stale, the operator must perform regeneration of it.
After:  If the cache is stale, regenerate it.
```

## Know the adaptation boundary

Do not enforce the complete ASD-STE100 dictionary. Keep necessary software and
project terms, including established technical verbs. Do not replace an exact
term with a simpler word when that replacement changes the meaning. Treat the
sentence and paragraph limits as strong targets, not mechanical gates for code,
identifiers, or unavoidable technical names.

Read [the adaptation profile](references/ste-adaptation.md) only when you must
explain the 80-percent boundary, resolve a wording edge case, or audit a document
against this skill. Do not load the bundled standard during routine writing. For
formal ASD-STE100 work, inspect only the relevant parts of the bundled standard
and use qualified human review.
