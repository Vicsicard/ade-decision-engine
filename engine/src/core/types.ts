/**
 * ADE Core Types
 * 
 * Derived directly from V1 canonical specifications.
 * These types define the contracts between all engine components.
 * 
 * @version 1.0.0
 */

// ============================================================================
// DECISION REQUEST (API Input)
// ============================================================================

export interface DecisionRequest {
  scenario_id: string;
  user_id: string;
  actions: Action[];
  signals: Record<string, unknown>;
  context: RequestContext;
  options: RequestOptions;
}

export interface Action {
  action_id: string;
  type_id: string;
  attributes: Record<string, unknown>;
}

export interface RequestContext {
  current_time: string; // ISO8601
  timezone: string | undefined;
  platform_constraints: Record<string, unknown> | undefined;
}

export interface RequestOptions {
  execution_mode_override: ExecutionMode | undefined;
  include_rationale: boolean | undefined;
  include_score_breakdown: boolean | undefined;
  max_ranked_options: number | undefined;
}

export type ExecutionMode = 'deterministic_only' | 'skill_enhanced';

// ============================================================================
// DECISION RESPONSE (API Output)
// ============================================================================

export interface DecisionResponse {
  decision: Decision;
  state: UserState;
  execution: ExecutionInfo;
  guardrails_applied: string[];
  audit: AuditInfo;
  meta: ResponseMeta;
}

export interface Decision {
  decision_id: string;
  selected_action: string;
  payload: DecisionPayload;
  ranked_options: RankedOption[];
}

export interface DecisionPayload {
  rationale?: string;
  display_title?: string;
  display_parameters?: Record<string, unknown>;
}

export interface RankedOption {
  action_id: string;
  rank: number;
  score: number;
  score_breakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  objective_scores: Record<string, number>;
  weighted_sum: number;
  execution_risk_penalty: number;
}

export interface ExecutionInfo {
  execution_mode: ExecutionMode;
  skill_id: string;
  skill_version: string;
  validation_status: 'passed' | 'failed';
  fallback_used: boolean;
  fallback_reason_code: string | null;
}

export interface AuditInfo {
  decision_id: string;
  replay_token: string;
  scenario_id: string;
  scenario_version: string;
  scenario_hash: string;
  trace_id: string;
}

export interface ResponseMeta {
  request_id: string;
  timestamp: string;
  total_duration_ms: number;
  api_version: string;
}

// ============================================================================
// USER STATE
// ============================================================================

export interface UserState {
  state_version: string;
  scenario_id: string;
  scenario_version: string;
  core: CoreStateDimensions;
  scenario_extensions: Record<string, unknown>;
  execution_capabilities: ExecutionCapabilities;
  computed_at: string;
  inputs_hash: string;
}

export interface CoreStateDimensions {
  engagement_level: number;
  recency_score: number;
  interaction_depth: number;
  depth_factor: number;
  churn_risk: number;
  [key: string]: number; // Allow scenario-specific core dimensions
}

export interface ExecutionCapabilities {
  llm_available: boolean;
  max_latency_ms: number;
  offline_mode: boolean;
}

// ============================================================================
// SCENARIO SCHEMA
// ============================================================================

export interface Scenario {
  scenario_id: string;
  version: string;
  metadata: ScenarioMetadata;
  state_schema: StateSchema;
  actions: ActionsConfig;
  guardrails: GuardrailsConfig;
  scoring: ScoringConfig;
  skills: SkillsConfig;
  execution: ExecutionConfig;
}

export interface ScenarioMetadata {
  name: string;
  description: string;
  domain: string;
  created_at: string;
  author: string;
  tags: string[];
}

export interface StateSchema {
  core_dimensions: Record<string, DimensionDefinition>;
  scenario_dimensions: Record<string, DimensionDefinition>;
}

export interface DimensionDefinition {
  type: 'float' | 'integer' | 'boolean' | 'string';
  range?: { min?: number; max?: number };
  default: unknown;
  derivation: DerivationConfig;
  description: string;
}

export interface DerivationConfig {
  source: 'signal' | 'computed' | 'context' | 'memory';
  formula: string;
  inputs: string[];
}

export interface ActionsConfig {
  action_source: 'static' | 'dynamic';
  action_types: ActionType[];
}

export interface ActionType {
  type_id: string;
  display_name: string;
  description: string;
  attributes: Record<string, AttributeDefinition>;
  skill_mapping: string;
}

export interface AttributeDefinition {
  type: string;
  required?: boolean;
  values?: string[];
  range?: { min?: number; max?: number };
  value?: unknown;
}

// ============================================================================
// GUARDRAILS
// ============================================================================

export interface GuardrailsConfig {
  rules: GuardrailRule[];
  fail_behavior: 'reject_action' | 'force_alternative';
}

export interface GuardrailRule {
  rule_id: string;
  description: string;
  condition: string;
  effect: GuardrailEffect;
  target?: string;
  parameters?: Record<string, unknown>;
  priority: number;
}

export type GuardrailEffect = 'block_action' | 'force_action' | 'cap_intensity' | 'require_cooldown';

export interface GuardrailResult {
  rule_id: string;
  triggered: boolean;
  effect: GuardrailEffect;
  target: string | undefined;
  parameters: Record<string, unknown> | undefined;
}

// ============================================================================
// SCORING
// ============================================================================

export interface ScoringConfig {
  objectives: ScoringObjective[];
  execution_risk: ExecutionRiskConfig;
  tie_breaking: string[];
}

export interface ScoringObjective {
  objective_id: string;
  name: string;
  weight: number;
  formula: string;
  inputs: string[];
  description: string;
}

