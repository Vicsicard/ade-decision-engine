/**
 * Decision Rationale Template Skill
 * 
 * A deterministic skill that generates human-readable rationale using
 * parameterized templates. This is the universal fallback skill for ADE.
 * 
 * @version 1.0.0
 * @type deterministic
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
    display_parameters?: Record<string, any>;
  };
  metadata: {
    skill_id: string;
    skill_version: string;
    generated_at: string;
    token_count: number;
    generation_ms: number;
  };
}

interface Template {
  template: string;
  condition?: string;
  inputs: string[];
}

interface TemplateConfig {
  templates: Record<string, Template>;
  template_selection_logic: {
    priority_order: string[];
  };
}

// Load template configuration
const config: TemplateConfig = {
  templates: {
    default: {
      template: "We selected {action_name} based on your recent activity and preferences.",
      inputs: ["action_metadata.name"]
    },
    high_engagement: {
      condition: "state.core.engagement_level > 0.7",
      template: "Great momentum! {action_name} will help you maintain your progress.",
      inputs: ["action_metadata.name"]
    },
    low_engagement: {
      condition: "state.core.engagement_level < 0.3",
      template: "Welcome back! {action_name} is a great way to get started again.",
      inputs: ["action_metadata.name"]
    },
    high_churn_risk: {
      condition: "state.core.churn_risk > 0.6",
      template: "{action_name} is designed to fit your schedule today.",
      inputs: ["action_metadata.name"]
    },
    new_user: {
      condition: "state.core.interaction_depth < 5",
      template: "Welcome! {action_name} is a great way to get started.",
      inputs: ["action_metadata.name"]
    }
  },
  template_selection_logic: {
    priority_order: [
      "high_churn_risk",
      "new_user", 
      "low_engagement",
      "high_engagement",
      "default"
    ]
  }
};

/**
 * Evaluate a simple condition expression against the input envelope
 */
function evaluateCondition(condition: string, input: SkillInputEnvelope): boolean {
  // Parse simple conditions like "state.core.engagement_level > 0.7"
  const match = condition.match(/^([\w.]+)\s*(>|<|>=|<=|==|!=)\s*([\d.]+)$/);
  if (!match) return false;
  
  const [, path, operator, valueStr] = match;
  const value = parseFloat(valueStr);
  
  // Navigate to the value in the input
  const actual = getNestedValue(input, path);
  if (actual === undefined || actual === null) return false;
  
  switch (operator) {
    case '>': return actual > value;
    case '<': return actual < value;
    case '>=': return actual >= value;
    case '<=': return actual <= value;
    case '==': return actual === value;
    case '!=': return actual !== value;
    default: return false;
  }
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Select the appropriate template based on conditions
 */
function selectTemplate(input: SkillInputEnvelope): { templateId: string; template: Template } {
  for (const templateId of config.template_selection_logic.priority_order) {
    const template = config.templates[templateId];
    if (!template) continue;
    
    // Default template always matches
    if (!template.condition) {
      return { templateId, template };
    }
    
    // Evaluate condition
    if (evaluateCondition(template.condition, input)) {
      return { templateId, template };
    }
  }
  
  // Fallback to default (should always exist)
  return { 
    templateId: 'default', 
    template: config.templates.default 
  };
}

/**
 * Render a template with values from the input
 */
function renderTemplate(template: string, input: SkillInputEnvelope): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    // Map common keys to their paths
    const keyMappings: Record<string, string> = {
      'action_name': 'decision_context.action_metadata.name',
      'action_type': 'decision_context.action_metadata.type',
      'action_id': 'decision_context.selected_action'
    };
    
    const path = keyMappings[key] || key;
    const value = getNestedValue(input, path);
    
    // Return the value or the original placeholder if not found
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Main execution function for the skill
 */
export function execute(input: SkillInputEnvelope): SkillOutput {
  const startTime = Date.now();
  
  // Select template based on user state
  const { templateId, template } = selectTemplate(input);
  
  // Render the template
  const rationale = renderTemplate(template.template, input);
  
  // Get action name for display title
  const actionName = getNestedValue(input, 'decision_context.action_metadata.name') 
    || getNestedValue(input, 'decision_context.selected_action')
    || 'Selected Action';
  
  const generationMs = Date.now() - startTime;
  
  // Build output
  const output: SkillOutput = {
    payload: {
      rationale,
      display_title: String(actionName),
      display_parameters: {
        template_used: templateId,
        personalization_level: templateId === 'default' ? 'none' : 'low'
      }
    },
    metadata: {
      skill_id: 'decision_rationale_template',
      skill_version: '1.0.0',
      generated_at: new Date().toISOString(),
      token_count: 0,
      generation_ms: generationMs
    }
  };
  
  return output;
}

/**
 * Health check for the skill
 */
export function isAvailable(): boolean {
  return true; // Deterministic skill is always available
}

/**
 * Latency estimate for the skill
 */
export function getLatencyEstimate(): number {
  return 5; // ~5ms typical execution
}
