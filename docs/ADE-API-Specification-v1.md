# ADE API Specification v1

**Version:** 1.0.0  
**Status:** Canonical  
**Date:** January 16, 2026  
**Base URL:** `https://api.ade.{domain}/v1`  
**Depends On:** ADE-Cycle-Definition-v1.md, ADE-Scenario-Schema-v1.md

---

## Overview

This specification defines the public API contract for the Adaptive Decision Engine (ADE). The API is **scenario-agnostic** — the same endpoints serve any configured scenario.

**Endpoints:**
- `POST /v1/decide` — Request a decision for a user
- `POST /v1/feedback` — Report outcome signals
- `GET /v1/health` — System status check
- `GET /v1/replay/{decision_id}` — Retrieve decision audit trace

**Design Principles:**
- Stateless per request
- Deterministic (same inputs → same outputs)
- Auditable (all decisions logged with replay tokens)
- Scenario-agnostic (engine serves any valid scenario)
- Containment-aware (execution mode and skill info exposed)

---

## Authentication

All requests require an API key in the header:

```
Authorization: Bearer {api_key}
```

API keys are scoped per platform/partner. Rate limits and quotas are enforced per key.

---

## Versioning Strategy

- API version is embedded in the URL path: `/v1/decide`
- Breaking changes increment the major version
- Non-breaking additions are backward-compatible within a version
- Deprecation notices provided 90 days before removal

---

## Endpoints

---

### POST `/v1/decide`

Request a decision for a user within a specified scenario.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |
| `Content-Type` | Yes | `application/json` |
| `X-Request-ID` | No | Client-provided idempotency key (UUID) |
| `X-Platform-ID` | Yes | Platform identifier |

#### Request Body

```json
{
  "scenario_id": "string",
  "user_id": "string",
  "actions": [
    {
      "action_id": "string",
      "type_id": "string",
      "attributes": {}
    }
  ],
  "signals": {},
  "context": {
    "current_time": "ISO8601",
    "timezone": "string",
    "platform_constraints": {}
  },
  "options": {
    "execution_mode_override": "deterministic_only" | "skill_enhanced" | null,
    "include_rationale": true,
    "include_score_breakdown": false,
    "max_ranked_options": 3
  }
}
```

#### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scenario_id` | string | Yes | Scenario identifier (e.g., `fitness-daily-session`) |
| `user_id` | string | Yes | Unique user identifier (platform-scoped) |
| `actions` | array | Yes* | Available actions for selection (*if scenario uses dynamic actions) |
| `actions[].action_id` | string | Yes | Unique action identifier |
| `actions[].type_id` | string | Yes | Action type (must match scenario schema) |
| `actions[].attributes` | object | Yes | Action-specific attributes |
| `signals` | object | Yes | User signals for state derivation |
| `context.current_time` | ISO8601 | Yes | Current timestamp |
| `context.timezone` | string | No | User timezone |
| `context.platform_constraints` | object | No | Platform-defined restrictions |
| `options.execution_mode_override` | string | No | Force execution mode |
| `options.include_rationale` | boolean | No | Include human-readable rationale (default: false) |
| `options.include_score_breakdown` | boolean | No | Include detailed scoring (default: false) |
| `options.max_ranked_options` | integer | No | Number of ranked options (default: 3, max: 10) |

#### Response Body (Success: 200 OK)

```json
{
  "decision": {
    "decision_id": "uuid",
    "selected_action": "string",
    "payload": {
      "rationale": "string",
      "display_parameters": {}
    },
    "ranked_options": [
      {
        "action_id": "string",
        "rank": 1,
        "score": 0.85,
        "score_breakdown": {}
      }
    ]
  },
  "state": {
    "state_version": "1.0.0",
    "core": {
      "engagement_level": 0.71,
      "recency_score": 0.85,
      "interaction_depth": 23,
      "churn_risk": 0.32
    },
    "scenario_extensions": {}
  },
  "execution": {
    "execution_mode": "deterministic_only" | "skill_enhanced",
    "skill_id": "string",
    "skill_version": "string",
    "validation_status": "passed" | "failed",
    "fallback_used": false,
    "fallback_reason_code": null
  },
  "guardrails_applied": ["GR-001", "GR-002"],
  "audit": {
    "decision_id": "uuid",
    "replay_token": "string",
    "scenario_id": "string",
    "scenario_version": "string",
    "scenario_hash": "sha256:...",
    "trace_id": "string"
  },
  "meta": {
    "request_id": "string",
    "timestamp": "ISO8601",
    "total_duration_ms": 45,
    "api_version": "1.0.0"
  }
}
```

