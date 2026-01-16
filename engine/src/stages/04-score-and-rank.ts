/**
 * Stage 4: Score and Rank
 * 
 * Scores eligible actions using scenario objectives.
 * Ranks actions and selects the top-ranked action.
 * 
 * CRITICAL: Selection locks at the end of this stage.
 * After this stage, selected_action is IMMUTABLE.
 * 
 * @version 1.0.0
 */

import type { Stage, StageContext, StageResult, ScoreAndRankArtifacts } from '../core/stage-interface.js';
import type { DecisionEnvelope } from '../core/decision-envelope.js';
import type { Action, RankedOption, ScoreBreakdown, ScoringObjective, UserState } from '../core/types.js';
import { lockSelection } from '../core/decision-envelope.js';
import { NoEligibleActionsError } from '../core/errors.js';

export class ScoreAndRankStage implements Stage<ScoreAndRankArtifacts> {
  readonly stageNumber = 4;
  readonly stageName = 'score_and_rank';
  
  async execute(
    envelope: DecisionEnvelope,
    context: StageContext
  ): Promise<StageResult<ScoreAndRankArtifacts>> {
    const startTime = performance.now();
    
    const { scenario } = context;
    const userState = envelope.user_state;
    const eligibleActions = envelope.eligible_actions;
    
    if (!userState) {
      throw new Error('User state not derived before scoring');
    }
    
    if (eligibleActions.length === 0) {
      throw new NoEligibleActionsError('No eligible actions to score');
    }
    
    // If action is forced by guardrails, skip scoring
    if (envelope.forced_action) {
      const forcedActionObj = eligibleActions.find(
        a => a.action_id === envelope.forced_action
      );
      
      if (forcedActionObj) {
        const rankedOptions: RankedOption[] = [{
          action_id: forcedActionObj.action_id,
          rank: 1,
          score: 1.0,
          score_breakdown: {
            objective_scores: {},
            weighted_sum: 1.0,
            execution_risk_penalty: 0,
          },
        }];
        
        const lockedEnvelope = lockSelection(
          envelope,
          forcedActionObj.action_id,
          rankedOptions
        );
        
        const artifacts: ScoreAndRankArtifacts = {
          objectives_evaluated: [],
          execution_risk_applied: false,
          ranked_actions: rankedOptions.map(r => ({
            action_id: r.action_id,
            score: r.score,
            rank: r.rank,
          })),
          selected_action: forcedActionObj.action_id,
          selection_locked_at: lockedEnvelope.selection_locked_at ?? new Date().toISOString(),
          selection_margin: 0,
        };
        
        return {
          envelope: lockedEnvelope,
          artifacts,
          duration_ms: performance.now() - startTime,
        };
      }
    }
    
    // Score each eligible action
    const scoredActions: Array<{ action: Action; score: number; breakdown: ScoreBreakdown }> = [];
    
    for (const action of eligibleActions) {
      const breakdown = this.scoreAction(action, userState, scenario.scoring.objectives);
      
      // Apply execution risk penalty
      let executionRiskPenalty = 0;
      if (scenario.scoring.execution_risk.enabled) {
        executionRiskPenalty = this.calculateExecutionRisk(
          action,
          userState,
          scenario.scoring.execution_risk
        );
      }
      
      const finalScore = breakdown.weighted_sum - executionRiskPenalty;
      
      scoredActions.push({
        action,
        score: finalScore,
        breakdown: {
          ...breakdown,
          execution_risk_penalty: executionRiskPenalty,
        },
      });
    }
    
    // Sort by score descending
    scoredActions.sort((a, b) => b.score - a.score);
    
    // Apply tie-breaking if needed
    this.applyTieBreaking(scoredActions, scenario.scoring.tie_breaking);
    
    // Build ranked options
    const rankedOptions: RankedOption[] = scoredActions.map((sa, index) => ({
      action_id: sa.action.action_id,
      rank: index + 1,
      score: sa.score,
      score_breakdown: sa.breakdown,
    }));
    
    // Select top-ranked action
    const selectedAction = rankedOptions[0]?.action_id;
    
    if (!selectedAction) {
      throw new NoEligibleActionsError('No action could be selected');
    }
    
    // Calculate selection margin (difference between #1 and #2)
    const selectionMargin = rankedOptions.length > 1
      ? (rankedOptions[0]?.score ?? 0) - (rankedOptions[1]?.score ?? 0)
      : 1.0;
    
    // CRITICAL: Lock selection
    const lockedEnvelope = lockSelection(envelope, selectedAction, rankedOptions);
    
    const artifacts: ScoreAndRankArtifacts = {
      objectives_evaluated: scenario.scoring.objectives.map(o => o.objective_id),
      execution_risk_applied: scenario.scoring.execution_risk.enabled,
      ranked_actions: rankedOptions.map(r => ({
        action_id: r.action_id,
        score: r.score,
        rank: r.rank,
      })),
      selected_action: selectedAction,
      selection_locked_at: lockedEnvelope.selection_locked_at ?? new Date().toISOString(),
      selection_margin: selectionMargin,
    };
    
    return {
      envelope: lockedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime,
    };
  }
  
