/**
 * Authority Patterns
 * 
 * Defines the canonical patterns for detecting authority boundary violations.
 * These patterns are versioned independently from the engine.
 * 
 * @version 1.0.0
 */

/**
 * Authority pattern definition
 */
export interface AuthorityPattern {
  id: string;
  description: string;
  pattern: RegExp;
  severity: 'error' | 'warning';
}

/**
 * Authority patterns configuration
 */
export interface AuthorityPatternsConfig {
  version: string;
  effective_date: string;
  patterns: AuthorityPattern[];
}

/**
 * Canonical authority patterns v1.0.0
 * 
 * These patterns detect when a skill attempts to exercise decision authority.
 */
export const AUTHORITY_PATTERNS_V1: AuthorityPatternsConfig = {
  version: '1.0.0',
  effective_date: '2026-01-16',
  patterns: [
    {
      id: 'AUTH-001',
      description: 'No prohibited action fields',
      pattern: /\b(selected_action|recommended_action|alternative_action|action_choice)\b/i,
      severity: 'error',
    },
    {
      id: 'AUTH-002',
      description: 'No recommendation language',
      pattern: /\b(i recommend|you should|instead|better option|consider instead|alternatively)\b/i,
      severity: 'error',
    },
    {
      id: 'AUTH-003',
      description: 'No alternative suggestion',
      pattern: /\b(better option|consider instead|alternatively|other option|different choice)\b/i,
      severity: 'error',
    },
    {
      id: 'AUTH-004',
      description: 'No score reference',
      pattern: /\b(score[ds]?\s*[:=]?\s*\d|ranked?\s+\d|\d+%\s+match|\d+\s*\/\s*\d+\s+rating)\b/i,
      severity: 'error',
    },
    {
      id: 'AUTH-005',
      description: 'No ranking reference',
      pattern: /\b(ranked|top choice|best option|first choice|highest rated|number one)\b/i,
      severity: 'error',
    },
    {
      id: 'AUTH-006',
      description: 'No guardrail commentary',
      pattern: /\b(despite|overriding|ignoring constraint|bypassing|working around)\b/i,
      severity: 'error',
    },
    {
      id: 'AUTH-007',
      description: 'No decision agency claims',
      pattern: /\b(i decided|i chose|we chose for you|i selected|we picked|i determined)\b/i,
      severity: 'error',
    },
  ],
};

/**
 * Check text against all authority patterns
 */
export function checkAuthorityPatterns(
  text: string,
  config: AuthorityPatternsConfig = AUTHORITY_PATTERNS_V1
): AuthorityViolation[] {
  const violations: AuthorityViolation[] = [];
  
  for (const pattern of config.patterns) {
    const match = pattern.pattern.exec(text);
    if (match) {
      violations.push({
        pattern_id: pattern.id,
        description: pattern.description,
        matched_text: match[0],
        severity: pattern.severity,
        pattern_version: config.version,
      });
    }
  }
  
  return violations;
}

/**
 * Authority violation result
 */
export interface AuthorityViolation {
  pattern_id: string;
  description: string;
  matched_text: string;
  severity: 'error' | 'warning';
  pattern_version: string;
}
