/**
 * Replay Comparator
 * 
 * CLI tooling for comparing decisions and debugging determinism issues.
 * Takes a decision_id or replay_token and prints:
 * - Critical field diffs only
 * - Stage-by-stage diffs
 * 
 * This is the "flight recorder debugger" for ADE.
 * 
 * @version 1.0.0
 */

import type { AuditTrace, DecisionResponse, StageTrace } from '../core/types.js';
import { DETERMINISM_CRITICAL_FIELDS, DETERMINISM_IGNORED_FIELDS } from '../replay/reexecute.js';

/**
 * Comparison result
 */
export interface ComparisonResult {
  decision_id: string;
  determinism_verified: boolean;
  critical_diffs: FieldDiff[];
  stage_diffs: StageDiff[];
  summary: string;
}

/**
 * Field-level diff
 */
export interface FieldDiff {
  path: string;
  original: unknown;
  replay: unknown;
  severity: 'critical' | 'minor' | 'ignored';
}

/**
 * Stage-level diff
 */
export interface StageDiff {
  stage_name: string;
  stage_number: number;
  duration_diff_ms: number;
  artifact_diffs: FieldDiff[];
}

/**
 * Compare two audit traces
 */
export function compareTraces(
  original: AuditTrace,
  replay: AuditTrace
): ComparisonResult {
  const criticalDiffs: FieldDiff[] = [];
  const stageDiffs: StageDiff[] = [];
  
  // Compare critical fields in final decision
  compareCriticalFields(
    original.final_decision,
    replay.final_decision,
    'final_decision',
    criticalDiffs
  );
  
  // Compare stage-by-stage
  const stageNames = Object.keys(original.stages) as Array<keyof typeof original.stages>;
  
  for (const stageName of stageNames) {
    const origStage = original.stages[stageName];
    const replayStage = replay.stages[stageName];
    
    if (!origStage || !replayStage) continue;
    
    const stageDiff = compareStages(stageName, origStage, replayStage);
    if (stageDiff.artifact_diffs.length > 0 || Math.abs(stageDiff.duration_diff_ms) > 100) {
      stageDiffs.push(stageDiff);
    }
  }
  
  const determinismVerified = criticalDiffs.filter(d => d.severity === 'critical').length === 0;
  
  return {
    decision_id: original.decision_id,
    determinism_verified: determinismVerified,
    critical_diffs: criticalDiffs,
    stage_diffs: stageDiffs,
    summary: generateSummary(determinismVerified, criticalDiffs, stageDiffs),
  };
}

/**
 * Compare critical fields between two decision responses
 */
function compareCriticalFields(
  original: DecisionResponse,
  replay: DecisionResponse,
  prefix: string,
  diffs: FieldDiff[]
): void {
  // selected_action
  if (original.decision.selected_action !== replay.decision.selected_action) {
    diffs.push({
      path: `${prefix}.decision.selected_action`,
      original: original.decision.selected_action,
      replay: replay.decision.selected_action,
      severity: 'critical',
    });
  }
  
  // ranked_options
  const origRanked = original.decision.ranked_options;
  const replayRanked = replay.decision.ranked_options;
  
  if (origRanked.length !== replayRanked.length) {
    diffs.push({
      path: `${prefix}.decision.ranked_options.length`,
      original: origRanked.length,
      replay: replayRanked.length,
      severity: 'critical',
    });
  } else {
    for (let i = 0; i < origRanked.length; i++) {
      const orig = origRanked[i];
      const rep = replayRanked[i];
      
      if (!orig || !rep) continue;
      
      if (orig.action_id !== rep.action_id) {
        diffs.push({
          path: `${prefix}.decision.ranked_options[${i}].action_id`,
          original: orig.action_id,
          replay: rep.action_id,
          severity: 'critical',
        });
      }
      
      if (orig.rank !== rep.rank) {
        diffs.push({
          path: `${prefix}.decision.ranked_options[${i}].rank`,
          original: orig.rank,
          replay: rep.rank,
          severity: 'critical',
        });
      }
      
      // Allow small floating point differences
      if (Math.abs(orig.score - rep.score) > 0.0001) {
        diffs.push({
          path: `${prefix}.decision.ranked_options[${i}].score`,
          original: orig.score,
          replay: rep.score,
          severity: 'critical',
        });
      }
    }
  }
  
  // guardrails_applied (set comparison)
  const origGuardrails = new Set(original.guardrails_applied);
  const replayGuardrails = new Set(replay.guardrails_applied);
  
  for (const g of origGuardrails) {
    if (!replayGuardrails.has(g)) {
      diffs.push({
        path: `${prefix}.guardrails_applied`,
        original: `contains ${g}`,
        replay: `missing ${g}`,
        severity: 'critical',
      });
    }
  }
  
  for (const g of replayGuardrails) {
    if (!origGuardrails.has(g)) {
      diffs.push({
        path: `${prefix}.guardrails_applied`,
        original: `missing ${g}`,
        replay: `contains ${g}`,
        severity: 'critical',
      });
    }
  }
  
  // state.core
  compareObjects(
    original.state.core,
    replay.state.core,
    `${prefix}.state.core`,
    diffs,
    'critical'
  );
}

