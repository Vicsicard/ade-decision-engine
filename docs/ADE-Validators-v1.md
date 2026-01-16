# ADE Validators v1

**Version:** 1.0.0  
**Status:** Canonical  
**Date:** January 16, 2026  
**Depends On:** ADE-Cycle-Definition-v1.md, ADE-Skill-Execution-Contract-v1.md

---

## Overview

This document defines the **Validation Pipeline** for ADE. Validators are deterministic functions that enforce the Skill Execution Contract (SEC) and authority boundaries.

**Core Principles:**
- Validators are **deterministic** — same input always produces same validation result
- Validators are **composable** — multiple checks combine into a pipeline
- Validators are **fail-safe** — rejection triggers fallback, not system failure
- Validators are **auditable** — every check result is logged

**Normative Statement:** Validators are the enforcement mechanism for the SEC. A Skill output that passes validation is considered lawful; one that fails is rejected regardless of content quality.

**Design Note:** Validators must be pure functions with no side effects.

**Defense-in-Depth:** Invariant validators enforce structural legality; authority validators enforce semantic intent. Overlap between INV-001/INV-002 and AUTH-002/AUTH-003/AUTH-005 is intentional to provide defense-in-depth. Do not deduplicate these checks.

---

## Validation Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SKILL OUTPUT                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  V1: SCHEMA VALIDATOR                                                        │
│  JSON Schema conformance check                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                              ┌───────┴───────┐
                         PASS ▼          FAIL ▼ → REJECT
┌─────────────────────────────────────────────────────────────────────────────┐
│  V2: INVARIANT VALIDATOR                                                     │
│  Universal + Skill-specific invariant checks                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                              ┌───────┴───────┐
                         PASS ▼          FAIL ▼ → REJECT
┌─────────────────────────────────────────────────────────────────────────────┐
│  V3: AUTHORITY BOUNDARY VALIDATOR                                            │
│  Ensures output does not attempt to influence action selection              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                              ┌───────┴───────┐
                         PASS ▼          FAIL ▼ → REJECT
┌─────────────────────────────────────────────────────────────────────────────┐
│  V4: PROHIBITION VALIDATOR                                                   │
│  Blocklist pattern matching                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                              ┌───────┴───────┐
                         PASS ▼          FAIL ▼ → REJECT
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VALIDATION PASSED                                    │
│                         Output proceeds to response assembly                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Validation Result Schema

Every validation produces a structured result:

```json
{
  "valid": true,
  "validators_run": ["schema", "invariants", "authority_boundary", "prohibitions"],
  "checks_passed": [
    { "validator": "schema", "check": "json_schema_valid", "passed": true },
    { "validator": "invariants", "check": "INV-001", "passed": true },
    { "validator": "invariants", "check": "INV-002", "passed": true }
  ],
  "checks_failed": [],
  "first_failure": null,
  "validation_duration_ms": 3,
  "timestamp": "ISO8601"
}
```

### On Failure

```json
{
  "valid": false,
  "validators_run": ["schema", "invariants"],
  "checks_passed": [
    { "validator": "schema", "check": "json_schema_valid", "passed": true }
  ],
  "checks_failed": [
    { 
      "validator": "invariants", 
      "check": "INV-001", 
      "passed": false,
      "reason": "Output contains prohibited field 'recommended_action'",
      "evidence": { "field_path": "payload.recommended_action" }
    }
  ],
  "first_failure": {
    "validator": "invariants",
    "check": "INV-001",
    "reason": "Output contains prohibited field 'recommended_action'"
  },
  "validation_duration_ms": 2,
  "timestamp": "ISO8601"
}
```

---

## V1: Schema Validator

**Purpose:** Verify Skill output conforms to the declared JSON Schema in the SEC.

### Input
- Skill output (raw JSON)
- SEC output schema definition

### Checks Performed

| Check ID | Description | Failure Condition |
|----------|-------------|-------------------|
| `SCHEMA-001` | Root type matches | Output is not an object |
| `SCHEMA-002` | Required fields present | Missing required field |
| `SCHEMA-003` | Field types correct | Field has wrong type |
| `SCHEMA-004` | No additional properties | Extra field present (if `additionalProperties: false`) |
| `SCHEMA-005` | String length constraints | String exceeds `maxLength` or below `minLength` |
| `SCHEMA-006` | Numeric constraints | Number outside `minimum`/`maximum` |
| `SCHEMA-007` | Enum constraints | Value not in allowed enum |
| `SCHEMA-008` | Format constraints | String doesn't match format (e.g., `date-time`) |

