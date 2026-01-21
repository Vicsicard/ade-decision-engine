-- DDR Runtime D1 Schema
-- Phase 5.2: Decision Events + Aggregates
--
-- Tables:
-- 1. decision_events - Append-only decision log
-- 2. daily_aggregates - Rollup summaries

-- =============================================================================
-- decision_events: Append-only decision log
-- =============================================================================
-- Stores enough to answer:
-- - What decision was made
-- - What contract path triggered it
-- - Latency
-- - Guardrail triggers
-- - Cohort (control vs treatment)

CREATE TABLE IF NOT EXISTS decision_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  scenario_version TEXT NOT NULL,
  selected_action_id TEXT NOT NULL,
  decision_code TEXT NOT NULL,
  guardrail_flags TEXT, -- JSON array of triggered guardrails
  latency_ms INTEGER NOT NULL,
  cohort TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_decision_events_timestamp ON decision_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_decision_events_user_id ON decision_events(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_events_cohort ON decision_events(cohort);
CREATE INDEX IF NOT EXISTS idx_decision_events_scenario ON decision_events(scenario_id, scenario_version);

-- =============================================================================
-- daily_aggregates: Rollup summaries
-- =============================================================================
-- Computed nightly or on-write incremental counts:
-- - Total decisions
-- - Approvals/refusals
-- - Guardrail trigger rate
-- - Latency p50/p95 approximations

CREATE TABLE IF NOT EXISTS daily_aggregates (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  scenario_version TEXT NOT NULL,
  cohort TEXT NOT NULL,
  
  -- Counts
  total_decisions INTEGER DEFAULT 0,
  approvals INTEGER DEFAULT 0,
  refusals INTEGER DEFAULT 0,
  guardrail_triggers INTEGER DEFAULT 0,
  
  -- Latency stats (approximations)
  latency_sum_ms INTEGER DEFAULT 0,
  latency_count INTEGER DEFAULT 0,
  latency_min_ms INTEGER,
  latency_max_ms INTEGER,
  
  -- Outcome tracking (if host app reports)
  outcomes_reported INTEGER DEFAULT 0,
  outcomes_completed INTEGER DEFAULT 0,
  outcomes_dropped INTEGER DEFAULT 0,
  
  -- Metadata
  last_updated TEXT NOT NULL,
  
  UNIQUE(date, scenario_id, scenario_version, cohort)
);

CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date ON daily_aggregates(date);
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_scenario ON daily_aggregates(scenario_id, scenario_version);

-- =============================================================================
-- outcome_events: Host app outcome reports (optional)
-- =============================================================================
-- Tracks what happened after a decision was made
-- Used to compute completion rates, churn, etc.

CREATE TABLE IF NOT EXISTS outcome_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  decision_event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  outcome_type TEXT NOT NULL, -- 'completed', 'skipped', 'dropped', 'converted'
  outcome_metadata TEXT, -- JSON for additional context
  
  FOREIGN KEY (decision_event_id) REFERENCES decision_events(id)
);

CREATE INDEX IF NOT EXISTS idx_outcome_events_decision ON outcome_events(decision_event_id);
CREATE INDEX IF NOT EXISTS idx_outcome_events_user ON outcome_events(user_id);
CREATE INDEX IF NOT EXISTS idx_outcome_events_type ON outcome_events(outcome_type);
