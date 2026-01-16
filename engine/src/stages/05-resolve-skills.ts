/**
 * Stage 5: Resolve Skills
 * 
 * Determines which skill will execute for the selected action.
 * Maps action type to primary/fallback skill based on scenario config.
 * 
 * @version 1.0.0
 */

import type { Stage, StageContext, StageResult, ResolveSkillsArtifacts } from '../core/stage-interface.js';
import type { DecisionEnvelope } from '../core/decision-envelope.js';
import type { ExecutionMode } from '../core/types.js';

export class ResolveSkillsStage implements Stage<ResolveSkillsArtifacts> {
  readonly stageNumber = 5;
  readonly stageName = 'resolve_skills';
  
  async execute(
    envelope: DecisionEnvelope,
    context: StageContext
  ): Promise<StageResult<ResolveSkillsArtifacts>> {
    const startTime = performance.now();
    
    const { scenario } = context;
    
    if (!envelope.selection_locked || !envelope.selected_action) {
      throw new Error('Selection must be locked before skill resolution');
    }
    
    // Find the selected action
    const selectedAction = envelope.normalized_actions.find(
      a => a.action_id === envelope.selected_action
    );
    
    if (!selectedAction) {
      throw new Error(`Selected action not found: ${envelope.selected_action}`);
    }
    
    // Get action type
    const actionType = selectedAction.type_id;
    
    // Determine execution mode
    const executionMode: ExecutionMode = envelope.request.options.execution_mode_override
      ?? scenario.execution.default_mode;
    
    // Get skill mapping for this action type
    const actionMapping = scenario.skills.action_mappings[actionType];
    const actionTypeConfig = scenario.actions.action_types.find(
      t => t.type_id === actionType
    );
    
    // Determine primary and fallback skills
    let primarySkill: string;
    let fallbackSkill: string;
    
    if (actionMapping) {
      primarySkill = actionMapping.primary_skill;
      fallbackSkill = actionMapping.fallback_skill;
    } else if (actionTypeConfig?.skill_mapping) {
      primarySkill = actionTypeConfig.skill_mapping;
      fallbackSkill = scenario.skills.default_fallback;
    } else {
      primarySkill = scenario.skills.default_fallback;
      fallbackSkill = scenario.skills.default_fallback;
    }
    
    // Resolve which skill to use based on execution mode
    let resolvedSkill: string;
    let resolutionReason: 'primary' | 'fallback_unavailable' | 'mode_override';
    
    if (executionMode === 'deterministic_only') {
      // In deterministic mode, always use fallback (deterministic) skill
      resolvedSkill = fallbackSkill;
      resolutionReason = 'mode_override';
    } else {
      // In skill_enhanced mode, try primary first
      // TODO: Check if primary skill is available
      const primaryAvailable = this.isSkillAvailable(primarySkill);
      
      if (primaryAvailable) {
        resolvedSkill = primarySkill;
        resolutionReason = 'primary';
      } else {
        resolvedSkill = fallbackSkill;
        resolutionReason = 'fallback_unavailable';
      }
    }
    
    // Parse skill reference (format: "skill_id@version")
    const [skillId, skillVersion] = this.parseSkillReference(resolvedSkill);
    
    // Update envelope
    const updatedEnvelope: DecisionEnvelope = {
      ...envelope,
      resolved_skill_id: skillId,
      resolved_skill_version: skillVersion,
      execution_mode: executionMode,
    };
    
    const artifacts: ResolveSkillsArtifacts = {
      action_type: actionType,
      primary_skill: primarySkill,
      fallback_skill: fallbackSkill,
      resolved_skill: resolvedSkill,
      resolution_reason: resolutionReason,
    };
    
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime,
    };
  }
  
  private isSkillAvailable(skillRef: string): boolean {
    // TODO: Check executor registry for skill availability
    // For now, assume deterministic skills are always available
    // and LLM skills depend on LLM availability
    const [skillId] = this.parseSkillReference(skillRef);
    
    // Deterministic template skill is always available
    if (skillId === 'decision_rationale_template') {
      return true;
    }
    
    // LLM skills require LLM availability
    // TODO: Check actual LLM availability
    return true;
  }
  
  private parseSkillReference(ref: string): [string, string] {
    const parts = ref.split('@');
    const skillId = parts[0] ?? ref;
    const version = parts[1] ?? '1.0.0';
    return [skillId, version];
  }
}

export function createResolveSkillsStage(): ResolveSkillsStage {
  return new ResolveSkillsStage();
}
