# DDR Runtime Worker

**Phase 5.2: Cloudflare Workers Deployment**

This Worker hosts the DDR decision runtime ONLY. DCG (contract authoring) stays in Control Plane.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DDR Runtime Worker                        │
│                                                             │
│  • Accepts decision requests                                │
│  • Returns deterministic decisions                          │
│  • Logs events to D1 (async, best-effort)                   │
│  • Does NOT modify decisions based on logging failures      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Bindings                       │
│                                                             │
│  • KV: Short-lived session state (optional)                 │
│  • D1: Decision events + aggregates                         │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service health check |
| POST | `/v1/decide` | Make a decision |
| POST | `/v1/outcome` | Report outcome (host app) |
| GET | `/v1/metrics` | Basic aggregates (24h) |

## Setup

### 1. Install dependencies

```bash
cd worker
npm install
```

### 2. Create D1 database

```bash
wrangler d1 create ddr-events
```

Update `wrangler.toml` with the returned database ID.

### 3. Create KV namespace

```bash
wrangler kv:namespace create SESSION_STATE
wrangler kv:namespace create SESSION_STATE --preview
```

Update `wrangler.toml` with the returned namespace IDs.

### 4. Initialize database schema

```bash
npm run db:init:dev
```

### 5. Run locally

```bash
npm run dev
```

### 6. Deploy

```bash
npm run deploy:dev   # Development
npm run deploy:prod  # Production
```

## Configuration

Environment variables in `wrangler.toml`:

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | `development` or `production` |
| `SCENARIO_ID` | Pinned scenario ID |
| `SCENARIO_VERSION` | Pinned scenario version |
| `COHORT_MODE` | `control` or `treatment` |

## Request/Response Examples

### POST /v1/decide

**Request:**
```json
{
  "user_id": "user-123",
  "actions": [
    { "action_id": "workout-a", "type_id": "workout_session", "attributes": { "intensity": "moderate" } },
    { "action_id": "rest-day", "type_id": "rest_day", "attributes": {} }
  ],
  "signals": {
    "sessions_completed_7d": 4,
    "hours_since_last_session": 24,
    "fatigue_score": 0.3
  }
}
```

**Response:**
```json
{
  "decision": {
    "selected_action": "workout-a",
    "decision_code": "APPROVE",
    "payload": {
      "rationale": "Based on your recovery status..."
    }
  },
  "audit": {
    "replay_token": "rpl_abc123",
    "scenario_id": "fitness-daily-session",
    "scenario_version": "1.0.0",
    "latency_ms": 12,
    "cohort": "treatment"
  }
}
```

### POST /v1/outcome

**Request:**
```json
{
  "decision_event_id": "evt_abc123",
  "user_id": "user-123",
  "outcome_type": "completed",
  "outcome_metadata": { "duration_minutes": 45 }
}
```

**Response:**
```json
{
  "recorded": true,
  "timestamp": "2026-01-19T21:00:00.000Z"
}
```

## D1 Schema

See `schema.sql` for full schema. Key tables:

- **decision_events**: Append-only decision log
- **daily_aggregates**: Rollup summaries
- **outcome_events**: Host app outcome reports

## Phase 5 Scope

This deployment is intentionally minimal:

- ✅ One scenario pinned
- ✅ No hot-swap
- ✅ No dashboard (Phase 5.4)
- ✅ Append-only logging
- ✅ Basic metrics endpoint