export interface ExecutionRiskConfig {
  enabled: boolean;
  weight: number;
  factors: ExecutionRiskFactor[];
}

export interface ExecutionRiskFactor {
  factor: string;
  condition: string;
  penalty: number;
}

// ============================================================================
// SKILLS
// ============================================================================

export interface SkillsConfig {
  available_skills: SkillReference[];
  action_mappings: Record<string, ActionSkillMapping>;
  default_fallback: string;
}

export interface SkillReference {
  skill_id: string;
  version: string;
}

export interface ActionSkillMapping {
  primary_skill: string;
  fallback_skill: string;
}

export interface SkillExecutionContract {
  skill_id: string;
  version: string;
  type: 'deterministic' | 'llm';
  sec: SECDefinition;
}

export interface SECDefinition {
  sec_version: string;
  input_schema: unknown;
  output_schema: unknown;
  invariants: InvariantsConfig;
  prohibitions: ProhibitionsConfig;
  timeout: TimeoutConfig;
  fallback: SkillReference | null;
}

export interface InvariantsConfig {
  universal: string[];
  skill_specific: SkillInvariant[];
}

export interface SkillInvariant {
  id: string;
  description: string;
  check: string;
}

export interface ProhibitionsConfig {
  universal: boolean;
  skill_specific: SkillProhibition[];
}

export interface SkillProhibition {
  id: string;
  pattern: string;
  reason: string;
}

export interface TimeoutConfig {
  default_ms: number;
  hard_limit_ms: number;
}

// ============================================================================
// EXECUTION CONFIG
// ============================================================================

export interface ExecutionConfig {
  default_mode: ExecutionMode;
  allow_mode_override: boolean;
  timeouts: TimeoutsConfig;
  retry_policy: RetryPolicy;
}

export interface TimeoutsConfig {
  total_decision_ms: number;
  skill_execution_ms: number;
  state_derivation_ms: number;
}

export interface RetryPolicy {
  max_retries: number;
  retry_on: string[];
}

// ============================================================================
// SKILL INPUT/OUTPUT
// ============================================================================

export interface SkillInputEnvelope {
  decision_context: SkillDecisionContext;
  user_state: SkillUserState;
  skill_config: SkillConfig;
}

export interface SkillDecisionContext {
  decision_id: string;
  selected_action: string;
  action_metadata: Record<string, unknown>;
  ranked_options: Array<{ action_id: string; score: number; rank: number }>;
  guardrails_applied: string[];
}

export interface SkillUserState {
  core: CoreStateDimensions;
  scenario_extensions: Record<string, unknown>;
}

export interface SkillConfig {
  skill_id: string;
  skill_version: string;
  execution_mode: ExecutionMode;
  max_output_tokens: number;
  timeout_ms: number;
  custom_parameters: Record<string, unknown>;
}

export interface SkillOutput {
  payload: DecisionPayload;
  metadata: SkillOutputMetadata;
}

export interface SkillOutputMetadata {
  skill_id: string;
  skill_version: string;
  generated_at: string;
  token_count: number;
  generation_ms: number;
  model_id?: string;
}

// ============================================================================
// MEMORY STORE
// ============================================================================

export interface MemoryEntry {
  schema_version: string;
  scenario_id: string;
  last_updated: string;
  interaction_history: InteractionRecord[];
  custom_memory: Record<string, unknown>;
}

export interface InteractionRecord {
  interaction_id: string;
  type: string;
  attributes: Record<string, unknown>;
  completed: boolean;
  completion_pct: number;
  timestamp: string;
}

// ============================================================================
// AUDIT TRACE
// ============================================================================

export interface AuditTrace {
  decision_id: string;
  scenario_id: string;
  scenario_version: string;
  scenario_hash: string;
  
  // Engine version binding for audit-grade reproducibility (Option A)
  // Decisions are cryptographically bound to the engine that executed them
  engine_version: string;
  
  timestamp: string;
  request: DecisionRequest;
  stages: StageTraces;
  final_decision: DecisionResponse;
  total_duration_ms: number;
  determinism_verified?: boolean;
}

export interface StageTraces {
  ingest: StageTrace;
  derive_state: StageTrace;
  evaluate_guardrails: StageTrace;
  score_and_rank: StageTrace;
  resolve_skills: StageTrace;
  execute_skill: StageTrace;
  validate_output: StageTrace;
  fallback: StageTrace | null;
  audit_and_replay: StageTrace;
}

export interface StageTrace {
  stage_number: number;
  stage_name: string;
  started_at: string;
  duration_ms: number;
  input_hash?: string;
  output_hash?: string;
  artifacts: Record<string, unknown>;
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
  validator_id: string;
  duration_ms: number;
}

export interface ValidationViolation {
  check_id: string;
  severity: 'error' | 'warning';
  message: string;
  path?: string;
  matched_text?: string;
}

export interface ValidationPipelineResult {
  valid: boolean;
  stage_results: {
    schema: ValidationResult;
    invariants: ValidationResult;
    authority_boundary: ValidationResult;
    prohibitions: ValidationResult;
  };
  first_failure: {
    stage: string;
    check_id: string;
    reason: string;
  } | null;
  total_duration_ms: number;
}

// ============================================================================
// ERROR CODES
// ============================================================================

export type ADEErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_SCENARIO'
  | 'INVALID_ACTION_TYPE'
  | 'NO_ELIGIBLE_ACTIONS'
  | 'SKILL_TIMEOUT'
  | 'SKILL_VALIDATION_FAILED'
  | 'INTERNAL_ERROR';

export interface ADEError {
  code: ADEErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
