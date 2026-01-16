/**
 * Prohibitions
 * 
 * Defines universal and skill-specific prohibition patterns.
 * These patterns detect prohibited content in skill outputs.
 * 
 * @version 1.0.0
 */

/**
 * Prohibition definition
 */
export interface Prohibition {
  id: string;
  category: string;
  pattern: RegExp;
  reason: string;
}

/**
 * Prohibitions configuration
 */
export interface ProhibitionsConfig {
  version: string;
  universal: Prohibition[];
  pii_patterns: Prohibition[];
}

/**
 * Universal prohibitions v1.0.0
 */
export const PROHIBITIONS_V1: ProhibitionsConfig = {
  version: '1.0.0',
  universal: [
    {
      id: 'PROHIB-001',
      category: 'decision_override',
      pattern: /\b(i recommend|you should|instead of)\b/i,
      reason: 'Decision override language not allowed',
    },
    {
      id: 'PROHIB-002',
      category: 'medical_claims',
      pattern: /\b(cure|treat|diagnose|medical advice|prescription)\b/i,
      reason: 'Medical claims not allowed',
    },
    {
      id: 'PROHIB-003',
      category: 'legal_claims',
      pattern: /\b(legal advice|legally you|lawsuit|liability)\b/i,
      reason: 'Legal claims not allowed',
    },
    {
      id: 'PROHIB-004',
      category: 'financial_advice',
      pattern: /\b(invest|financial advice|guaranteed return|stock tip)\b/i,
      reason: 'Financial advice not allowed',
    },
    {
      id: 'PROHIB-005',
      category: 'urgency_manipulation',
      pattern: /\b(act now|limited time|don't miss|last chance|urgent)\b/i,
      reason: 'Urgency manipulation not allowed',
    },
    {
      id: 'PROHIB-006',
      category: 'negative_framing',
      pattern: /\b(you failed|you're behind|disappointing|poor performance)\b/i,
      reason: 'Negative framing not allowed',
    },
  ],
  pii_patterns: [
    {
      id: 'PII-EMAIL',
      category: 'pii',
      pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      reason: 'Email address detected',
    },
    {
      id: 'PII-PHONE',
      category: 'pii',
      pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      reason: 'Phone number detected',
    },
    {
      id: 'PII-SSN',
      category: 'pii',
      pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/,
      reason: 'SSN pattern detected',
    },
  ],
};

/**
 * Check text against all prohibition patterns
 */
export function checkProhibitions(
  text: string,
  config: ProhibitionsConfig = PROHIBITIONS_V1,
  include_pii: boolean = true
): ProhibitionViolation[] {
  const violations: ProhibitionViolation[] = [];
  
  // Check universal prohibitions
  for (const prohibition of config.universal) {
    const match = prohibition.pattern.exec(text);
    if (match) {
      violations.push({
        prohibition_id: prohibition.id,
        category: prohibition.category,
        matched_text: match[0],
        reason: prohibition.reason,
      });
    }
  }
  
  // Check PII patterns if enabled
  if (include_pii) {
    for (const prohibition of config.pii_patterns) {
      const match = prohibition.pattern.exec(text);
      if (match) {
        violations.push({
          prohibition_id: prohibition.id,
          category: prohibition.category,
          matched_text: '[REDACTED]', // Don't log actual PII
          reason: prohibition.reason,
        });
      }
    }
  }
  
  return violations;
}

/**
 * Prohibition violation result
 */
export interface ProhibitionViolation {
  prohibition_id: string;
  category: string;
  matched_text: string;
  reason: string;
}
