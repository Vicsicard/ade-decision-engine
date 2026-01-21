var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-eU7u0T/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-eU7u0T/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// node_modules/ade-decision-engine/dist/core/errors.js
var ADEError = class extends Error {
  code;
  details;
  timestamp;
  constructor(code, message, details) {
    super(message);
    this.name = "ADEError";
    this.code = code;
    this.details = details;
    this.timestamp = (/* @__PURE__ */ new Date()).toISOString();
  }
  toJSON() {
    const result = {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp
    };
    if (this.details !== void 0) {
      result["details"] = this.details;
    }
    return result;
  }
};
__name(ADEError, "ADEError");
var InvalidRequestError = class extends ADEError {
  constructor(message, details) {
    super("INVALID_REQUEST", message, details);
    this.name = "InvalidRequestError";
  }
};
__name(InvalidRequestError, "InvalidRequestError");
var InvalidScenarioError = class extends ADEError {
  constructor(message, details) {
    super("INVALID_SCENARIO", message, details);
    this.name = "InvalidScenarioError";
  }
};
__name(InvalidScenarioError, "InvalidScenarioError");
var InvalidActionTypeError = class extends ADEError {
  constructor(message, details) {
    super("INVALID_ACTION_TYPE", message, details);
    this.name = "InvalidActionTypeError";
  }
};
__name(InvalidActionTypeError, "InvalidActionTypeError");
var NoEligibleActionsError = class extends ADEError {
  constructor(message, details) {
    super("NO_ELIGIBLE_ACTIONS", message, details);
    this.name = "NoEligibleActionsError";
  }
};
__name(NoEligibleActionsError, "NoEligibleActionsError");
var SkillTimeoutError = class extends ADEError {
  constructor(message, details) {
    super("SKILL_TIMEOUT", message, details);
    this.name = "SkillTimeoutError";
  }
};
__name(SkillTimeoutError, "SkillTimeoutError");
var InternalError = class extends ADEError {
  constructor(message, details) {
    super("INTERNAL_ERROR", message, details);
    this.name = "InternalError";
  }
};
__name(InternalError, "InternalError");

