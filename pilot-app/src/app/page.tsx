'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  decide, 
  reportOutcome, 
  assignCohort, 
  generateSessionId, 
  controlDecision,
  type DecideResponse 
} from '@/lib/ddr-client';

type AppState = 'loading' | 'ready' | 'workout' | 'completed' | 'skipped' | 'error';

export default function Home() {
  // Use stable user ID from localStorage or generate new one (client-only)
  const [userId, setUserId] = useState<string>('');
  const [cohort, setCohort] = useState<'control' | 'treatment'>('control');
  const [sessionId, setSessionId] = useState<string>('');
  const [decision, setDecision] = useState<DecideResponse | null>(null);
  const [appState, setAppState] = useState<AppState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [workoutStartTime, setWorkoutStartTime] = useState<number>(0);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // Initialize on client only to avoid hydration mismatch
  useEffect(() => {
    let storedUserId = localStorage.getItem('ddr_pilot_user_id');
    if (!storedUserId) {
      storedUserId = `user-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('ddr_pilot_user_id', storedUserId);
    }
    const userCohort = assignCohort(storedUserId);
    const session = generateSessionId(storedUserId);
    
    setUserId(storedUserId);
    setCohort(userCohort);
    setSessionId(session);
  }, []);

  const fetchDecision = useCallback(async (uid: string, sid: string, coh: 'control' | 'treatment') => {
    setAppState('loading');
    setError(null);

    try {
      let result: DecideResponse;

      if (coh === 'control') {
        // Control cohort: static logic, no DDR call
        result = controlDecision(uid, sid);
      } else {
        // Treatment cohort: call DDR runtime
        result = await decide({
          user_id: uid,
          session_id: sid,
          signals: {
            days_since_last_session: 2,
            recent_completion_rate: 0.66,
            fatigue_score: 0.3,
          },
          context: {
            local_time: new Date().toISOString(),
          },
          cohort: coh,
          actions: [
            { action_id: 'workout-a', type_id: 'workout_session', attributes: { intensity: 'moderate', duration_minutes: 30, session_type: 'strength' } },
            { action_id: 'workout-b', type_id: 'workout_session', attributes: { intensity: 'low', duration_minutes: 20, session_type: 'cardio' } },
            { action_id: 'rest-day', type_id: 'rest_day', attributes: { recovery_type: 'passive' } },
          ],
        });
      }

      setDecision(result);
      setAppState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get decision');
      setAppState('error');
    }
  }, []);

  // Fetch decision once user is initialized
  useEffect(() => {
    if (userId && sessionId) {
      fetchDecision(userId, sessionId, cohort);
    }
  }, [userId, sessionId, cohort, fetchDecision]);

  // Timer for workout
  useEffect(() => {
    if (appState !== 'workout') return;
    const interval = setInterval(() => {
      setElapsedMinutes(Math.floor((Date.now() - workoutStartTime) / 60000));
    }, 1000);
    return () => clearInterval(interval);
  }, [appState, workoutStartTime]);

  async function startWorkout() {
    setWorkoutStartTime(Date.now());
    setAppState('workout');
  }

  async function completeWorkout() {
    setAppState('completed');
    if (decision) {
      await reportOutcome({
        decision_id: decision.decision_id,
        user_id: userId,
        outcome: 'completed',
        completion_percentage: 1.0,
        duration_minutes: elapsedMinutes || 1,
      }).catch(console.error);
    }
  }

  async function skipWorkout() {
    setAppState('skipped');
    if (decision) {
      await reportOutcome({
        decision_id: decision.decision_id,
        user_id: userId,
        outcome: 'skipped',
        completion_percentage: 0,
        duration_minutes: 0,
      }).catch(console.error);
    }
  }

  async function abandonWorkout() {
    const completionPct = decision?.selected_action.duration_minutes 
      ? elapsedMinutes / decision.selected_action.duration_minutes 
      : 0;
    setAppState('completed');
    if (decision) {
      await reportOutcome({
        decision_id: decision.decision_id,
        user_id: userId,
        outcome: 'abandoned',
        completion_percentage: Math.min(completionPct, 1),
        duration_minutes: elapsedMinutes,
      }).catch(console.error);
    }
  }

  function resetSession() {
    const newSession = generateSessionId(userId);
    setSessionId(newSession);
    setDecision(null);
    setElapsedMinutes(0);
    fetchDecision(userId, newSession, cohort);
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold mb-2">DDR Fitness Pilot</h1>
          <div className="text-sm text-zinc-400 space-y-1">
            <p>User: <span className="font-mono">{userId}</span></p>
            <p>Cohort: <span className={`font-bold ${cohort === 'treatment' ? 'text-green-400' : 'text-blue-400'}`}>{cohort}</span></p>
            <p>Session: <span className="font-mono text-xs">{sessionId}</span></p>
          </div>
        </div>

        {/* Loading State */}
        {appState === 'loading' && (
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Getting your workout...</p>
          </div>
        )}

        {/* Error State */}
        {appState === 'error' && (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              onClick={() => fetchDecision(userId, sessionId, cohort)}
              className="px-6 py-2 bg-zinc-700 rounded-lg hover:bg-zinc-600"
            >
              Retry
            </button>
          </div>
        )}

        {/* Ready State - Show Decision */}
        {appState === 'ready' && decision && (
          <div className="space-y-6">
            <div className="bg-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Today&apos;s Workout</h2>
              <div className="space-y-3">
                <p className="text-2xl font-bold capitalize">{decision.selected_action.type}</p>
                <p className="text-zinc-400">{decision.selected_action.duration_minutes} minutes</p>
                <p className="text-xs text-zinc-500">Action: {decision.selected_action.action_id}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={startWorkout}
                className="flex-1 py-4 bg-green-600 rounded-xl font-semibold hover:bg-green-500 transition"
              >
                Start Workout
              </button>
              <button
                onClick={skipWorkout}
                className="flex-1 py-4 bg-zinc-700 rounded-xl font-semibold hover:bg-zinc-600 transition"
              >
                Skip
              </button>
            </div>

            {/* Debug Info */}
            <details className="text-xs text-zinc-500">
              <summary className="cursor-pointer">Debug Info</summary>
              <pre className="mt-2 p-2 bg-zinc-800 rounded overflow-auto">
                {JSON.stringify(decision, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Workout In Progress */}
        {appState === 'workout' && decision && (
          <div className="space-y-6">
            <div className="bg-zinc-800 rounded-xl p-6 text-center">
              <h2 className="text-lg font-semibold mb-4">Workout In Progress</h2>
              <p className="text-4xl font-bold mb-2">{elapsedMinutes} min</p>
              <p className="text-zinc-400">of {decision.selected_action.duration_minutes} min</p>
              <div className="mt-4 h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${Math.min((elapsedMinutes / decision.selected_action.duration_minutes) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={completeWorkout}
                className="flex-1 py-4 bg-green-600 rounded-xl font-semibold hover:bg-green-500 transition"
              >
                Complete
              </button>
              <button
                onClick={abandonWorkout}
                className="flex-1 py-4 bg-red-600 rounded-xl font-semibold hover:bg-red-500 transition"
              >
                Stop Early
              </button>
            </div>
          </div>
        )}

        {/* Completed/Skipped State */}
        {(appState === 'completed' || appState === 'skipped') && (
          <div className="text-center py-16 space-y-6">
            <div className="text-6xl">{appState === 'completed' ? '✓' : '→'}</div>
            <h2 className="text-xl font-semibold">
              {appState === 'completed' ? 'Workout Complete!' : 'Skipped for Today'}
            </h2>
            <p className="text-zinc-400">Outcome reported to DDR</p>
            <button
              onClick={resetSession}
              className="px-6 py-3 bg-zinc-700 rounded-xl hover:bg-zinc-600 transition"
            >
              New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
