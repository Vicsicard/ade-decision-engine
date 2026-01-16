# ADE V1 Deployment Guide

## Operational Invariants (Must Hold in Production)

These four invariants **must hold under concurrent load** for ADE to be genuinely deployable:

### 1. Determinism Mode Defaulting
- Execution mode resolution: `engine default → scenario default → request override`
- Final resolved mode **must be recorded** in the audit trace
- No implicit mode switching

### 2. Selection Lock Enforcement
- Selection locks at end of Stage 4 (Score and Rank)
- Enforced by code (`Object.freeze`) AND audit verification
- Any attempt to mutate `selected_action` after Stage 4 throws/flags
- Validators reject any skill output attempting selection override

### 3. Scenario Hash Pinning
- `scenario_id + version` resolves to **exactly one content hash**
- Hash mismatch → fail closed to deterministic fallback + flags
- Scenario registry enforces immutability on registration

### 4. Audit Trace Immutability
- Deep clone on retrieval (prevents mutation by consumers)
- Append-only storage (no post-write mutation)
- Replay returns cloned data, never references

---

## Deployment Hardening Checklist

### A. API Hardening

| Item | Description | Priority |
|------|-------------|----------|
| Request size limits | `signals` and `actions` can balloon; enforce max payload size | Required |
| Input validation | Strict type checking for `actions[].attributes`, unknown field policy | Required |
| Max array lengths | Limit `actions.length`, `signals` key count | Required |
| Idempotency | If caller passes `request_id`, return existing `decision_id` + response | Recommended |

**Recommended limits:**
```typescript
const LIMITS = {
  MAX_PAYLOAD_BYTES: 64 * 1024,      // 64KB
  MAX_ACTIONS: 100,
  MAX_SIGNALS: 50,
  MAX_ATTRIBUTE_DEPTH: 3,
};
```

### B. Storage Hardening

| Item | Description | Priority |
|------|-------------|----------|
| Atomic writes | Write entire trace in one transaction, or use monotonic stage index + commit marker | Required |
| Replay token security | Treat as bearer secret; store hashed form; prevent enumeration | Required |
| Retention policy | Define TTL for traces vs "pinned" traces (golden vectors never expire) | Required |

**Retention recommendations:**
```typescript
const RETENTION = {
  DEFAULT_TTL_DAYS: 90,
  PINNED_TTL_DAYS: Infinity,  // Golden vector traces
  FEEDBACK_TTL_DAYS: 365,
};
```

### C. Observability

**Required metrics (per stage):**
- `ade_stage_latency_ms` - Histogram by stage name
- `ade_guardrails_triggered_total` - Counter by rule_id
- `ade_fallback_rate` - Gauge
- `ade_validation_violation_total` - Counter by rule/prohibition

**Structured logging:**
- All logs keyed by `decision_id`
- Include `scenario_id`, `scenario_version`, `execution_mode`
- Log guardrails triggered, fallback reason if applicable

### D. Abuse Controls

| Item | Description | Priority |
|------|-------------|----------|
| Rate limiting | By `user_id` and/or IP at adapter layer | Required |
| Authentication | Even shared key prevents open write to audit store | Required |
| Request validation | Reject malformed requests before engine execution | Required |

---

## Deployment Paths

### Option 1: Local/Node Reference Deployment (Fastest)

Run as a service with local adapters:

```typescript
import { createEngine } from '@ade/engine';

const engine = await createEngine({
  traceEnabled: true,
  // Uses local-audit, local-memory by default
});
```

**Use for:**
- Validating golden vectors in CI
- Generating baseline audit traces
- Proving replay determinism end-to-end

### Option 2: Cloudflare Workers (Canonical Edge Runtime)

Thin HTTP adapter in Workers with:
- **D1** for audit storage
- **KV** for memory storage
- Engine code identical; only adapters swapped

```typescript
// workers/index.ts
import { createEngine, createRouter } from '@ade/engine';
import { D1AuditStore } from './adapters/d1-audit';
import { KVMemoryStore } from './adapters/kv-memory';

export default {
  async fetch(request: Request, env: Env) {
    const engine = await createEngine({
      auditStore: new D1AuditStore(env.DB),
      memoryStore: new KVMemoryStore(env.KV),
    });
    
    const router = createRouter({
      engine,
      auditStore: engine.getAuditStore(),
      version: '1.0.0',
      startTime: Date.now(),
    });
    
    // ... route request
  }
};
```

---

## CI/CD Integration

### Golden Vector Gate

```yaml
# .github/workflows/golden-vectors.yml
name: Golden Vector Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:golden
      - name: Fail on vector drift
        if: failure()
        run: |
          echo "❌ Golden vectors failed - behavior has drifted"
          exit 1
```

### Test Script

```json
// package.json
{
  "scripts": {
    "test:golden": "vitest run --config vitest.golden.config.ts",
    "test:replay": "tsx src/tests/cli/replay-check.ts"
  }
}
```

---

## Security Considerations

### Replay Token Security

Replay tokens are **bearer secrets**. They:
- Encode `decision_id` + `scenario_hash`
- Should be stored hashed in production
- Must not be enumerable (no `/replay/list` endpoint)

### Audit Data Classification

| Field | Classification | Notes |
|-------|---------------|-------|
| `decision_id` | Internal | Never expose to end users |
| `replay_token` | Secret | Treat as bearer token |
| `user_id` | PII | May require redaction |
| `signals` | Sensitive | May contain user behavior data |
| `rationale` | Public | Safe to display to users |

---

## V1 Constraints (Non-Negotiable)

1. **Feedback does not influence decisions** - `learning_applied: false` always
2. **Memory is non-authoritative** - Decisions succeed even if memory unavailable
3. **Skills cannot override selection** - Validators enforce authority boundary
4. **Replay is read-only** - No re-execution, only retrieval

These constraints are **legally important** in regulated domains.

---

## Next Steps After Deployment

1. **Capture baseline audit traces** for all golden vectors
2. **Add replay verification** to CI (assert `determinism_verified === true`)
3. **Monitor fallback rate** - should be near zero in deterministic mode
4. **Collect feedback** (even though not used in V1) for future learning pipeline