/**
 * Compare two stage traces
 */
function compareStages(
  stageName: string,
  original: StageTrace,
  replay: StageTrace
): StageDiff {
  const artifactDiffs: FieldDiff[] = [];
  
  // Compare artifacts
  compareObjects(
    original.artifacts,
    replay.artifacts,
    `stages.${stageName}.artifacts`,
    artifactDiffs,
    'minor'
  );
  
  return {
    stage_name: stageName,
    stage_number: original.stage_number,
    duration_diff_ms: replay.duration_ms - original.duration_ms,
    artifact_diffs: artifactDiffs,
  };
}

/**
 * Compare two objects recursively
 */
function compareObjects(
  original: Record<string, unknown>,
  replay: Record<string, unknown>,
  prefix: string,
  diffs: FieldDiff[],
  defaultSeverity: 'critical' | 'minor'
): void {
  const allKeys = new Set([...Object.keys(original), ...Object.keys(replay)]);
  
  for (const key of allKeys) {
    const path = `${prefix}.${key}`;
    const origValue = original[key];
    const replayValue = replay[key];
    
    // Check if this path should be ignored
    if (DETERMINISM_IGNORED_FIELDS.some(f => path.includes(f))) {
      continue;
    }
    
    // Determine severity
    const severity = DETERMINISM_CRITICAL_FIELDS.some(f => path.includes(f))
      ? 'critical'
      : defaultSeverity;
    
    if (typeof origValue === 'object' && origValue !== null &&
        typeof replayValue === 'object' && replayValue !== null) {
      // Recurse
      compareObjects(
        origValue as Record<string, unknown>,
        replayValue as Record<string, unknown>,
        path,
        diffs,
        defaultSeverity
      );
    } else if (JSON.stringify(origValue) !== JSON.stringify(replayValue)) {
      diffs.push({
        path,
        original: origValue,
        replay: replayValue,
        severity,
      });
    }
  }
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  verified: boolean,
  criticalDiffs: FieldDiff[],
  stageDiffs: StageDiff[]
): string {
  if (verified && criticalDiffs.length === 0) {
    return 'Determinism verified. No critical differences found.';
  }
  
  const criticalCount = criticalDiffs.filter(d => d.severity === 'critical').length;
  const stageCount = stageDiffs.length;
  
  return `Determinism FAILED. ${criticalCount} critical diff(s), ${stageCount} stage(s) with differences.`;
}

/**
 * Format comparison result for console output
 */
export function formatComparisonResult(result: ComparisonResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    REPLAY COMPARISON REPORT                    ');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Decision ID: ${result.decision_id}`);
  lines.push(`Determinism: ${result.determinism_verified ? '✅ VERIFIED' : '❌ FAILED'}`);
  lines.push('');
  
  if (result.critical_diffs.length > 0) {
    lines.push('─── CRITICAL DIFFERENCES ───────────────────────────────────────');
    for (const diff of result.critical_diffs) {
      if (diff.severity === 'critical') {
        lines.push(`  ${diff.path}:`);
        lines.push(`    original: ${JSON.stringify(diff.original)}`);
        lines.push(`    replay:   ${JSON.stringify(diff.replay)}`);
      }
    }
    lines.push('');
  }
  
  if (result.stage_diffs.length > 0) {
    lines.push('─── STAGE DIFFERENCES ──────────────────────────────────────────');
    for (const stage of result.stage_diffs) {
      lines.push(`  Stage ${stage.stage_number}: ${stage.stage_name}`);
      lines.push(`    duration diff: ${stage.duration_diff_ms.toFixed(2)}ms`);
      
      if (stage.artifact_diffs.length > 0) {
        lines.push(`    artifact diffs:`);
        for (const diff of stage.artifact_diffs) {
          lines.push(`      ${diff.path}: ${JSON.stringify(diff.original)} → ${JSON.stringify(diff.replay)}`);
        }
      }
    }
    lines.push('');
  }
  
  lines.push('─── SUMMARY ────────────────────────────────────────────────────');
  lines.push(`  ${result.summary}`);
  lines.push('');
  
  return lines.join('\n');
}