// node_modules/ade-decision-engine/dist/core/decision-envelope.js
function createEnvelope(request, scenario_id, scenario_version, scenario_hash) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const decision_id = generateDecisionId();
  return {
    // Identity
    decision_id,
    request_id: request.options.execution_mode_override ?? decision_id,
    // Use decision_id if no request_id
    scenario_id,
    scenario_version,
    scenario_hash,
    // Timing
    created_at: now,
    stage_times: /* @__PURE__ */ new Map(),
    // Stage 1: Ingest
    request,
    normalized_actions: [...request.actions],
    // Stage 2: Derive State
    user_state: null,
    // Stage 3: Guardrails
    guardrail_results: [],
    eligible_actions: [],
    forced_action: null,
    // Stage 4: Score and Rank
    ranked_options: [],
    selected_action: null,
    selection_locked: false,
    selection_locked_at: null,
    // Stage 5: Skill Resolution
    resolved_skill_id: null,
    resolved_skill_version: null,
    execution_mode: request.options.execution_mode_override ?? "deterministic_only",
    // Stage 6: Skill Execution
    skill_output: null,
    skill_execution_ms: 0,
    skill_token_count: 0,
    // Stage 7: Validation
    validation_result: null,
    // Stage 8: Fallback
    fallback_triggered: false,
    fallback_reason_code: null,
    fallback_output: null,
    // Stage 9: Audit
    replay_token: null,
    trace_id: null
  };
}
__name(createEnvelope, "createEnvelope");
function lockSelection(envelope, selected_action, ranked_options) {
  if (envelope.selection_locked) {
    throw new Error("INVARIANT VIOLATION: Selection already locked");
  }
  const lockedEnvelope = {
    ...envelope,
    selected_action,
    ranked_options,
    selection_locked: true,
    selection_locked_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  Object.defineProperty(lockedEnvelope, "selected_action", {
    writable: false,
    configurable: false
  });
  Object.defineProperty(lockedEnvelope, "selection_locked", {
    writable: false,
    configurable: false
  });
  Object.defineProperty(lockedEnvelope, "ranked_options", {
    writable: false,
    configurable: false
  });
  Object.freeze(lockedEnvelope.ranked_options);
  for (const option of lockedEnvelope.ranked_options) {
    Object.freeze(option);
  }
  return lockedEnvelope;
}
__name(lockSelection, "lockSelection");
function getFinalPayload(envelope) {
  if (envelope.fallback_triggered && envelope.fallback_output) {
    return envelope.fallback_output;
  }
  if (envelope.skill_output) {
    return envelope.skill_output;
  }
  return {
    rationale: "Decision made based on your current state."
  };
}
__name(getFinalPayload, "getFinalPayload");
function buildResponse(envelope) {
  if (!envelope.selection_locked || !envelope.selected_action) {
    throw new Error("Cannot build response: selection not locked");
  }
  if (!envelope.user_state) {
    throw new Error("Cannot build response: user state not derived");
  }
  const payload = getFinalPayload(envelope);
  const totalDuration = calculateTotalDuration(envelope);
  return {
    decision: {
      decision_id: envelope.decision_id,
      selected_action: envelope.selected_action,
      payload,
      ranked_options: envelope.ranked_options
    },
    state: envelope.user_state,
    execution: {
      execution_mode: envelope.execution_mode,
      skill_id: envelope.resolved_skill_id ?? "unknown",
      skill_version: envelope.resolved_skill_version ?? "0.0.0",
      validation_status: envelope.validation_result?.valid ? "passed" : "failed",
      fallback_used: envelope.fallback_triggered,
      fallback_reason_code: envelope.fallback_reason_code
    },
    guardrails_applied: envelope.guardrail_results.filter((r) => r.triggered).map((r) => r.rule_id),
    audit: {
      decision_id: envelope.decision_id,
      replay_token: envelope.replay_token ?? "",
      scenario_id: envelope.scenario_id,
      scenario_version: envelope.scenario_version,
      scenario_hash: envelope.scenario_hash,
      trace_id: envelope.trace_id ?? ""
    },
    meta: {
      request_id: envelope.request_id,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      total_duration_ms: totalDuration,
      api_version: "1.0.0"
    }
  };
}
__name(buildResponse, "buildResponse");
function generateDecisionId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
__name(generateDecisionId, "generateDecisionId");
function calculateTotalDuration(envelope) {
  let total = 0;
  for (const [, times] of envelope.stage_times) {
    total += times.end - times.start;
  }
  return total;
}
__name(calculateTotalDuration, "calculateTotalDuration");

// node_modules/ade-decision-engine/dist/storage/memory-store.js
function buildMemoryKey(platform_id, user_id) {
  return `ade:memory:${platform_id}:${user_id}`;
}
__name(buildMemoryKey, "buildMemoryKey");

// node_modules/ade-decision-engine/dist/scenario/loader.js
async function computeScenarioHash(scenario) {
  const content = JSON.stringify(scenario);
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hashHex}`;
}
__name(computeScenarioHash, "computeScenarioHash");

// node_modules/ade-decision-engine/dist/governance/authority-patterns.js
var AUTHORITY_PATTERNS_V1 = {
  version: "1.0.0",
  effective_date: "2026-01-16",
  patterns: [
    {
      id: "AUTH-001",
      description: "No prohibited action fields",
      pattern: /\b(selected_action|recommended_action|alternative_action|action_choice)\b/i,
      severity: "error"
    },
    {
      id: "AUTH-002",
      description: "No recommendation language",
      pattern: /\b(i recommend|you should|instead|better option|consider instead|alternatively)\b/i,
      severity: "error"
    },
    {
      id: "AUTH-003",
      description: "No alternative suggestion",
      pattern: /\b(better option|consider instead|alternatively|other option|different choice)\b/i,
      severity: "error"
    },
    {
      id: "AUTH-004",
      description: "No score reference",
      pattern: /\b(score[ds]?\s*[:=]?\s*\d|ranked?\s+\d|\d+%\s+match|\d+\s*\/\s*\d+\s+rating)\b/i,
      severity: "error"
    },
    {
      id: "AUTH-005",
      description: "No ranking reference",
      pattern: /\b(ranked|top choice|best option|first choice|highest rated|number one)\b/i,
      severity: "error"
    },
    {
      id: "AUTH-006",
      description: "No guardrail commentary",
      pattern: /\b(despite|overriding|ignoring constraint|bypassing|working around)\b/i,
      severity: "error"
    },
    {
      id: "AUTH-007",
      description: "No decision agency claims",
      pattern: /\b(i decided|i chose|we chose for you|i selected|we picked|i determined)\b/i,
      severity: "error"
    }
  ]
};
function checkAuthorityPatterns(text, config = AUTHORITY_PATTERNS_V1) {
  const violations = [];
  for (const pattern of config.patterns) {
    const match = pattern.pattern.exec(text);
    if (match) {
      violations.push({
        pattern_id: pattern.id,
        description: pattern.description,
        matched_text: match[0],
        severity: pattern.severity,
        pattern_version: config.version
      });
    }
  }
  return violations;
}
__name(checkAuthorityPatterns, "checkAuthorityPatterns");

// node_modules/ade-decision-engine/dist/governance/prohibitions.js
var PROHIBITIONS_V1 = {
  version: "1.0.0",
  universal: [
    {
      id: "PROHIB-001",
      category: "decision_override",
      pattern: /\b(i recommend|you should|instead of)\b/i,
      reason: "Decision override language not allowed"
    },
    {
      id: "PROHIB-002",
      category: "medical_claims",
      pattern: /\b(cure|treat|diagnose|medical advice|prescription)\b/i,
      reason: "Medical claims not allowed"
    },
    {
      id: "PROHIB-003",
      category: "legal_claims",
      pattern: /\b(legal advice|legally you|lawsuit|liability)\b/i,
      reason: "Legal claims not allowed"
    },
    {
      id: "PROHIB-004",
      category: "financial_advice",
      pattern: /\b(invest|financial advice|guaranteed return|stock tip)\b/i,
      reason: "Financial advice not allowed"
    },
    {
      id: "PROHIB-005",
      category: "urgency_manipulation",
      pattern: /\b(act now|limited time|don't miss|last chance|urgent)\b/i,
      reason: "Urgency manipulation not allowed"
    },
    {
      id: "PROHIB-006",
      category: "negative_framing",
      pattern: /\b(you failed|you're behind|disappointing|poor performance)\b/i,
      reason: "Negative framing not allowed"
    }
  ],
  pii_patterns: [
    {
      id: "PII-EMAIL",
      category: "pii",
      pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      reason: "Email address detected"
    },
    {
      id: "PII-PHONE",
      category: "pii",
      pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      reason: "Phone number detected"
    },
    {
      id: "PII-SSN",
      category: "pii",
      pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/,
      reason: "SSN pattern detected"
    }
  ]
};
function checkProhibitions(text, config = PROHIBITIONS_V1, include_pii = true) {
  const violations = [];
  for (const prohibition of config.universal) {
    const match = prohibition.pattern.exec(text);
    if (match) {
      violations.push({
        prohibition_id: prohibition.id,
        category: prohibition.category,
        matched_text: match[0],
        reason: prohibition.reason
      });
    }
  }
  if (include_pii) {
    for (const prohibition of config.pii_patterns) {
      const match = prohibition.pattern.exec(text);
      if (match) {
        violations.push({
          prohibition_id: prohibition.id,
          category: prohibition.category,
          matched_text: "[REDACTED]",
          // Don't log actual PII
          reason: prohibition.reason
        });
      }
    }
  }
  return violations;
}
__name(checkProhibitions, "checkProhibitions");

// node_modules/ade-decision-engine/dist/core/pipeline.js
var Pipeline = class {
  config;
  stages = /* @__PURE__ */ new Map();
  constructor(config) {
    this.config = config;
  }
  /**
   * Register a stage implementation
   */
  registerStage(stage, required = true) {
    this.stages.set(stage.stageNumber, { stage, required });
  }
  /**
   * Execute the full 9-stage pipeline
   */
  async run(request) {
    const startTime = performance.now();
    const scenario = this.config.scenarioRegistry.get(
      request.scenario_id,
      "latest"
      // TODO: Support version pinning
    );
    if (!scenario) {
      throw new InvalidScenarioError(`Scenario not found: ${request.scenario_id}`, { scenario_id: request.scenario_id });
    }
    const scenarioHash = await this.getScenarioHash(scenario);
    let envelope = createEnvelope(request, scenario.scenario_id, scenario.version, scenarioHash);
    const context = {
      scenario,
      startTime,
      traceEnabled: this.config.traceEnabled
    };
    const stageTraces = {};
    for (let stageNum = 1; stageNum <= 9; stageNum++) {
      const registration = this.stages.get(stageNum);
      if (!registration) {
        if (stageNum === 8) {
          continue;
        }
        throw new InternalError(`Stage ${stageNum} not registered`, { stage_number: stageNum });
      }
      const stageStart = performance.now();
      try {
        const result = await registration.stage.execute(envelope, context);
        envelope = result.envelope;
        envelope.stage_times.set(stageNum, {
          start: stageStart,
          end: performance.now()
        });
        const stageName = this.getStageName(stageNum);
        stageTraces[stageName] = {
          stage_number: stageNum,
          stage_name: stageName,
          started_at: new Date(stageStart).toISOString(),
          duration_ms: performance.now() - stageStart,
          artifacts: result.artifacts
        };
      } catch (error) {
        if (stageNum >= 6 && stageNum <= 7) {
          envelope = {
            ...envelope,
            fallback_triggered: true,
            fallback_reason_code: error instanceof Error ? error.message : "UNKNOWN_ERROR"
          };
        } else {
          throw error;
        }
      }
    }
    const response = buildResponse(envelope);
    const trace = {
      decision_id: envelope.decision_id,
      scenario_id: scenario.scenario_id,
      scenario_version: scenario.version,
      scenario_hash: scenarioHash,
      timestamp: envelope.created_at,
      request,
      stages: stageTraces,
      final_decision: response,
      total_duration_ms: performance.now() - startTime
    };
    await this.config.auditStore.store(trace);
    return {
      response,
      trace,
      duration_ms: performance.now() - startTime
    };
  }
  /**
   * Get stage name from number
   */
  getStageName(stageNum) {
    const names = {
      1: "ingest",
      2: "derive_state",
      3: "evaluate_guardrails",
      4: "score_and_rank",
      5: "resolve_skills",
      6: "execute_skill",
      7: "validate_output",
      8: "fallback",
      9: "audit_and_replay"
    };
    return names[stageNum] ?? `stage_${stageNum}`;
  }
  /**
   * Get scenario hash
   */
  async getScenarioHash(scenario) {
    const content = JSON.stringify(scenario);
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `sha256:${hashHex}`;
  }
};
__name(Pipeline, "Pipeline");
function createPipeline(config) {
  return new Pipeline(config);
}
__name(createPipeline, "createPipeline");

// node_modules/ade-decision-engine/dist/stages/01-ingest.js
var IngestStage = class {
  stageNumber = 1;
  stageName = "ingest";
  async execute(envelope, context) {
    const startTime = performance.now();
    if (!envelope.decision_id) {
      throw new Error("Decision ID must be generated by createEnvelope, not passed from client");
    }
    this.validateRequest(envelope);
    const normalizedActions = this.normalizeActions(envelope.normalized_actions, context.scenario);
    const updatedEnvelope = {
      ...envelope,
      normalized_actions: normalizedActions
    };
    const artifacts = {
      normalized_request: true,
      action_count: normalizedActions.length,
      signal_count: Object.keys(envelope.request.signals).length
    };
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime
    };
  }
  validateRequest(envelope) {
    const { request } = envelope;
    if (!request.scenario_id) {
      throw new InvalidRequestError("Missing scenario_id");
    }
    if (!request.user_id) {
      throw new InvalidRequestError("Missing user_id");
    }
    if (!request.actions || request.actions.length === 0) {
      throw new InvalidRequestError("No actions provided");
    }
    if (!request.context?.current_time) {
      throw new InvalidRequestError("Missing context.current_time");
    }
  }
  normalizeActions(actions, scenario) {
    const validTypeIds = new Set(scenario.actions.action_types.map((t) => t.type_id));
    const normalized = [];
    for (const action of actions) {
      if (!action.action_id) {
        throw new InvalidRequestError("Action missing action_id");
      }
      if (!action.type_id) {
        throw new InvalidRequestError(`Action ${action.action_id} missing type_id`);
      }
      if (!validTypeIds.has(action.type_id)) {
        throw new InvalidActionTypeError(`Invalid action type: ${action.type_id}`, { action_id: action.action_id, type_id: action.type_id });
      }
      normalized.push({
        action_id: action.action_id,
        type_id: action.type_id,
        attributes: action.attributes ?? {}
      });
    }
    return normalized;
  }
};
__name(IngestStage, "IngestStage");
function createIngestStage() {
  return new IngestStage();
}
__name(createIngestStage, "createIngestStage");

// node_modules/ade-decision-engine/dist/stages/02-derive-state.js
var DeriveStateStage = class {
  stageNumber = 2;
  stageName = "derive_state";
  async execute(envelope, context) {
    const startTime = performance.now();
    const { scenario } = context;
    const { request } = envelope;
    const coreDimensions = this.computeCoreDimensions(scenario.state_schema.core_dimensions, request.signals, request.context);
    const scenarioExtensions = this.computeScenarioDimensions(scenario.state_schema.scenario_dimensions, request.signals, request.context, coreDimensions);
    const userState = {
      state_version: "1.0.0",
      scenario_id: scenario.scenario_id,
      scenario_version: scenario.version,
      core: coreDimensions,
      scenario_extensions: scenarioExtensions,
      execution_capabilities: {
        llm_available: true,
        // TODO: Check actual availability
        max_latency_ms: scenario.execution.timeouts.total_decision_ms,
        offline_mode: false
      },
      computed_at: (/* @__PURE__ */ new Date()).toISOString(),
      inputs_hash: this.computeInputsHash(request.signals, request.context)
    };
    const updatedEnvelope = {
      ...envelope,
      user_state: userState
    };
    const artifacts = {
      core_dimensions_computed: Object.keys(coreDimensions),
      scenario_dimensions_computed: Object.keys(scenarioExtensions),
      memory_accessed: false,
      // TODO: Track memory access
      cold_start: false
      // TODO: Detect cold start
    };
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime
    };
  }
  computeCoreDimensions(definitions, signals, context) {
    const dimensions = {
      engagement_level: 0.5,
      recency_score: 0.5,
      interaction_depth: 0,
      depth_factor: 1,
      churn_risk: 0.5
    };
    for (const [name, def] of Object.entries(definitions)) {
      const value = this.evaluateDimension(def, signals, context, dimensions);
      dimensions[name] = value;
    }
    return dimensions;
  }
  computeScenarioDimensions(definitions, signals, context, coreDimensions) {
    const dimensions = {};
    for (const [name, def] of Object.entries(definitions)) {
      const value = this.evaluateDimension(def, signals, context, coreDimensions);
      dimensions[name] = value;
    }
    return dimensions;
  }
  evaluateDimension(def, signals, context, existingDimensions) {
    switch (def.derivation.source) {
      case "signal":
        return this.getSignalValue(def, signals);
      case "context":
        return this.getContextValue(def, context);
      case "computed":
        return this.computeValue(def, signals, context, existingDimensions);
      default:
        return def.default;
    }
  }
  getSignalValue(def, signals) {
    const match = def.derivation.formula.match(/signals\.(\w+)/);
    if (match) {
      const signalName = match[1];
      const value = signals[signalName];
      if (value !== void 0) {
        return this.clampValue(value, def);
      }
    }
    return def.default;
  }
  getContextValue(def, context) {
    const match = def.derivation.formula.match(/context\.(\w+)/);
    if (match) {
      const contextName = match[1];
      const value = context[contextName];
      if (value !== void 0) {
        return this.clampValue(value, def);
      }
    }
    return def.default;
  }
  computeValue(def, signals, context, existingDimensions) {
    const formula = def.derivation.formula;
    if (formula.includes("if_else")) {
      return this.evaluateIfElse(formula, existingDimensions, def);
    }
    if (formula.includes("coalesce")) {
      return this.evaluateCoalesce(formula, existingDimensions, def);
    }
    return this.evaluateArithmetic(formula, signals, context, existingDimensions, def);
  }
  evaluateIfElse(formula, dimensions, def) {
    const match = formula.match(/if_else\((\w+)\s*<\s*(\d+),\s*([\d.]+),/);
    if (match) {
      const varName = match[1];
      const threshold = parseFloat(match[2]);
      const thenValue = parseFloat(match[3]);
      const actualValue = dimensions[varName] ?? 0;
      if (actualValue < threshold) {
        return thenValue;
      }
    }
    return def.default;
  }
  evaluateCoalesce(formula, dimensions, def) {
    const match = formula.match(/coalesce\(.+,\s*([\d.]+)\)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return def.default;
  }
  evaluateArithmetic(formula, signals, context, dimensions, def) {
    const vars = {};
    for (const [key, value] of Object.entries(signals)) {
      if (typeof value === "number") {
        vars[key] = value;
      }
    }
    for (const [key, value] of Object.entries(dimensions)) {
      if (typeof value === "number") {
        vars[key] = value;
      }
    }
    try {
      let result = formula;
      for (const [name, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\b${name}\\b`, "g"), value.toString());
      }
      const numericResult = this.safeEval(result);
      return this.clampValue(numericResult, def);
    } catch {
      return def.default;
    }
  }
  safeEval(expr) {
    const sanitized = expr.replace(/[^0-9+\-*/().]/g, "");
    if (sanitized !== expr.replace(/\s/g, "")) {
      throw new Error("Invalid expression");
    }
    try {
      const fn = new Function(`return ${sanitized}`);
      const result = fn();
      return typeof result === "number" && !isNaN(result) ? result : 0;
    } catch {
      return 0;
    }
  }
  clampValue(value, def) {
    if (def.range) {
      const min = def.range.min ?? -Infinity;
      const max = def.range.max ?? Infinity;
      return Math.max(min, Math.min(max, value));
    }
    return value;
  }
  computeInputsHash(signals, context) {
    const content = JSON.stringify({ signals, context });
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `hash:${Math.abs(hash).toString(16)}`;
  }
};
__name(DeriveStateStage, "DeriveStateStage");
function createDeriveStateStage() {
  return new DeriveStateStage();
}
__name(createDeriveStateStage, "createDeriveStateStage");

