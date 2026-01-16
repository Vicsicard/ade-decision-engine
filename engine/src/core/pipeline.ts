/**
 * ADE Pipeline Orchestrator
 * 
 * Orchestrates the 9-stage decision cycle.
 * Each stage receives a DecisionEnvelope and returns an updated envelope.
 * 
 * CRITICAL INVARIANT: Selection locks after Stage 4.
 * 
 * @version 1.0.0
 */

import type { DecisionRequest, DecisionResponse, Scenario, AuditTrace, StageTraces } from './types.js';
import type { DecisionEnvelope } from './decision-envelope.js';
import type { Stage, StageContext, StageResult } from './stage-interface.js';
import type { AuditStore } from '../storage/audit-store.js';
import type { MemoryStore } from '../storage/memory-store.js';
import type { ScenarioRegistry } from '../scenario/loader.js';
import type { ExecutorRegistry } from '../executors/executor-interface.js';
import { createEnvelope, buildResponse } from './decision-envelope.js';
import { InvalidScenarioError, InternalError } from './errors.js';

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  scenarioRegistry: ScenarioRegistry;
  auditStore: AuditStore;
  memoryStore: MemoryStore;
  executorRegistry: ExecutorRegistry;
  traceEnabled: boolean;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  response: DecisionResponse;
  trace: AuditTrace;
  duration_ms: number;
}

/**
 * Stage registration
 */
interface StageRegistration {
  stage: Stage;
  required: boolean;
}

/**
 * ADE Pipeline - orchestrates the 9-stage decision cycle
 */
export class Pipeline {
  private readonly config: PipelineConfig;
  private readonly stages: Map<number, StageRegistration> = new Map();
  
  constructor(config: PipelineConfig) {
    this.config = config;
  }
  
  /**
   * Register a stage implementation
   */
  registerStage(stage: Stage, required: boolean = true): void {
    this.stages.set(stage.stageNumber, { stage, required });
  }
  
  /**
   * Execute the full 9-stage pipeline
   */
  async run(request: DecisionRequest): Promise<PipelineResult> {
    const startTime = performance.now();
    
    // Load scenario
    const scenario = this.config.scenarioRegistry.get(
      request.scenario_id,
      'latest' // TODO: Support version pinning
    );
    
    if (!scenario) {
      throw new InvalidScenarioError(
        `Scenario not found: ${request.scenario_id}`,
        { scenario_id: request.scenario_id }
      );
    }
    
    // Get scenario hash for replay
    const scenarioHash = await this.getScenarioHash(scenario);
    
    // Create initial envelope
    let envelope = createEnvelope(
      request,
      scenario.scenario_id,
      scenario.version,
      scenarioHash
    );
    
    // Create stage context
    const context: StageContext = {
      scenario,
      startTime,
      traceEnabled: this.config.traceEnabled,
    };
    
    // Stage traces for audit
    const stageTraces: Partial<StageTraces> = {};
    
    // Execute stages 1-9 in order
    for (let stageNum = 1; stageNum <= 9; stageNum++) {
      const registration = this.stages.get(stageNum);
      
      if (!registration) {
        if (stageNum === 8) {
          // Stage 8 (Fallback) is optional if validation passes
          continue;
        }
        throw new InternalError(
          `Stage ${stageNum} not registered`,
          { stage_number: stageNum }
        );
      }
      
      const stageStart = performance.now();
      
      try {
        const result = await registration.stage.execute(envelope, context);
        envelope = result.envelope;
        
        // Record stage timing
        envelope.stage_times.set(stageNum, {
          start: stageStart,
          end: performance.now(),
        });
        
        // Store stage trace
        const stageName = this.getStageName(stageNum);
        stageTraces[stageName as keyof StageTraces] = {
          stage_number: stageNum,
          stage_name: stageName,
          started_at: new Date(stageStart).toISOString(),
          duration_ms: performance.now() - stageStart,
          artifacts: result.artifacts as Record<string, unknown>,
        };
        
      } catch (error) {
        // If stage fails, attempt fallback for certain stages
        if (stageNum >= 6 && stageNum <= 7) {
          // Skill execution or validation failed - trigger fallback
          envelope = {
            ...envelope,
            fallback_triggered: true,
            fallback_reason_code: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          };
          // Continue to Stage 8 (Fallback)
        } else {
          throw error;
        }
      }
    }
    
    // Build final response
    const response = buildResponse(envelope);
    
    // Build audit trace
    const trace: AuditTrace = {
      decision_id: envelope.decision_id,
      scenario_id: scenario.scenario_id,
      scenario_version: scenario.version,
      scenario_hash: scenarioHash,
      timestamp: envelope.created_at,
      request,
      stages: stageTraces as StageTraces,
      final_decision: response,
      total_duration_ms: performance.now() - startTime,
    };
    
    // Store audit trace (Stage 9 responsibility, but we ensure it happens)
    await this.config.auditStore.store(trace);
    
    return {
      response,
      trace,
      duration_ms: performance.now() - startTime,
    };
  }
  
  /**
   * Get stage name from number
   */
  private getStageName(stageNum: number): string {
    const names: Record<number, string> = {
      1: 'ingest',
      2: 'derive_state',
      3: 'evaluate_guardrails',
      4: 'score_and_rank',
      5: 'resolve_skills',
      6: 'execute_skill',
      7: 'validate_output',
      8: 'fallback',
      9: 'audit_and_replay',
    };
    return names[stageNum] ?? `stage_${stageNum}`;
  }
  
  /**
   * Get scenario hash
   */
  private async getScenarioHash(scenario: Scenario): Promise<string> {
    const content = JSON.stringify(scenario);
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  }
}

/**
 * Create a new pipeline with default configuration
 */
export function createPipeline(config: PipelineConfig): Pipeline {
  return new Pipeline(config);
}
