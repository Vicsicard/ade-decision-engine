# ADE State Schema v1

**Version:** 1.0.0  
**Status:** Canonical  
**Date:** January 16, 2026  
**Depends On:** ADE-Cycle-Definition-v1.md, ADE-Scenario-Schema-v1.md

---

## Overview

This document defines the **User State Model** for ADE v1. State is the foundation of all decision-making — guardrails evaluate it, scoring weights it, and the audit system logs it.

**Core Principles:**
- State is **reconstructed per-request**, not stored as a persistent profile
- State is **deterministic** — same inputs always produce same state
- State is **observable** — all dimensions derived from platform telemetry
- State is **versioned** — schema changes are explicit and backward-compatible
- State is **layered** — core dimensions are universal; scenario dimensions are pluggable

**Normative Statement:** State derivation occurs in Stage 2 of the ADE Cycle. It is purely deterministic with no AI/ML inference.

---

## State Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER STATE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  CORE DIMENSIONS (Universal)                                                 │
│  ├── engagement_level                                                        │
│  ├── recency_score                                                           │
│  ├── interaction_depth                                                       │
│  └── churn_risk (derived)                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  SCENARIO DIMENSIONS (Pluggable)                                             │
│  ├── [defined by scenario schema]                                            │
│  └── [e.g., fatigue_score, novelty_balance for fitness]                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  EXECUTION CAPABILITIES                                                      │
│  ├── llm_available                                                           │
│  ├── max_latency_ms                                                          │
│  └── offline_mode                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  METADATA                                                                    │
│  ├── state_version                                                           │
│  ├── scenario_id                                                             │
│  ├── computed_at                                                             │
│  └── inputs_hash                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Complete State Object

### TypeScript Interface

```typescript
interface UserState {
  // Version & Identity
  state_version: string;           // "1.0.0"
  scenario_id: string;             // "fitness-daily-session"
  scenario_version: string;        // "1.0.0"
  
  // Core Dimensions (always present)
  core: {
    engagement_level: number;      // 0.0 - 1.0
    recency_score: number;         // 0.0 - 1.0
    interaction_depth: number;     // integer >= 0
    churn_risk: number;            // 0.0 - 1.0 (derived)
  };
  
  // Scenario Dimensions (defined by scenario schema)
  scenario_extensions: Record<string, number | boolean | string>;
  
  // Execution Capabilities
  execution_capabilities: {
    llm_available: boolean;
    max_latency_ms: number;
    offline_mode: boolean;
  };
  
  // Metadata
  computed_at: string;             // ISO8601 datetime
  inputs_hash: string;             // SHA256 of input signals
}
```

---

## 2. Core Dimensions (Universal)

These dimensions are present in **every** scenario. They represent fundamental user engagement patterns.

### 2.1 Engagement Level

**Definition:** Recent interaction completion rate

**Formula:**
```
engagement_level = interactions_completed_7d / max(interactions_expected_7d, 1)
```

| Property | Value |
|----------|-------|
| Type | float |
| Range | 0.0 – 1.0 |
| Default | 0.5 |
| Source | Computed from signals + memory |

**Inputs Required:**
- `signals.interactions_completed_7d` (from request)
- `interactions_expected_7d` (from short-term memory)

**Cold Start:** Default to 0.5

---

### 2.2 Recency Score

**Definition:** How recently the user interacted (inverse of time since last interaction)

**Formula:**
```
recency_score = 1.0 - min(hours_since_last_interaction / 168, 1.0)
```

| Property | Value |
|----------|-------|
| Type | float |
| Range | 0.0 – 1.0 |
| Default | 0.5 |
| Source | Computed from signals |

**Interpretation:**
- 1.0 = Just interacted
- 0.5 = ~3.5 days ago
- 0.0 = 7+ days ago

**Cold Start:** Default to 0.5

---

### 2.3 Interaction Depth

**Definition:** Total interactions since signup

**Formula:**
```
interaction_depth = signals.total_interactions
```

| Property | Value |
|----------|-------|
| Type | integer |
| Range | 0 – ∞ |
| Default | 0 |
| Source | Direct from signal |

**Cold Start:** Default to 0

---

### 2.4 Churn Risk (Derived)

**Definition:** Composite score indicating likelihood of dropout

**Formula:**
```
churn_risk = (
  (1.0 - engagement_level) * 0.50 +
  (1.0 - recency_score) * 0.30 +
  depth_factor * 0.20
)

depth_factor = 1.0 if interaction_depth < 5 else 0.5 if interaction_depth < 20 else 0.2
```

| Property | Value |
|----------|-------|
| Type | float |
| Range | 0.0 – 1.0 |
| Default | 0.5 |
| Source | Derived from other core dimensions |

**Interpretation:**
- 0.0–0.3 = Low risk
- 0.3–0.6 = Moderate risk
- 0.6–1.0 = High risk

**Important:** Churn risk is a **prioritization signal**, not a prediction. It does not trigger decisions directly.

---

## 3. Scenario Dimensions (Pluggable)

