# ADE State Schema v1

**Version:** 1.0.0  
**Status:** Draft  
**Date:** January 13, 2026  
**Depends On:** ADE-API-Specification-v1.md

---

## Overview

This document defines the **User State Model** for ADE v1. State is the foundation of all decision-making — guardrails evaluate it, scoring weights it, and learning updates it.

**Core Principles:**
- State is **reconstructed per-request**, not stored as a persistent profile
- State is **deterministic** — same inputs always produce same state
- State is **observable** — all dimensions derived from platform telemetry
- State is **versioned** — schema changes are explicit and backward-compatible

---

## 1. Typed State Object

### State Dimensions

```typescript
interface UserState {
  state_version: "1.0.0";
  
  // Core dimensions (all required, all computed)
  engagement_level: number;      // 0.0 - 1.0
  fatigue_score: number;         // 0.0 - 1.0
  session_depth: number;         // integer >= 0
  completion_proximity: number;  // 0.0 - 1.0
  novelty_balance: number;       // 0.0 - 1.0
  churn_risk: number;            // 0.0 - 1.0 (derived)
  
  // Metadata
  computed_at: string;           // ISO8601 datetime
  inputs_hash: string;           // SHA256 of input signals (for debugging)
}
```

### Field Specifications

| Field | Type | Range | Default | Nullable | Description |
|-------|------|-------|---------|----------|-------------|
| `state_version` | string | semver | "1.0.0" | No | Schema version for backward compatibility |
| `engagement_level` | float | 0.0–1.0 | 0.5 | No | Recent session completion rate (7-day rolling) |
| `fatigue_score` | float | 0.0–1.0 | 0.0 | No | Accumulated load vs. recovery (higher = more fatigued) |
| `session_depth` | integer | 0–∞ | 0 | No | Total sessions completed since signup |
| `completion_proximity` | float | 0.0–1.0 | 0.0 | No | Progress through current program |
| `novelty_balance` | float | 0.0–1.0 | 0.5 | No | Variety vs. repetition (0.5 = balanced) |
| `churn_risk` | float | 0.0–1.0 | 0.5 | No | Derived likelihood of dropout |
| `computed_at` | ISO8601 | — | now | No | Timestamp of state computation |
| `inputs_hash` | string | SHA256 | — | No | Hash of input signals for audit/debugging |

---

## 2. Derivation Logic

Each state dimension is computed from request signals. No external data sources. No ML inference.

### 2.1 Engagement Level

**Definition:** Rolling 7-day session completion rate

**Formula:**
```
engagement_level = sessions_completed_7d / max(sessions_recommended_7d, 1)
```

**Inputs Required:**
- `signals.sessions_completed_7d` (from request)
- `sessions_recommended_7d` (from short-term memory)

**Bounds:** Clamped to [0.0, 1.0]

**Cold Start:** If `sessions_recommended_7d` is unknown, default to 0.5

---

### 2.2 Fatigue Score

**Definition:** Accumulated training load relative to recovery

**Formula:**
```
intensity_load = sum(intensity_weights[session.intensity] for session in last_7_days)
recovery_factor = rest_days_last_7d * 0.15
fatigue_score = clamp((intensity_load - recovery_factor) / max_load, 0.0, 1.0)
```

**Intensity Weights:**
| Intensity | Weight |
|-----------|--------|
| low | 0.3 |
| moderate | 0.6 |
| high | 1.0 |

**Inputs Required:**
- `signals.rest_days_last_7d`
- Session history from short-term memory (intensity per session)

**Constants:**
- `max_load` = 5.0 (calibrated for 7-day window)

**Cold Start:** Default to 0.0 (no fatigue assumed)

---

### 2.3 Session Depth

**Definition:** Total sessions completed since signup

**Formula:**
```
session_depth = signals.sessions_completed_total
```

**Inputs Required:**
- `signals.sessions_completed_total`

**Cold Start:** Default to 0

---

### 2.4 Completion Proximity

**Definition:** Progress through current program

**Formula:**
```
completion_proximity = signals.current_program_progress_pct / 100.0
```

**Inputs Required:**
- `signals.current_program_progress_pct`