#### Response Field Definitions

| Field | Description |
|-------|-------------|
| `decision.decision_id` | Unique identifier for this decision (UUID v4) |
| `decision.selected_action` | The action_id ADE selected |
| `decision.payload` | Skill-generated enrichment (rationale, display params) |
| `decision.ranked_options` | All evaluated actions with scores |
| `state.core` | Core state dimensions |
| `state.scenario_extensions` | Scenario-specific state dimensions |
| `execution.execution_mode` | How the decision was executed |
| `execution.skill_id` | Which skill generated the payload |
| `execution.fallback_used` | Whether fallback was triggered |
| `execution.fallback_reason_code` | Why fallback was used (if applicable) |
| `guardrails_applied` | List of guardrails that affected eligibility |
| `audit.replay_token` | Token for audit retrieval and deterministic replay |
| `audit.scenario_hash` | Content hash of scenario used |
| `meta.total_duration_ms` | End-to-end processing time |

#### Containment Fields

The `execution` block provides **containment transparency**:

| Field | Purpose |
|-------|---------|
| `execution_mode` | Shows whether LLM was used |
| `skill_id` / `skill_version` | Identifies which skill executed |
| `validation_status` | Whether skill output passed validation |
| `fallback_used` | Whether primary skill failed |
| `fallback_reason_code` | Why fallback was triggered |

This enables:
- Audit compliance (know exactly how decision was made)
- Debugging (trace skill failures)
- SLA monitoring (track fallback rates)

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request body |
| 400 | `INVALID_SCENARIO` | Scenario not found or invalid |
| 400 | `INVALID_ACTION_TYPE` | Action type doesn't match scenario schema |
| 401 | `UNAUTHORIZED` | Invalid or missing API key |
| 403 | `FORBIDDEN` | API key lacks permission |
| 422 | `NO_ELIGIBLE_ACTIONS` | All actions blocked by guardrails |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Temporary unavailability |

#### Error Response Body

```json
{
  "error": {
    "code": "NO_ELIGIBLE_ACTIONS",
    "message": "All actions blocked by guardrails",
    "details": {
      "guardrails_triggered": ["GR-REST-MIN", "GR-FATIGUE-OVERRIDE"],
      "actions_evaluated": 5,
      "actions_blocked": 5
    }
  },
  "audit": {
    "decision_id": "uuid",
    "trace_id": "string"
  },
  "meta": {
    "request_id": "string",
    "timestamp": "ISO8601"
  }
}
```

---

### POST `/v1/feedback`

Report outcome signals for a previous decision.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |
| `Content-Type` | Yes | `application/json` |
| `X-Platform-ID` | Yes | Platform identifier |

#### Request Body

```json
{
  "decision_id": "uuid",
  "user_id": "string",
  "outcome": {
    "action_taken": true,
    "action_completed": true,
    "completion_percentage": 100,
    "user_rating": 4,
    "user_skipped": false,
    "skip_reason": null,
    "custom_signals": {}
  },
  "timestamp": "ISO8601"
}
```

#### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `decision_id` | uuid | Yes | The `decision_id` from `/decide` response |
| `user_id` | string | Yes | User identifier (must match original) |
| `outcome.action_taken` | boolean | Yes | Whether user took the action |
| `outcome.action_completed` | boolean | Yes | Whether user completed the action |
| `outcome.completion_percentage` | integer | Yes | Completion percentage (0-100) |
| `outcome.user_rating` | integer | No | User's rating (1-5) |
| `outcome.user_skipped` | boolean | No | Whether user explicitly skipped |
| `outcome.skip_reason` | string | No | Reason for skip |
| `outcome.custom_signals` | object | No | Scenario-specific outcome signals |
| `timestamp` | ISO8601 | Yes | When outcome occurred |

