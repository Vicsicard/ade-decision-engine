# ADE Scoring Model v1

**Version:** 1.0.0  
**Status:** Draft  
**Date:** January 13, 2026  
**Depends On:** ADE-State-Schema-v1.md, ADE-API-Specification-v1.md

---

## Overview

This document defines the **Scoring Model** for ADE v1. The scoring model determines how eligible sessions are ranked after guardrails have filtered the candidate set.

**Core Principles:**
- Scoring operates **only on eligible sessions** (guardrails run first)
- Scoring is **deterministic** — same state + same sessions = same scores
- Scoring is **explainable** — weights are explicit, not learned
- Scoring optimizes for **30-day retention**, not single-session metrics
- Weights are **tunable** but changes are versioned and auditable

---

## 1. Scoring Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  Input: User State + Available Sessions                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Guardrail Filter                                   │
│  Remove ineligible sessions based on hard constraints       │
│  Output: Eligible session set                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Feature Extraction                                 │
│  Compute session-specific features for each eligible option │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Objective Scoring                                  │
│  Score each session against weighted objectives             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Rank & Select                                      │
│  Sort by score, return top N                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Objectives (What We Optimize For)

ADE v1 optimizes for a **single primary objective**: maximizing 30-day retention.

This is decomposed into four sub-objectives that are weighted and combined:

| Objective | Weight | Description |
|-----------|--------|-------------|
| **Completion Likelihood** | 0.35 | Probability user completes this session |
| **Fatigue Management** | 0.25 | Avoid overtraining, respect recovery |
| **Engagement Momentum** | 0.25 | Maintain or build engagement streak |
| **Novelty Optimization** | 0.15 | Balance variety vs. familiarity |

**Total:** 1.00

### Why These Weights?

- **Completion Likelihood (0.35):** Highest weight because incomplete sessions correlate strongly with churn
- **Fatigue Management (0.25):** Overtraining is a primary driver of week 2–3 dropout
- **Engagement Momentum (0.25):** Streaks and consistency predict long-term retention
- **Novelty Optimization (0.15):** Important but secondary; too much novelty can confuse, too little bores

---

## 3. Feature Extraction

For each eligible session, compute the following features:

### 3.1 Session Features (from request)

| Feature | Type | Source |
|---------|------|--------|
| `session_intensity` | enum | `session_context.available_sessions[].intensity` |
| `session_duration` | integer | `session_context.available_sessions[].duration_minutes` |
| `session_type` | string | `session_context.available_sessions[].type` |
| `session_tags` | array | `session_context.available_sessions[].tags` |

### 3.2 State-Session Interaction Features (computed)

| Feature | Formula | Range |
|---------|---------|-------|
| `intensity_match` | See Section 4.1 | 0.0–1.0 |
| `type_novelty` | See Section 4.4 | 0.0–1.0 |
| `duration_fit` | See Section 4.1 | 0.0–1.0 |
| `fatigue_compatibility` | See Section 4.2 | 0.0–1.0 |

---

## 4. Objective Scoring Functions

Each objective has a scoring function that returns a value in [0.0, 1.0].

### 4.1 Completion Likelihood Score

**Goal:** Predict how likely the user is to complete this session.

**Formula:**
```
intensity_match = 1.0 - abs(ideal_intensity - session_intensity_value) / 2.0

ideal_intensity = 
  if fatigue_score > 0.7: 0.0 (low)
  elif fatigue_score > 0.4: 0.5 (moderate)
  else: 1.0 (high)

session_intensity_value =
  low: 0.0
  moderate: 0.5
  high: 1.0

duration_fit = 
  if session_depth < 7: prefer_shorter(session_duration)
  else: 1.0 (no penalty)

prefer_shorter(duration) = 
  if duration <= 20: 1.0
  elif duration <= 30: 0.8
  elif duration <= 45: 0.6
  else: 0.4

completion_likelihood = (intensity_match * 0.6) + (duration_fit * 0.4)
```