// node_modules/ade-decision-engine/dist/stages/03-evaluate-guardrails.js
var EvaluateGuardrailsStage = class {
  stageNumber = 3;
  stageName = "evaluate_guardrails";
  async execute(envelope, context) {
    const startTime = performance.now();
    const { scenario } = context;
    const userState = envelope.user_state;
    if (!userState) {
      throw new Error("User state not derived before guardrail evaluation");
    }
    const sortedRules = [...scenario.guardrails.rules].sort((a, b) => a.priority - b.priority);
    const results = [];
    const blockedActions = /* @__PURE__ */ new Set();
    let forcedAction = null;
    for (const rule of sortedRules) {
      const triggered = this.evaluateCondition(rule.condition, userState, envelope);
      const result = {
        rule_id: rule.rule_id,
        triggered,
        effect: rule.effect,
        target: rule.target,
        parameters: rule.parameters
      };
      results.push(result);
      if (triggered) {
        switch (rule.effect) {
          case "block_action":
            for (const action of envelope.normalized_actions) {
              if (this.matchesTarget(action, rule.target)) {
                blockedActions.add(action.action_id);
              }
            }
            break;
          case "force_action":
            if (rule.target) {
              const forcedActionObj = envelope.normalized_actions.find((a) => a.type_id === rule.target || a.action_id === rule.target);
              if (forcedActionObj) {
                forcedAction = forcedActionObj.action_id;
              }
            }
            break;
          case "cap_intensity":
            const maxIntensity = rule.parameters?.["max_intensity"];
            if (maxIntensity) {
              for (const action of envelope.normalized_actions) {
                const actionIntensity = action.attributes["intensity"];
                if (this.intensityExceeds(actionIntensity, maxIntensity)) {
                  blockedActions.add(action.action_id);
                }
              }
            }
            break;
        }
      }
    }
    let eligibleActions;
    if (forcedAction) {
      eligibleActions = envelope.normalized_actions.filter((a) => a.action_id === forcedAction);
    } else {
      eligibleActions = envelope.normalized_actions.filter((a) => !blockedActions.has(a.action_id));
    }
    if (eligibleActions.length === 0) {
      throw new NoEligibleActionsError("All actions blocked by guardrails", {
        rules_triggered: results.filter((r) => r.triggered).map((r) => r.rule_id),
        actions_blocked: Array.from(blockedActions)
      });
    }
    const updatedEnvelope = {
      ...envelope,
      guardrail_results: results,
      eligible_actions: eligibleActions,
      forced_action: forcedAction
    };
    const artifacts = {
      rules_evaluated: sortedRules.length,
      rules_triggered: results.filter((r) => r.triggered).map((r) => r.rule_id),
      actions_blocked: Array.from(blockedActions),
      actions_forced: forcedAction,
      eligible_action_count: eligibleActions.length
    };
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime
    };
  }
  evaluateCondition(condition, state, envelope) {
    const context = {
      state: {
        core: state.core,
        scenario_extensions: state.scenario_extensions
      },
      signals: envelope.request.signals,
      memory: {}
      // TODO: Add memory context
    };
    try {
      return this.evaluateExpression(condition, context);
    } catch {
      return false;
    }
  }
  evaluateExpression(expr, context) {
    if (expr.includes("||")) {
      const parts = expr.split("||").map((p) => p.trim());
      return parts.some((part) => this.evaluateExpression(part, context));
    }
    if (expr.includes("&&")) {
      const parts = expr.split("&&").map((p) => p.trim());
      return parts.every((part) => this.evaluateExpression(part, context));
    }
    const match = expr.match(/^([\w.]+)\s*(>=|<=|>|<|==|!=)\s*([\d.]+|true|false|"[^"]*")$/);
    if (!match) {
      return false;
    }
    const [, path, operator, valueStr] = match;
    const actualValue = this.getNestedValue(context, path);
    let compareValue;
    if (valueStr === "true") {
      compareValue = true;
    } else if (valueStr === "false") {
      compareValue = false;
    } else if (valueStr?.startsWith('"')) {
      compareValue = valueStr.slice(1, -1);
    } else {
      compareValue = parseFloat(valueStr);
    }
    switch (operator) {
      case ">=":
        return actualValue >= compareValue;
      case "<=":
        return actualValue <= compareValue;
      case ">":
        return actualValue > compareValue;
      case "<":
        return actualValue < compareValue;
      case "==":
        return actualValue === compareValue;
      case "!=":
        return actualValue !== compareValue;
      default:
        return false;
    }
  }
  getNestedValue(obj, path) {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
      if (current === null || current === void 0) {
        return void 0;
      }
      current = current[part];
    }
    return current;
  }
  matchesTarget(action, target) {
    if (!target || target === "all") {
      return true;
    }
    if (action.action_id === target || action.type_id === target) {
      return true;
    }
    const attrMatch = target.match(/^(\w+)\s*==\s*'([^']+)'$/);
    if (attrMatch) {
      const [, attrName, attrValue] = attrMatch;
      return action.attributes[attrName] === attrValue;
    }
    return false;
  }
  intensityExceeds(actual, max) {
    const levels = {
      "low": 1,
      "moderate": 2,
      "high": 3
    };
    const actualLevel = levels[actual ?? "low"] ?? 1;
    const maxLevel = levels[max] ?? 3;
    return actualLevel > maxLevel;
  }
};
__name(EvaluateGuardrailsStage, "EvaluateGuardrailsStage");
function createEvaluateGuardrailsStage() {
  return new EvaluateGuardrailsStage();
}
__name(createEvaluateGuardrailsStage, "createEvaluateGuardrailsStage");

