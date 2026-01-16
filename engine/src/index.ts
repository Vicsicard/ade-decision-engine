/**
 * ADE Engine - Reference Implementation
 * 
 * Adaptive Decision Engine v1.0.0
 * 
 * @version 1.0.0
 */

// Core types
export type {
  DecisionRequest,
  DecisionResponse,
  Action,
  RequestContext,
  RequestOptions,
  ExecutionMode,
  Decision,
  DecisionPayload,
  RankedOption,
  ScoreBreakdown,
  ExecutionInfo,
  AuditInfo,
  ResponseMeta,
  UserState,
  CoreStateDimensions,
  ExecutionCapabilities,
  Scenario,
  ScenarioMetadata,
  StateSchema,
  DimensionDefinition,
  DerivationConfig,
  ActionsConfig,
  ActionType,
  AttributeDefinition,
  GuardrailsConfig,
  GuardrailRule,
  GuardrailEffect,
  GuardrailResult,
  ScoringConfig,
  ScoringObjective,
  ExecutionRiskConfig,
  ExecutionRiskFactor,
  SkillsConfig,
  SkillReference,
  ActionSkillMapping,
  SkillExecutionContract,
  SECDefinition,
  InvariantsConfig,
  SkillInvariant,
  ProhibitionsConfig,
  SkillProhibition,
  TimeoutConfig,
  ExecutionConfig,
  TimeoutsConfig,
  RetryPolicy,
  SkillInputEnvelope,
  SkillDecisionContext,
  SkillUserState,
  SkillConfig,
  SkillOutput,
  SkillOutputMetadata,
  MemoryEntry,
  InteractionRecord,
  AuditTrace,
  StageTraces,
  StageTrace,
  ValidationResult,
  ValidationViolation,
  ValidationPipelineResult,
  ADEErrorCode,
} from './core/types.js';

// Core errors
export {
  ADEError,
  InvalidRequestError,
  InvalidScenarioError,
  InvalidActionTypeError,
  NoEligibleActionsError,
  SkillTimeoutError,
  SkillValidationError,
  InternalError,
} from './core/errors.js';

// Decision envelope
export {
  createEnvelope,
  lockSelection,
  verifySelectionIntegrity,
  getFinalPayload,
  buildResponse,
} from './core/decision-envelope.js';
export type { DecisionEnvelope } from './core/decision-envelope.js';

// Stage interfaces
export type {
  Stage,
  StageContext,
  StageResult,
  IngestArtifacts,
  DeriveStateArtifacts,
  EvaluateGuardrailsArtifacts,
  ScoreAndRankArtifacts,
  ResolveSkillsArtifacts,
  ExecuteSkillArtifacts,
  ValidateOutputArtifacts,
  FallbackArtifacts,
  AuditAndReplayArtifacts,
} from './core/stage-interface.js';

// Storage interfaces
export type {
  AuditStore,
  AuditStoreConfig,
} from './storage/audit-store.js';

export type {
  MemoryStore,
  MemoryStoreConfig,
} from './storage/memory-store.js';
export { buildMemoryKey } from './storage/memory-store.js';

// Executor interfaces
export type {
  Executor,
  ExecutorResult,
  ExecutorError,
  ExecutorRegistry,
} from './executors/executor-interface.js';

// Scenario interfaces
export type {
  ScenarioLoader,
  ScenarioReference,
  ScenarioRegistry,
} from './scenario/loader.js';
export { computeScenarioHash } from './scenario/loader.js';

// Validator interfaces
export type {
  Validator,
  SchemaValidator,
  InvariantValidator,
  AuthorityValidator,
  ProhibitionValidator,
  ValidationPipeline,
} from './validators/validator-interface.js';

// Governance
export {
  AUTHORITY_PATTERNS_V1,
  checkAuthorityPatterns,
} from './governance/authority-patterns.js';
export type {
  AuthorityPattern,
  AuthorityPatternsConfig,
  AuthorityViolation,
} from './governance/authority-patterns.js';

export {
  PROHIBITIONS_V1,
  checkProhibitions,
} from './governance/prohibitions.js';
export type {
  Prohibition,
  ProhibitionsConfig as GovernanceProhibitionsConfig,
  ProhibitionViolation,
} from './governance/prohibitions.js';

// Replay
export {
  DETERMINISM_CRITICAL_FIELDS,
  DETERMINISM_IGNORED_FIELDS,
  compareValues,
} from './replay/reexecute.js';
export type {
  ReplayResult,
  ReplayDifference,
  ReplayExecutor,
} from './replay/reexecute.js';

// Engine
export { createEngine, createTestEngine } from './engine.js';
export type { Engine, EngineConfig } from './engine.js';

// Stages
export {
  createIngestStage,
  createDeriveStateStage,
  createEvaluateGuardrailsStage,
  createScoreAndRankStage,
  createResolveSkillsStage,
  createExecuteSkillStage,
  createValidateOutputStage,
  createFallbackStage,
  createAuditAndReplayStage,
} from './stages/index.js';

// Executors
export { createDeterministicExecutor } from './executors/deterministic-executor.js';
export { createExecutorRegistry } from './executors/registry.js';

// Storage adapters
export { createLocalAuditStore } from './storage/adapters/local-audit.js';
export { createLocalMemoryStore } from './storage/adapters/local-memory.js';

// Scenario registry
export { createScenarioRegistry } from './scenario/registry.js';

// API
export { route, createRouter } from './api/routes.js';
export type { RouterConfig, HttpRequest, HttpResponse } from './api/routes.js';
export { handleDecide } from './api/handlers/decide.js';
export { handleReplay, handleReplayByToken } from './api/handlers/replay.js';
export { handleHealth } from './api/handlers/health.js';
export { handleFeedback } from './api/handlers/feedback.js';
