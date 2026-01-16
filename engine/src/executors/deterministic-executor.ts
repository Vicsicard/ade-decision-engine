/**
 * Deterministic Executor
 * 
 * Executes deterministic (template-based) skills.
 * Always available, no external dependencies.
 * 
 * @version 1.0.0
 */

import type { Executor, ExecutorResult, ExecutorError } from './executor-interface.js';
import type { SkillInputEnvelope, SkillOutput, DecisionPayload } from '../core/types.js';

interface TemplateConfig {
  template: string;
  condition?: string;
}

interface SkillTemplates {
  templates: Record<string, TemplateConfig>;
  priority_order: string[];
}

const DEFAULT_TEMPLATES: SkillTemplates = {
  templates: {
    default: {
      template: "We selected {action_name} based on your recent activity and preferences.",
    },
    high_engagement: {
      condition: "state.core.engagement_level > 0.7",
      template: "Great momentum! {action_name} will help you maintain your progress.",
    },
    low_engagement: {
      condition: "state.core.engagement_level < 0.3",
      template: "Welcome back! {action_name} is a great way to get started again.",
    },
    high_churn_risk: {
      condition: "state.core.churn_risk > 0.6",
      template: "{action_name} is designed to fit your schedule today.",
    },
    new_user: {
      condition: "state.core.interaction_depth < 5",
      template: "Welcome! {action_name} is a great way to get started.",
    },
  },
  priority_order: [
    "high_churn_risk",
    "new_user",
    "low_engagement",
    "high_engagement",
    "default",
  ],
};

export class DeterministicExecutor implements Executor {
  readonly type = 'deterministic_only' as const;
  
  private readonly templates: Map<string, SkillTemplates> = new Map();
  
  constructor() {
    // Register default templates
    this.templates.set('decision_rationale_template', DEFAULT_TEMPLATES);
  }
  
  isAvailable(): boolean {
    return true; // Always available
  }
  
  getLatencyEstimate(): number {
    return 5; // ~5ms typical
  }
  
  async execute(
    skill_id: string,
    skill_version: string,
    input: SkillInputEnvelope,
    timeout_ms: number
  ): Promise<ExecutorResult> {
    const startTime = performance.now();
    
    try {
      // Get templates for this skill
      const skillTemplates = this.templates.get(skill_id) ?? DEFAULT_TEMPLATES;
      
      // Select template based on user state
      const selectedTemplate = this.selectTemplate(skillTemplates, input);
      
      // Render template
      const rationale = this.renderTemplate(selectedTemplate.template, input);
      
      // Get action name for display
      const actionName = this.getActionName(input);
      
      // Build output
      const payload: DecisionPayload = {
        rationale,
        display_title: actionName,
        display_parameters: {
          template_used: selectedTemplate.id,
          personalization_level: selectedTemplate.id === 'default' ? 'none' : 'low',
        },
      };
      
      const output: SkillOutput = {
        payload,
        metadata: {
          skill_id,
          skill_version,
          generated_at: new Date().toISOString(),
          token_count: 0,
          generation_ms: performance.now() - startTime,
        },
      };
      
      return {
        success: true,
        output,
        error: null,
        execution_ms: performance.now() - startTime,
        token_count: 0,
      };
      
    } catch (err) {
      const error: ExecutorError = {
        code: 'EXECUTION_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
      
      return {
        success: false,
        output: null,
        error,
        execution_ms: performance.now() - startTime,
        token_count: 0,
      };
    }
  }
  
  private selectTemplate(
    config: SkillTemplates,
    input: SkillInputEnvelope
  ): { id: string; template: string } {
    for (const templateId of config.priority_order) {
      const template = config.templates[templateId];
      if (!template) continue;
      
      // Default template always matches
      if (!template.condition) {
        return { id: templateId, template: template.template };
      }
      
      // Evaluate condition
      if (this.evaluateCondition(template.condition, input)) {
        return { id: templateId, template: template.template };
      }
    }
    
    // Fallback to default
    return { 
      id: 'default', 
      template: config.templates['default']?.template ?? 'Decision made based on your current state.',
    };
  }
  
  private evaluateCondition(condition: string, input: SkillInputEnvelope): boolean {
    // Parse simple conditions like "state.core.engagement_level > 0.7"
    const match = condition.match(/^([\w.]+)\s*(>|<|>=|<=|==|!=)\s*([\d.]+)$/);
    if (!match) return false;
    
    const [, path, operator, valueStr] = match;
    const value = parseFloat(valueStr as string);
    
    // Navigate to the value in the input
    const actual = this.getNestedValue(input, path as string);
    if (actual === undefined || actual === null) return false;
    
    const actualNum = typeof actual === 'number' ? actual : parseFloat(String(actual));
    
    switch (operator) {
      case '>': return actualNum > value;
      case '<': return actualNum < value;
      case '>=': return actualNum >= value;
      case '<=': return actualNum <= value;
      case '==': return actualNum === value;
      case '!=': return actualNum !== value;
      default: return false;
    }
  }
  
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    
    // Handle special prefixes
    if (parts[0] === 'state' && parts[1]) {
      // Map to user_state
      current = (obj as SkillInputEnvelope).user_state;
      parts.shift(); // Remove 'state'
    }
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }
  
  private renderTemplate(template: string, input: SkillInputEnvelope): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      switch (key) {
        case 'action_name':
          return this.getActionName(input);
        case 'action_type':
          return String(input.decision_context.action_metadata['type_id'] ?? 'action');
        case 'action_id':
          return input.decision_context.selected_action;
        default:
          return match;
      }
    });
  }
  
  private getActionName(input: SkillInputEnvelope): string {
    const metadata = input.decision_context.action_metadata;
    
    // Try various name fields
    const name = metadata['name'] 
      ?? metadata['display_name'] 
      ?? metadata['type_id']
      ?? input.decision_context.selected_action;
    
    // Capitalize and format
    return this.formatActionName(String(name));
  }
  
  private formatActionName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  
  /**
   * Register custom templates for a skill
   */
  registerTemplates(skill_id: string, templates: SkillTemplates): void {
    this.templates.set(skill_id, templates);
  }
}

export function createDeterministicExecutor(): DeterministicExecutor {
  return new DeterministicExecutor();
}
