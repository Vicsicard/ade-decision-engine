/**
 * Decision Rationale LLM Skill
 * 
 * An LLM-powered skill that generates personalized, context-aware rationale.
 * Falls back to decision_rationale_template on failure or timeout.
 * 
 * @version 1.0.0
 * @type llm
 */

// Type definitions (inline for V1 stub)
interface SkillInputEnvelope {
  decision_context: {
    decision_id: string;
    selected_action: string;
    action_metadata: Record<string, any>;
    ranked_options: Array<{ action_id: string; score: number; rank: number }>;
    guardrails_applied: string[];
  };
  user_state: {
    core: {
      engagement_level: number;
      recency_score: number;
      interaction_depth: number;
      churn_risk: number;
    };
    scenario_extensions: Record<string, any>;
  };
  skill_config: {
    skill_id: string;
    skill_version: string;
    execution_mode: string;
    max_output_tokens: number;
    timeout_ms: number;
    custom_parameters: Record<string, any>;
  };
}

interface SkillOutput {
  payload: {
    rationale: string;
    display_title?: string;
    encouragement?: string;
    display_parameters?: Record<string, any>;
  };
  metadata: {
    skill_id: string;
    skill_version: string;
    generated_at: string;
    token_count: number;
    generation_ms: number;
    model_id?: string;
  };
}

interface LLMExecutor {
  complete(prompt: string, options: LLMOptions): Promise<LLMResponse>;
  isAvailable(): boolean;
  getLatencyEstimate(): number;
}

interface LLMOptions {
  system_prompt: string;
  max_tokens: number;
  temperature: number;
  timeout_ms: number;
}

interface LLMResponse {
  content: string;
  token_count: number;
  model_id: string;
  latency_ms: number;
}

// Prompt configuration
const PROMPT_CONFIG = {
  system_prompt: `You are a helpful assistant that generates brief, encouraging rationale for user decisions. You explain WHY a particular action was selected for the user based on their current state. You NEVER recommend different actions, suggest alternatives, or mention scores/rankings. Keep responses under 100 words. Be warm but concise.`,
  
  user_prompt_template: `Generate a brief, encouraging rationale for why {action_name} was selected for a user with the following state:

- Engagement: {engagement_description}
- Recent activity: {recency_description}
- Experience level: {depth_description}

The rationale should:
1. Acknowledge their current state positively
2. Explain why this action fits them right now
3. Be encouraging without being pushy

Respond with ONLY the rationale text, nothing else.`,
  
  max_tokens: 150,
  temperature: 0.7
};

// State description mappings
const STATE_DESCRIPTIONS = {
  engagement: {
    high: "highly engaged and consistent",
    medium: "moderately engaged",
    low: "getting back into the routine"
  },
  recency: {
    recent: "recently active",
    moderate: "returning after a short break",
    distant: "coming back after some time away"
  },
  depth: {
    new: "just getting started",
    developing: "building good habits",
    experienced: "experienced and committed"
  }
};

/**
 * Get engagement description based on level
 */
function getEngagementDescription(level: number): string {
  if (level > 0.7) return STATE_DESCRIPTIONS.engagement.high;
  if (level > 0.3) return STATE_DESCRIPTIONS.engagement.medium;
  return STATE_DESCRIPTIONS.engagement.low;
}

/**
 * Get recency description based on score
 */
function getRecencyDescription(score: number): string {
  if (score > 0.7) return STATE_DESCRIPTIONS.recency.recent;
  if (score > 0.3) return STATE_DESCRIPTIONS.recency.moderate;
  return STATE_DESCRIPTIONS.recency.distant;
}

/**
 * Get depth description based on interaction count
 */
function getDepthDescription(depth: number): string {
  if (depth < 5) return STATE_DESCRIPTIONS.depth.new;
  if (depth < 20) return STATE_DESCRIPTIONS.depth.developing;
  return STATE_DESCRIPTIONS.depth.experienced;
}

/**
 * Build the user prompt from template and input
 */
function buildUserPrompt(input: SkillInputEnvelope): string {
  const actionName = input.decision_context.action_metadata?.name 
    || input.decision_context.selected_action;
  
  const engagementDesc = getEngagementDescription(input.user_state.core.engagement_level);
  const recencyDesc = getRecencyDescription(input.user_state.core.recency_score);
  const depthDesc = getDepthDescription(input.user_state.core.interaction_depth);
  
  return PROMPT_CONFIG.user_prompt_template
    .replace('{action_name}', actionName)
    .replace('{engagement_description}', engagementDesc)
    .replace('{recency_description}', recencyDesc)
    .replace('{depth_description}', depthDesc);
}

/**
 * Determine tone based on user state
 */
function determineTone(input: SkillInputEnvelope): string {
  const { engagement_level, churn_risk } = input.user_state.core;
  
  if (churn_risk > 0.6) return 'supportive';
  if (engagement_level > 0.7) return 'energetic';
  if (engagement_level < 0.3) return 'motivational';
  return 'calm';
}

// LLM Executor stub - to be replaced with actual implementation
let llmExecutor: LLMExecutor | null = null;

/**
 * Register an LLM executor (called by engine at startup)
 */
export function registerExecutor(executor: LLMExecutor): void {
  llmExecutor = executor;
}

/**
 * Main execution function for the skill
 */
export async function execute(input: SkillInputEnvelope): Promise<SkillOutput> {
  const startTime = Date.now();
  
  if (!llmExecutor || !llmExecutor.isAvailable()) {
    throw new Error('LLM executor not available');
  }
  
  // Build prompt
  const userPrompt = buildUserPrompt(input);
  
  // Call LLM
  const response = await llmExecutor.complete(userPrompt, {
    system_prompt: PROMPT_CONFIG.system_prompt,
    max_tokens: PROMPT_CONFIG.max_tokens,
    temperature: PROMPT_CONFIG.temperature,
    timeout_ms: input.skill_config.timeout_ms || 300
  });
  
  const generationMs = Date.now() - startTime;
  
  // Get action name for display
  const actionName = input.decision_context.action_metadata?.name 
    || input.decision_context.selected_action;
  
  // Build output
  const output: SkillOutput = {
    payload: {
      rationale: response.content.trim(),
      display_title: actionName,
      display_parameters: {
        tone: determineTone(input),
        personalization_level: 'high'
      }
    },
    metadata: {
      skill_id: 'decision_rationale_llm',
      skill_version: '1.0.0',
      generated_at: new Date().toISOString(),
      token_count: response.token_count,
      generation_ms: generationMs,
      model_id: response.model_id
    }
  };
  
  return output;
}

/**
 * Health check for the skill
 */
export function isAvailable(): boolean {
  return llmExecutor !== null && llmExecutor.isAvailable();
}

/**
 * Latency estimate for the skill
 */
export function getLatencyEstimate(): number {
  if (!llmExecutor) return 500; // Conservative estimate
  return llmExecutor.getLatencyEstimate();
}