// node_modules/ade-decision-engine/dist/stages/04-score-and-rank.js
var ScoreAndRankStage = class {
  stageNumber = 4;
  stageName = "score_and_rank";
  async execute(envelope, context) {
    const startTime = performance.now();
    const { scenario } = context;
    const userState = envelope.user_state;
    const eligibleActions = envelope.eligible_actions;
    if (!userState) {
      throw new Error("User state not derived before scoring");
    }
    if (eligibleActions.length === 0) {
      throw new NoEligibleActionsError("No eligible actions to score");
    }
    if (envelope.forced_action) {
      const forcedActionObj = eligibleActions.find((a) => a.action_id === envelope.forced_action);
      if (forcedActionObj) {
        const rankedOptions2 = [{
          action_id: forcedActionObj.action_id,
          rank: 1,
          score: 1,
          score_breakdown: {
            objective_scores: {},
            weighted_sum: 1,
            execution_risk_penalty: 0
          }
        }];
        const lockedEnvelope2 = lockSelection(envelope, forcedActionObj.action_id, rankedOptions2);
        const artifacts2 = {
          objectives_evaluated: [],
          execution_risk_applied: false,
          ranked_actions: rankedOptions2.map((r) => ({
            action_id: r.action_id,
            score: r.score,
            rank: r.rank
          })),
          selected_action: forcedActionObj.action_id,
          selection_locked_at: lockedEnvelope2.selection_locked_at ?? (/* @__PURE__ */ new Date()).toISOString(),
          selection_margin: 0
        };
        return {
          envelope: lockedEnvelope2,
          artifacts: artifacts2,
          duration_ms: performance.now() - startTime
        };
      }
    }
    const scoredActions = [];
    for (const action of eligibleActions) {
      const breakdown = this.scoreAction(action, userState, scenario.scoring.objectives);
      let executionRiskPenalty = 0;
      if (scenario.scoring.execution_risk.enabled) {
        executionRiskPenalty = this.calculateExecutionRisk(action, userState, scenario.scoring.execution_risk);
      }
      const finalScore = breakdown.weighted_sum - executionRiskPenalty;
      scoredActions.push({
        action,
        score: finalScore,
        breakdown: {
          ...breakdown,
          execution_risk_penalty: executionRiskPenalty
        }
      });
    }
    scoredActions.sort((a, b) => b.score - a.score);
    this.applyTieBreaking(scoredActions, scenario.scoring.tie_breaking);
    const rankedOptions = scoredActions.map((sa, index) => ({
      action_id: sa.action.action_id,
      rank: index + 1,
      score: sa.score,
      score_breakdown: sa.breakdown
    }));
    const selectedAction = rankedOptions[0]?.action_id;
    if (!selectedAction) {
      throw new NoEligibleActionsError("No action could be selected");
    }
    const selectionMargin = rankedOptions.length > 1 ? (rankedOptions[0]?.score ?? 0) - (rankedOptions[1]?.score ?? 0) : 1;
    const lockedEnvelope = lockSelection(envelope, selectedAction, rankedOptions);
    const artifacts = {
      objectives_evaluated: scenario.scoring.objectives.map((o) => o.objective_id),
      execution_risk_applied: scenario.scoring.execution_risk.enabled,
      ranked_actions: rankedOptions.map((r) => ({
        action_id: r.action_id,
        score: r.score,
        rank: r.rank
      })),
      selected_action: selectedAction,
      selection_locked_at: lockedEnvelope.selection_locked_at ?? (/* @__PURE__ */ new Date()).toISOString(),
      selection_margin: selectionMargin
    };
    return {
      envelope: lockedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime
    };
  }
  scoreAction(action, state, objectives) {
    const objectiveScores = {};
    let weightedSum = 0;
    for (const objective of objectives) {
      const score = this.evaluateObjective(objective, action, state);
      objectiveScores[objective.objective_id] = score;
      weightedSum += score * objective.weight;
    }
    return {
      objective_scores: objectiveScores,
      weighted_sum: weightedSum,
      execution_risk_penalty: 0
      // Set later
    };
  }
  evaluateObjective(objective, action, state) {
    const context = {
      state: {
        core: state.core,
        scenario_extensions: state.scenario_extensions,
        execution_capabilities: state.execution_capabilities
      },
      action: {
        action_id: action.action_id,
        type_id: action.type_id,
        attributes: action.attributes
      }
    };
    try {
      const score = this.evaluateFormula(objective.formula, context);
      return Math.max(0, Math.min(1, score));
    } catch {
      return 0.5;
    }
  }
  evaluateFormula(formula, context) {
    let expr = formula;
    const pathRegex = /\b(state|action)\.[a-zA-Z_.]+/g;
    const matches = formula.match(pathRegex) ?? [];
    for (const match of matches) {
      const value = this.getNestedValue(context, match);
      if (typeof value === "number") {
        expr = expr.replace(match, value.toString());
      } else {
        expr = expr.replace(match, "0.5");
      }
    }
    try {
      const sanitized = expr.replace(/[^0-9+\-*/().]/g, "");
      if (sanitized.length === 0)
        return 0.5;
      const fn = new Function(`return ${sanitized}`);
      const result = fn();
      return typeof result === "number" && !isNaN(result) ? result : 0.5;
    } catch {
      return 0.5;
    }
  }
  getNestedValue(obj, path) {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
      if (current === null || current === void 0) {
        return void 0;
      }
      current = current[part];
    }
    return current;
  }
  calculateExecutionRisk(action, state, riskConfig) {
    if (!riskConfig.enabled)
      return 0;
    let totalPenalty = 0;
    for (const factor of riskConfig.factors) {
      if (factor.condition.includes("!state.execution_capabilities.llm_available")) {
        if (!state.execution_capabilities.llm_available) {
          totalPenalty += factor.penalty;
        }
      }
    }
    return Math.min(totalPenalty, 1) * riskConfig.weight;
  }
  applyTieBreaking(scoredActions, tieBreakers) {
    for (let i = 0; i < scoredActions.length - 1; i++) {
      const current = scoredActions[i];
      const next = scoredActions[i + 1];
      if (current && next && Math.abs(current.score - next.score) < 1e-3) {
        for (const rule of tieBreakers) {
          const comparison = this.compareTieBreaker(current.action, next.action, rule);
          if (comparison !== 0) {
            if (comparison > 0) {
              scoredActions[i] = next;
              scoredActions[i + 1] = current;
            }
            break;
          }
        }
      }
    }
  }
  compareTieBreaker(a, b, rule) {
    switch (rule) {
      case "action_id_asc":
        return a.action_id.localeCompare(b.action_id);
      case "intensity_asc": {
        const levels = { low: 1, moderate: 2, high: 3 };
        const aLevel = levels[a.attributes["intensity"]] ?? 2;
        const bLevel = levels[b.attributes["intensity"]] ?? 2;
        return aLevel - bLevel;
      }
      case "duration_asc": {
        const aDuration = a.attributes["duration_minutes"] ?? 30;
        const bDuration = b.attributes["duration_minutes"] ?? 30;
        return aDuration - bDuration;
      }
      default:
        return 0;
    }
  }
};
__name(ScoreAndRankStage, "ScoreAndRankStage");
function createScoreAndRankStage() {
  return new ScoreAndRankStage();
}
__name(createScoreAndRankStage, "createScoreAndRankStage");

