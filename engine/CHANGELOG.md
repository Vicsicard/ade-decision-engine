# Changelog

All notable changes to ADE (Authority Decision Engine) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-01-16

### Governance Event

**This is not a feature release. It is a governance milestone.**

Version 1.1.0 freezes the authority/learning boundary in a released artifact, making governance documents binding to external adopters.

### Added

#### V2 Learning System (Optional, Disabled by Default)

- **Learner Interface** — Async, post-decision, evidence-only processing
- **Learner Registry** — Isolated execution with failure tolerance
- **Memory Snapshots** — Point-in-time, replay-safe memory capture
- **Namespace Enforcement** — `learned.*` only; authority namespaces forbidden
- **Input Validation** — Hard guard requiring finalized audit before learner execution

#### Canonical Learners

- **HourSuccessRateLearner** — Temporal evidence (when actions succeed)
- **ActionEffectivenessLearner** — Outcome evidence (what actions succeed)

#### Governance Tests

- **Temporal Boundary** — Learners cannot run before audit commit
- **Learner Isolation** — Failures do not cascade
- **Non-Causality** — Learner output cannot affect triggering decision
- **Forbidden Namespace** — Authority escalation blocked
- **Pathological Learner Proof** — Adversary model proving boundary holds

#### Governance Documents

- **ADE-V2-Learning-Contract.md** — Technical boundary definition
- **ADE-V2-Learning-Permanence.md** — Institutional boundary declaration
- **ADE-Complete-Overview.md** — What, who, how documentation

### Unchanged

- **V1 Authority Kernel** — 9-stage pipeline, selection lock, deterministic replay
- **Decision Semantics** — Identical behavior with learning disabled
- **Audit Trace** — Complete, immutable decision record

### Governance Guarantees

This release permanently establishes:

1. **Learning is optional** — Engine functions correctly with zero learners
2. **Learning is non-causal** — Cannot influence decisions
3. **Learning is post-decision** — Runs only after audit commit
4. **Learning is bounded** — Writes only to `learned.*` namespaces

These guarantees are not roadmap promises. They are permanent constraints.

### Breaking Changes

None. This release is fully backward compatible with 1.0.0.

### Migration

No migration required. Learning is disabled by default.

To enable learning (optional):
```typescript
import { LearnerRegistry, HourSuccessRateLearner } from 'ade-decision-engine';

const registry = new LearnerRegistry();
registry.register(HourSuccessRateLearner);

// After decision + audit commit:
await registry.processAll(learnerInput);
```

---

## [1.0.0] - 2026-01-16

### Initial Release

- **9-Stage Decision Pipeline** — Ingest, State, Guardrails, Score/Rank, Skills, Validate, Fallback, Commit, Audit
- **Selection Lock** — Immutable after Stage 4
- **Deterministic Replay** — Bit-identical decision reproduction
- **Audit Trace** — Complete, immutable decision record
- **Scenario Schema** — Pluggable decision contexts
- **Guardrails** — Hard constraints that cannot be bypassed
- **Skill Execution** — Deterministic or LLM-enhanced rationale

---

## Versioning Policy

| Change Type | Version Impact |
|-------------|----------------|
| Bug fixes in learner execution | Patch (1.1.x) |
| New learners added | Minor (1.x.0) |
| Any change to engine authority | **Major (x.0.0)** |
| Any learner gaining decision influence | **Major (x.0.0)** |

**Rule:** If you're unsure whether a change affects authority, it's a major version.
