/**
 * /decide Handler
 * 
 * Handles POST /v1/decide requests.
 * 
 * @version 1.0.0
 */

import type { DecisionRequest, DecisionResponse } from '../../core/types.js';
import type { Engine } from '../../engine.js';
import { InvalidRequestError } from '../../core/errors.js';

export interface DecideHandlerConfig {
  engine: Engine;
}

export interface DecideResult {
  status: number;
  body: DecisionResponse | ErrorResponse;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Handle /decide request
 */
export async function handleDecide(
  request: unknown,
  config: DecideHandlerConfig
): Promise<DecideResult> {
  try {
    // Validate request structure
    const decisionRequest = validateRequest(request);
    
    // Execute decision
    const response = await config.engine.decide(decisionRequest);
    
    return {
      status: 200,
      body: response,
    };
    
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Validate incoming request
 */
function validateRequest(request: unknown): DecisionRequest {
  if (!request || typeof request !== 'object') {
    throw new InvalidRequestError('Request body must be an object');
  }
  
  const req = request as Record<string, unknown>;
  
  // Required fields
  if (typeof req['scenario_id'] !== 'string') {
    throw new InvalidRequestError('Missing or invalid scenario_id');
  }
  
  if (typeof req['user_id'] !== 'string') {
    throw new InvalidRequestError('Missing or invalid user_id');
  }
  
  // Actions may be optional for static scenarios
  // The scenario schema, not the handler, decides whether actions are required
  if ('actions' in req && !Array.isArray(req['actions'])) {
    throw new InvalidRequestError('Invalid actions array');
  }
  
  // Validate actions if provided
  const actions = req['actions'] as Array<Record<string, unknown>> | undefined;
  if (actions && Array.isArray(actions)) {
    for (const action of actions) {
      if (!action || typeof action !== 'object') {
        throw new InvalidRequestError('Invalid action in actions array');
      }
      if (typeof action['action_id'] !== 'string') {
        throw new InvalidRequestError('Action missing action_id');
      }
      if (typeof action['type_id'] !== 'string') {
        throw new InvalidRequestError('Action missing type_id');
      }
    }
  }
  
  // Build validated request
  const context = req['context'] as Record<string, unknown> | undefined;
  const options = req['options'] as Record<string, unknown> | undefined;
  
  return {
    scenario_id: req['scenario_id'] as string,
    user_id: req['user_id'] as string,
    actions: req['actions'] as DecisionRequest['actions'],
    signals: (req['signals'] as Record<string, unknown>) ?? {},
    context: {
      current_time: (context?.['current_time'] as string) ?? new Date().toISOString(),
      timezone: context?.['timezone'] as string | undefined,
      platform_constraints: context?.['platform_constraints'] as Record<string, unknown> | undefined,
    },
    options: {
      execution_mode_override: options?.['execution_mode_override'] as DecisionRequest['options']['execution_mode_override'],
      include_rationale: (options?.['include_rationale'] as boolean) ?? true,
      include_score_breakdown: (options?.['include_score_breakdown'] as boolean) ?? false,
      max_ranked_options: options?.['max_ranked_options'] as number | undefined,
    },
  };
}

/**
 * Convert error to response
 */
function handleError(error: unknown): DecideResult {
  if (error instanceof InvalidRequestError) {
    const errorBody: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    if (error.details !== undefined) {
      errorBody.error.details = error.details;
    }
    return {
      status: 400,
      body: errorBody,
    };
  }
  
  // Generic error
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