// node_modules/ade-decision-engine/dist/stages/05-resolve-skills.js
var ResolveSkillsStage = class {
  stageNumber = 5;
  stageName = "resolve_skills";
  async execute(envelope, context) {
    const startTime = performance.now();
    const { scenario } = context;
    if (!envelope.selection_locked || !envelope.selected_action) {
      throw new Error("Selection must be locked before skill resolution");
    }
    const selectedAction = envelope.normalized_actions.find((a) => a.action_id === envelope.selected_action);
    if (!selectedAction) {
      throw new Error(`Selected action not found: ${envelope.selected_action}`);
    }
    const actionType = selectedAction.type_id;
    const executionMode = envelope.request.options.execution_mode_override ?? scenario.execution.default_mode;
    const actionMapping = scenario.skills.action_mappings[actionType];
    const actionTypeConfig = scenario.actions.action_types.find((t) => t.type_id === actionType);
    let primarySkill;
    let fallbackSkill;
    if (actionMapping) {
      primarySkill = actionMapping.primary_skill;
      fallbackSkill = actionMapping.fallback_skill;
    } else if (actionTypeConfig?.skill_mapping) {
      primarySkill = actionTypeConfig.skill_mapping;
      fallbackSkill = scenario.skills.default_fallback;
    } else {
      primarySkill = scenario.skills.default_fallback;
      fallbackSkill = scenario.skills.default_fallback;
    }
    let resolvedSkill;
    let resolutionReason;
    if (executionMode === "deterministic_only") {
      resolvedSkill = fallbackSkill;
      resolutionReason = "mode_override";
    } else {
      const primaryAvailable = this.isSkillAvailable(primarySkill);
      if (primaryAvailable) {
        resolvedSkill = primarySkill;
        resolutionReason = "primary";
      } else {
        resolvedSkill = fallbackSkill;
        resolutionReason = "fallback_unavailable";
      }
    }
    const [skillId, skillVersion] = this.parseSkillReference(resolvedSkill);
    const updatedEnvelope = {
      ...envelope,
      resolved_skill_id: skillId,
      resolved_skill_version: skillVersion,
      execution_mode: executionMode
    };
    const artifacts = {
      action_type: actionType,
      primary_skill: primarySkill,
      fallback_skill: fallbackSkill,
      resolved_skill: resolvedSkill,
      resolution_reason: resolutionReason
    };
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime
    };
  }
  isSkillAvailable(skillRef) {
    const [skillId] = this.parseSkillReference(skillRef);
    if (skillId === "decision_rationale_template") {
      return true;
    }
    return true;
  }
  parseSkillReference(ref) {
    const parts = ref.split("@");
    const skillId = parts[0] ?? ref;
    const version = parts[1] ?? "1.0.0";
    return [skillId, version];
  }
};
__name(ResolveSkillsStage, "ResolveSkillsStage");
function createResolveSkillsStage() {
  return new ResolveSkillsStage();
}
__name(createResolveSkillsStage, "createResolveSkillsStage");

// node_modules/ade-decision-engine/dist/stages/06-execute-skill.js
var ExecuteSkillStage = class {
  stageNumber = 6;
  stageName = "execute_skill";
  executorRegistry;
  constructor(config) {
    this.executorRegistry = config.executorRegistry;
  }
  async execute(envelope, context) {
    const startTime = performance.now();
    if (!envelope.selection_locked || !envelope.selected_action) {
      throw new Error("Selection must be locked before skill execution");
    }
    if (!envelope.resolved_skill_id) {
      throw new Error("Skill must be resolved before execution");
    }
    const { scenario } = context;
    const skillInput = this.buildSkillInput(envelope);
    const executor = this.executorRegistry.get(envelope.execution_mode);
    if (!executor) {
      throw new Error(`No executor available for mode: ${envelope.execution_mode}`);
    }
    const timeout = scenario.execution.timeouts.skill_execution_ms;
    const result = await executor.execute(envelope.resolved_skill_id, envelope.resolved_skill_version ?? "1.0.0", skillInput, timeout);
    if (!result.success || !result.output) {
      throw new SkillTimeoutError(result.error?.message ?? "Skill execution failed", { skill_id: envelope.resolved_skill_id, error: result.error });
    }
    this.verifyNoSelectionOverride(result.output);
    const updatedEnvelope = {
      ...envelope,
      skill_output: result.output.payload,
      skill_execution_ms: result.execution_ms,
      skill_token_count: result.token_count
    };
    const artifacts = {
      skill_id: envelope.resolved_skill_id,
      skill_version: envelope.resolved_skill_version ?? "1.0.0",
      execution_mode: envelope.execution_mode,
      execution_ms: result.execution_ms,
      token_count: result.token_count,
      output_generated: true
    };
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime
    };
  }
  buildSkillInput(envelope) {
    if (!envelope.user_state) {
      throw new Error("User state required for skill input");
    }
    const selectedAction = envelope.normalized_actions.find((a) => a.action_id === envelope.selected_action);
    return {
      decision_context: {
        decision_id: envelope.decision_id,
        selected_action: envelope.selected_action ?? "",
        action_metadata: {
          action_id: selectedAction?.action_id,
          type_id: selectedAction?.type_id,
          name: selectedAction?.type_id,
          // Use type_id as name if no display name
          ...selectedAction?.attributes
        },
        ranked_options: envelope.ranked_options.map((r) => ({
          action_id: r.action_id,
          score: r.score,
          rank: r.rank
        })),
        guardrails_applied: envelope.guardrail_results.filter((r) => r.triggered).map((r) => r.rule_id)
      },
      user_state: {
        core: envelope.user_state.core,
        scenario_extensions: envelope.user_state.scenario_extensions
      },
      skill_config: {
        skill_id: envelope.resolved_skill_id ?? "",
        skill_version: envelope.resolved_skill_version ?? "1.0.0",
        execution_mode: envelope.execution_mode,
        max_output_tokens: 150,
        timeout_ms: 300,
        custom_parameters: {}
      }
    };
  }
  verifyNoSelectionOverride(output) {
    const payload = output.payload;
    const prohibitedFields = [
      "selected_action",
      "recommended_action",
      "alternative_action",
      "action_choice"
    ];
    for (const field of prohibitedFields) {
      if (field in payload) {
        throw new Error(`Skill output contains prohibited field: ${field}`);
      }
    }
  }
};
__name(ExecuteSkillStage, "ExecuteSkillStage");
function createExecuteSkillStage(config) {
  return new ExecuteSkillStage(config);
}
__name(createExecuteSkillStage, "createExecuteSkillStage");

