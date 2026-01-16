/**
 * ADE Error Definitions
 * 
 * Standardized error codes and error handling for the ADE engine.
 * 
 * @version 1.0.0
 */

import type { ADEErrorCode } from './types.js';

export class ADEError extends Error {
  readonly code: ADEErrorCode;
  readonly details: Record<string, unknown> | undefined;
  readonly timestamp: string;

  constructor(code: ADEErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ADEError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
    };
    if (this.details !== undefined) {
      result['details'] = this.details;
    }
    return result;
  }
}

export class InvalidRequestError extends ADEError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_REQUEST', message, details);
    this.name = 'InvalidRequestError';
  }
}

export class InvalidScenarioError extends ADEError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_SCENARIO', message, details);
    this.name = 'InvalidScenarioError';
  }
}

export class InvalidActionTypeError extends ADEError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_ACTION_TYPE', message, details);
    this.name = 'InvalidActionTypeError';
  }
}

export class NoEligibleActionsError extends ADEError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('NO_ELIGIBLE_ACTIONS', message, details);
    this.name = 'NoEligibleActionsError';
  }
}

export class SkillTimeoutError extends ADEError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('SKILL_TIMEOUT', message, details);
    this.name = 'SkillTimeoutError';
  }
}

export class SkillValidationError extends ADEError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('SKILL_VALIDATION_FAILED', message, details);
    this.name = 'SkillValidationError';
  }
}

export class InternalError extends ADEError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INTERNAL_ERROR', message, details);
    this.name = 'InternalError';
  }
}
