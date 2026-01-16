/**
 * ADE Engine Factory
 * 
 * Creates and configures a complete ADE engine instance.
 * 
 * @version 1.0.0
 */

import type { DecisionRequest, DecisionResponse, Scenario } from './core/types.js';
import type { AuditStore } from './storage/audit-store.js';
import type { MemoryStore } from './storage/memory-store.js';
import type { ScenarioRegistry } from './scenario/loader.js';
import type { ExecutorRegistry } from './executors/executor-interface.js';

import { Pipeline, createPipeline } from './core/pipeline.js';
import { createIngestStage } from './stages/01-ingest.js';
import { createDeriveStateStage } from './stages/02-derive-state.js';
import { createEvaluateGuardrailsStage } from './stages/03-evaluate-guardrails.js';
import { createScoreAndRankStage } from './stages/04-score-and-rank.js';
import { createResolveSkillsStage } from './stages/05-resolve-skills.js';
import { createExecuteSkillStage } from './stages/06-execute-skill.js';
import { createValidateOutputStage } from './stages/07-validate-output.js';
import { createFallbackStage } from './stages/08-fallback.js';
import { createAuditAndReplayStage } from './stages/09-audit-and-replay.js';

import { createLocalAuditStore } from './storage/adapters/local-audit.js';
import { createLocalMemoryStore } from './storage/adapters/local-memory.js';
import { createScenarioRegistry } from './scenario/registry.js';
import { createExecutorRegistry } from './executors/registry.js';
import { createDeterministicExecutor } from './executors/deterministic-executor.js';
import { computeScenarioHash } from './scenario/loader.js';

/**
 * Engine configuration options
 */
export interface EngineConfig {
  auditStore?: AuditStore;
  memoryStore?: MemoryStore;
  scenarioRegistry?: ScenarioRegistry;
  executorRegistry?: ExecutorRegistry;
  traceEnabled?: boolean;
}

/**
 * ADE Engine instance
 */
export interface Engine {
  /**
   * Run a decision request through the 9-stage pipeline
   */
  decide(request: DecisionRequest): Promise<DecisionResponse>;
  
  /**
   * Register a scenario with the engine
   */
  registerScenario(scenario: Scenario): Promise<void>;
  
  /**
   * Get the underlying pipeline (for testing)
   */
  getPipeline(): Pipeline;
  
  /**
   * Get the scenario registry (for testing)
   */
  getScenarioRegistry(): ScenarioRegistry;
  
  /**
   * Get the audit store (for testing)
   */
  getAuditStore(): AuditStore;
}

/**
 * Create a fully configured ADE engine
 */
export async function createEngine(config: EngineConfig = {}): Promise<Engine> {
  // Create or use provided components
  const auditStore = config.auditStore ?? createLocalAuditStore();
  const memoryStore = config.memoryStore ?? createLocalMemoryStore();
  const scenarioRegistry = config.scenarioRegistry ?? createScenarioRegistry();
  const executorRegistry = config.executorRegistry ?? createExecutorRegistry();
  const traceEnabled = config.traceEnabled ?? true;
  
  // Register deterministic executor
  const deterministicExecutor = createDeterministicExecutor();
  executorRegistry.register(deterministicExecutor);
  
  // Create pipeline
  const pipeline = createPipeline({
    scenarioRegistry,
    auditStore,
    memoryStore,
    executorRegistry,
    traceEnabled,
  });
  
  // Register all stages
  pipeline.registerStage(createIngestStage());
  pipeline.registerStage(createDeriveStateStage());
  pipeline.registerStage(createEvaluateGuardrailsStage());
  pipeline.registerStage(createScoreAndRankStage());
  pipeline.registerStage(createResolveSkillsStage());
  pipeline.registerStage(createExecuteSkillStage({ executorRegistry }));
  pipeline.registerStage(createValidateOutputStage());
  pipeline.registerStage(createFallbackStage(), false); // Optional stage
  pipeline.registerStage(createAuditAndReplayStage());
  
  // Return engine interface
  return {
    async decide(request: DecisionRequest): Promise<DecisionResponse> {
      const result = await pipeline.run(request);
      return result.response;
    },
    
    async registerScenario(scenario: Scenario): Promise<void> {
      const hash = await computeScenarioHash(scenario);
      scenarioRegistry.register(scenario, hash);
    },
    
    getPipeline(): Pipeline {
      return pipeline;
    },
    
    getScenarioRegistry(): ScenarioRegistry {
      return scenarioRegistry;
    },
    
    getAuditStore(): AuditStore {
      return auditStore;
    },
  };
}

/**
 * Create a minimal engine for testing (deterministic only)
 */
export async function createTestEngine(): Promise<Engine> {
  return createEngine({
    traceEnabled: true,
  });
}
