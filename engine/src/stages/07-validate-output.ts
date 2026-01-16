/**
 * Stage 7: Validate Output
 * 
 * Validates skill output against SEC, invariants, authority boundaries,
 * and prohibitions. If validation fails, triggers fallback.
 * 
 * @version 1.0.0
 */

import type { Stage, StageContext, StageResult, ValidateOutputArtifacts } from '../core/stage-interface.js';
import type { DecisionEnvelope } from '../core/decision-envelope.js';
import type { ValidationResult, ValidationViolation, SkillOutput } from '../core/types.js';
import { checkAuthorityPatterns, AUTHORITY_PATTERNS_V1 } from '../governance/authority-patterns.js';
import { checkProhibitions, PROHIBITIONS_V1 } from '../governance/prohibitions.js';

export class ValidateOutputStage implements Stage<ValidateOutputArtifacts> {
  readonly stageNumber = 7;
  readonly stageName = 'validate_output';
  
  async execute(
    envelope: DecisionEnvelope,
    context: StageContext
  ): Promise<StageResult<ValidateOutputArtifacts>> {
    const startTime = performance.now();
    
    if (!envelope.skill_output) {
      throw new Error('No skill output to validate');
    }
    
    // Build skill output object for validation
    const skillOutput: SkillOutput = {
      payload: envelope.skill_output,
      metadata: {
        skill_id: envelope.resolved_skill_id ?? '',
        skill_version: envelope.resolved_skill_version ?? '1.0.0',
        generated_at: new Date().toISOString(),
        token_count: envelope.skill_token_count,
        generation_ms: envelope.skill_execution_ms,
      },
    };
    
    // Run validation pipeline
    const schemaResult = this.validateSchema(skillOutput);
    const invariantsResult = this.validateInvariants(skillOutput, envelope);
    const authorityResult = this.validateAuthorityBoundary(skillOutput);
    const prohibitionsResult = this.validateProhibitions(skillOutput);
    
    // Determine overall validity
    const overallValid = 
      schemaResult.valid && 
      invariantsResult.valid && 
      authorityResult.valid && 
      prohibitionsResult.valid;
    
    // Collect all violations
    const allViolations: Array<{ check_id: string; message: string }> = [];
    
    for (const result of [schemaResult, invariantsResult, authorityResult, prohibitionsResult]) {
      for (const violation of result.violations) {
        allViolations.push({
          check_id: violation.check_id,
          message: violation.message,
        });
      }
    }
    
    // Build validation pipeline result
    const validationResult = {
      valid: overallValid,
      stage_results: {
        schema: schemaResult,
        invariants: invariantsResult,
        authority_boundary: authorityResult,
        prohibitions: prohibitionsResult,
      },
      first_failure: overallValid ? null : this.getFirstFailure(
        schemaResult,
        invariantsResult,
        authorityResult,
        prohibitionsResult
      ),
      total_duration_ms: performance.now() - startTime,
    };
    
    // Update envelope
    const updatedEnvelope: DecisionEnvelope = {
      ...envelope,
      validation_result: validationResult,
      // If validation failed, mark for fallback
      fallback_triggered: !overallValid,
      fallback_reason_code: overallValid ? null : validationResult.first_failure?.check_id ?? 'VALIDATION_FAILED',
    };
    
    const artifacts: ValidateOutputArtifacts = {
      schema_valid: schemaResult.valid,
      invariants_valid: invariantsResult.valid,
      authority_valid: authorityResult.valid,
      prohibitions_valid: prohibitionsResult.valid,
      overall_valid: overallValid,
      violations: allViolations,
    };
    
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime,
    };
  }
  
  private validateSchema(output: SkillOutput): ValidationResult {
    const violations: ValidationViolation[] = [];
    const startTime = performance.now();
    
    // Check required fields
    if (!output.payload) {
      violations.push({
        check_id: 'SCHEMA-001',
        severity: 'error',
        message: 'Missing payload in skill output',
      });
    }
    
    if (!output.metadata) {
      violations.push({
        check_id: 'SCHEMA-002',
        severity: 'error',
        message: 'Missing metadata in skill output',
      });
    }
    
    // Check payload structure
    if (output.payload) {
      const payload = output.payload as Record<string, unknown>;
      
      // Check rationale length if present
      if (typeof payload['rationale'] === 'string') {
        if (payload['rationale'].length > 500) {
          violations.push({
            check_id: 'SCHEMA-003',
            severity: 'error',
            message: 'Rationale exceeds maximum length (500 chars)',
          });
        }
        if (payload['rationale'].length < 5) {
          violations.push({
            check_id: 'SCHEMA-004',
            severity: 'error',
            message: 'Rationale below minimum length (5 chars)',
          });
        }
      }
    }
    
    return {
      valid: violations.length === 0,
      violations,
      validator_id: 'schema',
      duration_ms: performance.now() - startTime,
    };
  }
  
  private validateInvariants(output: SkillOutput, envelope: DecisionEnvelope): ValidationResult {
    const violations: ValidationViolation[] = [];
    const startTime = performance.now();
    
    // INV-001: selected_action unchanged
    // This is enforced by the envelope structure, but we verify here
    if (!envelope.selection_locked) {
      violations.push({
        check_id: 'INV-001',
        severity: 'error',
        message: 'Selection must be locked before validation',
      });
    }
    
    // INV-002: Payload must not contain action selection fields
    const payload = output.payload as Record<string, unknown>;
    const prohibitedFields = ['selected_action', 'recommended_action', 'alternative_action'];
    
    for (const field of prohibitedFields) {
      if (field in payload) {
        violations.push({
          check_id: 'INV-002',
          severity: 'error',
          message: `Payload contains prohibited field: ${field}`,
          path: `payload.${field}`,
        });
      }
    }
    
    // INV-003: Token count within limits
    if (output.metadata.token_count > 500) {
      violations.push({
        check_id: 'INV-003',
        severity: 'error',
        message: 'Token count exceeds limit (500)',
      });
    }
    
    return {
      valid: violations.length === 0,
      violations,
      validator_id: 'invariants',
      duration_ms: performance.now() - startTime,
    };
  }
  
  private validateAuthorityBoundary(output: SkillOutput): ValidationResult {
    const violations: ValidationViolation[] = [];
    const startTime = performance.now();
    
    // Get text content to scan
    const textToScan = this.extractTextContent(output.payload);
    
    // Check against authority patterns
    const authorityViolations = checkAuthorityPatterns(textToScan, AUTHORITY_PATTERNS_V1);
    
    for (const av of authorityViolations) {
      violations.push({
        check_id: av.pattern_id,
        severity: av.severity,
        message: av.description,
        matched_text: av.matched_text,
      });
    }
    
    return {
      valid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      validator_id: 'authority_boundary',
      duration_ms: performance.now() - startTime,
    };
  }
  
  private validateProhibitions(output: SkillOutput): ValidationResult {
    const violations: ValidationViolation[] = [];
    const startTime = performance.now();
    
    // Get text content to scan
    const textToScan = this.extractTextContent(output.payload);
    
    // Check against prohibition patterns
    const prohibitionViolations = checkProhibitions(textToScan, PROHIBITIONS_V1, true);
    
    for (const pv of prohibitionViolations) {
      violations.push({
        check_id: pv.prohibition_id,
        severity: 'error',
        message: pv.reason,
        matched_text: pv.matched_text,
      });
    }
    
    return {
      valid: violations.length === 0,
      violations,
      validator_id: 'prohibitions',
      duration_ms: performance.now() - startTime,
    };
  }
  
  private extractTextContent(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return '';
    }
    
    const parts: string[] = [];
    const obj = payload as Record<string, unknown>;
    
    // Extract string fields
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        parts.push(value);
      } else if (typeof value === 'object' && value !== null) {
        parts.push(this.extractTextContent(value));
      }
    }
    
    return parts.join(' ');
  }
  
  private getFirstFailure(
    ...results: ValidationResult[]
  ): { stage: string; check_id: string; reason: string } | null {
    // Authority violations take precedence
    for (const result of results) {
      if (!result.valid && result.validator_id === 'authority_boundary') {
        const firstViolation = result.violations[0];
        if (firstViolation) {
          return {
            stage: result.validator_id,
            check_id: firstViolation.check_id,
            reason: firstViolation.message,
          };
        }
      }
    }
    
    // Then other failures
    for (const result of results) {
      if (!result.valid) {
        const firstViolation = result.violations[0];
        if (firstViolation) {
          return {
            stage: result.validator_id,
            check_id: firstViolation.check_id,
            reason: firstViolation.message,
          };
        }
      }
    }
    
    return null;
  }
}

export function createValidateOutputStage(): ValidateOutputStage {
  return new ValidateOutputStage();
}