  private scoreAction(
    action: Action,
    state: UserState,
    objectives: ScoringObjective[]
  ): ScoreBreakdown {
    const objectiveScores: Record<string, number> = {};
    let weightedSum = 0;
    
    for (const objective of objectives) {
      const score = this.evaluateObjective(objective, action, state);
      objectiveScores[objective.objective_id] = score;
      weightedSum += score * objective.weight;
    }
    
    return {
      objective_scores: objectiveScores,
      weighted_sum: weightedSum,
      execution_risk_penalty: 0, // Set later
    };
  }
  
  private evaluateObjective(
    objective: ScoringObjective,
    action: Action,
    state: UserState
  ): number {
    // Build context for formula evaluation
    const context: Record<string, unknown> = {
      state: {
        core: state.core,
        scenario_extensions: state.scenario_extensions,
        execution_capabilities: state.execution_capabilities,
      },
      action: {
        action_id: action.action_id,
        type_id: action.type_id,
        attributes: action.attributes,
      },
    };
    
    // Evaluate formula
    // TODO: Implement full formula evaluator
    // For now, use simplified evaluation
    try {
      const score = this.evaluateFormula(objective.formula, context);
      return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
    } catch {
      return 0.5; // Default on error
    }
  }
  
  private evaluateFormula(
    formula: string,
    context: Record<string, unknown>
  ): number {
    // Simple formula evaluation
    // Handles patterns like:
    // - "state.core.engagement_level * (1.0 - state.scenario_extensions.notification_fatigue)"
    // - Direct numeric values
    
    // Replace variable references with values
    let expr = formula;
    
    // Find all path references like "state.core.engagement_level"
    const pathRegex = /\b(state|action)\.[a-zA-Z_.]+/g;
    const matches = formula.match(pathRegex) ?? [];
    
    for (const match of matches) {
      const value = this.getNestedValue(context, match);
      if (typeof value === 'number') {
        expr = expr.replace(match, value.toString());
      } else {
        expr = expr.replace(match, '0.5'); // Default for missing values
      }
    }
    
    // Evaluate simple arithmetic
    try {
      // Only allow safe characters
      const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
      if (sanitized.length === 0) return 0.5;
      
      const fn = new Function(`return ${sanitized}`);
      const result = fn() as number;
      return typeof result === 'number' && !isNaN(result) ? result : 0.5;
    } catch {
      return 0.5;
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
  
  private calculateExecutionRisk(
    action: Action,
    state: UserState,
    riskConfig: { enabled: boolean; weight: number; factors: Array<{ factor: string; condition: string; penalty: number }> }
  ): number {
    if (!riskConfig.enabled) return 0;
    
    let totalPenalty = 0;
    
    for (const factor of riskConfig.factors) {
      // Evaluate condition
      // TODO: Implement proper condition evaluation
      // For now, simplified check
      if (factor.condition.includes('!state.execution_capabilities.llm_available')) {
        if (!state.execution_capabilities.llm_available) {
          totalPenalty += factor.penalty;
        }
      }
    }
    
    return Math.min(totalPenalty, 1.0) * riskConfig.weight;
  }
  
  private applyTieBreaking(
    scoredActions: Array<{ action: Action; score: number; breakdown: ScoreBreakdown }>,
    tieBreakers: string[]
  ): void {
    // Check for ties (within 0.001)
    for (let i = 0; i < scoredActions.length - 1; i++) {
      const current = scoredActions[i];
      const next = scoredActions[i + 1];
      
      if (current && next && Math.abs(current.score - next.score) < 0.001) {
        // Apply tie-breaking rules
        for (const rule of tieBreakers) {
          const comparison = this.compareTieBreaker(current.action, next.action, rule);
          if (comparison !== 0) {
            if (comparison > 0) {
              // Swap positions
              scoredActions[i] = next;
              scoredActions[i + 1] = current;
            }
            break;
          }
        }
      }
    }
  }
  
  private compareTieBreaker(a: Action, b: Action, rule: string): number {
    switch (rule) {
      case 'action_id_asc':
        return a.action_id.localeCompare(b.action_id);
      case 'intensity_asc': {
        const levels: Record<string, number> = { low: 1, moderate: 2, high: 3 };
        const aLevel = levels[a.attributes['intensity'] as string] ?? 2;
        const bLevel = levels[b.attributes['intensity'] as string] ?? 2;
        return aLevel - bLevel;
      }
      case 'duration_asc': {
        const aDuration = (a.attributes['duration_minutes'] as number) ?? 30;
        const bDuration = (b.attributes['duration_minutes'] as number) ?? 30;
        return aDuration - bDuration;
      }
      default:
        return 0;
    }
  }
}

export function createScoreAndRankStage(): ScoreAndRankStage {
  return new ScoreAndRankStage();
}
