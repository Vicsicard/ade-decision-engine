# ADE V2 Learning Contract

**Version:** 2.0.0-alpha  
**Status:** Canonical  
**Effective:** Upon inclusion in tagged release

---

## Glossary

| Term | Definition |
|------|------------|
| **Audit Commit** | The point at which the final decision and its full execution trace are immutably persisted |
| **Authority** | The ability to force, modify, bypass, or block a decision outcome |
| **Learner** | A post-decision processor that writes derived evidence to memory |
| **Memory Snapshot** | A point-in-time, immutable copy of user memory used for replay |
| **Signal** | An optional input value that may influence scoring but cannot force outcomes |
| **LearnerInput** | A read-only view of audit data. Runtime immutability is enforced at the audit store boundary, not the object reference level. |

---

## Purpose

This document defines the governance boundary for learning in ADE V2. It is as authoritative as the V1 specification documents and must be treated with equal rigor.

**Core Principle:**

> Learners may write evidence. They may never write rules.

---

## 1. Non-Negotiable Principles

| Principle | Requirement |
|-----------|-------------|
| Learning is post-decision | Learners execute AFTER the decision is finalized and audited |
| Learning is non-causal | No learner output can influence the decision that triggered it |
| Learning is evidence-only | Learners write derived features, never scoring weights, guardrails, or selection logic |
| Learning is optional | Missing learned data must never fail a decision |
| Learning is isolated | Learner failures do not affect engine operation |
| Learning is observable | All learner writes are logged and auditable |

---

## 2. Temporal Boundary

```
DECISION PATH (Authoritative)
─────────────────────────────
Request
  → Stage 1-4: Ingest, State, Guardrails, Score/Rank
    → SELECTION LOCKED (immutable)
      → Stage 5-8: Skills, Validate, Fallback
        → Stage 9: Audit Commit
          → DECISION FINALIZED
            ↓
            ↓ (async, fire-and-forget)
            ↓
LEARNING PATH (Non-authoritative)
─────────────────────────────────
Audit + Feedback
  → Learner(s)
    → Memory writes (learned.* only)
      → Available to FUTURE decisions
```

**Critical invariant:** No arrow ever points backward.

---

## 3. Proof of Non-Causality

This proof is designed for auditors, regulators, and skeptical engineers.

```
PREMISE 1: Learners run AFTER audit commit
PREMISE 2: Audit commit contains the final, immutable decision
PREMISE 3: The decision cannot be modified after audit commit
─────────────────────────────────────────────────────────────
CONCLUSION: Learners cannot influence the decision they observe

∴ Learning is non-causal. QED.
```

This is not a design choice. It is a mechanical guarantee enforced by execution order.

---

## 4. Data Boundary

### What Learners CAN Read

| Data | Source | Mutability |
|------|--------|------------|
| `decision_id` | Audit trace | Immutable |
| `scenario_id`, `scenario_version`, `scenario_hash` | Audit trace | Immutable |
| `user_id` | Request | Immutable |
| `audit.request` | Audit trace | Immutable (deep clone) |
| `audit.final_decision` | Audit trace | Immutable (deep clone) |
| `audit.execution` | Audit trace | Immutable |
| `audit.guardrails_applied` | Audit trace | Immutable |
| `audit.timestamp` | Audit trace | Immutable |
| `feedback` | Feedback endpoint | Optional, may arrive later |
| `memory_snapshot` | Snapshot store | Immutable (point-in-time clone) |
| `memory_snapshot_id` | Snapshot store | Immutable |

### What Learners CAN Write

| Namespace | Example Keys | Constraints |
|-----------|--------------|-------------|
| `learned.*` | `learned.engagement.hour_success_rate` | Overwrite-safe, optional |
| `learned.*` | `learned.delivery.best_send_window` | TTL allowed |
| `learned.*` | `learned.content.read_depth_trend` | Must not fail if missing |

### What Learners CANNOT Write

| Namespace | Reason |
|-----------|--------|
| `scoring.*` | Authority boundary violation |
| `guardrails.*` | Authority boundary violation |
| `execution.*` | Authority boundary violation |
| `scenario.*` | Authority boundary violation |
| Any non-`learned.*` namespace | Namespace enforcement |

---

## 5. Authority Boundary

The engine makes decisions. Learners observe outcomes.

### Engine Authority (V1, unchanged)

- Which action is selected
- Guardrail enforcement
- Scoring and ranking
- Selection lock after Stage 4
- Fallback behavior
- Audit trace generation

### Learner Authority (V2)

- Compute derived features from audit + feedback
- Write to `learned.*` namespaces only
- Provide metadata for observability

### Explicit Prohibition

The engine will **NEVER**:

1. Read from `learned.*` namespaces to influence scoring
2. Read from `learned.*` namespaces to influence guardrails
3. Read from `learned.*` namespaces to influence selection
4. Modify a decision based on learner output
5. Block or delay a decision waiting for learner completion
6. Fail a decision because learned data is missing

Scenarios **MAY** optionally read `learned.*` values as **signals**, but:
- They must be declared as optional
- Missing values must have safe defaults
- The scenario author accepts responsibility for this coupling

**Invariant:** No engine code path may synchronously await learner output.

---

## 6. Signals vs Authority (Critical Clarification)

This section anticipates the most common regulator/auditor objection.

### The Objection

> "If scenarios can read learned values as signals, doesn't that mean learning influences decisions?"

### The Answer

**No.** Authority is defined as the ability to:

1. **Force** a decision outcome
2. **Modify** a score deterministically
3. **Bypass** a guardrail
4. **Block** an action unconditionally