### Implementation

```typescript
interface SchemaValidatorResult {
  valid: boolean;
  errors: SchemaError[];
}

interface SchemaError {
  check_id: string;
  path: string;
  message: string;
  expected: any;
  actual: any;
}

function validateSchema(
  output: unknown,
  schema: JSONSchema
): SchemaValidatorResult {
  // Use standard JSON Schema validator (e.g., Ajv)
  // Return structured errors with paths
}
```

### Failure Behavior
- On any schema error → validation fails
- All schema errors are collected (not just first)
- Detailed error paths provided for debugging

---

## V2: Invariant Validator

**Purpose:** Verify Skill output satisfies all invariants defined in the SEC.

### Input
- Skill output (validated JSON)
- SEC invariant definitions (universal + skill-specific)
- Decision context (for context-dependent invariants)

### Universal Invariants (Always Checked)

| Invariant ID | Rule | Check Logic |
|--------------|------|-------------|
| `INV-001` | No action selection reference | `payload` must not contain keys: `selected_action`, `recommended_action`, `action_id`, `choose`, `select` |
| `INV-002` | No scoring data | `payload` must not contain keys: `score`, `ranking`, `probability`, `confidence_score`, `likelihood` |
| `INV-003` | No state mutation | `payload` must not contain keys: `state`, `update_state`, `set_state`, `modify` |
| `INV-004` | No guardrail bypass | `payload` must not contain keys: `override`, `bypass`, `ignore_guardrail`, `force` |
| `INV-005` | Self-contained output | `payload` must not contain external URLs or "see more" references |
| `INV-006` | Length limits respected | All string fields within declared `maxLength` |

### Invariant Check Implementation

```typescript
interface InvariantCheckResult {
  invariant_id: string;
  passed: boolean;
  reason?: string;
  evidence?: {
    field_path?: string;
    matched_pattern?: string;
    actual_value?: any;
  };
}

function checkInvariant(
  output: object,
  invariant: InvariantDefinition,
  context: DecisionContext
): InvariantCheckResult {
  // Parse invariant expression
  // Evaluate against output
  // Return structured result
}
```

### Invariant Expression Evaluation

The invariant language (defined in SEC) is evaluated as follows:

| Operator | Implementation |
|----------|----------------|
| `CONTAINS` | `string.includes(substring)` |
| `CONTAINS_ANY` | `list.some(s => string.includes(s))` |
| `NOT CONTAINS` | `!string.includes(substring)` |
| `MATCHES` | `new RegExp(pattern).test(string)` |
| `NOT MATCHES` | `!new RegExp(pattern).test(string)` |
| `IS NULL` | `value === null \|\| value === undefined` |
| `IS NOT NULL` | `value !== null && value !== undefined` |
| `EQUALS` | `value === expected` |
| `LENGTH <` | `string.length < limit` |
| `LENGTH >` | `string.length > limit` |

