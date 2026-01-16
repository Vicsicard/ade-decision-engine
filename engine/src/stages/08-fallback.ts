/**
 * Stage 8: Fallback
 * 
 * Executes when skill execution or validation fails.
 * Always produces a lawful decision payload using deterministic fallback.
 * 
 * CRITICAL: Fallback never blocks a decision - it always returns.
 * 
 * @version 1.0.0
 */

import type { Stage, StageContext, StageResult, FallbackArtifacts } from '../core/stage-interface.js';
import type { DecisionEnvelope } from '../core/decision-envelope.js';
import type { DecisionPayload } from '../core/types.js';

export class FallbackStage implements Stage<FallbackArtifacts> {
  readonly stageNumber = 8;
  readonly stageName = 'fallback';
  
  async execute(
    envelope: DecisionEnvelope,
    context: StageContext
  ): Promise<StageResult<FallbackArtifacts>> {
    const startTime = performance.now();
    
    // Check if fallback is needed
    if (!envelope.fallback_triggered) {
      // No fallback needed - pass through
      const artifacts: FallbackArtifacts = {
        triggered: false,
        reason_code: '',
        fallback_skill_used: '',
        fallback_output_valid: true,
      };
      
      return {
        envelope,
        artifacts,
        duration_ms: performance.now() - startTime,
      };
    }
    
    // Fallback is needed - generate deterministic payload
    const fallbackPayload = this.generateFallbackPayload(envelope, context);
    
    // Validate fallback output (should always pass for deterministic)
    const fallbackValid = this.validateFallbackOutput(fallbackPayload);
    
    // Update envelope with fallback output
    const updatedEnvelope: DecisionEnvelope = {
      ...envelope,
      fallback_output: fallbackPayload,
    };
    
    const artifacts: FallbackArtifacts = {
      triggered: true,
      reason_code: envelope.fallback_reason_code ?? 'UNKNOWN',
      fallback_skill_used: 'decision_rationale_template@1.0.0',
      fallback_output_valid: fallbackValid,
    };
    
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime,
    };
  }
  
  private generateFallbackPayload(
    envelope: DecisionEnvelope,
    context: StageContext
  ): DecisionPayload {
    // Find selected action for context
    const selectedAction = envelope.normalized_actions.find(
      a => a.action_id === envelope.selected_action
    );
    
    const actionName = selectedAction?.type_id ?? 'selected action';
    
    // Generate deterministic rationale based on user state
    let rationale: string;
    
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
        template_used: 'fallback',
        personalization_level: 'low',
        fallback_reason: envelope.fallback_reason_code,
      },
    };
  }
  
  private validateFallbackOutput(payload: DecisionPayload): boolean {
    // Fallback output should always be valid since it's deterministic
    // But we verify basic structure
    if (!payload.rationale || payload.rationale.length < 5) {
      return false;
    }
    
    // Check for prohibited content (should never happen with templates)
    const prohibitedPatterns = [
      /\b(i recommend|you should|instead)\b/i,
      /\b(selected_action|recommended_action)\b/i,
    ];
    
    for (const pattern of prohibitedPatterns) {
      if (pattern.test(payload.rationale)) {
        return false;
      }
    }
    
    return true;
  }
  
  private capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
  }
}

export function createFallbackStage(): FallbackStage {
  return new FallbackStage();
}