// node_modules/ade-decision-engine/dist/stages/07-validate-output.js
var ValidateOutputStage = class {
  stageNumber = 7;
  stageName = "validate_output";
  async execute(envelope, context) {
    const startTime = performance.now();
    if (!envelope.skill_output) {
      throw new Error("No skill output to validate");
    }
    const skillOutput = {
      payload: envelope.skill_output,
      metadata: {
        skill_id: envelope.resolved_skill_id ?? "",
        skill_version: envelope.resolved_skill_version ?? "1.0.0",
        generated_at: (/* @__PURE__ */ new Date()).toISOString(),
        token_count: envelope.skill_token_count,
        generation_ms: envelope.skill_execution_ms
      }
    };
    const schemaResult = this.validateSchema(skillOutput);
    const invariantsResult = this.validateInvariants(skillOutput, envelope);
    const authorityResult = this.validateAuthorityBoundary(skillOutput);
    const prohibitionsResult = this.validateProhibitions(skillOutput);
    const overallValid = schemaResult.valid && invariantsResult.valid && authorityResult.valid && prohibitionsResult.valid;
    const allViolations = [];
    for (const result of [schemaResult, invariantsResult, authorityResult, prohibitionsResult]) {
      for (const violation of result.violations) {
        allViolations.push({
          check_id: violation.check_id,
          message: violation.message
        });
      }
    }
    const validationResult = {
      valid: overallValid,
      stage_results: {
        schema: schemaResult,
        invariants: invariantsResult,
        authority_boundary: authorityResult,
        prohibitions: prohibitionsResult
      },
      first_failure: overallValid ? null : this.getFirstFailure(schemaResult, invariantsResult, authorityResult, prohibitionsResult),
      total_duration_ms: performance.now() - startTime
    };
    const updatedEnvelope = {
      ...envelope,
      validation_result: validationResult,
      // If validation failed, mark for fallback
      fallback_triggered: !overallValid,
      fallback_reason_code: overallValid ? null : validationResult.first_failure?.check_id ?? "VALIDATION_FAILED"
    };
    const artifacts = {
      schema_valid: schemaResult.valid,
      invariants_valid: invariantsResult.valid,
      authority_valid: authorityResult.valid,
      prohibitions_valid: prohibitionsResult.valid,
      overall_valid: overallValid,
      violations: allViolations
    };
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime
    };
  }
  validateSchema(output) {
    const violations = [];
    const startTime = performance.now();
    if (!output.payload) {
      violations.push({
        check_id: "SCHEMA-001",
        severity: "error",
        message: "Missing payload in skill output"
      });
    }
    if (!output.metadata) {
      violations.push({
        check_id: "SCHEMA-002",
        severity: "error",
        message: "Missing metadata in skill output"
      });
    }
    if (output.payload) {
      const payload = output.payload;
      if (typeof payload["rationale"] === "string") {
        if (payload["rationale"].length > 500) {
          violations.push({
            check_id: "SCHEMA-003",
            severity: "error",
            message: "Rationale exceeds maximum length (500 chars)"
          });
        }
        if (payload["rationale"].length < 5) {
          violations.push({
            check_id: "SCHEMA-004",
            severity: "error",
            message: "Rationale below minimum length (5 chars)"
          });
        }
      }
    }
    return {
      valid: violations.length === 0,
      violations,
      validator_id: "schema",
      duration_ms: performance.now() - startTime
    };
  }
  validateInvariants(output, envelope) {
    const violations = [];
    const startTime = performance.now();
    if (!envelope.selection_locked) {
      violations.push({
        check_id: "INV-001",
        severity: "error",
        message: "Selection must be locked before validation"
      });
    }
    const payload = output.payload;
    const prohibitedFields = ["selected_action", "recommended_action", "alternative_action"];
    for (const field of prohibitedFields) {
      if (field in payload) {
        violations.push({
          check_id: "INV-002",
          severity: "error",
          message: `Payload contains prohibited field: ${field}`,
          path: `payload.${field}`
        });
      }
    }
    if (output.metadata.token_count > 500) {
      violations.push({
        check_id: "INV-003",
        severity: "error",
        message: "Token count exceeds limit (500)"
      });
    }
    return {
      valid: violations.length === 0,
      violations,
      validator_id: "invariants",
      duration_ms: performance.now() - startTime
    };
  }
  validateAuthorityBoundary(output) {
    const violations = [];
    const startTime = performance.now();
    const textToScan = this.extractTextContent(output.payload);
    const authorityViolations = checkAuthorityPatterns(textToScan, AUTHORITY_PATTERNS_V1);
    for (const av of authorityViolations) {
      violations.push({
        check_id: av.pattern_id,
        severity: av.severity,
        message: av.description,
        matched_text: av.matched_text
      });
    }
    return {
      valid: violations.filter((v) => v.severity === "error").length === 0,
      violations,
      validator_id: "authority_boundary",
      duration_ms: performance.now() - startTime
    };
  }
  validateProhibitions(output) {
    const violations = [];
    const startTime = performance.now();
    const textToScan = this.extractTextContent(output.payload);
    const prohibitionViolations = checkProhibitions(textToScan, PROHIBITIONS_V1, true);
    for (const pv of prohibitionViolations) {
      violations.push({
        check_id: pv.prohibition_id,
        severity: "error",
        message: pv.reason,
        matched_text: pv.matched_text
      });
    }
    return {
      valid: violations.length === 0,
      violations,
      validator_id: "prohibitions",
      duration_ms: performance.now() - startTime
    };
  }
  extractTextContent(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }
    const parts = [];
    const obj = payload;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        parts.push(value);
      } else if (typeof value === "object" && value !== null) {
        parts.push(this.extractTextContent(value));
      }
    }
    return parts.join(" ");
  }
  getFirstFailure(...results) {
    for (const result of results) {
      if (!result.valid && result.validator_id === "authority_boundary") {
        const firstViolation = result.violations[0];
        if (firstViolation) {
          return {
            stage: result.validator_id,
            check_id: firstViolation.check_id,
            reason: firstViolation.message
          };
        }
      }
    }
    for (const result of results) {
      if (!result.valid) {
        const firstViolation = result.violations[0];
        if (firstViolation) {
          return {
            stage: result.validator_id,
            check_id: firstViolation.check_id,
            reason: firstViolation.message
          };
        }
      }
    }
    return null;
  }
};
__name(ValidateOutputStage, "ValidateOutputStage");
function createValidateOutputStage() {
  return new ValidateOutputStage();
}
__name(createValidateOutputStage, "createValidateOutputStage");

// node_modules/ade-decision-engine/dist/stages/08-fallback.js
var FallbackStage = class {
  stageNumber = 8;
  stageName = "fallback";
  async execute(envelope, context) {
    const startTime = performance.now();
    if (!envelope.fallback_triggered) {
      const artifacts2 = {
        triggered: false,
        reason_code: "",
        fallback_skill_used: "",
        fallback_output_valid: true
      };
      return {
        envelope,
        artifacts: artifacts2,
        duration_ms: performance.now() - startTime
      };
    }
    const fallbackPayload = this.generateFallbackPayload(envelope, context);
    const fallbackValid = this.validateFallbackOutput(fallbackPayload);
    const updatedEnvelope = {
      ...envelope,
      fallback_output: fallbackPayload
    };
    const artifacts = {
      triggered: true,
      reason_code: envelope.fallback_reason_code ?? "UNKNOWN",
      fallback_skill_used: "decision_rationale_template@1.0.0",
      fallback_output_valid: fallbackValid
    };
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime
    };
  }
  generateFallbackPayload(envelope, context) {
    const selectedAction = envelope.normalized_actions.find((a) => a.action_id === envelope.selected_action);
    const actionName = selectedAction?.type_id ?? "selected action";
    let rationale;
    if (envelope.user_state) {
      const { engagement_level, churn_risk, interaction_depth } = envelope.user_state.core;
      if (interaction_depth < 5) {
        rationale = `Welcome! ${this.capitalize(actionName)} is a great way to get started.`;
      } else if (churn_risk > 0.6) {
        rationale = `${this.capitalize(actionName)} is designed to fit your schedule today.`;
      } else if (engagement_level < 0.3) {
        rationale = `Welcome back! ${this.capitalize(actionName)} is a great way to get started again.`;
      } else if (engagement_level > 0.7) {
        rationale = `Great momentum! ${this.capitalize(actionName)} will help you maintain your progress.`;
      } else {
        rationale = `We selected ${actionName} based on your recent activity and preferences.`;
      }
    } else {
      rationale = `We selected ${actionName} based on your current state.`;
    }
    return {
      rationale,
      display_title: this.capitalize(actionName),
      display_parameters: {
        template_used: "fallback",
        personalization_level: "low",
        fallback_reason: envelope.fallback_reason_code
      }
    };
  }
  validateFallbackOutput(payload) {
    if (!payload.rationale || payload.rationale.length < 5) {
      return false;
    }
    const prohibitedPatterns = [
      /\b(i recommend|you should|instead)\b/i,
      /\b(selected_action|recommended_action)\b/i
    ];
    for (const pattern of prohibitedPatterns) {
      if (pattern.test(payload.rationale)) {
        return false;
      }
    }
    return true;
  }
  capitalize(str) {
    if (!str)
      return str;
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
  }
};
__name(FallbackStage, "FallbackStage");
function createFallbackStage() {
  return new FallbackStage();
}
__name(createFallbackStage, "createFallbackStage");

