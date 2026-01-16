/**
 * Stage 2: Derive State
 * 
 * Computes user state from signals, context, and memory.
 * All derivation is deterministic - no ML inference.
 * 
 * @version 1.0.0
 */

import type { Stage, StageContext, StageResult, DeriveStateArtifacts } from '../core/stage-interface.js';
import type { DecisionEnvelope } from '../core/decision-envelope.js';
import type { UserState, CoreStateDimensions, DimensionDefinition } from '../core/types.js';

export class DeriveStateStage implements Stage<DeriveStateArtifacts> {
  readonly stageNumber = 2;
  readonly stageName = 'derive_state';
  
  async execute(
    envelope: DecisionEnvelope,
    context: StageContext
  ): Promise<StageResult<DeriveStateArtifacts>> {
    const startTime = performance.now();
    
    const { scenario } = context;
    const { request } = envelope;
    
    // Compute core dimensions
    const coreDimensions = this.computeCoreDimensions(
      scenario.state_schema.core_dimensions,
      request.signals,
      request.context as unknown as Record<string, unknown>
    );
    
    // Compute scenario-specific dimensions
    const scenarioExtensions = this.computeScenarioDimensions(
      scenario.state_schema.scenario_dimensions,
      request.signals,
      request.context as unknown as Record<string, unknown>,
      coreDimensions
    );
    
    // Build user state
    const userState: UserState = {
      state_version: '1.0.0',
      scenario_id: scenario.scenario_id,
      scenario_version: scenario.version,
      core: coreDimensions,
      scenario_extensions: scenarioExtensions,
      execution_capabilities: {
        llm_available: true, // TODO: Check actual availability
        max_latency_ms: scenario.execution.timeouts.total_decision_ms,
        offline_mode: false,
      },
      computed_at: new Date().toISOString(),
      inputs_hash: this.computeInputsHash(request.signals, request.context as unknown as Record<string, unknown>),
    };
    
    // Update envelope
    const updatedEnvelope: DecisionEnvelope = {
      ...envelope,
      user_state: userState,
    };
    
    const artifacts: DeriveStateArtifacts = {
      core_dimensions_computed: Object.keys(coreDimensions),
      scenario_dimensions_computed: Object.keys(scenarioExtensions),
      memory_accessed: false, // TODO: Track memory access
      cold_start: false, // TODO: Detect cold start
    };
    
    return {
      envelope: updatedEnvelope,
      artifacts,
      duration_ms: performance.now() - startTime,
    };
  }
  
  private computeCoreDimensions(
    definitions: Record<string, DimensionDefinition>,
    signals: Record<string, unknown>,
    context: Record<string, unknown>
  ): CoreStateDimensions {
    const dimensions: CoreStateDimensions = {
      engagement_level: 0.5,
      recency_score: 0.5,
      interaction_depth: 0,
      depth_factor: 1.0,
      churn_risk: 0.5,
    };
    
    // Compute each dimension from its definition
    for (const [name, def] of Object.entries(definitions)) {
      const value = this.evaluateDimension(def, signals, context, dimensions);
      dimensions[name] = value as number;
    }
    
    return dimensions;
  }
  
  private computeScenarioDimensions(
    definitions: Record<string, DimensionDefinition>,
    signals: Record<string, unknown>,
    context: Record<string, unknown>,
    coreDimensions: CoreStateDimensions
  ): Record<string, unknown> {
    const dimensions: Record<string, unknown> = {};
    
    for (const [name, def] of Object.entries(definitions)) {
      const value = this.evaluateDimension(def, signals, context, coreDimensions);
      dimensions[name] = value;
    }
    
    return dimensions;
  }
  
  private evaluateDimension(
    def: DimensionDefinition,
    signals: Record<string, unknown>,
    context: Record<string, unknown>,
    existingDimensions: Record<string, unknown>
  ): unknown {
    // Get value based on derivation source
    switch (def.derivation.source) {
      case 'signal':
        return this.getSignalValue(def, signals);
      case 'context':
        return this.getContextValue(def, context);
      case 'computed':
        return this.computeValue(def, signals, context, existingDimensions);
      default:
        return def.default;
    }
  }
  
  private getSignalValue(
    def: DimensionDefinition,
    signals: Record<string, unknown>
  ): unknown {
    // Parse formula like "signals.sessions_completed_7d"
    const match = def.derivation.formula.match(/signals\.(\w+)/);
    if (match) {
      const signalName = match[1];
      const value = signals[signalName as string];
      if (value !== undefined) {
        return this.clampValue(value as number, def);
      }
    }
    return def.default;
  }
  