### Failure Behavior
- Check all invariants (don't stop at first failure)
- Collect all violations for audit
- Return first failure as primary rejection reason

**Note:** If schema validation fails, semantic validators (invariants, authority, prohibitions) are skipped because structure cannot be safely traversed.

---

## V3: Authority Boundary Validator

**Purpose:** Ensure Skill output does not attempt to influence action selection or claim decision authority.

### Input
- Skill output (validated JSON)
- `selected_action` from decision context

### Checks Performed

| Check ID | Description | Detection Method |
|----------|-------------|------------------|
| `AUTH-001` | No prohibited action fields | Explicit denylist: `selected_action`, `recommended_action`, `alternative_action`, `action_choice`. Allowed: `action_metadata`, `action_name`, `action_label` |
| `AUTH-002` | No recommendation language | Regex scan for "I recommend", "you should", "instead" |
| `AUTH-003` | No alternative suggestion | Regex scan for "better option", "consider instead", "alternatively" |
| `AUTH-004` | No score reference | Regex scan for numeric scores or percentages in decision context |
| `AUTH-005` | No ranking reference | Regex scan for "ranked", "top choice", "best option" |
| `AUTH-006` | No guardrail commentary | Regex scan for "despite", "overriding", "ignoring constraint" |

### Authority Boundary Patterns (Regex)

```json
{
  "authority_violation_patterns": [
    {
      "id": "AUTH-002",
      "pattern": "(?i)(i recommend|you should|i suggest|instead of|rather than)",
      "description": "Recommendation language"
    },
    {
      "id": "AUTH-003",
      "pattern": "(?i)(better option|consider instead|alternatively|other choice)",
      "description": "Alternative suggestion"
    },
    {
      "id": "AUTH-004",
      "pattern": "\\b\\d+(\\.\\d+)?\\s*(%|percent|score|rating)\\b",
      "description": "Numeric score reference"
    },
    {
      "id": "AUTH-005",
      "pattern": "(?i)(ranked|top choice|best option|highest score|first choice)",
      "description": "Ranking reference"
    },
    {
      "id": "AUTH-006",
      "pattern": "(?i)(despite|overriding|ignoring|bypassing)\\s+(constraint|guardrail|rule|limit)",
      "description": "Guardrail commentary"
    }
  ]
}
```

### Implementation

```typescript
function validateAuthorityBoundary(
  output: object,
  selectedAction: string,
  patterns: AuthorityPattern[]
): AuthorityValidatorResult {
  const violations: AuthorityViolation[] = [];
  
  // Recursively scan all string values in output
  const strings = extractAllStrings(output);
  
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.pattern);
    for (const { path, value } of strings) {
      if (regex.test(value)) {
        violations.push({
          check_id: pattern.id,
          path,
          matched_text: value.match(regex)?.[0],
          description: pattern.description
        });
      }
    }
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}
```

### Failure Behavior
- Any authority violation → immediate rejection
- Log matched pattern and text for audit
- This is the most critical validator — false negatives are unacceptable

### Authority Pattern Governance

Authority patterns define semantic decision boundaries. They are **policy instruments**, not business logic. Governance ensures they evolve safely without breaking determinism, replay integrity, or audit defensibility.

#### 1. Pattern Versioning

Authority patterns are versioned independently from ADE core.

```json
{
  "authority_patterns": {
    "version": "1.0.0",
    "effective_date": "2026-01-16",
    "patterns": [ ]
  }
}
```

**Rules:**
- Pattern version changes do **not** change ADE engine version
- Pattern updates are non-breaking by default
- Pattern version used **MUST** be logged in the audit trace

#### 2. Determinism & Replay Guarantees

Authority patterns do not participate in decision selection and therefore:
- Do **not** affect `selected_action`
- Do **not** affect scoring, ranking, or guardrails
- Do **not** invalidate historical replay correctness

**Replay Rule:**
> Deterministic replay verifies decision outcome, not validator pass/fail parity across time.

If authority patterns change:
- Old decisions remain valid
- Replays may surface different validation outcomes, but `selected_action` must remain identical

This distinction is intentional and canonical.

#### 3. Pattern Update Policy

Authority pattern changes are classified as **policy updates**, not code changes.

| Change Type | Allowed | Requires |
|-------------|---------|----------|
| Add new pattern | ✅ | Regression tests |
| Tighten regex | ✅ | Regression tests |
| Relax regex | ⚠️ | Explicit approval |
| Remove pattern | ❌ | Major version + review |
| Change severity | ⚠️ | Audit note |

**Hard Rule:** Patterns may only become more restrictive in minor updates.

#### 4. Regression Testing Requirements

Every authority pattern update **MUST** include:

- **Known-good corpus** — Previously accepted Skill outputs; must continue to pass
- **Known-bad corpus** — Previously rejected outputs; must continue to fail
- **False-positive scan** — Ensure no legitimate phrasing is incorrectly rejected

Test results **MUST** be stored with the pattern version.

#### 5. Audit & Trace Requirements

For every decision:
- Authority pattern version **MUST** be logged
- Any matched pattern **MUST** record:
  - Pattern ID
  - Matched text
  - Output path
  - Pattern version

This ensures:
- Regulator traceability
- Policy change explainability
- False-positive root cause analysis

#### 6. Precedence Rules

If multiple validators fail, canonical precedence order:

1. **Authority Boundary Violations** (highest)
2. **Invariant Violations**
3. **Prohibition Violations**
4. **Schema Violations** (structural)

**Fallback Reason Code Rule:** If an authority boundary violation is present, it **MUST** be used as the primary fallback reason, regardless of other failures. Authority violations represent governance breaches and take precedence.

#### 7. Security & Change Control

Authority pattern changes:
- Must be reviewed by a designated policy owner
- Must be logged with author, timestamp, and rationale
- Must **not** be modified at runtime (deploy-time only in V1)

Runtime pattern mutation is explicitly out of scope for V1.

#### Canonical Statement

> Authority patterns define what a Skill is allowed to say — not what ADE decides.
>
> They may evolve over time, but they may never rewrite history, never alter selection, and never weaken the authority boundary.

---

## V4: Prohibition Validator

**Purpose:** Detect and reject outputs containing prohibited content.

### Input
- Skill output (validated JSON)
- SEC prohibition definitions (universal + skill-specific)

### Universal Prohibitions

| Prohibition ID | Category | Pattern |
|----------------|----------|---------|
| `PROHIB-001` | Decision override | `(?i)(i recommend|you should|instead of)` |
| `PROHIB-002` | Medical claims | `(?i)(cure|treat|diagnose|medical advice|prescription)` |
| `PROHIB-003` | Legal claims | `(?i)(legal advice|legally you|lawsuit|liability)` |
| `PROHIB-004` | Financial advice | `(?i)(invest|financial advice|guaranteed return|stock tip)` |
| `PROHIB-005` | Urgency manipulation | `(?i)(act now|limited time|don't miss|last chance|urgent)` |
| `PROHIB-006` | Negative framing | `(?i)(you failed|you're behind|disappointing|poor performance)` |
| `PROHIB-007` | Competitor mention | Configurable per scenario |
| `PROHIB-008` | PII echo | Patterns for email, phone, SSN, etc. |

### PII Detection Patterns

```json
{
  "pii_patterns": [
    {
      "id": "PII-EMAIL",
      "pattern": "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      "description": "Email address"
    },
    {
      "id": "PII-PHONE",
      "pattern": "\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b",
      "description": "Phone number"
    },
    {
      "id": "PII-SSN",
      "pattern": "\\b\\d{3}-\\d{2}-\\d{4}\\b",
      "description": "Social Security Number"
    }
  ]
}
```

### Implementation

```typescript
function validateProhibitions(
  output: object,
  prohibitions: ProhibitionDefinition[]
): ProhibitionValidatorResult {
  const violations: ProhibitionViolation[] = [];
  
  const strings = extractAllStrings(output);
  
  for (const prohibition of prohibitions) {
    const regex = new RegExp(prohibition.pattern);
    for (const { path, value } of strings) {
      if (regex.test(value)) {
        violations.push({
          prohibition_id: prohibition.id,
          path,
          matched_text: value.match(regex)?.[0],
          category: prohibition.category,
          reason: prohibition.reason
        });
      }
    }
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}
```

### Failure Behavior
- Any prohibition match → rejection
- Log prohibition ID and matched text
- Skill-specific prohibitions override universal (can be more restrictive)

**Note:** For precedence rules when multiple validators fail, see Authority Pattern Governance § 6.

---

## Validation Pipeline Orchestration

### Pipeline Execution

```typescript
interface ValidationPipelineResult {
  valid: boolean;
  stage_results: {
    schema: SchemaValidatorResult;
    invariants: InvariantValidatorResult;
    authority_boundary: AuthorityValidatorResult;
    prohibitions: ProhibitionValidatorResult;
  };
  first_failure?: {
    stage: string;
    check_id: string;
    reason: string;
  };
  total_duration_ms: number;
}

function runValidationPipeline(
  output: unknown,
  sec: SkillExecutionContract,
  context: DecisionContext
): ValidationPipelineResult {
  const startTime = Date.now();
  const results: ValidationPipelineResult = {
    valid: true,
    stage_results: {},
    total_duration_ms: 0
  };
  
  // V1: Schema
  results.stage_results.schema = validateSchema(output, sec.output_schema);
  if (!results.stage_results.schema.valid) {
    results.valid = false;
    results.first_failure = {
      stage: "schema",
      check_id: results.stage_results.schema.errors[0].check_id,
      reason: results.stage_results.schema.errors[0].message
    };
    // Continue to collect all errors for audit
  }
  
  // V2: Invariants (only if schema passed - need valid structure)
  if (results.stage_results.schema.valid) {
    results.stage_results.invariants = validateInvariants(
      output as object,
      sec.invariants,
      context
    );
    if (!results.stage_results.invariants.valid && results.valid) {
      results.valid = false;
      results.first_failure = {
        stage: "invariants",
        check_id: results.stage_results.invariants.failures[0].invariant_id,
        reason: results.stage_results.invariants.failures[0].reason
      };
    }
  }
  
  // V3: Authority Boundary
  if (results.stage_results.schema.valid) {
    results.stage_results.authority_boundary = validateAuthorityBoundary(
      output as object,
      context.selected_action,
      AUTHORITY_PATTERNS
    );
    if (!results.stage_results.authority_boundary.valid && results.valid) {
      results.valid = false;
      results.first_failure = {
        stage: "authority_boundary",
        check_id: results.stage_results.authority_boundary.violations[0].check_id,
        reason: results.stage_results.authority_boundary.violations[0].description
      };
    }
  }
  
  // V4: Prohibitions
  if (results.stage_results.schema.valid) {
    results.stage_results.prohibitions = validateProhibitions(
      output as object,
      [...UNIVERSAL_PROHIBITIONS, ...sec.prohibitions.skill_specific]
    );
    if (!results.stage_results.prohibitions.valid && results.valid) {
      results.valid = false;
      results.first_failure = {
        stage: "prohibitions",
        check_id: results.stage_results.prohibitions.violations[0].prohibition_id,
        reason: results.stage_results.prohibitions.violations[0].reason
      };
    }
  }
  
  results.total_duration_ms = Date.now() - startTime;
  return results;
}
```

### Pipeline Invariants

| Rule | Description |
|------|-------------|
| All validators run | Even after first failure, continue to collect all violations |
| Order is fixed | Schema → Invariants → Authority → Prohibitions |
| Schema gates others | If schema fails, structural validators skip (can't traverse invalid JSON) |
| First failure recorded | `first_failure` captures the rejection reason for fallback |

---

## Rejection Handling

### On Validation Failure

```
1. Record full ValidationPipelineResult in audit trace
2. Extract first_failure for fallback reason code
3. Trigger Stage 8 (Fallback) with:
   - fallback_reason_code = first_failure.stage + ":" + first_failure.check_id
   - original_output_hash = sha256(rejected_output)
   - validation_errors = all collected failures
4. Fallback skill executes
5. Fallback output is validated (should always pass by design)
6. If fallback also fails → catastrophic error (should never happen)
```

### Rejection Reason Codes

| Code Format | Example | Meaning |
|-------------|---------|---------|
| `schema:{check_id}` | `schema:SCHEMA-002` | Missing required field |
| `invariant:{inv_id}` | `invariant:INV-001` | Action reference in output |
| `authority:{check_id}` | `authority:AUTH-002` | Recommendation language detected |
| `prohibition:{prohib_id}` | `prohibition:PROHIB-002` | Medical claim detected |

---

## Validator Configuration

### Global Validator Config

```json
{
  "validator_config": {
    "version": "1.0.0",
    "schema_validator": {
      "strict_mode": true,
      "allow_additional_properties": false,
      "coerce_types": false
    },
    "invariant_validator": {
      "universal_invariants_enabled": true,
      "fail_fast": false
    },
    "authority_validator": {
      "patterns_version": "1.0.0",
      "case_sensitive": false
    },
    "prohibition_validator": {
      "universal_prohibitions_enabled": true,
      "pii_detection_enabled": true
    },
    "pipeline": {
      "continue_on_failure": true,
      "max_duration_ms": 50
    }
  }
}
```

### Per-Scenario Overrides

Scenarios may add stricter prohibitions but cannot weaken universal rules:

```json
{
  "scenario_validator_overrides": {
    "additional_prohibitions": [
      {
        "id": "SCENARIO-PROHIB-001",
        "pattern": "(?i)(competitor_name)",
        "reason": "Competitor mention not allowed"
      }
    ],
    "additional_invariants": [
      {
        "id": "SCENARIO-INV-001",
        "expression": "payload.rationale LENGTH < 100",
        "reason": "Rationale must be brief for this scenario"
      }
    ]
  }
}
```

---

## Testing Requirements

### Unit Tests per Validator

| Validator | Test Cases |
|-----------|------------|
| Schema | Valid output passes, missing field fails, wrong type fails, extra field fails |
| Invariants | Each INV-00X has positive and negative test |
| Authority | Each AUTH-00X pattern has match and non-match test |
| Prohibitions | Each PROHIB-00X pattern has match and non-match test |

### Integration Tests

| Test | Description |
|------|-------------|
| Full pipeline pass | Valid output passes all validators |
| Schema failure | Invalid JSON structure triggers fallback |
| Invariant failure | Authority violation triggers fallback |
| Multiple failures | All failures collected even after first |
| Fallback validation | Fallback output always passes |

### Regression Tests

After any pattern update:
1. Run full test suite
2. Verify no false positives on known-good outputs
3. Verify detection of known-bad outputs
4. Document any pattern changes in changelog

---

## Performance Requirements

| Metric | Target | Hard Limit |
|--------|--------|------------|
| Schema validation | 1ms | 5ms |
| Invariant validation | 1ms | 5ms |
| Authority validation | 1ms | 5ms |
| Prohibition validation | 1ms | 5ms |
| **Total pipeline** | **4ms** | **20ms** |

### Performance Notes
- Regex patterns are pre-compiled at startup
- JSON Schema is pre-compiled at startup
- No network calls during validation
- No file I/O during validation

---

## Audit Requirements

### What Gets Logged

Every validation produces an audit record:

```json
{
  "audit_type": "validation",
  "decision_id": "uuid",
  "skill_id": "...",
  "skill_version": "...",
  "timestamp": "ISO8601",
  "input_hash": "sha256",
  "output_hash": "sha256",
  "result": {
    "valid": true,
    "validators_run": ["schema", "invariants", "authority_boundary", "prohibitions"],
    "checks_passed": [...],
    "checks_failed": [...],
    "first_failure": null
  },
  "duration_ms": 3
}
```

### Retention
- Validation audit records retained with decision trace (default 90 days)
- Failed validations flagged for review
- Pattern match evidence stored for debugging

---

## What Flows From This Specification

| Artifact | Status |
|----------|--------|
| Validator implementation | Unblocked |
| SEC validation tooling | Unblocked |
| Scenario schema (validator overrides) | Unblocked |
| Fallback trigger logic | Defined above |
| Audit schema (validation section) | Defined above |

---

## Appendix A: Complete Universal Invariant List

```json
{
  "universal_invariants": [
    {
      "id": "INV-001",
      "description": "No action selection reference",
      "expression": "payload NOT CONTAINS_KEYS ['selected_action', 'recommended_action', 'action_id', 'choose', 'select']",
      "severity": "critical"
    },
    {
      "id": "INV-002",
      "description": "No scoring data",
      "expression": "payload NOT CONTAINS_KEYS ['score', 'ranking', 'probability', 'confidence_score', 'likelihood']",
      "severity": "critical"
    },
    {
      "id": "INV-003",
      "description": "No state mutation",
      "expression": "payload NOT CONTAINS_KEYS ['state', 'update_state', 'set_state', 'modify']",
      "severity": "critical"
    },
    {
      "id": "INV-004",
      "description": "No guardrail bypass",
      "expression": "payload NOT CONTAINS_KEYS ['override', 'bypass', 'ignore_guardrail', 'force']",
      "severity": "critical"
    },
    {
      "id": "INV-005",
      "description": "Self-contained output",
      "expression": "payload.* NOT MATCHES 'https?://' AND payload.* NOT CONTAINS 'see more'",
      "severity": "high"
    },
    {
      "id": "INV-006",
      "description": "Length limits respected",
      "expression": "ALL string fields within declared maxLength",
      "severity": "medium"
    }
  ]
}
```

---

## Appendix B: Complete Universal Prohibition List

```json
{
  "universal_prohibitions": [
    {
      "id": "PROHIB-001",
      "category": "authority",
      "pattern": "(?i)(i recommend|you should|instead of|i suggest)",
      "reason": "Decision override attempt"
    },
    {
      "id": "PROHIB-002",
      "category": "medical",
      "pattern": "(?i)(cure|treat|diagnose|medical advice|prescription|symptom)",
      "reason": "Medical claim"
    },
    {
      "id": "PROHIB-003",
      "category": "legal",
      "pattern": "(?i)(legal advice|legally you|lawsuit|liability|attorney)",
      "reason": "Legal claim"
    },
    {
      "id": "PROHIB-004",
      "category": "financial",
      "pattern": "(?i)(invest|financial advice|guaranteed return|stock|trading tip)",
      "reason": "Financial advice"
    },
    {
      "id": "PROHIB-005",
      "category": "manipulation",
      "pattern": "(?i)(act now|limited time|don't miss|last chance|urgent|hurry)",
      "reason": "Urgency manipulation"
    },
    {
      "id": "PROHIB-006",
      "category": "negative",
      "pattern": "(?i)(you failed|you're behind|disappointing|poor performance|not good enough)",
      "reason": "Negative framing"
    },
    {
      "id": "PROHIB-007",
      "category": "pii",
      "pattern": "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      "reason": "Email address detected"
    },
    {
      "id": "PROHIB-008",
      "category": "pii",
      "pattern": "\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b",
      "reason": "Phone number detected"
    }
  ]
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-16 | Initial specification |
