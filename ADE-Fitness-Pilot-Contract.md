# ADE Fitness Pilot: One-Page Loop Contract

**Version:** 1.0  
**Status:** Draft  
**Date:** January 13, 2026

---

## 1. Loop Definition

**Name:** Daily Session Selection Loop

**Domain:** Mobile fitness apps with daily workout/session plans

**Target Segment:** Apps experiencing high early churn (weeks 1–4) with explicit daily plan structures

**Core Problem:** Users churn because sessions are poorly timed, too hard, too easy, or misaligned with their current state. Manual tuning doesn't scale.

---

## 2. Decision Boundary

### What ADE Decides
- **Which session/plan** the user should receive today
- **When** to surface it (within a platform-defined eligible window; platform controls notification mechanics)
- **How** to frame it (intensity label, duration expectation)

### What ADE Does NOT Decide
- Content creation (workouts are pre-defined by platform)
- UI/UX rendering
- Payment or subscription logic
- Long-term program design
- Anything requiring creativity or strategy

**Explicit Constraint:** ADE automates *judgment*, not creativity or strategy.

---

## 3. State Dimensions (v1)

ADE models each user as a dynamic state vector. Initial dimensions:

| Dimension | Description | Source |
|-----------|-------------|--------|
| **Engagement Level** | Recent session completion rate (7-day rolling) | Feedback events |
| **Fatigue Score** | Accumulated load vs. recovery signals | Session intensity + rest days |
| **Session Depth** | Days since signup / sessions completed | Session count |
| **Completion Proximity** | How close to finishing current program | Progress % |
| **Novelty Balance** | Variety vs. repetition in recent sessions | Session type history |
| **Churn Risk** | Likelihood of dropout based on pattern | Derived from above |

**Note on Churn Risk:** This is a derived score used only for prioritization, not as a direct decision trigger. ADE does not "predict churn" — it uses churn risk as one input to scoring.

**Note:** State is reconstructed per-request from session inputs + short-term memory (KV). No persistent user profiles stored.

---

## 4. Constraints (Hard, Non-Negotiable)

These are guardrails that **must never be violated**, regardless of scoring:

| Constraint | Rule |
|------------|------|
| **Rest Day Minimum** | At least 1 rest day per 7-day window |
| **Intensity Cap** | No more than 2 high-intensity sessions consecutively |
| **Progression Gate** | Cannot skip difficulty levels without completion threshold |
| **Cooldown Enforcement** | Minimum 18 hours between session recommendations |
| **Fatigue Override** | If fatigue score > threshold, force recovery session |
| **Platform Exclusions** | Respect any platform-defined blocked sessions |

Guardrails determine **eligibility**, not outcomes. Scoring only applies to eligible options.

**Emergency Override:** Platform may disable ADE and revert to default logic at any time with no data loss. This is a non-negotiable trust requirement.

---

## 5. Metric & Success Threshold

### Primary Metric
**30-Day Retention Rate**  
Definition: % of users who complete at least 1 session in week 4 after signup

### Secondary Metrics
- **Session Completion Rate:** % of recommended sessions completed
- **Early Churn Rate:** % of users who drop off in weeks 1–2
- **Engagement Consistency:** Standard deviation of daily active sessions

### Success Threshold (Pilot)
| Metric | Baseline (Manual/Static) | Target (ADE) | Minimum Viable Lift |
|--------|--------------------------|--------------|---------------------|
| 30-Day Retention | ~35% (typical) | 42%+ | +7 percentage points |
| Session Completion | ~55% | 65%+ | +10 percentage points |
| Week 1–2 Churn | ~40% | 32% | -8 percentage points |

**Note:** Baselines should be measured from partner app's existing data before pilot begins.

---

## 6. 30-Day Pilot Plan

### Week 0: Setup (Pre-Pilot)
- [ ] Integrate `/decide` endpoint with partner app
- [ ] Integrate `/feedback` endpoint for outcome signals
- [ ] Establish baseline metrics from historical data
- [ ] Define cohort split (control vs. ADE-enabled)
- [ ] Validate state reconstruction from session data

### Week 1: Soft Launch
- [ ] Enable ADE for 10% of new users
- [ ] Monitor latency (<50ms target)
- [ ] Monitor guardrail violations (should be 0)
- [ ] Daily review of decision distribution

### Week 2: Expand & Observe
- [ ] Expand to 25% of new users
- [ ] Begin tracking retention signals
- [ ] Identify any state dimension gaps
- [ ] First weight adjustment review (if needed)

### Week 3: Full Cohort
- [ ] Expand to 50% of new users
- [ ] Compare early churn rates (ADE vs. control)
- [ ] Session completion rate comparison
- [ ] Identify edge cases or failure modes

### Week 4: Measurement & Decision
- [ ] Calculate 30-day retention for Week 1 cohort
- [ ] Full metric comparison (ADE vs. control)
- [ ] Document learnings and state model refinements
- [ ] Go/No-Go decision on continued rollout

---

## 7. API Contract Preview

### `POST /decide`

**Request:**
```json
{
  "user_id": "string",
  "session_context": {
    "available_sessions": ["session_a", "session_b", "session_c"],
    "current_time": "ISO8601",
    "platform_constraints": {}
  },
  "signals": {
    "last_session_completed": true,
    "last_session_intensity": "high",
    "days_since_last_session": 1
  }
}
```

**Response:**
```json
{
  "decision": {
    "recommended_session": "session_b",
    "ranked_options": [
      {"session": "session_b", "score": 0.87},
      {"session": "session_c", "score": 0.72},
      {"session": "session_a", "score": 0.45}
    ],
    "rationale": "User fatigue elevated; moderate intensity preferred"
  },
  "meta": {
    "latency_ms": 23,
    "guardrails_applied": ["intensity_cap"],
    "request_id": "uuid"
  }
}
```

### `POST /feedback`

**Request:**
```json
{
  "request_id": "uuid",
  "outcome": {
    "session_completed": true,
    "completion_percentage": 100,
    "user_rating": 4
  }
}
```

---

## 8. Explicit Scope Constraints (v1)

To prevent scope creep and ensure clean proof:

| Allowed | NOT Allowed (v1) |
|---------|------------------|
| Single loop (daily session) | Multiple loops |
| Single decision type | Cross-loop optimization |
| One primary metric | Multi-objective balancing |
| One vertical (fitness) | Domain-agnostic positioning |
| Deterministic scoring | ML training loops |
| LLM advisory (offline) | LLM in live path |

**Mantra:** One loop, one decision, one metric.

---

## 9. Exit Criteria

### Pilot Success → Continue
- 30-day retention lift ≥ 5 percentage points
- No guardrail violations
- Latency consistently <50ms
- Partner satisfaction (qualitative)

### Pilot Failure → Reassess
- No measurable lift after 30 days
- Guardrail violations or unexpected behavior
- Latency issues affecting UX
- Partner friction or integration problems
- Misalignment between partner expectations and control-system boundaries

---

## 10. What Flows From This Contract

Once this contract is locked:

| Artifact | Status |
|----------|--------|
| `/decide` API spec | Derivable |
| State schema v1 | Derivable |
| Scoring model v1 | Derivable |
| Guardrail implementation | Derivable |
| Success criteria | Defined above |
| Pilot timeline | Defined above |

---

**Next Step:** Review and lock this contract, then proceed to formal API specification.