**Bounds:** [0.0, 1.0]

**Cold Start:** Default to 0.0

---

### 2.5 Novelty Balance

**Definition:** Variety vs. repetition in recent sessions

**Formula:**
```
unique_types = count(distinct session.type for session in last_7_sessions)
total_types = count(last_7_sessions)
novelty_balance = unique_types / max(total_types, 1)
```

**Inputs Required:**
- Session history from short-term memory (type per session)

**Interpretation:**
- 0.0 = All sessions same type (high repetition)
- 1.0 = All sessions different types (high novelty)
- 0.5 = Balanced

**Cold Start:** Default to 0.5

---

### 2.6 Churn Risk (Derived)

**Definition:** Composite score indicating likelihood of dropout

**Formula:**
```
churn_risk = (
  (1.0 - engagement_level) * 0.40 +
  fatigue_score * 0.25 +
  (1.0 - completion_proximity) * 0.15 +
  recency_penalty * 0.20
)

recency_penalty = min(signals.days_since_last_session / 7.0, 1.0)
```

**Inputs Required:**
- All other state dimensions (computed first)
- `signals.days_since_last_session`

**Interpretation:**
- 0.0–0.3 = Low risk
- 0.3–0.6 = Moderate risk
- 0.6–1.0 = High risk

**Important:** Churn risk is a **prioritization signal**, not a prediction. It does not trigger decisions directly.

**Cold Start:** Default to 0.5

---

## 3. KV Storage Model

State reconstruction requires short-term memory for session history. This is stored in Cloudflare KV.

### Key Structure

```
ade:state:{platform_id}:{user_id}
```

**Example:**
```
ade:state:fitness-app-123:user-abc-456
```

### Value Structure

```json
{
  "schema_version": "1.0.0",
  "last_updated": "ISO8601 datetime",
  "session_history": [
    {
      "session_id": "string",
      "intensity": "low" | "moderate" | "high",
      "type": "string",
      "completed": boolean,
      "completion_pct": integer,
      "timestamp": "ISO8601 datetime"
    }
  ],
  "sessions_recommended_7d": integer,
  "last_decision_request_id": "string"
}
```

### TTL & Eviction

| Data | TTL | Rationale |
|------|-----|-----------|
| Session history | 30 days | Sufficient for 7-day rolling windows + buffer |
| Full KV entry | 90 days | Covers pilot duration + analysis |

**Eviction Semantics:**
- If KV entry is missing → cold start defaults apply
- If KV entry is expired → treated as missing
- Session history is pruned to last 30 entries on each write

### What Is Cached vs. Recomputed

| Data | Storage | Behavior |
|------|---------|----------|
| Session history | KV (cached) | Appended on `/feedback`, pruned on read |
| State dimensions | Recomputed | Always derived fresh from signals + history |
| Decision response | KV (idempotency) | Cached 5 minutes by `X-Request-ID` |

---

## 4. Versioning Strategy

### Schema Version

- `state_version` is included in every state object
- Format: semver (major.minor.patch)
- Returned in API response for transparency

### Compatibility Rules

| Change Type | Version Bump | Backward Compatible |
|-------------|--------------|---------------------|
| Add optional field | minor | Yes |
| Change derivation formula (same inputs) | patch | Yes |
| Add required field | major | No |
| Remove field | major | No |
| Change field type | major | No |
| Change field semantics | major | No |

### Migration Path

When `state_version` changes:
1. New version deployed alongside old
2. API accepts both versions during transition
3. Old version deprecated with 90-day notice
4. Old version removed after deprecation period

---

## 5. Failure Modes & Edge Cases

### 5.1 Missing Data

| Scenario | Behavior |
|----------|----------|
| KV entry not found | Use cold start defaults for all dimensions |
| Session history empty | Use cold start defaults |
| Single signal missing | Use field-specific default (see table above) |
| Multiple signals missing | Compute what's possible, default the rest |

### 5.2 Partial History

| Scenario | Behavior |
|----------|----------|
| < 7 days of history | Compute with available data, note in metadata |
| < 7 sessions | Novelty balance uses available sessions |
| No prior decisions | `sessions_recommended_7d` = 0, engagement defaults to 0.5 |

