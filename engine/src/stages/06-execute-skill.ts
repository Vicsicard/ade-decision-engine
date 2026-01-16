/**
 * Stage 6: Execute Skill
 * 
 * Executes the resolved skill to generate the decision payload.
 * Skills enrich the decision with rationale and display parameters.
 * 
 * CRITICAL: Skills cannot modify selected_action.
 * 
 * @version 1.0.0
 */

import type { Stage, StageContext, StageResult, ExecuteSkillArtifacts } from '../core/stage-interface.js';
import type { DecisionEnvelope } from '../core/decision-envelope.js';
import type { SkillInputEnvelope, SkillOutput, DecisionPayload } from '../core/types.js';
import type { Executor, ExecutorRegistry } from '../executors/executor-interface.js';
import { SkillTimeoutError } from '../core/errors.js';

export interface ExecuteSkillStageConfig {
  executorRegistry: ExecutorRegistry;
}

export class ExecuteSkillStage implements Stage<ExecuteSkillArtifacts> {
  readonly stageNumber = 6;
  readonly stageName = 'execute_skill';
  
  private readonly executorRegistry: ExecutorRegistry;
  
  constructor(config: ExecuteSkillStageConfig) {
    this.executorRegistry = config.executorRegistry;
  }
  
  async execute(
    envelope: DecisionEnvelope,
    context: StageContext
  ): Promise<StageResult<ExecuteSkillArtifacts>> {
    const startTime = performance.now();
    
    if (!envelope.selection_locked || !envelope.selected_action) {
      throw new Error('Selection must be locked before skill execution');
    }
    
    if (!envelope.resolved_skill_id) {
      throw new Error('Skill must be resolved before execution');
    }
    
    const { scenario } = context;
    
    // Build skill input envelope
    const skillInput = this.buildSkillInput(envelope);
    
    // Get executor for the execution mode
    const executor = this.executorRegistry.get(envelope.execution_mode);
    
    if (!executor) {
      throw new Error(`No executor available for mode: ${envelope.execution_mode}`);
    }
    
    // Execute skill with timeout
    const timeout = scenario.execution.timeouts.skill_execution_ms;
    
    const result = await executor.execute(
      envelope.resolved_skill_id,
      envelope.resolved_skill_version ?? '1.0.0',
      skillInput,
      timeout
    );
    
    if (!result.success || !result.output) {
      throw new SkillTimeoutError(
        result.error?.message ?? 'Skill execution failed',
        { skill_id: envelope.resolved_skill_id, error: result.error }
      );
    }
    
    // Verify skill output doesn't contain selection override attempts
    this.verifyNoSelectionOverride(result.output);
    
    // Update envelope with skill output
    const updatedEnvelope: DecisionEnvelope = {
      ...envelope,
      skill_output: result.output.payload,
      skill_execution_ms: result.execution_ms,
      skill_token_count: result.token_count,
    };
    
    const artifacts: ExecuteSkillArtifacts = {
      skill_id: envelope.resolved_skill_id,
      skill_version: envelope.resolved_skill_version ?? '1.0.0',
      execution_mode: envelope.execution_mode,
      execution_ms: result.execution_ms,
      token_count: result.token_count,
      output_generated: true,
    };
    
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime,
    };
  }
  
  private buildSkillInput(envelope: DecisionEnvelope): SkillInputEnvelope {
    if (!envelope.user_state) {
      throw new Error('User state required for skill input');
    }
    
    // Find selected action metadata
    const selectedAction = envelope.normalized_actions.find(
      a => a.action_id === envelope.selected_action
    );
    
    return {
      decision_context: {
        decision_id: envelope.decision_id,
        selected_action: envelope.selected_action ?? '',
        action_metadata: {
          action_id: selectedAction?.action_id,
          type_id: selectedAction?.type_id,
          name: selectedAction?.type_id, // Use type_id as name if no display name
          ...selectedAction?.attributes,
        },
        ranked_options: envelope.ranked_options.map(r => ({
          action_id: r.action_id,
          score: r.score,
          rank: r.rank,
        })),
        guardrails_applied: envelope.guardrail_results
          .filter(r => r.triggered)
          .map(r => r.rule_id),
      },
      user_state: {
        core: envelope.user_state.core,
        scenario_extensions: envelope.user_state.scenario_extensions,
      },
      skill_config: {
        skill_id: envelope.resolved_skill_id ?? '',
        skill_version: envelope.resolved_skill_version ?? '1.0.0',
        execution_mode: envelope.execution_mode,
        max_output_tokens: 150,
        timeout_ms: 300,
        custom_parameters: {},
      },
    };
  }
  
  private verifyNoSelectionOverride(output: SkillOutput): void {
    // Check payload doesn't contain selection-related fields
    const payload = output.payload as Record<string, unknown>;
    
    const prohibitedFields = [
      'selected_action',
      'recommended_action',
      'alternative_action',
      'action_choice',
    ];
    
    for (const field of prohibitedFields) {
      if (field in payload) {
        throw new Error(`Skill output contains prohibited field: ${field}`);
      }
    }
  }
}

export function createExecuteSkillStage(config: ExecuteSkillStageConfig): ExecuteSkillStage {
  return new ExecuteSkillStage(config);
}