Learned signals have **none** of these properties:

| Property | Learned Signals | Authority |
|----------|-----------------|-----------|
| May be missing | ✅ Yes | ❌ No |
| May be stale | ✅ Yes | ❌ No |
| May be ignored | ✅ Yes | ❌ No |
| Must have safe defaults | ✅ Yes | ❌ No |
| Can force an outcome | ❌ No | ✅ Yes |
| Can bypass guardrails | ❌ No | ✅ Yes |

### Formal Definition

```
AUTHORITY: A value that, if changed, MUST change the decision outcome.
SIGNAL:    A value that, if changed, MAY influence scoring but cannot
           force, block, or bypass any decision logic.
```

Learned values are **informational**, not **authoritative**.

### Scenario Author Responsibility

If a scenario author chooses to read `learned.*` values as signals:

1. They must declare them as `optional: true`
2. They must provide a `default` value
3. They accept that the signal may be missing, stale, or zero
4. The decision must remain valid without the signal

This is the same contract as any other optional signal (e.g., `timezone`, `platform_constraints`).

### Why This Matters

A regulator can now verify:

1. Remove all `learned.*` values from memory
2. Re-run the decision
3. The decision still completes successfully
4. The outcome may differ, but the system did not fail

This proves learned data is advisory, not authoritative.

---

## 7. Replay Definition (V2)

### V1 Replay (unchanged)

```
Given: scenario_hash + request
→ Identical decision
```

### V2 Replay (extended)

```
Given: scenario_hash + request + memory_snapshot_id
→ Identical decision
```

The addition of `memory_snapshot_id` ensures that:
- Replay is exact even when memory evolves
- Audit reconstruction is deterministic
- Legal defensibility is preserved

### Memory Snapshot Requirements

| Requirement | Implementation |
|-------------|----------------|
| Point-in-time capture | Deep clone at decision start |
| Immutable storage | Clone-on-read from snapshot store |
| Deterministic hashing | `stableStringify()` for canonical key ordering |
| Unique identification | `snap_` prefix + content-derived hash |
| Integrity verification | Hash comparison on retrieval |

---

## 8. Versioning Rules

### What Triggers a PATCH Version (1.1.x)

- Bug fixes in learner execution
- Performance improvements
- Additional observability

### What Triggers a MINOR Version (1.x.0)

- New learners added
- New `learned.*` namespaces
- Learner interface extensions (backward compatible)
- Memory snapshot format changes (backward compatible)

### What Triggers a MAJOR Version (x.0.0)

- Any change to engine authority
- Any change to scoring logic
- Any change to guardrail evaluation
- Any change to selection lock timing
- Any learner gaining influence over decisions
- Any removal of the non-causality guarantee

**Rule:** If you're unsure whether a change affects authority, it's a major version.

---

## 9. Examples: Allowed vs Forbidden

### ✅ ALLOWED

```typescript
// Learner computes success rate by hour
const learner: Learner = {
  learner_id: 'hour-success-rate',
  version: '1.0.0',
  async process(input) {
    const hour = new Date(input.audit.timestamp).getUTCHours();
    const completed = input.feedback?.completed ?? false;
    
    return {
      memory_updates: [{
        namespace: 'learned.engagement',
        key: 'hour_success_rate',
        value: computeRate(hour, completed),
      }],
    };
  },
};
```

### ✅ ALLOWED (Scenario reads learned data as optional signal)

```json
{
  "signals": {
    "hour_success_rate": {
      "source": "learned.engagement.hour_success_rate",
      "optional": true,
      "default": null
    }
  }
}
```

### ❌ FORBIDDEN (Learner writes to scoring namespace)

```typescript
// THIS IS FORBIDDEN
return {
  memory_updates: [{
    namespace: 'scoring.weights',  // ❌ VIOLATION
    key: 'engagement_boost',
    value: 1.5,
  }],
};
```

### ❌ FORBIDDEN (Engine depends on learned data)

```typescript
// THIS IS FORBIDDEN IN ENGINE CODE
const boost = await memory.get('learned.engagement.hour_success_rate');
score = baseScore * boost;  // ❌ VIOLATION
```

### ❌ FORBIDDEN (Learner runs before decision)

```typescript
// THIS IS FORBIDDEN
async function decide(request) {
  await learnerRegistry.processAll(input);  // ❌ VIOLATION: before decision
  const decision = await pipeline.run(request);
  return decision;
}
```

---

## 10. Compliance Checklist

For any V2 deployment, verify:

- [ ] Learners execute only after `audit.commit()`
- [ ] All learner writes target `learned.*` namespaces
- [ ] `validateLearnerResult()` is called before accepting writes
- [ ] Memory snapshots are created before Stage 1
- [ ] `memory_snapshot_id` is included in audit trace
- [ ] Learner failures do not propagate to decision path
- [ ] Missing learned data does not fail decisions
- [ ] Replay with `memory_snapshot_id` produces identical results

---

## 11. Governance

This document is versioned alongside the codebase.

Changes to this contract require:
1. Written justification
2. Review against authority boundaries
3. Version bump according to Section 8
4. Update to all dependent documentation

**The contract is the code. The code is the contract.**

---

## Summary

ADE V2 Learning is:

| Property | Value |
|----------|-------|
| Causal | No |
| Authoritative | No |
| Optional | Yes |
| Observable | Yes |
| Replay-safe | Yes |
| Failure-isolated | Yes |

> "The decision system never changes. Only the evidence it observes can grow."

This contract ensures that statement remains true.
