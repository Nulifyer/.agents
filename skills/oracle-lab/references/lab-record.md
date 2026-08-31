# Oracle lab record

Use this outline when the project has no established experiment record.

```markdown
# <experiment name>

## Question
<observable behavior and stop condition>

## Authority and limits
- Reference identity:
- Workload and environment:
- What this experiment can establish:
- What it cannot establish:

## Isolation
- Selected environment and why it is faithful:
- Known differences from production:
- Immutable source and hash:
- Disposable state:
- Network and credential boundary:
- Before/after source check:

## Collection profile
- Providers or observations:
- Filters and buffers:
- Tool versions:
- Loss/rejection rule:

## Action boundaries
| Boundary | Actor/session | Wall clock | Monotonic clock | Expected observation |
| --- | --- | --- | --- | --- |

## Runs
| Run ID | Reference/config hash | Events | Lost | Accepted | Raw evidence |
| --- | --- | ---: | ---: | --- | --- |

## Normalization
- Schema and version:
- Normalizer command/version:
- Declared nondeterminism:
- Raw-to-derived hashes:

## Findings
| Finding | Evidence | Stable across | Completeness |
| --- | --- | --- | --- |

## Rejected attempts
| Attempt | Failure | Pipeline change |
| --- | --- | --- |

## Implementation fixture
- Unchanged input:
- Required assertions:
- Unsupported partitions:

## Retention and privacy
- Publishable artifacts:
- Private artifacts:
- Expiration or cleanup:
```