### 5.3 Cold Start Behavior

**Definition:** User has no prior ADE interaction

**Behavior:**
- All state dimensions use defaults (see table in Section 1)
- Guardrails still apply (no special exemptions)
- First decision is conservative (moderate intensity, high-engagement session types)
- State is written to KV after first `/feedback`

### 5.4 Stale Data

| Scenario | Behavior |
|----------|----------|
| KV data > 30 days old | Treat as cold start |
| Last session > 14 days ago | Apply maximum recency penalty |
| Feedback arrives after idempotency cache expiry | Feedback still processed, linked by `request_id` |

### 5.5 Idempotency Edge Cases

| Scenario | Behavior |
|----------|----------|
| Same `X-Request-ID` within 5 min | Return cached response |
| Same `X-Request-ID` after 5 min | Recompute (cache expired) |
| Feedback for expired `request_id` | Still accepted, linked via `request_id` in logs |
| Duplicate feedback for same `request_id` | Return `409 DUPLICATE_FEEDBACK` |

---

## 6. State Computation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     /decide Request                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Extract signals from request body                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Fetch session history from KV                           │
│     Key: ade:state:{platform_id}:{user_id}                  │
│     If missing → cold start                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Compute state dimensions (in order)                     │
│     a. engagement_level                                     │
│     b. fatigue_score                                        │
│     c. session_depth                                        │
│     d. completion_proximity                                 │
│     e. novelty_balance                                      │
│     f. churn_risk (depends on a, b, d)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Attach metadata                                         │
│     - state_version                                         │
│     - computed_at                                           │
│     - inputs_hash                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Pass state to Guardrail Engine → Scoring Engine         │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Testing & Validation

### Unit Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Cold start user | No KV entry, minimal signals | All defaults, valid state |
| High engagement | 7/7 sessions completed | `engagement_level` = 1.0 |
| High fatigue | 5 high-intensity sessions, 0 rest days | `fatigue_score` > 0.8 |
| Low novelty | 7 sessions same type | `novelty_balance` < 0.2 |
| High churn risk | 0 sessions in 7 days, low engagement | `churn_risk` > 0.7 |
| Partial history | 3 days of data | Valid state, no errors |

### Integration Test Cases

| Test | Scenario | Expected Behavior |
|------|----------|-------------------|
| KV write after feedback | Send `/feedback` | Session history updated in KV |
| Idempotency | Same `X-Request-ID` twice | Same response returned |
| Version mismatch | Old client, new schema | Graceful handling, no crash |

---

## 8. What Flows From This Schema

| Artifact | Status |
|----------|--------|
| Guardrail Engine Implementation | Unblocked |
| Scoring Model v1 | Unblocked |
| KV Data Model Implementation | Unblocked |
| State Computation Module | Unblocked |
| Cold Start Logic | Defined above |
| Testing Strategy | Defined above |

---

## Appendix A: Full State Object Example

```json
{
  "state_version": "1.0.0",
  "engagement_level": 0.71,
  "fatigue_score": 0.45,
  "session_depth": 23,
  "completion_proximity": 0.65,
  "novelty_balance": 0.57,
  "churn_risk": 0.38,
  "computed_at": "2026-01-13T19:45:00Z",
  "inputs_hash": "a3f2b8c1d4e5f6..."
}
```

---

## Appendix B: KV Entry Example

```json
{
  "schema_version": "1.0.0",
  "last_updated": "2026-01-13T19:30:00Z",
  "session_history": [
    {
      "session_id": "workout-hiit-001",
      "intensity": "high",
      "type": "hiit",
      "completed": true,
      "completion_pct": 100,
      "timestamp": "2026-01-12T08:00:00Z"
    },
    {
      "session_id": "workout-yoga-003",
      "intensity": "low",
      "type": "yoga",
      "completed": true,
      "completion_pct": 100,
      "timestamp": "2026-01-11T07:30:00Z"
    }
  ],
  "sessions_recommended_7d": 5,
  "last_decision_request_id": "req-uuid-12345"
}
```
