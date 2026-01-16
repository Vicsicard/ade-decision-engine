# Action Effectiveness Learner: Safety Documentation

**Learner ID:** `action-effectiveness`  
**Version:** `1.0.0`  
**Status:** Canonical Reference Learner

---

## One-Line Description

Computes historical success ratios for actions based on post-decision feedback.

---

## Why This Learner Is Safe

### What It Does

- Counts how many times each action was selected
- Counts how many times feedback indicated success
- Computes a simple ratio: `success_count / attempt_count`
- Records timestamps of last attempt and last success

### What It Does NOT Do

| Forbidden Behavior | Status |
|--------------------|--------|
| Compute weights | ❌ Never |
| Rank actions | ❌ Never |
| Suggest decisions | ❌ Never |
| Block outcomes | ❌ Never |
| Read scenario config | ❌ Never |
| Modify memory outside `learned.*` | ❌ Never |

---

## Governance Compliance

| Requirement | Status |
|-------------|--------|
| Post-decision only | ✅ Uses finalized audit |
| Non-causal | ✅ Decision unchanged if learner vanishes |
| Evidence-only | ✅ Descriptive statistics, not prescriptions |
| Overwrite-safe | ✅ Idempotent per event; replayable with ordered history |
| Optional | ✅ Missing data does not fail decisions |
| Namespace-compliant | ✅ Writes only to `learned.effectiveness.*` |

---

## Feedback Trust Level

Feedback is treated as an **untrusted, optional signal**.

This learner does not:
- Validate feedback structure
- Normalize feedback values
- Interpret feedback beyond `completed === true`

This prevents future pressure to "clean" or "interpret" feedback inside the learner.

---

## Downstream Coupling (Forbidden)

**No engine component may read `learned.effectiveness.*` during decision selection.**

This is not enforced in code — it is enforced by governance declaration per the V2 Learning Contract.

Scenarios MAY optionally read these values as signals, but:
- They must be declared as `optional: true`
- They must provide a `default` value
- The scenario author accepts responsibility for this coupling

---

## Data Flow

```
INPUT (Read-Only)
─────────────────
audit.final_decision.selected_action  → Which action was chosen
audit.timestamp                        → When the decision occurred
feedback.completed                     → Whether outcome was successful (optional)
memory_snapshot.learned.*              → Prior effectiveness data (optional)

OUTPUT (Evidence Only)
──────────────────────
learned.effectiveness.{action}_effectiveness
  ├── attempt_count      (integer)
  ├── success_count      (integer)
  ├── success_rate       (float 0-1)
  ├── last_success_ts    (ISO timestamp or null)
  └── last_attempt_ts    (ISO timestamp)

learned.effectiveness._last_update
  ├── learner_id
  ├── version
  ├── timestamp
  └── decision_id
```

---

## Algorithm (Deliberately Boring)

```
1. Read selected action from audit
2. Read feedback (if present)
3. Increment attempt_count
4. If feedback.completed === true:
     Increment success_count
     Update last_success_ts
5. Compute success_rate = success_count / attempt_count
6. Update last_attempt_ts
7. Write to learned.effectiveness.*
```

No prediction. No intelligence. Just accounting.

---

## Why "Boring" Is Correct

This learner is intentionally simple because:

1. **Simplicity proves safety** — Anyone can audit the algorithm
2. **No optimization pressure** — It doesn't try to improve decisions
3. **No hidden state** — Everything is visible in memory
4. **No temporal coupling** — It runs after decisions are finalized

---

## Auditor Verification

An auditor can verify safety by:

1. **Remove all `learned.effectiveness.*` values from memory**
2. **Re-run any decision**
3. **Observe: Decision still completes successfully**
4. **Observe: Outcome may differ, but system did not fail**

This proves the learner is advisory, not authoritative.

---

## Relationship to V2 Learning Contract

This learner is a canonical implementation of the V2 Learning Contract:

> "Learners may write evidence. They may never write rules."

It demonstrates that learning can be:
- Useful (provides historical success data)
- Safe (cannot influence decisions)
- Observable (all writes are auditable)
- Optional (missing data is handled gracefully)

---

## See Also

- [ADE V2 Learning Contract](../ADE-V2-Learning-Contract.md)
- [Hour Success Rate Learner](../../engine/src/learning/learners/hour-success-rate.ts)