// node_modules/ade-decision-engine/dist/stages/09-audit-and-replay.js
var AuditAndReplayStage = class {
  stageNumber = 9;
  stageName = "audit_and_replay";
  async execute(envelope, context) {
    const startTime = performance.now();
    const replayToken = this.generateReplayToken(envelope);
    const traceId = this.generateTraceId();
    const updatedEnvelope = {
      ...envelope,
      replay_token: replayToken,
      trace_id: traceId
    };
    const artifacts = {
      trace_stored: true,
      // Actual storage happens in pipeline
      replay_token: replayToken,
      scenario_hash: envelope.scenario_hash,
      trace_id: traceId
    };
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime
    };
  }
  generateReplayToken(envelope) {
    const data = `${envelope.decision_id}:${envelope.scenario_hash}`;
    const encoded = btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    return `rpl_${encoded}`;
  }
  generateTraceId() {
    return `trc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
};
__name(AuditAndReplayStage, "AuditAndReplayStage");
function createAuditAndReplayStage() {
  return new AuditAndReplayStage();
}
__name(createAuditAndReplayStage, "createAuditAndReplayStage");

// node_modules/ade-decision-engine/dist/storage/adapters/local-audit.js
var LocalAuditStore = class {
  traces = /* @__PURE__ */ new Map();
  tokenIndex = /* @__PURE__ */ new Map();
  // replay_token -> decision_id
  async store(trace) {
    this.traces.set(trace.decision_id, trace);
    const replayToken = trace.final_decision.audit.replay_token;
    if (replayToken) {
      this.tokenIndex.set(replayToken, trace.decision_id);
    }
  }
  async retrieve(decision_id) {
    return this.traces.get(decision_id) ?? null;
  }
  async retrieveByToken(replay_token) {
    const decisionId = this.tokenIndex.get(replay_token);
    if (!decisionId)
      return null;
    return this.traces.get(decisionId) ?? null;
  }
  async exists(decision_id) {
    return this.traces.has(decision_id);
  }
  async storeVerification(decision_id, verified) {
    const trace = this.traces.get(decision_id);
    if (trace) {
      trace.determinism_verified = verified;
    }
  }
  /**
   * Clear all traces (for testing)
   */
  clear() {
    this.traces.clear();
    this.tokenIndex.clear();
  }
  /**
   * Get all traces (for testing)
   */
  getAll() {
    return Array.from(this.traces.values());
  }
};
__name(LocalAuditStore, "LocalAuditStore");
function createLocalAuditStore() {
  return new LocalAuditStore();
}
__name(createLocalAuditStore, "createLocalAuditStore");

// node_modules/ade-decision-engine/dist/storage/adapters/local-memory.js
var LocalMemoryStore = class {
  entries = /* @__PURE__ */ new Map();
  async get(platform_id, user_id) {
    const key = buildMemoryKey(platform_id, user_id);
    return this.entries.get(key) ?? null;
  }
  async set(platform_id, user_id, entry) {
    const key = buildMemoryKey(platform_id, user_id);
    this.entries.set(key, entry);
  }
  async delete(platform_id, user_id) {
    const key = buildMemoryKey(platform_id, user_id);
    this.entries.delete(key);
  }
  async exists(platform_id, user_id) {
    const key = buildMemoryKey(platform_id, user_id);
    return this.entries.has(key);
  }
  async getAll(user_id) {
    const result = {};
    for (const [key, entry] of this.entries) {
      if (key.includes(`:${user_id}`)) {
        result[`${key}.schema_version`] = entry.schema_version;
        result[`${key}.scenario_id`] = entry.scenario_id;
        result[`${key}.last_updated`] = entry.last_updated;
        result[`${key}.interaction_history`] = entry.interaction_history;
        if (entry.custom_memory) {
          for (const [k, v] of Object.entries(entry.custom_memory)) {
            result[`custom_memory.${k}`] = v;
          }
        }
      }
    }
    return result;
  }
  /**
   * Clear all entries (for testing)
   */
  clear() {
    this.entries.clear();
  }
  /**
   * Seed memory for testing
   */
  seed(platform_id, user_id, entry) {
    const key = buildMemoryKey(platform_id, user_id);
    this.entries.set(key, entry);
  }
};
__name(LocalMemoryStore, "LocalMemoryStore");
function createLocalMemoryStore() {
  return new LocalMemoryStore();
}
__name(createLocalMemoryStore, "createLocalMemoryStore");

// node_modules/ade-decision-engine/dist/scenario/registry.js
var InMemoryScenarioRegistry = class {
  scenarios = /* @__PURE__ */ new Map();
  hashIndex = /* @__PURE__ */ new Map();
  // hash -> key
  register(scenario, hash) {
    const key = this.buildKey(scenario.scenario_id, scenario.version);
    const existing = this.scenarios.get(key);
    if (existing) {
      for (const [existingHash, existingKey] of this.hashIndex) {
        if (existingKey === key && existingHash !== hash) {
          throw new Error(`Scenario ${scenario.scenario_id}@${scenario.version} hash mismatch: existing=${existingHash}, new=${hash}. Scenarios are immutable once registered.`);
        }
      }
      return;
    }
    this.scenarios.set(key, scenario);
    this.hashIndex.set(hash, key);
  }
  get(scenario_id, version) {
    if (version === "latest") {
      return this.getLatest(scenario_id);
    }
    const key = this.buildKey(scenario_id, version);
    return this.scenarios.get(key) ?? null;
  }
  getByHash(hash) {
    const key = this.hashIndex.get(hash);
    if (!key)
      return null;
    return this.scenarios.get(key) ?? null;
  }
  list() {
    const refs = [];
    for (const [key, scenario] of this.scenarios) {
      let hash = "";
      for (const [h, k] of this.hashIndex) {
        if (k === key) {
          hash = h;
          break;
        }
      }
      refs.push({
        scenario_id: scenario.scenario_id,
        version: scenario.version,
        hash
      });
    }
    return refs;
  }
  getLatest(scenario_id) {
    const versions = [];
    for (const [key, scenario] of this.scenarios) {
      if (key.startsWith(`${scenario_id}@`)) {
        versions.push({ version: scenario.version, scenario });
      }
    }
    if (versions.length === 0)
      return null;
    versions.sort((a, b) => this.compareVersions(b.version, a.version));
    return versions[0]?.scenario ?? null;
  }
  buildKey(scenario_id, version) {
    return `${scenario_id}@${version}`;
  }
  compareVersions(a, b) {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
      if (diff !== 0)
        return diff;
    }
    return 0;
  }
  /**
   * Clear all scenarios (for testing)
   */
  clear() {
    this.scenarios.clear();
    this.hashIndex.clear();
  }
};
__name(InMemoryScenarioRegistry, "InMemoryScenarioRegistry");
function createScenarioRegistry() {
  return new InMemoryScenarioRegistry();
}
__name(createScenarioRegistry, "createScenarioRegistry");

// node_modules/ade-decision-engine/dist/executors/registry.js
var InMemoryExecutorRegistry = class {
  executors = /* @__PURE__ */ new Map();
  register(executor) {
    this.executors.set(executor.type, executor);
  }
  get(mode) {
    return this.executors.get(mode) ?? null;
  }
  isAvailable(mode) {
    const executor = this.executors.get(mode);
    return executor !== void 0 && executor.isAvailable();
  }
  getBestAvailable() {
    const enhanced = this.executors.get("skill_enhanced");
    if (enhanced?.isAvailable()) {
      return enhanced;
    }
    const deterministic = this.executors.get("deterministic_only");
    if (deterministic?.isAvailable()) {
      return deterministic;
    }
    return null;
  }
};
__name(InMemoryExecutorRegistry, "InMemoryExecutorRegistry");
function createExecutorRegistry() {
  return new InMemoryExecutorRegistry();
}
__name(createExecutorRegistry, "createExecutorRegistry");

// node_modules/ade-decision-engine/dist/executors/deterministic-executor.js
var DEFAULT_TEMPLATES = {
  templates: {
    default: {
      template: "We selected {action_name} based on your recent activity and preferences."
    },
    high_engagement: {
      condition: "state.core.engagement_level > 0.7",
      template: "Great momentum! {action_name} will help you maintain your progress."
    },
    low_engagement: {
      condition: "state.core.engagement_level < 0.3",
      template: "Welcome back! {action_name} is a great way to get started again."
    },
    high_churn_risk: {
      condition: "state.core.churn_risk > 0.6",
      template: "{action_name} is designed to fit your schedule today."
    },
    new_user: {
      condition: "state.core.interaction_depth < 5",
      template: "Welcome! {action_name} is a great way to get started."
    }
  },
  priority_order: [
    "high_churn_risk",
    "new_user",
    "low_engagement",
    "high_engagement",
    "default"
  ]
};
var DeterministicExecutor = class {
  type = "deterministic_only";
  templates = /* @__PURE__ */ new Map();
  constructor() {
    this.templates.set("decision_rationale_template", DEFAULT_TEMPLATES);
  }
  isAvailable() {
    return true;
  }
  getLatencyEstimate() {
    return 5;
  }
  async execute(skill_id, skill_version, input, timeout_ms) {
    const startTime = performance.now();
    try {
      const skillTemplates = this.templates.get(skill_id) ?? DEFAULT_TEMPLATES;
      const selectedTemplate = this.selectTemplate(skillTemplates, input);
      const rationale = this.renderTemplate(selectedTemplate.template, input);
      const actionName = this.getActionName(input);
      const payload = {
        rationale,
        display_title: actionName,
        display_parameters: {
          template_used: selectedTemplate.id,
          personalization_level: selectedTemplate.id === "default" ? "none" : "low"
        }
      };
      const output = {
        payload,
        metadata: {
          skill_id,
          skill_version,
          generated_at: (/* @__PURE__ */ new Date()).toISOString(),
          token_count: 0,
          generation_ms: performance.now() - startTime
        }
      };
      return {
        success: true,
        output,
        error: null,
        execution_ms: performance.now() - startTime,
        token_count: 0
      };
    } catch (err) {
      const error = {
        code: "EXECUTION_ERROR",
        message: err instanceof Error ? err.message : "Unknown error"
      };
      return {
        success: false,
        output: null,
        error,
        execution_ms: performance.now() - startTime,
        token_count: 0
      };
    }
  }
  selectTemplate(config, input) {
    for (const templateId of config.priority_order) {
      const template = config.templates[templateId];
      if (!template)
        continue;
      if (!template.condition) {
        return { id: templateId, template: template.template };
      }
      if (this.evaluateCondition(template.condition, input)) {
        return { id: templateId, template: template.template };
      }
    }
    return {
      id: "default",
      template: config.templates["default"]?.template ?? "Decision made based on your current state."
    };
  }
  evaluateCondition(condition, input) {
    const match = condition.match(/^([\w.]+)\s*(>|<|>=|<=|==|!=)\s*([\d.]+)$/);
    if (!match)
      return false;
    const [, path, operator, valueStr] = match;
    const value = parseFloat(valueStr);
    const actual = this.getNestedValue(input, path);
    if (actual === void 0 || actual === null)
      return false;
    const actualNum = typeof actual === "number" ? actual : parseFloat(String(actual));
    switch (operator) {
      case ">":
        return actualNum > value;
      case "<":
        return actualNum < value;
      case ">=":
        return actualNum >= value;
      case "<=":
        return actualNum <= value;
      case "==":
        return actualNum === value;
      case "!=":
        return actualNum !== value;
      default:
        return false;
    }
  }
  getNestedValue(obj, path) {
    const parts = path.split(".");
    let current = obj;
    if (parts[0] === "state" && parts[1]) {
      current = obj.user_state;
      parts.shift();
    }
    for (const part of parts) {
      if (current === null || current === void 0) {
        return void 0;
      }
      current = current[part];
    }
    return current;
  }
  renderTemplate(template, input) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      switch (key) {
        case "action_name":
          return this.getActionName(input);
        case "action_type":
          return String(input.decision_context.action_metadata["type_id"] ?? "action");
        case "action_id":
          return input.decision_context.selected_action;
        default:
          return match;
      }
    });
  }
  getActionName(input) {
    const metadata = input.decision_context.action_metadata;
    const name = metadata["name"] ?? metadata["display_name"] ?? metadata["type_id"] ?? input.decision_context.selected_action;
    return this.formatActionName(String(name));
  }
  formatActionName(name) {
    return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  /**
   * Register custom templates for a skill
   */
  registerTemplates(skill_id, templates) {
    this.templates.set(skill_id, templates);
  }
};
__name(DeterministicExecutor, "DeterministicExecutor");
function createDeterministicExecutor() {
  return new DeterministicExecutor();
}
__name(createDeterministicExecutor, "createDeterministicExecutor");

// node_modules/ade-decision-engine/dist/engine.js
async function createEngine(config = {}) {
  const auditStore = config.auditStore ?? createLocalAuditStore();
  const memoryStore = config.memoryStore ?? createLocalMemoryStore();
  const scenarioRegistry = config.scenarioRegistry ?? createScenarioRegistry();
  const executorRegistry = config.executorRegistry ?? createExecutorRegistry();
  const traceEnabled = config.traceEnabled ?? true;
  const deterministicExecutor = createDeterministicExecutor();
  executorRegistry.register(deterministicExecutor);
  const pipeline = createPipeline({
    scenarioRegistry,
    auditStore,
    memoryStore,
    executorRegistry,
    traceEnabled
  });
  pipeline.registerStage(createIngestStage());
  pipeline.registerStage(createDeriveStateStage());
  pipeline.registerStage(createEvaluateGuardrailsStage());
  pipeline.registerStage(createScoreAndRankStage());
  pipeline.registerStage(createResolveSkillsStage());
  pipeline.registerStage(createExecuteSkillStage({ executorRegistry }));
  pipeline.registerStage(createValidateOutputStage());
  pipeline.registerStage(createFallbackStage(), false);
  pipeline.registerStage(createAuditAndReplayStage());
  return {
    async decide(request) {
      const result = await pipeline.run(request);
      return result.response;
    },
    async registerScenario(scenario) {
      const hash = await computeScenarioHash(scenario);
      scenarioRegistry.register(scenario, hash);
    },
    getPipeline() {
      return pipeline;
    },
    getScenarioRegistry() {
      return scenarioRegistry;
    },
    getAuditStore() {
      return auditStore;
    }
  };
}
__name(createEngine, "createEngine");

// src/index.ts
async function handleHealth(env) {
  return Response.json({
    status: "ok",
    service: "ddr-runtime",
    version: "0.1.0",
    environment: env.ENVIRONMENT,
    scenario: {
      id: env.SCENARIO_ID,
      version: env.SCENARIO_VERSION
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}
__name(handleHealth, "handleHealth");
async function handleDecide(request, env) {
  const startTime = Date.now();
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (!body.user_id || !body.actions || !Array.isArray(body.actions)) {
    return Response.json(
      { error: "Missing required fields: user_id, actions" },
      { status: 400 }
    );
  }
  try {
    const engine = await createEngine();
    const response = await engine.decide({
      scenario_id: env.SCENARIO_ID,
      user_id: body.user_id,
      actions: body.actions,
      signals: body.signals ?? {},
      context: {
        current_time: (/* @__PURE__ */ new Date()).toISOString(),
        timezone: void 0,
        platform_constraints: void 0
      },
      options: {
        execution_mode_override: body.options?.execution_mode_override ?? "deterministic_only",
        include_rationale: body.options?.include_rationale ?? true,
        include_score_breakdown: void 0,
        max_ranked_options: void 0
      }
    });
    const latencyMs = Date.now() - startTime;
    logDecisionEvent(env, {
      id: crypto.randomUUID(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      user_id: body.user_id,
      scenario_id: env.SCENARIO_ID,
      scenario_version: env.SCENARIO_VERSION,
      selected_action_id: response.decision.selected_action,
      decision_code: "APPROVE",
      // Derived from guardrails_applied
      guardrail_flags: JSON.stringify(response.guardrails_applied ?? []),
      latency_ms: latencyMs,
      cohort: env.COHORT_MODE
    }).catch((err) => {
      console.error("[DDR] Failed to log decision event:", err);
    });
    return Response.json({
      decision: response.decision,
      audit: {
        replay_token: response.audit?.replay_token,
        decision_id: response.decision.decision_id,
        scenario_id: env.SCENARIO_ID,
        scenario_version: env.SCENARIO_VERSION,
        latency_ms: latencyMs,
        cohort: env.COHORT_MODE
      }
    });
  } catch (err) {
    console.error("[DDR] Decision error:", err);
    return Response.json(
      { error: "Decision failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
__name(handleDecide, "handleDecide");
async function handleOutcome(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (!body.decision_event_id || !body.user_id || !body.outcome_type) {
    return Response.json(
      { error: "Missing required fields: decision_event_id, user_id, outcome_type" },
      { status: 400 }
    );
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  try {
    await env.DB.prepare(`
      INSERT INTO outcome_events (
        id, timestamp, decision_event_id, user_id, outcome_type, outcome_metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      timestamp,
      body.decision_event_id,
      body.user_id,
      body.outcome_type,
      JSON.stringify(body.outcome_metadata ?? {})
    ).run();
    return Response.json({
      recorded: true,
      timestamp
    });
  } catch (err) {
    console.error("[DDR] Outcome logging error:", err);
    return Response.json(
      { error: "Failed to record outcome", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
__name(handleOutcome, "handleOutcome");
async function handleMetrics(env) {
  try {
    const result = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_decisions,
        COUNT(CASE WHEN decision_code = 'APPROVE' THEN 1 END) as approvals,
        COUNT(CASE WHEN decision_code = 'REFUSE' THEN 1 END) as refusals,
        AVG(latency_ms) as avg_latency_ms,
        cohort
      FROM decision_events
      WHERE timestamp > datetime('now', '-24 hours')
      GROUP BY cohort
    `).all();
    return Response.json({
      period: "24h",
      aggregates: result.results,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("[DDR] Metrics error:", err);
    return Response.json(
      { error: "Metrics unavailable", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
__name(handleMetrics, "handleMetrics");
async function logDecisionEvent(env, event) {
  await env.DB.prepare(`
    INSERT INTO decision_events (
      id, timestamp, user_id, scenario_id, scenario_version,
      selected_action_id, decision_code, guardrail_flags, latency_ms, cohort
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.id,
    event.timestamp,
    event.user_id,
    event.scenario_id,
    event.scenario_version,
    event.selected_action_id,
    event.decision_code,
    event.guardrail_flags,
    event.latency_ms,
    event.cohort
  ).run();
}
__name(logDecisionEvent, "logDecisionEvent");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    let response;
    if (path === "/health" && request.method === "GET") {
      response = await handleHealth(env);
    } else if (path === "/v1/decide" && request.method === "POST") {
      response = await handleDecide(request, env);
    } else if (path === "/v1/outcome" && request.method === "POST") {
      response = await handleOutcome(request, env);
    } else if (path === "/v1/metrics" && request.method === "GET") {
      response = await handleMetrics(env);
    } else {
      response = Response.json(
        { error: "Not found", path },
        { status: 404 }
      );
    }
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-eU7u0T/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-eU7u0T/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
