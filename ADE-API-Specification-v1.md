# ADE API Specification v1

**Version:** 1.0.0  
**Status:** Draft  
**Date:** January 13, 2026  
**Base URL:** `https://api.ade.{domain}/v1`

---

## Overview

This specification defines the public API contract for the Adaptive Decision Engine (ADE) Fitness Pilot. It covers:

- `/decide` — Request a ranked decision for a user
- `/feedback` — Report outcome signals for learning
- `/health` — System status check

**Design Principles:**
- Stateless per request
- Deterministic (same inputs → same outputs)
- Auditable (all decisions logged)
- Fast (<50ms target latency)

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
- Clients should specify `Accept: application/json` header

---

## Endpoints

---

### POST `/v1/decide`

Request a ranked decision for which session a user should receive.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |
| `Content-Type` | Yes | `application/json` |
| `X-Request-ID` | No | Client-provided idempotency key (UUID recommended) |
| `X-Platform-ID` | Yes | Platform identifier |

#### Request Body

```json
{
  "user_id": "string",
  "session_context": {
    "available_sessions": [
      {
        "session_id": "string",
        "intensity": "low" | "moderate" | "high",
        "duration_minutes": integer,
        "type": "string",
        "tags": ["string"]
      }
    ],
    "current_time": "ISO8601 datetime",
    "eligible_window": {
      "start": "ISO8601 datetime",
      "end": "ISO8601 datetime"
    },
    "platform_constraints": {
      "blocked_sessions": ["string"],
      "max_intensity": "low" | "moderate" | "high" | null,
      "custom": {}
    }
  },
  "signals": {
    "last_session_completed": boolean,
    "last_session_id": "string" | null,
    "last_session_intensity": "low" | "moderate" | "high" | null,
    "last_session_completion_pct": integer (0-100) | null,
    "days_since_last_session": integer,
    "sessions_completed_total": integer,
    "sessions_completed_7d": integer,
    "current_program_progress_pct": integer (0-100),
    "user_reported_fatigue": integer (1-5) | null,
    "rest_days_last_7d": integer
  },
  "options": {
    "include_rationale": boolean,
    "max_ranked_options": integer (1-10, default 3)
  }
}
```

#### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | Unique user identifier (platform-scoped) |
| `session_context.available_sessions` | array | Yes | Sessions eligible for recommendation |
| `session_context.current_time` | ISO8601 | Yes | Current timestamp for decision context |
| `session_context.eligible_window` | object | No | Time window for session delivery |
| `session_context.platform_constraints` | object | No | Platform-defined restrictions |
| `signals.last_session_completed` | boolean | Yes | Whether last recommended session was completed |
| `signals.days_since_last_session` | integer | Yes | Days since last session (0 = today) |
| `signals.sessions_completed_total` | integer | Yes | Lifetime session count |
| `signals.sessions_completed_7d` | integer | Yes | Sessions completed in last 7 days |
| `signals.current_program_progress_pct` | integer | Yes | Progress through current program (0-100) |
| `signals.rest_days_last_7d` | integer | Yes | Rest days taken in last 7 days |
| `options.include_rationale` | boolean | No | Include human-readable rationale (default: false) |
| `options.max_ranked_options` | integer | No | Number of ranked options to return (default: 3) |

#### Response Body (Success: 200 OK)

```json
{
  "decision": {
    "recommended_session": "string",
    "ranked_options": [
      {
        "session_id": "string",
        "score": float (0.0-1.0),
        "eligible": boolean
      }
    ],
    "rationale": "string" | null
  },
  "state": {
    "state_version": "1.0.0",
    "engagement_level": float (0.0-1.0),
    "fatigue_score": float (0.0-1.0),
    "session_depth": integer,
    "completion_proximity": float (0.0-1.0),
    "novelty_balance": float (0.0-1.0),
    "churn_risk": float (0.0-1.0)
  },
  "guardrails_applied": ["string"],
  "meta": {
    "request_id": "string",
    "latency_ms": integer,
    "api_version": "1.0.0",
    "timestamp": "ISO8601 datetime"
  }
}
```

#### Response Field Definitions

| Field | Description |
|-------|-------------|
| `decision.recommended_session` | The session_id ADE recommends |
| `decision.ranked_options` | All evaluated sessions with scores |
| `decision.rationale` | Human-readable explanation (if requested) |
| `state.*` | Computed state dimensions for this user at decision time |
| `guardrails_applied` | List of guardrails that affected eligibility |
| `meta.request_id` | Unique ID for this decision (use for feedback) |
| `meta.latency_ms` | Server-side processing time |

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request body or missing required fields |
| 401 | `UNAUTHORIZED` | Invalid or missing API key |
| 403 | `FORBIDDEN` | API key lacks permission for this platform |
| 404 | `USER_NOT_FOUND` | User ID not recognized (invalid platform/user combination). Note: Unknown users with valid platform are treated as cold-start, not 404. |
| 422 | `NO_ELIGIBLE_SESSIONS` | All sessions blocked by guardrails |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Temporary unavailability |

