/**
 * Stage Interface Contract
 * 
 * Defines the contract that all 9 stages must implement.
 * Each stage receives a DecisionEnvelope and returns an updated envelope.
 * 
 * @version 1.0.0
 */

import type { DecisionEnvelope } from './decision-envelope.js';
import type { Scenario } from './types.js';

/**
 * Stage execution context provided to each stage
 */
export interface StageContext {
  scenario: Scenario;
  startTime: number;
  traceEnabled: boolean;
}

/**
 * Result of stage execution
 */
export interface StageResult<T = unknown> {
  envelope: DecisionEnvelope;
  artifacts: T;
  duration_ms: number;
}

/**
 * Stage interface - all stages must implement this contract
 */
export interface Stage<TArtifacts = unknown> {
  readonly stageNumber: number;
  readonly stageName: string;
  
  execute(
    envelope: DecisionEnvelope,
    context: StageContext
  ): Promise<StageResult<TArtifacts>>;
}

/**
 * Stage 1: Ingest artifacts
 */
export interface IngestArtifacts {
  normalized_request: boolean;
  action_count: number;
  signal_count: number;
}

/**
 * Stage 2: Derive State artifacts
 */
export interface DeriveStateArtifacts {
  core_dimensions_computed: string[];
  scenario_dimensions_computed: string[];
  memory_accessed: boolean;
  cold_start: boolean;
}

/**
 * Stage 3: Evaluate Guardrails artifacts
 */
export interface EvaluateGuardrailsArtifacts {
  rules_evaluated: number;
  rules_triggered: string[];
  actions_blocked: string[];
  actions_forced: string | null;
  eligible_action_count: number;
}

/**
 * Stage 4: Score and Rank artifacts
 * 
 * CRITICAL: Selection locks after this stage
 */
export interface ScoreAndRankArtifacts {
  objectives_evaluated: string[];
  execution_risk_applied: boolean;
  ranked_actions: Array<{ action_id: string; score: number; rank: number }>;
  selected_action: string;
  selection_locked_at: string;
  selection_margin: number;
}

/**
 * Stage 5: Resolve Skills artifacts
 */
export interface ResolveSkillsArtifacts {
  action_type: string;
  primary_skill: string;
  fallback_skill: string;
  resolved_skill: string;
  resolution_reason: 'primary' | 'fallback_unavailable' | 'mode_override';
}

/**
 * Stage 6: Execute Skill artifacts
 */
export interface ExecuteSkillArtifacts {
  skill_id: string;
  skill_version: string;
  execution_mode: 'deterministic_only' | 'skill_enhanced';
  execution_ms: number;
  token_count: number;
  output_generated: boolean;
}

/**
 * Stage 7: Validate Output artifacts
 */
export interface ValidateOutputArtifacts {
  schema_valid: boolean;
  invariants_valid: boolean;
  authority_valid: boolean;
  prohibitions_valid: boolean;
  overall_valid: boolean;
  violations: Array<{ check_id: string; message: string }>;
}

/**
 * Stage 8: Fallback artifacts (null if not triggered)
 */
export interface FallbackArtifacts {
  triggered: boolean;
  reason_code: string;
  fallback_skill_used: string;
  fallback_output_valid: boolean;
}

/**
 * Stage 9: Audit and Replay artifacts
 */
export interface AuditAndReplayArtifacts {
  trace_stored: boolean;
  replay_token: string;
  scenario_hash: string;
  trace_id: string;
}