Scenario dimensions are defined in the Scenario Schema and extend the core state. The engine does not hardcode any scenario-specific dimensions.

### How Scenario Dimensions Work

1. Scenario schema declares dimensions with derivation formulas
2. Engine loads scenario at startup
3. State derivation evaluates scenario formulas
4. Results stored in `scenario_extensions` object

### Example: Fitness Scenario Dimensions

```json
{
  "scenario_dimensions": {
    "fatigue_score": {
      "type": "float",
      "range": { "min": 0.0, "max": 1.0 },
      "default": 0.0,
      "derivation": {
        "source": "computed",
        "formula": "clamp((intensity_load - recovery_factor) / 5.0, 0.0, 1.0)",
        "inputs": ["session_history", "rest_days_last_7d"]
      }
    },
    "novelty_balance": {
      "type": "float",
      "range": { "min": 0.0, "max": 1.0 },
      "default": 0.5,
      "derivation": {
        "source": "computed",
        "formula": "unique_types / max(total_sessions, 1)",
        "inputs": ["session_history"]
      }
    },
    "completion_proximity": {
      "type": "float",
      "range": { "min": 0.0, "max": 1.0 },
      "default": 0.0,
      "derivation": {
        "source": "signal",
        "formula": "signals.program_progress_pct / 100.0"
      }
    }
  }
}
```

### Example: Notification Scenario Dimensions

```json
{
  "scenario_dimensions": {
    "notification_fatigue": {
      "type": "float",
      "range": { "min": 0.0, "max": 1.0 },
      "default": 0.0,
      "derivation": {
        "source": "computed",
        "formula": "notifications_sent_24h / 5.0",
        "inputs": ["notification_history"]
      }
    },
    "optimal_hour_score": {
      "type": "float",
      "range": { "min": 0.0, "max": 1.0 },
      "default": 0.5,
      "derivation": {
        "source": "computed",
        "formula": "hour_preference_score(current_hour, user_timezone)",
        "inputs": ["current_time", "user_timezone", "interaction_history"]
      }
    }
  }
}
```

---

## 4. Execution Capabilities

These dimensions describe the current execution environment, enabling execution risk scoring.