#### Error Response Body

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {} | null
  },
  "meta": {
    "request_id": "string",
    "timestamp": "ISO8601 datetime"
  }
}
```

---

### POST `/v1/feedback`

Report outcome signals for a previous decision. Used for learning and aggregate tracking.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |
| `Content-Type` | Yes | `application/json` |
| `X-Platform-ID` | Yes | Platform identifier |

#### Request Body

```json
{
  "request_id": "string",
  "user_id": "string",
  "outcome": {
    "session_started": boolean,
    "session_completed": boolean,
    "completion_percentage": integer (0-100),
    "duration_actual_minutes": integer | null,
    "user_rating": integer (1-5) | null,
    "user_skipped": boolean,
    "skip_reason": "string" | null
  },
  "timestamp": "ISO8601 datetime"
}
```

#### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `request_id` | string | Yes | The `meta.request_id` from the `/decide` response |
| `user_id` | string | Yes | User identifier (must match original request) |
| `outcome.session_started` | boolean | Yes | Whether user started the session |
| `outcome.session_completed` | boolean | Yes | Whether user completed the session |
| `outcome.completion_percentage` | integer | Yes | How much of session was completed (0-100) |
| `outcome.duration_actual_minutes` | integer | No | Actual time spent |
| `outcome.user_rating` | integer | No | User's rating of session (1-5) |
| `outcome.user_skipped` | boolean | No | Whether user explicitly skipped |
| `outcome.skip_reason` | string | No | Reason for skip (if provided) |
| `timestamp` | ISO8601 | Yes | When the outcome occurred |

#### Response Body (Success: 202 Accepted)

```json
{
  "status": "accepted",
  "meta": {
    "request_id": "string",
    "timestamp": "ISO8601 datetime"
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request body |
| 401 | `UNAUTHORIZED` | Invalid or missing API key |
| 404 | `REQUEST_NOT_FOUND` | Original request_id not found |
| 409 | `DUPLICATE_FEEDBACK` | Feedback already submitted for this request_id |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

### GET `/v1/health`

System health check endpoint.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | No | Not required for health check |

#### Response Body (Success: 200 OK)

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "components": {
    "decision_engine": "ok" | "degraded" | "down",
    "state_store": "ok" | "degraded" | "down",
    "aggregate_store": "ok" | "degraded" | "down"
  },
  "version": "1.0.0",
  "timestamp": "ISO8601 datetime"
}
```

---

## Idempotency

- Clients may provide `X-Request-ID` header for idempotent requests
- If the same `X-Request-ID` is sent within 5 minutes, the cached response is returned
- This prevents duplicate decisions during network retries

---

## Timeout Behavior

| Endpoint | Target Latency | Hard Timeout |
|----------|----------------|--------------|
| `/decide` | <50ms | 200ms |
| `/feedback` | <100ms | 500ms |
| `/health` | <10ms | 50ms |

If a request exceeds the hard timeout:
- `/decide`: Returns `503 SERVICE_UNAVAILABLE` with fallback recommendation flag
- `/feedback`: Queued for async processing, returns `202 Accepted`

---

## Rate Limits

| Tier | `/decide` | `/feedback` |
|------|-----------|-------------|
| Pilot | 100 req/sec | 200 req/sec |
| Production | 1000 req/sec | 2000 req/sec |
| Enterprise | Custom | Custom |

Rate limit headers included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Audit & Logging

Every `/decide` request is logged with:
- Full request payload (excluding PII if configured)
- Full response payload
- Computed state at decision time
- Guardrails evaluated and applied
- Latency breakdown

Logs are retained for 90 days by default. Partners may request extended retention.

---

## Emergency Override Behavior

If a platform triggers emergency override:
1. All `/decide` requests return a `fallback` flag
2. Response includes `"override_active": true`
3. Platform should use its default session selection logic
4. No learning occurs during override period

Override is activated via platform dashboard or API call (separate admin endpoint, not specified here).

---

## SDK Recommendations

For pilot integrations, we recommend:
- Use a thin HTTP client wrapper
- Implement retry with exponential backoff (max 3 retries)
- Cache `/decide` responses client-side for 60 seconds as fallback
- Always send `/feedback` asynchronously (fire-and-forget with queue)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-13 | Initial specification |

---

## What Flows From This Specification

| Artifact | Status |
|----------|--------|
| State Schema v1 | Next |
| Guardrail Engine Implementation | Pending |
| Scoring Model v1 | Pending |
| OpenAPI/Swagger File | Derivable from this spec |
| SDK Stubs | Derivable from this spec |
