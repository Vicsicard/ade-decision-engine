/**
 * Decision Envelope
 * 
 * The Decision Envelope is the central data structure that flows through
 * all 9 stages of the ADE pipeline. It accumulates stage outputs and
 * enforces the critical invariant: selection locks after Stage 4.
 * 
 * @version 1.0.0
 */

import type {
  DecisionRequest,
  DecisionResponse,
  UserState,
  Action,
  RankedOption,
  DecisionPayload,
  ExecutionMode,
  GuardrailResult,
  ValidationPipelineResult,
} from './types.js';

/**
 * Decision Envelope - immutable after selection lock
 */
export interface DecisionEnvelope {
  // Identity
  readonly decision_id: string;
  readonly request_id: string;
  readonly scenario_id: string;
  readonly scenario_version: string;
  readonly scenario_hash: string;
  
  // Timing
  readonly created_at: string;
  readonly stage_times: Map<number, { start: number; end: number }>;
  
  // Stage 1: Ingest
  readonly request: DecisionRequest;
  readonly normalized_actions: Action[];
  
  // Stage 2: Derive State
  user_state: UserState | null;
  
  // Stage 3: Guardrails
  guardrail_results: GuardrailResult[];
  eligible_actions: Action[];
  forced_action: string | null;
  
  // Stage 4: Score and Rank (SELECTION LOCKS HERE)
  ranked_options: RankedOption[];
  selected_action: string | null;
  selection_locked: boolean;
  selection_locked_at: string | null;
  
  // Stage 5: Skill Resolution
  resolved_skill_id: string | null;
  resolved_skill_version: string | null;
  execution_mode: ExecutionMode;
  
  // Stage 6: Skill Execution
  skill_output: DecisionPayload | null;
  skill_execution_ms: number;
  skill_token_count: number;
  
  // Stage 7: Validation
  validation_result: ValidationPipelineResult | null;
  
  // Stage 8: Fallback
  fallback_triggered: boolean;
  fallback_reason_code: string | null;
  fallback_output: DecisionPayload | null;
  
  // Stage 9: Audit
  replay_token: string | null;
  trace_id: string | null;
}

/**
 * Create a new Decision Envelope from a request
 */
export function createEnvelope(
  request: DecisionRequest,
  scenario_id: string,
  scenario_version: string,
  scenario_hash: string
): DecisionEnvelope {
  const now = new Date().toISOString();
  const decision_id = generateDecisionId();
  
  return {
    // Identity
    decision_id,
    request_id: request.options.execution_mode_override ?? decision_id, // Use decision_id if no request_id
    scenario_id,
    scenario_version,
    scenario_hash,
    
    // Timing
    created_at: now,
    stage_times: new Map(),
    
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
    execution_mode: request.options.execution_mode_override ?? 'deterministic_only',
    
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
    trace_id: null,
  };
}

/**
 * Lock selection - called at end of Stage 4
 * 
 * CRITICAL INVARIANT: Once this is called, selected_action cannot be changed.
 * This function mechanically enforces immutability using Object.freeze.
 */
export function lockSelection(
  envelope: DecisionEnvelope,
  selected_action: string,
  ranked_options: RankedOption[]
): DecisionEnvelope {
  if (envelope.selection_locked) {
    throw new Error('INVARIANT VIOLATION: Selection already locked');
  }
  
  const lockedEnvelope = {
    ...envelope,
    selected_action,
    ranked_options,
    selection_locked: true,
    selection_locked_at: new Date().toISOString(),
  };
  
  // CRITICAL: Mechanically freeze selection-related fields
  // This prevents any downstream stage from mutating the selection
  Object.defineProperty(lockedEnvelope, 'selected_action', {
    writable: false,
    configurable: false,
  });
  Object.defineProperty(lockedEnvelope, 'selection_locked', {
    writable: false,
    configurable: false,
  });
  Object.defineProperty(lockedEnvelope, 'ranked_options', {
    writable: false,
    configurable: false,
  });
  
  // Deep freeze ranked_options array
  Object.freeze(lockedEnvelope.ranked_options);
  for (const option of lockedEnvelope.ranked_options) {
    Object.freeze(option);
  }
  
  return lockedEnvelope;
}

/**
 * Verify selection has not been mutated
 * 
 * Called by validators to ensure downstream stages haven't altered selection.
 */
export function verifySelectionIntegrity(
  envelope: DecisionEnvelope,
  expected_action: string
): boolean {
  if (!envelope.selection_locked) {
    return false;
  }
  return envelope.selected_action === expected_action;
}

/**
 * Get the final payload (skill output or fallback)
 */
export function getFinalPayload(envelope: DecisionEnvelope): DecisionPayload {
  if (envelope.fallback_triggered && envelope.fallback_output) {
    return envelope.fallback_output;
  }
  if (envelope.skill_output) {
    return envelope.skill_output;
  }
  // Emergency fallback - should never reach here in correct implementation
  return {
    rationale: 'Decision made based on your current state.',
  };
}

/**
 * Build final response from envelope
 */
export function buildResponse(envelope: DecisionEnvelope): DecisionResponse {
  if (!envelope.selection_locked || !envelope.selected_action) {
    throw new Error('Cannot build response: selection not locked');
  }
  if (!envelope.user_state) {
    throw new Error('Cannot build response: user state not derived');
  }
  
  const payload = getFinalPayload(envelope);
  const totalDuration = calculateTotalDuration(envelope);
  
  return {
    decision: {
      decision_id: envelope.decision_id,
      selected_action: envelope.selected_action,
      payload,
      ranked_options: envelope.ranked_options,
    },
    state: envelope.user_state,
    execution: {
      execution_mode: envelope.execution_mode,
      skill_id: envelope.resolved_skill_id ?? 'unknown',
      skill_version: envelope.resolved_skill_version ?? '0.0.0',
      validation_status: envelope.validation_result?.valid ? 'passed' : 'failed',
      fallback_used: envelope.fallback_triggered,
      fallback_reason_code: envelope.fallback_reason_code,
    },
    guardrails_applied: envelope.guardrail_results
      .filter(r => r.triggered)
      .map(r => r.rule_id),
    audit: {
      decision_id: envelope.decision_id,
      replay_token: envelope.replay_token ?? '',
      scenario_id: envelope.scenario_id,
      scenario_version: envelope.scenario_version,
      scenario_hash: envelope.scenario_hash,
      trace_id: envelope.trace_id ?? '',
    },
    meta: {
      request_id: envelope.request_id,
      timestamp: new Date().toISOString(),
      total_duration_ms: totalDuration,
      api_version: '1.0.0',
    },
  };
}

/**
 * Generate a UUID v4 for decision_id
 */
function generateDecisionId(): string {
  // Simple UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Calculate total duration from stage times
 */
function calculateTotalDuration(envelope: DecisionEnvelope): number {
  let total = 0;
  for (const [, times] of envelope.stage_times) {
    total += times.end - times.start;
  }
  return total;
}