```typescript
interface ExecutionCapabilities {
  llm_available: boolean;      // Is cloud LLM reachable?
  max_latency_ms: number;      // Remaining latency budget
  offline_mode: boolean;       // Is this an offline request?
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `llm_available` | true | Whether LLM executor is available |
| `max_latency_ms` | 500 | Maximum allowed response time |
| `offline_mode` | false | Whether running in offline mode |

**Usage:** These values feed into execution risk scoring (Stage 4) to ensure ADE only selects actions it can safely execute.

---

## 5. Short-Term Memory (KV Storage)

State reconstruction requires short-term memory for interaction history.

### Key Structure

```
ade:memory:{platform_id}:{user_id}
```

### Value Structure

```json
{
  "schema_version": "1.0.0",
  "scenario_id": "fitness-daily-session",
  "last_updated": "ISO8601",
  "interaction_history": [
    {
      "interaction_id": "string",
      "type": "string",
      "attributes": {},
      "completed": true,
      "completion_pct": 100,
      "timestamp": "ISO8601"
    }
  ],
  "interactions_expected_7d": 5,
  "last_decision_id": "uuid",
  "custom_memory": {}
}
```

### TTL & Eviction

| Data | TTL | Rationale |
|------|-----|-----------|
| Interaction history | 30 days | Sufficient for rolling windows |
| Full KV entry | 90 days | Covers analysis period |

**Eviction Semantics:**
- Missing entry → cold start defaults
- Expired entry → treated as missing
- History pruned to last 50 entries on write

---

## 6. State Derivation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INPUT: DecisionRequest from Stage 1 (Ingest)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Load Scenario Schema                                                     │
│     - Get scenario_id from request                                          │
│     - Load dimension definitions                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. Fetch Short-Term Memory                                                  │
│     - Key: ade:memory:{platform_id}:{user_id}                               │
│     - If missing → cold start mode                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. Compute Core Dimensions                                                  │
│     a. engagement_level                                                      │
│     b. recency_score                                                         │
│     c. interaction_depth                                                     │
│     d. churn_risk (depends on a, b, c)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. Compute Scenario Dimensions                                              │
│     - Evaluate each formula from scenario schema                            │
│     - Store in scenario_extensions                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. Assess Execution Capabilities                                            │
│     - Check LLM availability                                                │
│     - Calculate remaining latency budget                                    │
│     - Determine offline mode                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. Attach Metadata                                                          │
│     - state_version, scenario_id, computed_at, inputs_hash                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  OUTPUT: UserState → Stage 3 (Guardrails)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Cold Start Behavior

**Definition:** User has no prior ADE interaction (no KV entry)

### Cold Start Defaults

| Dimension | Default | Rationale |
|-----------|---------|-----------|
| `engagement_level` | 0.5 | Neutral assumption |
| `recency_score` | 0.5 | Neutral assumption |
| `interaction_depth` | 0 | No history |
| `churn_risk` | 0.5 | Moderate caution |
| Scenario dimensions | Per scenario schema | Scenario-defined defaults |

### Cold Start Behavior

- All guardrails still apply (no exemptions)
- First decision is conservative
- State written to KV after first `/feedback`
- Subsequent decisions use accumulated history

---

## 8. Failure Modes

### 8.1 Missing Data

| Scenario | Behavior |
|----------|----------|
| KV entry not found | Cold start defaults |
| Single signal missing | Field-specific default |
| Multiple signals missing | Compute what's possible, default rest |
| Scenario dimension formula error | Use dimension default, log error |

### 8.2 Stale Data

| Scenario | Behavior |
|----------|----------|
| KV data > 30 days old | Treat as cold start |
| Last interaction > 14 days | Maximum recency penalty |

### 8.3 Computation Errors

| Scenario | Behavior |
|----------|----------|
| Division by zero | Use default, log warning |
| Out of range result | Clamp to valid range |
| Formula parse error | Reject scenario at load time |

---

## 9. Versioning

### State Version

- `state_version` included in every state object
- Format: semver (major.minor.patch)
- Logged in audit trace

### Compatibility Rules

| Change Type | Version Bump | Backward Compatible |
|-------------|--------------|---------------------|
| Add optional core dimension | minor | Yes |
| Change derivation formula | patch | Yes |
| Add required core dimension | major | No |
| Remove core dimension | major | No |
| Change dimension semantics | major | No |

**Note:** Scenario dimension changes are governed by scenario versioning, not state schema versioning.

---

## 10. Testing Requirements

### Unit Tests

| Test | Input | Expected |
|------|-------|----------|
| Cold start | No KV, minimal signals | All defaults, valid state |
| High engagement | 7/7 completed | `engagement_level` = 1.0 |
| Low recency | 7+ days since last | `recency_score` = 0.0 |
| Churn risk derivation | Various inputs | Correct composite score |
| Scenario dimension | Fitness signals | Correct fatigue_score |

### Integration Tests

| Test | Scenario | Expected |
|------|----------|----------|
| KV write after feedback | Send `/feedback` | History updated |
| Scenario loading | Load fitness scenario | Dimensions available |
| Cross-scenario | Switch scenarios | Correct dimensions per scenario |

---

## What Flows From This Schema

| Artifact | Status |
|----------|--------|
| State Computation Module | Unblocked |
| Guardrail Engine | Unblocked |
| Scoring Engine | Unblocked |
| Scenario Validation | Unblocked |

---

## Appendix A: Full State Object Example (Fitness)

```json
{
  "state_version": "1.0.0",
  "scenario_id": "fitness-daily-session",
  "scenario_version": "1.0.0",
  "core": {
    "engagement_level": 0.71,
    "recency_score": 0.85,
    "interaction_depth": 23,
    "churn_risk": 0.32
  },
  "scenario_extensions": {
    "fatigue_score": 0.45,
    "novelty_balance": 0.57,
    "completion_proximity": 0.65
  },
  "execution_capabilities": {
    "llm_available": true,
    "max_latency_ms": 450,
    "offline_mode": false
  },
  "computed_at": "2026-01-16T09:15:00Z",
  "inputs_hash": "sha256:a3f2b8c1d4e5f6..."
}
```

---

## Appendix B: Full State Object Example (Notification)

```json
{
  "state_version": "1.0.0",
  "scenario_id": "notification-timing",
  "scenario_version": "1.0.0",
  "core": {
    "engagement_level": 0.60,
    "recency_score": 0.40,
    "interaction_depth": 45,
    "churn_risk": 0.48
  },
  "scenario_extensions": {
    "notification_fatigue": 0.20,
    "optimal_hour_score": 0.75
  },
  "execution_capabilities": {
    "llm_available": true,
    "max_latency_ms": 100,
    "offline_mode": false
  },
  "computed_at": "2026-01-16T14:30:00Z",
  "inputs_hash": "sha256:b4c3d2e1f0..."
}
```

---

## Appendix C: KV Entry Example

```json
{
  "schema_version": "1.0.0",
  "scenario_id": "fitness-daily-session",
  "last_updated": "2026-01-16T09:00:00Z",
  "interaction_history": [
    {
      "interaction_id": "workout-hiit-001",
      "type": "hiit",
      "attributes": { "intensity": "high", "duration_minutes": 30 },
      "completed": true,
      "completion_pct": 100,
      "timestamp": "2026-01-15T08:00:00Z"
    },
    {
      "interaction_id": "workout-yoga-003",
      "type": "yoga",
      "attributes": { "intensity": "low", "duration_minutes": 20 },
      "completed": true,
      "completion_pct": 100,
      "timestamp": "2026-01-14T07:30:00Z"
    }
  ],
  "interactions_expected_7d": 5,
  "last_decision_id": "dec-uuid-12345",
  "custom_memory": {
    "rest_days_last_7d": 2
  }
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-16 | Refactored to separate core from scenario dimensions |