  private getContextValue(
    def: DimensionDefinition,
    context: Record<string, unknown>
  ): unknown {
    // Parse formula like "context.local_hour"
    const match = def.derivation.formula.match(/context\.(\w+)/);
    if (match) {
      const contextName = match[1];
      const value = context[contextName as string];
      if (value !== undefined) {
        return this.clampValue(value as number, def);
      }
    }
    return def.default;
  }
  
  private computeValue(
    def: DimensionDefinition,
    signals: Record<string, unknown>,
    context: Record<string, unknown>,
    existingDimensions: Record<string, unknown>
  ): unknown {
    // Simple formula evaluation
    // TODO: Implement full formula evaluator
    const formula = def.derivation.formula;
    
    // Handle common patterns
    if (formula.includes('if_else')) {
      return this.evaluateIfElse(formula, existingDimensions, def);
    }
    
    if (formula.includes('coalesce')) {
      return this.evaluateCoalesce(formula, existingDimensions, def);
    }
    
    // Handle arithmetic formulas
    return this.evaluateArithmetic(formula, signals, context, existingDimensions, def);
  }
  
  private evaluateIfElse(
    formula: string,
    dimensions: Record<string, unknown>,
    def: DimensionDefinition
  ): number {
    // Parse if_else(condition, then, else)
    // Simplified implementation for common patterns
    const match = formula.match(/if_else\((\w+)\s*<\s*(\d+),\s*([\d.]+),/);
    if (match) {
      const varName = match[1];
      const threshold = parseFloat(match[2] as string);
      const thenValue = parseFloat(match[3] as string);
      
      const actualValue = dimensions[varName as string] as number ?? 0;
      if (actualValue < threshold) {
        return thenValue;
      }
    }
    
    return def.default as number;
  }
  
  private evaluateCoalesce(
    formula: string,
    dimensions: Record<string, unknown>,
    def: DimensionDefinition
  ): number {
    // Parse coalesce(value, default)
    const match = formula.match(/coalesce\(.+,\s*([\d.]+)\)/);
    if (match) {
      return parseFloat(match[1] as string);
    }
    return def.default as number;
  }
  
  private evaluateArithmetic(
    formula: string,
    signals: Record<string, unknown>,
    context: Record<string, unknown>,
    dimensions: Record<string, unknown>,
    def: DimensionDefinition
  ): number {
    // Build variable map
    const vars: Record<string, number> = {};
    
    // Add signals
    for (const [key, value] of Object.entries(signals)) {
      if (typeof value === 'number') {
        vars[key] = value;
      }
    }
    
    // Add dimensions
    for (const [key, value] of Object.entries(dimensions)) {
      if (typeof value === 'number') {
        vars[key] = value;
      }
    }
    
    // Simple evaluation for common patterns like:
    // "(1.0 - engagement_level) * 0.50 + (1.0 - recency_score) * 0.30 + depth_factor * 0.20"
    try {
      let result = formula;
      
      // Replace variable names with values
      for (const [name, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\b${name}\\b`, 'g'), value.toString());
      }
      
      // Evaluate simple arithmetic (UNSAFE in production - use proper parser)
      // This is a stub - real implementation needs safe expression evaluator
      const numericResult = this.safeEval(result);
      return this.clampValue(numericResult, def);
    } catch {
      return def.default as number;
    }
  }
  
  private safeEval(expr: string): number {
    // Very basic safe evaluation for simple arithmetic
    // Only allows numbers, operators, and parentheses
    const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
    if (sanitized !== expr.replace(/\s/g, '')) {
      throw new Error('Invalid expression');
    }
    
    // Use Function constructor for evaluation (still needs proper sandboxing in production)
    try {
      const fn = new Function(`return ${sanitized}`);
      const result = fn() as number;
      return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch {
      return 0;
    }
  }
  
  private clampValue(value: number, def: DimensionDefinition): number {
    if (def.range) {
      const min = def.range.min ?? -Infinity;
      const max = def.range.max ?? Infinity;
      return Math.max(min, Math.min(max, value));
    }
    return value;
  }
  
  private computeInputsHash(
    signals: Record<string, unknown>,
    context: Record<string, unknown>
  ): string {
    const content = JSON.stringify({ signals, context });
    // Simple hash for now - use proper crypto in production
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `hash:${Math.abs(hash).toString(16)}`;
  }
}

export function createDeriveStateStage(): DeriveStateStage {
  return new DeriveStateStage();
}
