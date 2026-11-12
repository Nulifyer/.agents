# Data tools

Read this before building or auditing a dashboard, analysis tool, or data visual. It covers the judgment that separates a tool that answers a question from one that only reports numbers.

## Start from the question

- Write down the question the person must answer and the decisions that may follow. Choose content, charts, and controls from that.
- The person's questions are the page structure. Each gets a verdict in its first sentence, with the comparison and number that support it. Put the main decision first. Give each answer once. Keep the questions on one page unless one is a separate job with its own working state, such as a list worked through over days.
- The verdict follows the best comparison the data allows, not what an experiment could prove. When that comparison shows no difference, say "no sign of it so far," what would change that, and when to look again; this is a finding, not proof of no effect. An inconclusive or unavailable comparison gets "not yet," with the missing evidence named. Every verdict comes with what to do meanwhile, and states its uncertainty once, after the verdict. Recommend the narrowest action the comparison supports, with a verb no stronger than the evidence: "assess for replacement" when the data shows only cost. Do not recommend action on a cause the comparison did not find, and do not let a caveat stand in for a split you have not run. A point estimate is neither a cause nor a bound: word money or dates drawn from it as a scenario with its assumption, not as "caused," "at most," or a forecast date.
- Apply stated rules exactly. Trace eligibility and priority to the findings and stated constraints. Read what a ranking or threshold returns before showing it: if the list is long, or one kind of item fills it, compare each item with others of its kind and name the few to act on, with the figure that justifies each. A count of items over a threshold is not an answer. Separate the eligible pool from how many can be picked now. Show a material assumption beside the result it changes and apply it consistently; a quantity the product cannot know, such as capacity, is a labeled, editable input. Keep optional method detail behind (i).

## Explain change against an expectation

- Before attributing a change, estimate what was expected from known drivers such as volume, mix, season, or timing. The difference from that expectation is what needs explaining. Choose and name a baseline suited to the question, accounting for changes already inside it. To attribute a change to an event, compare with a stable period before the first known event. A period control must update the conclusion with it.
- Separate counts from rates, and name the denominator. The largest contributor to a count may simply have grown.
- When an outcome arrives after the event that caused it, analyze by the event's date and mark periods that are not yet complete.
- Look across all the segments the data allows, not just the first or largest. Before writing a verdict, inventory raw fields and relevant timestamp-derived dimensions. For each usable comparison field, compute within-group gaps with counts and denominators. Exclude identifiers and outcome-derived fields with reasons, and group continuous values into meaningful ranges. Record where gaps grow, vanish, or remain similar in a compact table. Distinguish a localized association from a cause or proven remedy. If no meaningful split emerges, report that without inventing one. Cross fields only when a plausible explanation remains unresolved. Account for multiple comparisons, mark small groups as exploratory, and stop when further comparisons would not change the supported decision. Name unavailable comparisons and remaining uncertainty. When one segment explains most of the change, check whether the others still stand out without it, and report findings that describe the same records as one. A note that segments overlap does not replace this.
- Show the comparison that rules out the obvious alternative explanation. Before calling a group abnormal, compare it with its own history at comparable maturity and composition when available.

Example: crash reports rose 50% in a week while installs rose 30%, so most of the rise was expected. The crash rate is flat everywhere except one device on one OS version, where it tripled after a release. Other devices on that version are normal. The answer names that device and version, gives the rate before and after, and notes that the newest days are incomplete.

## Charts and tables

- Choose the chart for the comparison the question needs: change over time, actual against expected, part of a whole, or segment against segment.
- Label axes, units, and periods. Mark incomplete periods visually.
- Show the expectation or baseline on the same chart as the actual values.
- Right-align numbers and use tabular figures.
- Check labels for collisions at every target width.

## Shared output

A copyable summary states the answer first, then the specific segment, numbers, period, and comparison, and what remains uncertain. Use everyday units, such as "2 in 100 a week," not "pp." Say whether each figure is observed, estimated, or assumed. Aim for about 120 words unless the requested format differs: answer, supporting comparison, named priorities and figures, and the ask. Keep assumptions labeled in copied text.