**Interpretation:**
- New users (low session_depth) get shorter sessions
- Fatigued users get lower intensity
- Mismatch between state and session intensity reduces score

---

### 4.2 Fatigue Management Score

**Goal:** Avoid recommending sessions that will increase fatigue beyond safe levels.

**Formula:**
```
projected_fatigue = fatigue_score + intensity_impact[session_intensity]

intensity_impact =
  low: 0.05
  moderate: 0.15
  high: 0.30

fatigue_management = 
  if projected_fatigue > 0.9: 0.0 (dangerous)
  elif projected_fatigue > 0.7: 0.3 (risky)
  elif projected_fatigue > 0.5: 0.7 (acceptable)
  else: 1.0 (safe)
```

**Interpretation:**
- Sessions that would push fatigue into danger zone score poorly
- Low-intensity sessions score well for fatigued users
- This is a soft preference (guardrails handle hard stops)

---

### 4.3 Engagement Momentum Score

**Goal:** Recommend sessions that maintain or build engagement streaks.

**Formula:**
```
engagement_momentum = 
  if engagement_level >= 0.7:
    # High engagement: maintain with moderate challenge
    if session_intensity == "moderate": 1.0
    elif session_intensity == "high": 0.8
    else: 0.6
  elif engagement_level >= 0.4:
    # Medium engagement: build with accessible sessions
    if session_intensity == "low": 0.9
    elif session_intensity == "moderate": 1.0
    else: 0.5
  else:
    # Low engagement: recover with easy wins
    if session_intensity == "low": 1.0
    elif session_intensity == "moderate": 0.6
    else: 0.2
```

**Interpretation:**
- Low-engagement users get easy sessions to rebuild momentum
- High-engagement users get moderate challenge to maintain interest
- Mismatched intensity for engagement level reduces score

---

### 4.4 Novelty Optimization Score

**Goal:** Balance variety (prevent boredom) with familiarity (prevent confusion).

**Formula:**
```
type_recency = days_since_last(session_type) from session_history
max_recency = 7

type_novelty = min(type_recency / max_recency, 1.0)

novelty_optimization = 
  if novelty_balance < 0.3:
    # Too repetitive: prefer novel types
    type_novelty
  elif novelty_balance > 0.7:
    # Too varied: prefer familiar types
    1.0 - type_novelty
  else:
    # Balanced: slight preference for novelty
    0.5 + (type_novelty * 0.5)
```

**Interpretation:**
- If user has been doing same type repeatedly, prefer different types
- If user has been doing many different types, prefer familiar types
- Balanced users get slight novelty preference

---

## 5. Final Score Calculation

**Formula:**
```
# Apply fatigue override to engagement momentum
if fatigue_score > 0.75:
  engagement_momentum = min(engagement_momentum, 0.6)

# Neutralize novelty for early users (let habits form first)
if session_depth < 5:
  novelty_optimization = 0.5

# Weighted sum
raw_score = (
  completion_likelihood * 0.35 +
  fatigue_management * 0.25 +
  engagement_momentum * 0.25 +
  novelty_optimization * 0.15
)

# Completion likelihood floor penalty
# Prevents "clever but unrealistic" recommendations
if completion_likelihood < 0.3:
  final_score = raw_score * 0.7
else:
  final_score = raw_score
```

**Range:** 0.0–1.0

**Tie-Breaking:** If two sessions have identical scores (within 0.001), prefer:
1. Lower intensity (safer)
2. Shorter duration (more accessible)
3. Alphabetical session_id (deterministic)

---

## 6. Ranking & Selection

### Ranking

Sessions are sorted by `final_score` descending.

### Selection

Return top N sessions where N = `options.max_ranked_options` (default 3).

### Response Format

```json
{
  "ranked_options": [
    {"session_id": "yoga-recovery-01", "score": 0.87, "eligible": true},
    {"session_id": "strength-moderate-03", "score": 0.72, "eligible": true},
    {"session_id": "hiit-beginner-02", "score": 0.58, "eligible": true}
  ]
}
```

