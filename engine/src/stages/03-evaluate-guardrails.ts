/**
 * Stage 3: Evaluate Guardrails
 * 
 * Evaluates guardrail rules against user state and actions.
 * Filters eligible actions based on guardrail effects.
 * 
 * @version 1.0.0
 */

import type { Stage, StageContext, StageResult, EvaluateGuardrailsArtifacts } from '../core/stage-interface.js';
import type { DecisionEnvelope } from '../core/decision-envelope.js';
import type { Action, GuardrailRule, GuardrailResult, UserState } from '../core/types.js';
import { NoEligibleActionsError } from '../core/errors.js';

export class EvaluateGuardrailsStage implements Stage<EvaluateGuardrailsArtifacts> {
  readonly stageNumber = 3;
  readonly stageName = 'evaluate_guardrails';
  
  async execute(
    envelope: DecisionEnvelope,
    context: StageContext
  ): Promise<StageResult<EvaluateGuardrailsArtifacts>> {
    const startTime = performance.now();
    
    const { scenario } = context;
    const userState = envelope.user_state;
    
    if (!userState) {
      throw new Error('User state not derived before guardrail evaluation');
    }
    
    // Sort rules by priority (lower = earlier)
    const sortedRules = [...scenario.guardrails.rules].sort(
      (a, b) => a.priority - b.priority
    );
    
    // Evaluate each rule
    const results: GuardrailResult[] = [];
    const blockedActions = new Set<string>();
    let forcedAction: string | null = null;
    
    for (const rule of sortedRules) {
      const triggered = this.evaluateCondition(rule.condition, userState, envelope);
      
      const result: GuardrailResult = {
        rule_id: rule.rule_id,
        triggered,
        effect: rule.effect,
        target: rule.target,
        parameters: rule.parameters,
      };
      
      results.push(result);
      
      if (triggered) {
        switch (rule.effect) {
          case 'block_action':
            // Block specific actions matching target
            for (const action of envelope.normalized_actions) {
              if (this.matchesTarget(action, rule.target)) {
                blockedActions.add(action.action_id);
              }
            }
            break;
            
          case 'force_action':
            // Force a specific action type
            if (rule.target) {
              const forcedActionObj = envelope.normalized_actions.find(
                a => a.type_id === rule.target || a.action_id === rule.target
              );
              if (forcedActionObj) {
                forcedAction = forcedActionObj.action_id;
              }
            }
            break;
            
          case 'cap_intensity':
            // Cap intensity - mark high intensity actions as blocked
            const maxIntensity = rule.parameters?.['max_intensity'] as string;
            if (maxIntensity) {
              for (const action of envelope.normalized_actions) {
                const actionIntensity = action.attributes['intensity'] as string;
                if (this.intensityExceeds(actionIntensity, maxIntensity)) {
                  blockedActions.add(action.action_id);
                }
              }
            }
            break;
        }
      }
    }
    
    // Determine eligible actions
    let eligibleActions: Action[];
    
    if (forcedAction) {
      // If an action is forced, only that action is eligible
      eligibleActions = envelope.normalized_actions.filter(
        a => a.action_id === forcedAction
      );
    } else {
      // Filter out blocked actions
      eligibleActions = envelope.normalized_actions.filter(
        a => !blockedActions.has(a.action_id)
      );
    }
    
    // Check if any actions remain eligible
    if (eligibleActions.length === 0) {
      throw new NoEligibleActionsError(
        'All actions blocked by guardrails',
        {
          rules_triggered: results.filter(r => r.triggered).map(r => r.rule_id),
          actions_blocked: Array.from(blockedActions),
        }
      );
    }
    
    // Update envelope
    const updatedEnvelope: DecisionEnvelope = {
      ...envelope,
      guardrail_results: results,
      eligible_actions: eligibleActions,
      forced_action: forcedAction,
    };
    
    const artifacts: EvaluateGuardrailsArtifacts = {
      rules_evaluated: sortedRules.length,
      rules_triggered: results.filter(r => r.triggered).map(r => r.rule_id),
      actions_blocked: Array.from(blockedActions),
      actions_forced: forcedAction,
      eligible_action_count: eligibleActions.length,
    };
    
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime,
    };
  }
  
  private evaluateCondition(
    condition: string,
    state: UserState,
    envelope: DecisionEnvelope
  ): boolean {
    // Build context for condition evaluation
    const context: Record<string, unknown> = {
      state: {
        core: state.core,
        scenario_extensions: state.scenario_extensions,
      },
      signals: envelope.request.signals,
      memory: {}, // TODO: Add memory context
    };
    
    // Parse and evaluate condition
    // Supports patterns like:
    // - "state.core.daily_notification_count >= 3"
    // - "state.scenario_extensions.fatigue_score > 0.8"
    // - "state.core.local_hour >= 22 || state.core.local_hour < 8"
    
    try {
      return this.evaluateExpression(condition, context);
    } catch {
      // If condition evaluation fails, don't trigger the guardrail
      return false;
    }
  }
  
  private evaluateExpression(
    expr: string,
    context: Record<string, unknown>
  ): boolean {
    // Handle OR conditions
    if (expr.includes('||')) {
      const parts = expr.split('||').map(p => p.trim());
      return parts.some(part => this.evaluateExpression(part, context));
    }
    
    // Handle AND conditions
    if (expr.includes('&&')) {
      const parts = expr.split('&&').map(p => p.trim());
      return parts.every(part => this.evaluateExpression(part, context));
    }
    
    // Parse comparison: "path operator value"
    const match = expr.match(/^([\w.]+)\s*(>=|<=|>|<|==|!=)\s*([\d.]+|true|false|"[^"]*")$/);
    if (!match) {
      return false;
    }
    
    const [, path, operator, valueStr] = match;
    const actualValue = this.getNestedValue(context, path as string);
    
    let compareValue: number | boolean | string;
    if (valueStr === 'true') {
      compareValue = true;
    } else if (valueStr === 'false') {
      compareValue = false;
    } else if (valueStr?.startsWith('"')) {
      compareValue = valueStr.slice(1, -1);
    } else {
      compareValue = parseFloat(valueStr as string);
    }
    
    switch (operator) {
      case '>=': return (actualValue as number) >= (compareValue as number);
      case '<=': return (actualValue as number) <= (compareValue as number);
      case '>': return (actualValue as number) > (compareValue as number);
      case '<': return (actualValue as number) < (compareValue as number);
      case '==': return actualValue === compareValue;
      case '!=': return actualValue !== compareValue;
      default: return false;
    }
  }
  
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }
  
  private matchesTarget(action: Action, target: string | undefined): boolean {
    if (!target || target === 'all') {
      return true;
    }
    
    // Check if target matches action_id or type_id
    if (action.action_id === target || action.type_id === target) {
      return true;
    }
    
    // Check if target is an attribute condition like "intensity == 'high'"
    const attrMatch = target.match(/^(\w+)\s*==\s*'([^']+)'$/);
    if (attrMatch) {
      const [, attrName, attrValue] = attrMatch;
      return action.attributes[attrName as string] === attrValue;
    }
    
    return false;
  }
  
  private intensityExceeds(actual: string | undefined, max: string): boolean {
    const levels: Record<string, number> = {
      'low': 1,
      'moderate': 2,
      'high': 3,
    };
    
    const actualLevel = levels[actual ?? 'low'] ?? 1;
    const maxLevel = levels[max] ?? 3;
    
    return actualLevel > maxLevel;
  }
}

export function createEvaluateGuardrailsStage(): EvaluateGuardrailsStage {
  return new EvaluateGuardrailsStage();
}
