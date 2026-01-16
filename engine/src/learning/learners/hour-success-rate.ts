/**
 * HourSuccessRateLearner
 * 
 * First canonical V2 learner - deliberately boring and safe.
 * 
 * Inputs:
 * - decision timestamps
 * - feedback.completed
 * 
 * Output:
 * - learned.engagement.hour_success_rate[0..23]
 * 
 * Use:
 * - Scenario may optionally read it as a signal input
 * - Default behavior unchanged if missing
 * 
 * This is the ideal proof-of-safety learner.
 */

import type { Learner, LearnerInput, LearnerResult } from '../learner-interface.js';

/**
 * Tracks success rate by hour of day
 */
interface HourStats {
  total: number;
  completed: number;
}

/**
 * HourSuccessRateLearner
 * 
 * Computes engagement success rate by hour of day.
 * Writes to: learned.engagement.hour_success_rate
 */
export class HourSuccessRateLearner implements Learner {
  learner_id = 'hour-success-rate';
  version = '1.0.0';

  async process(input: LearnerInput): Promise<LearnerResult> {
    const computedAt = new Date().toISOString();

    // If no feedback, nothing to learn
    if (!input.feedback) {
      return {
        memory_updates: [],
        metadata: {
          computed_at: computedAt,
          notes: 'No feedback available, skipping',
        },
      };
    }

    // Extract hour from decision timestamp
    const decisionTime = new Date(input.audit.timestamp);
    const hour = decisionTime.getUTCHours();

    // Get existing stats from memory snapshot
    const existingStats = this.getExistingStats(input.memory_snapshot);

    // Update stats for this hour
    const hourKey = hour.toString().padStart(2, '0');
    const currentStats = existingStats[hourKey] || { total: 0, completed: 0 };
    
    currentStats.total += 1;
    if (input.feedback.completed) {
      currentStats.completed += 1;
    }

    existingStats[hourKey] = currentStats;

    // Compute success rates for all hours
    const successRates: Record<string, number> = {};
    for (const [h, stats] of Object.entries(existingStats)) {
      if (stats.total > 0) {
        successRates[h] = Math.round((stats.completed / stats.total) * 100) / 100;
      }
    }

    return {
      memory_updates: [
        {
          namespace: 'learned.engagement',
          key: 'hour_stats',
          value: existingStats,
        },
        {
          namespace: 'learned.engagement',
          key: 'hour_success_rate',
          value: successRates,
        },
      ],
      metadata: {
        computed_at: computedAt,
        confidence: this.computeConfidence(existingStats),
        notes: `Updated hour ${hourKey}: ${currentStats.completed}/${currentStats.total} completed`,
      },
    };
  }

  /**
   * Extract existing hour stats from memory snapshot
   */
  private getExistingStats(snapshot: Record<string, unknown>): Record<string, HourStats> {
    const existing = snapshot['learned.engagement.hour_stats'];
    
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      return existing as Record<string, HourStats>;
    }
    
    return {};
  }

  /**
   * Compute confidence based on sample size
   */
  private computeConfidence(stats: Record<string, HourStats>): number {
    const totalSamples = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
    
    // Confidence increases with sample size, maxes at ~100 samples
    if (totalSamples === 0) return 0;
    if (totalSamples >= 100) return 1;
    
    return Math.round((totalSamples / 100) * 100) / 100;
  }
}

/**
 * Create a new HourSuccessRateLearner instance
 */
export function createHourSuccessRateLearner(): HourSuccessRateLearner {
  return new HourSuccessRateLearner();
}