### Internal Score Breakdown (Logging Only)

For debugging and weight tuning, log objective contributions per decision. **Not exposed in API response by default.**

```json
{
  "score_breakdown": {
    "session_id": "yoga-recovery-01",
    "completion_likelihood": 0.28,
    "fatigue_management": 0.22,
    "engagement_momentum": 0.25,
    "novelty_optimization": 0.12,
    "raw_score": 0.87,
    "floor_penalty_applied": false,
    "final_score": 0.87
  }
}
```

---

## 7. Weight Configuration

### Default Weights (v1)

```json
{
  "weight_version": "1.0.0",
  "objectives": {
    "completion_likelihood": 0.35,
    "fatigue_management": 0.25,
    "engagement_momentum": 0.25,
    "novelty_optimization": 0.15
  }
}
```

### Weight Tuning Rules

1. **Weights must sum to 1.0**
2. **No weight < 0.05** (all objectives matter)
3. **No weight > 0.50** (no single objective dominates)
4. **Changes are versioned** (`weight_version` increments)
5. **Changes require pilot data justification**

### Weight Storage

Weights are stored in Cloudflare D1 (not KV) for:
- Audit trail
- Version history
- Per-platform overrides (future)

---

## 8. Rationale Generation

When `options.include_rationale = true`, generate a human-readable explanation.

### Rationale Template

```
"rationale": "[Session] recommended because: [primary_reason]. User state: [state_summary]."
```

### Examples

```
"rationale": "yoga-recovery-01 recommended because: User fatigue elevated (0.72); low-intensity session preferred. User state: moderate engagement, high fatigue, week 3 of program."
```

```
"rationale": "strength-moderate-03 recommended because: User engagement strong (0.85); moderate challenge maintains momentum. User state: high engagement, low fatigue, completing program."
```

### Rationale Components

| Component | Source |
|-----------|--------|
| `primary_reason` | Highest-weighted objective that favored this session |
| `state_summary` | Engagement level bucket + fatigue bucket + session depth context |

---

## 9. Edge Cases

### 9.1 All Sessions Score Equally

**Scenario:** Multiple sessions have identical scores.

**Behavior:** Apply tie-breaking rules (Section 5).

### 9.2 All Sessions Score Poorly

**Scenario:** Best session scores < 0.3.

**Behavior:** 
- Still return ranked options (no minimum threshold)
- Include warning in rationale: "Limited options available; best match selected."
- Log for analysis

### 9.3 Single Eligible Session

**Scenario:** Only one session passes guardrails.

**Behavior:**
- Return that session with score
- Rationale notes: "Only eligible option after guardrails."

### 9.4 Cold Start User

**Scenario:** No session history, default state.

**Behavior:**
- Completion likelihood favors short, low-intensity sessions
- Fatigue management is neutral (fatigue = 0)
- Engagement momentum favors easy wins
- Novelty is neutral (no history to compare)
- Net effect: Conservative, accessible session recommended

---

## 10. Learning & Weight Updates

### v1 Approach: Manual Tuning

ADE v1 does **not** include automated weight learning.

Weight updates are:
- Manual
- Based on aggregate pilot data
- Reviewed by humans
- Versioned and logged

### Feedback Loop

```
/feedback outcomes
      │
      ▼
Aggregate in D1 (daily)
      │
      ▼
Weekly analysis (offline)
      │
      ▼
Human review
      │
      ▼
Weight adjustment proposal
      │
      ▼
A/B test (if significant change)
      │
      ▼
Deploy new weight_version
```

### Metrics for Weight Tuning

| Metric | Target | Weight Adjustment Signal |
|--------|--------|--------------------------|
| Session completion rate | > 65% | If low, increase completion_likelihood weight |
| Week 2 retention | > 70% | If low, increase fatigue_management weight |
| Engagement consistency | Low variance | If high variance, increase engagement_momentum weight |
| User-reported boredom | < 10% | If high, increase novelty_optimization weight |

---

