/**
 * Validator Interface
 * 
 * Defines the contract for all validators in the validation pipeline.
 * 
 * @version 1.0.0
 */

import type { ValidationResult, SkillOutput } from '../core/types.js';
import type { DecisionEnvelope } from '../core/decision-envelope.js';

/**
 * Validator Interface - all validators must implement this
 */
export interface Validator {
  readonly validator_id: string;
  readonly validator_name: string;
  
  /**
   * Validate skill output against rules
   */
  validate(
    output: SkillOutput,
    envelope: DecisionEnvelope
  ): ValidationResult;
}

/**
 * Schema Validator - validates output structure
 */
export interface SchemaValidator extends Validator {
  readonly validator_id: 'schema';
}

/**
 * Invariant Validator - validates SEC invariants
 */
export interface InvariantValidator extends Validator {
  readonly validator_id: 'invariants';
}

/**
 * Authority Validator - validates authority boundaries
 */
export interface AuthorityValidator extends Validator {
  readonly validator_id: 'authority_boundary';
}

/**
 * Prohibition Validator - validates prohibited content
 */
export interface ProhibitionValidator extends Validator {
  readonly validator_id: 'prohibitions';
}

/**
 * Validation Pipeline - orchestrates all validators
 */
export interface ValidationPipeline {
  /**
   * Run all validators in order
   */
  validate(
    output: SkillOutput,
    envelope: DecisionEnvelope
  ): ValidationPipelineResult;
}

/**
 * Validation pipeline result
 */
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
