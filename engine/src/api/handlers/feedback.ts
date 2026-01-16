/**
 * /feedback Handler
 * 
 * Handles POST /v1/feedback requests.
 * Accepts outcome signals for decisions. Learning is out of scope for V1.
 * 
 * IMPORTANT V1 CONSTRAINT:
 * Feedback MUST NOT mutate MemoryStore or influence future decisions.
 * This handler accepts and acknowledges feedback only.
 * 
 * @version 1.0.0
 */

import type { AuditStore } from '../../storage/audit-store.js';

export interface FeedbackHandlerConfig {
  auditStore: AuditStore;
}

export interface FeedbackRequest {
  decision_id: string;
  outcome: OutcomeSignal;
  timestamp: string | undefined;
}

export interface OutcomeSignal {
  completed: boolean;
  completion_pct: number | undefined;
  duration_seconds: number | undefined;
  user_rating: number | undefined;
  custom_signals: Record<string, unknown> | undefined;
}

export interface FeedbackResult {
  status: number;
  body: FeedbackResponse | ErrorResponse;
}

export interface FeedbackResponse {
  accepted: boolean;
  decision_id: string;
  timestamp: string;
  meta: {
    learning_applied: boolean;
    feedback_schema_version: string;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Handle /feedback request
 * 
 * V1: Accept and acknowledge feedback. Learning is not implemented.
 * Feedback MUST NOT mutate MemoryStore or influence future decisions.
 */
export async function handleFeedback(
  request: unknown,
  config: FeedbackHandlerConfig
): Promise<FeedbackResult> {
  try {
    // Validate request
    const feedbackRequest = validateFeedbackRequest(request);
    
    // V1: Validate decision_id exists (soft check, no mutation)
    // This prevents poisoning future learning pipelines with garbage feedback
    const exists = await config.auditStore.exists(feedbackRequest.decision_id);
    if (!exists) {
      return {
        status: 404,
        body: {
          error: {
            code: 'DECISION_NOT_FOUND',
            message: 'Unknown decision_id',
          },
        },
      };
    }
    
    // Normalize timestamp to prevent malformed client clocks
    const timestamp = feedbackRequest.timestamp
      ? new Date(feedbackRequest.timestamp).toISOString()
      : new Date().toISOString();
    
    // V1: Accept feedback but don't process it
    // Future: Store feedback for learning pipeline
    
    return {
      status: 202, // Accepted
      body: {
        accepted: true,
        decision_id: feedbackRequest.decision_id,
        timestamp,
        meta: {
          learning_applied: false, // V1: No learning, explicit guarantee
          feedback_schema_version: '1.0.0',
        },
      },
    };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_REQUEST',
          message,
        },
      },
    };
  }
}

/**
 * Validate feedback request
 */
function validateFeedbackRequest(request: unknown): FeedbackRequest {
  if (!request || typeof request !== 'object') {
    throw new Error('Request body must be an object');
  }
  
  const req = request as Record<string, unknown>;
  
  if (typeof req['decision_id'] !== 'string') {
    throw new Error('Missing or invalid decision_id');
  }
  
  if (!req['outcome'] || typeof req['outcome'] !== 'object') {
    throw new Error('Missing or invalid outcome');
  }
  
  const outcome = req['outcome'] as Record<string, unknown>;
  
  if (typeof outcome['completed'] !== 'boolean') {
    throw new Error('outcome.completed must be a boolean');
  }
  
  return {
    decision_id: req['decision_id'] as string,
    outcome: {
      completed: outcome['completed'] as boolean,
      completion_pct: outcome['completion_pct'] as number | undefined,
      duration_seconds: outcome['duration_seconds'] as number | undefined,
      user_rating: outcome['user_rating'] as number | undefined,
      custom_signals: outcome['custom_signals'] as Record<string, unknown> | undefined,
    },
    timestamp: req['timestamp'] as string | undefined,
  };
}