## 11. Testing & Validation

### Unit Test Cases

| Test | Input | Expected |
|------|-------|----------|
| High fatigue user | fatigue_score = 0.8 | Low-intensity session scores highest |
| Low engagement user | engagement_level = 0.2 | Easy session scores highest |
| Repetitive history | novelty_balance = 0.1 | Novel session type scores higher |
| New user (cold start) | session_depth = 0 | Short, low-intensity session preferred |
| Balanced user | All dimensions ~0.5 | Moderate session scores well |

### Integration Test Cases

| Test | Scenario | Expected |
|------|----------|----------|
| Guardrail + Scoring | High-intensity blocked by fatigue override | Only low/moderate sessions scored |
| Tie-breaking | Two sessions score 0.75 | Lower intensity wins |
| Rationale generation | include_rationale = true | Valid rationale string returned |

### Regression Tests

After any weight change:
1. Run full test suite
2. Compare score distributions to previous version
3. Validate no unexpected ranking inversions

---

## 12. Configuration Summary

### Scoring Model Config (D1)

```json
{
  "config_id": "scoring-model-v1",
  "weight_version": "1.0.0",
  "created_at": "2026-01-13T00:00:00Z",
  "objectives": {
    "completion_likelihood": 0.35,
    "fatigue_management": 0.25,
    "engagement_momentum": 0.25,
    "novelty_optimization": 0.15
  },
  "constants": {
    "intensity_impact": {
      "low": 0.05,
      "moderate": 0.15,
      "high": 0.30
    },
    "max_recency_days": 7,
    "tie_break_order": ["intensity_asc", "duration_asc", "session_id_asc"]
  }
}
```

---

## 13. What Flows From This Model

| Artifact | Status |
|----------|--------|
| Guardrail Engine Implementation | Unblocked |
| Scoring Engine Implementation | Unblocked |
| Rationale Generator | Unblocked |
| Weight Tuning Dashboard (future) | Spec complete |
| A/B Testing Framework (future) | Spec complete |

---

## Appendix A: Full Scoring Example

### Input

**User State:**
```json
{
  "engagement_level": 0.65,
  "fatigue_score": 0.55,
  "session_depth": 12,
  "completion_proximity": 0.40,
  "novelty_balance": 0.45,
  "churn_risk": 0.35
}
```

**Eligible Sessions:**
```json
[
  {"session_id": "hiit-advanced-01", "intensity": "high", "duration_minutes": 45, "type": "hiit"},
  {"session_id": "strength-moderate-02", "intensity": "moderate", "duration_minutes": 30, "type": "strength"},
  {"session_id": "yoga-recovery-03", "intensity": "low", "duration_minutes": 20, "type": "yoga"}
]
```

### Scoring Breakdown

| Session | Completion | Fatigue | Momentum | Novelty | **Final** |
|---------|------------|---------|----------|---------|-----------|
| hiit-advanced-01 | 0.50 | 0.30 | 0.50 | 0.60 | **0.46** |
| strength-moderate-02 | 0.80 | 0.70 | 1.00 | 0.55 | **0.78** |
| yoga-recovery-03 | 0.70 | 1.00 | 0.60 | 0.70 | **0.75** |

### Result

```json
{
  "recommended_session": "strength-moderate-02",
  "ranked_options": [
    {"session_id": "strength-moderate-02", "score": 0.78, "eligible": true},
    {"session_id": "yoga-recovery-03", "score": 0.75, "eligible": true},
    {"session_id": "hiit-advanced-01", "score": 0.46, "eligible": true}
  ],
  "rationale": "strength-moderate-02 recommended because: User engagement moderate (0.65); moderate challenge maintains momentum. User state: moderate engagement, elevated fatigue, mid-program."
}
```

---

## Appendix B: Weight Evolution Log

| Version | Date | Changes | Justification |
|---------|------|---------|---------------|
| 1.0.0 | 2026-01-13 | Initial weights | Baseline for pilot |

*(Future changes logged here)*