#### Response Body (Success: 202 Accepted)

```json
{
  "status": "accepted",
  "meta": {
    "decision_id": "uuid",
    "timestamp": "ISO8601"
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request body |
| 401 | `UNAUTHORIZED` | Invalid or missing API key |
| 404 | `DECISION_NOT_FOUND` | Decision ID not found |
| 409 | `DUPLICATE_FEEDBACK` | Feedback already submitted |
| 429 | `RATE_LIMITED` | Too many requests |

---

### GET `/v1/replay/{decision_id}`

Retrieve the full audit trace for a decision.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |
| `X-Platform-ID` | Yes | Platform identifier |

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `decision_id` | UUID of the decision to retrieve |

#### Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `include_inputs` | true | Include original request |
| `include_stage_artifacts` | false | Include all stage outputs |
| `verify_determinism` | false | Re-execute and verify match |

#### Response Body (Success: 200 OK)

```json
{
  "decision_id": "uuid",
  "scenario_id": "string",
  "scenario_version": "string",
  "scenario_hash": "sha256:...",
  "timestamp": "ISO8601",
  "request": {},
  "stages": {
    "ingest": { "duration_ms": 2 },
    "derive_state": { "duration_ms": 5, "state_hash": "..." },
    "evaluate_guardrails": { "duration_ms": 3, "actions_filtered": 2 },
    "score_and_rank": { "duration_ms": 8, "selected_action": "..." },
    "resolve_skills": { "duration_ms": 1, "skill_id": "..." },
    "execute_skill": { "duration_ms": 15, "execution_mode": "..." },
    "validate_output": { "duration_ms": 2, "status": "passed" },
    "fallback": null,
    "audit_and_replay": { "duration_ms": 3 }
  },
  "final_decision": {},
  "total_duration_ms": 39,
  "determinism_verified": null
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Invalid or missing API key |
| 404 | `DECISION_NOT_FOUND` | Decision ID not found or expired |

---

### GET `/v1/health`

System health check endpoint.

#### Response Body (Success: 200 OK)

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "components": {
    "decision_engine": "ok" | "degraded" | "down",
    "state_store": "ok" | "degraded" | "down",
    "skill_executors": {
      "deterministic": "ok",
      "llm": "ok" | "degraded" | "down"
    }
  },
  "scenarios_loaded": ["fitness-daily-session@1.0.0", "notification-timing@1.0.0"],
  "version": "1.0.0",
  "timestamp": "ISO8601"
}
```

---

## Idempotency

- Clients may provide `X-Request-ID` header for idempotent requests
- If same `X-Request-ID` sent within 5 minutes, cached response returned
- Prevents duplicate decisions during network retries

---

## Timeout Behavior

| Endpoint | Target Latency | Hard Timeout |
|----------|----------------|--------------|
| `/decide` (deterministic) | <50ms | 150ms |
| `/decide` (skill_enhanced) | <300ms | 600ms |
| `/feedback` | <100ms | 500ms |
| `/replay` | <200ms | 1000ms |
| `/health` | <10ms | 50ms |

---

## Rate Limits

| Tier | `/decide` | `/feedback` | `/replay` |
|------|-----------|-------------|-----------|
| Pilot | 100 req/sec | 200 req/sec | 10 req/sec |
| Production | 1000 req/sec | 2000 req/sec | 100 req/sec |
| Enterprise | Custom | Custom | Custom |

Rate limit headers:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Audit & Logging

Every `/decide` request is logged with:
- Full request payload
- Full response payload
- All stage artifacts
- Execution mode and skill info
- Validation results
- Latency breakdown

Logs retained for 90 days by default. Extended retention available.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-16 | Refactored to scenario-agnostic with containment fields |

---

## What Flows From This Specification

| Artifact | Status |
|----------|--------|
| OpenAPI/Swagger File | Derivable |
| SDK Stubs | Derivable |
| Integration Tests | Unblocked |
