/**
 * /replay Handler
 * 
 * Handles GET /v1/replay/{decision_id} requests.
 * 
 * @version 1.0.0
 */

import type { AuditTrace } from '../../core/types.js';
import type { AuditStore } from '../../storage/audit-store.js';

export interface ReplayHandlerConfig {
  auditStore: AuditStore;
}

export interface ReplayResult {
  status: number;
  body: ReplayResponse | ErrorResponse;
}

export interface ReplayResponse {
  decision_id: string;
  scenario_id: string;
  scenario_version: string;
  scenario_hash: string;
  timestamp: string;
  request: unknown;
  decision: unknown;
  trace: unknown;
  determinism_verified: boolean | null;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Handle /replay request
 * 
 * IMPORTANT: Replay is a read-only audit surface, not a re-execution surface.
 * This handler MUST NOT mutate state or trigger execution.
 */
export async function handleReplay(
  decision_id: string,
  config: ReplayHandlerConfig
): Promise<ReplayResult> {
  try {
    // Retrieve audit trace
    const trace = await config.auditStore.retrieve(decision_id);
    
    if (!trace) {
      return {
        status: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: `Decision not found: ${decision_id}`,
          },
        },
      };
    }
    
    // Validate trace integrity before returning
    if (!isValidAuditTrace(trace)) {
      return {
        status: 500,
        body: {
          error: {
            code: 'CORRUPT_TRACE',
            message: 'Stored audit trace is invalid or incomplete',
          },
        },
      };
    }
    
    // Build response with immutable trace data
    const response = buildReplayResponse(trace);
    
    return {
      status: 200,
      body: response,
    };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      },
    };
  }
}

/**
 * Handle /replay by token request
 */
export async function handleReplayByToken(
  replay_token: string,
  config: ReplayHandlerConfig
): Promise<ReplayResult> {
  try {
    // Retrieve audit trace by token
    const trace = await config.auditStore.retrieveByToken(replay_token);
    
    if (!trace) {
      return {
        status: 404,
        body: {
          error: {
            code: 'NOT_FOUND',
            message: `Replay token not found: ${replay_token}`,
          },
        },
      };
    }
    
    // Build response
    const response = buildReplayResponse(trace);
    
    return {
      status: 200,
      body: response,
    };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      },
    };
  }
}

/**
 * Validate audit trace integrity
 * 
 * Minimal V1 validation - ensures required fields exist.
 */
function isValidAuditTrace(trace: AuditTrace): boolean {
  if (!trace.decision_id || typeof trace.decision_id !== 'string') return false;
  if (!trace.scenario_id || typeof trace.scenario_id !== 'string') return false;
  if (!trace.scenario_hash || typeof trace.scenario_hash !== 'string') return false;
  if (!trace.timestamp || typeof trace.timestamp !== 'string') return false;
  if (!trace.request) return false;
  if (!trace.final_decision) return false;
  if (!trace.stages) return false;
  return true;
}

/**
 * Build replay response from audit trace
 * 
 * IMPORTANT: Returns deep-cloned trace data to prevent mutation.
 * Audit data must be immutable after retrieval.
 * 
 * Determinism flag semantics:
 * - true  → replay executed and matched
 * - false → replay executed and diverged
 * - null  → replay not yet attempted
 */
function buildReplayResponse(trace: AuditTrace): ReplayResponse {
  return {
    decision_id: trace.decision_id,
    scenario_id: trace.scenario_id,
    scenario_version: trace.scenario_version,
    scenario_hash: trace.scenario_hash,
    timestamp: trace.timestamp,
    request: JSON.parse(JSON.stringify(trace.request)), // Deep clone
    decision: JSON.parse(JSON.stringify(trace.final_decision)), // Deep clone
    trace: JSON.parse(JSON.stringify(trace.stages)), // Deep clone - prevents mutation
    determinism_verified: trace.determinism_verified ?? null,
  };
}
