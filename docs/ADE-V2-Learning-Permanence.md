# ADE V2 — Learning Permanence Declaration

**Document ID:** ADE-GOV-LP-001  
**Status:** Canonical, Binding  
**Applies To:** All ADE engines ≥ v1.1.0  
**Scope:** Institutional Governance  
**Last Updated:** 2026-01-16

---

## 1. Purpose

This document permanently defines the role, limits, and immutability of learning within the ADE (Authority Decision Engine) system.

Its purpose is to ensure that:

- Learning never becomes authoritative
- Learning never becomes required
- Learning never becomes causal
- Learning never becomes a substitute for explicit rules
- Learning never erodes determinism

This document exists to prevent both technical drift and institutional drift over time.

---

## 2. Foundational Principle (Irreversible)

> **Learning in ADE is permanently advisory, permanently optional, and permanently non-authoritative.**

This is not an implementation detail.  
It is an institutional invariant.

No future version, feature, optimization, or success metric may override this principle.

---

## 3. Definitions (Authoritative)

| Term | Definition |
|------|------------|
| **Authority** | The power to influence, alter, or determine a decision outcome |
| **Learning** | Any post-decision process that observes outcomes, aggregates evidence, or writes descriptive data |
| **Non-Causal** | Learning does not influence the decision it observes, nor any decision synchronously derived from it |
| **Optional** | The engine must function correctly, deterministically, and completely with learning disabled or absent |
| **Evidence** | Descriptive data written post-decision that may be observed but never required |

---

## 4. Permanence Guarantees

The following guarantees are permanent and non-negotiable.

### 4.1 Learning Shall Never Be Required

The ADE engine must execute correctly with:

- Zero learners registered
- Empty learning memory
- Learning explicitly disabled

Any design that assumes the presence of learning data is invalid.

### 4.2 Learning Shall Never Influence Authority

Learning outputs:

- ❌ Shall not affect scoring
- ❌ Shall not affect guardrails
- ❌ Shall not affect selection
- ❌ Shall not break ties
- ❌ Shall not modify rules
- ❌ Shall not resolve ambiguity

Authority flows only from:

- Scenario definitions
- Explicit rules
- Deterministic evaluation

### 4.3 Learning Shall Remain Post-Decision

All learners:

- Execute only after audit commit
- Observe finalized decisions
- Operate asynchronously
- May fail, hang, or misbehave without affecting authority

If learning executes before a decision is finalized, the system is non-compliant.

### 4.4 Learning Shall Be Overwrite-Safe and Replayable

All learning outputs must be:

- Descriptive, not prescriptive
- Recomputable from ordered history
- Safe to delete without breaking the system
- Safe to recompute without changing past decisions

Learning memory may improve insight — never correctness.

---

## 5. Permanently Forbidden Evolutions

The following are explicitly forbidden, regardless of perceived benefit:

- "Soft preferences" derived from learning
- "Hints" that alter decision flow
- "Fallback logic" that depends on learning
- "Auto-tuning" of rules based on outcomes
- "Optimization loops" that adjust authority
- "Confidence weighting" sourced from learning
- "Learning-informed defaults" that change outcomes

**If a proposal requires learning to be present for correctness, it is rejected.**

---

## 6. Success Does Not Grant Authority

Improved outcomes, metrics, or performance do not justify expanding the role of learning.

In ADE:

> **Effectiveness does not create entitlement.**

Learning may:
- Reveal patterns
- Inform humans
- Support analysis

Learning may not:
- Decide
- Override
- Compensate
- Correct

---

## 7. Institutional Safeguards

### 7.1 Versioning Safeguard

Any change that:

- Allows learning to affect authority
- Makes learning required
- Introduces causal dependency

Requires a **major version reset** and **explicit repudiation** of this document.

Such a change constitutes the creation of a different system.

### 7.2 Governance Precedence

If code, tests, or documentation conflict with this declaration:

- This document prevails
- The implementation is considered defective

### 7.3 Document Immutability

This document may only be amended by:

1. Unanimous governance review
2. Major version increment
3. An explicit repudiation statement acknowledging that ADE is being fundamentally altered

Minor clarifications, formatting changes, or explanatory notes do not constitute amendments.

**Any attempt to weaken, bypass, or reinterpret this document without satisfying the above conditions is invalid.**

---

## 8. Auditor Verification Procedure

An auditor may verify compliance by:

1. Disabling all learners
2. Clearing all `learned.*` memory
3. Re-running any decision
4. Observing:
   - Decision completes
   - Determinism preserved
   - No authority loss
   - No undefined behavior

If any decision fails under these conditions, the system is non-compliant.

---

## 9. Institutional Intent (Statement of Record)

ADE is designed to **decide with authority**, not to chase outcomes.

Learning exists to:
- Observe
- Record
- Illuminate

Authority exists to:
- Decide
- Commit
- Be accountable

This separation is intentional, permanent, and foundational.

---

## 10. Final Declaration

> **Learning in ADE will never be allowed to become authority.**

Not because it is unsafe.  
Not because it is ineffective.  
But because authority must remain explicit, deterministic, and accountable.

This document exists so that this decision never needs to be re-argued.

---

## 11. Refusal Posture

ADE is intentionally designed to refuse the following requests:

- "Can we use learning as a tiebreaker?"
- "What if we add a soft preference?"
- "This isn't really decision logic…"
- "We already trust this metric."
- "It would improve results."

The answer is:

> **No.**

Not because it would not work.  
But because it would change what the system is.

---

## 12. Notice to Future Maintainers

If you are reading this document because you want to:

- Make learning "just a little" influential
- Add "smart defaults" based on outcomes
- Use learning to "improve" decisions
- Reduce explicit rules in favor of metrics

**Stop.**

You are proposing a different system.

That system may be valid.  
It may even be powerful.

But it is not ADE.

Build it elsewhere.  
Do not modify this one.

---

## Related Documents

- [ADE-V2-Learning-Contract.md](./ADE-V2-Learning-Contract.md)
- [Governance Tests](../engine/src/tests/governance/)
- [Pathological Learner Proof](../engine/src/tests/governance/pathological-learner.test.ts)
