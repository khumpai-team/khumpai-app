/**
 * Compassionate gamification — CELEBRATION ONLY.
 *
 * ABSOLUTE RULE: This file MUST NOT compute, store, or expose streaks,
 * missed days, or consecutive-day counts in any form. No "días seguidos",
 * no penalty logic, no streak variables. A test suite scans this file for
 * streak-related logic and will fail if any is found.
 *
 * All functions are pure; `now` is injectable for deterministic testing.
 */

import type { Achievement, AppState, GlucoseLog } from '@/types';
import { AGENT_ES } from '@/data/i18n/agent-es';

// ---------------------------------------------------------------------------
// Achievement definitions (ids, titles, descriptions from AGENT_ES)
// ---------------------------------------------------------------------------

type AchievementId =
  | 'ach-first-log'
  | 'ach-first-week'
  | 'ach-5-readings-week'
  | 'ach-khumpi-knows'
  | 'ach-report-ready';

interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  icon?: string;
}

const ACHIEVEMENT_DEFS: Record<AchievementId, AchievementDef> = {
  'ach-first-log': {
    id: 'ach-first-log',
    title: AGENT_ES.achievements.firstLog.title,
    description: AGENT_ES.achievements.firstLog.description,
    icon: 'star',
  },
  'ach-first-week': {
    id: 'ach-first-week',
    title: AGENT_ES.achievements.firstWeek.title,
    description: AGENT_ES.achievements.firstWeek.description,
    icon: 'calendar',
  },
  'ach-5-readings-week': {
    id: 'ach-5-readings-week',
    title: AGENT_ES.achievements.fiveReadingsThisWeek.title,
    description: AGENT_ES.achievements.fiveReadingsThisWeek.description,
    icon: 'chart',
  },
  'ach-khumpi-knows': {
    id: 'ach-khumpi-knows',
    title: AGENT_ES.achievements.khumpiKnowsYou.title,
    description: AGENT_ES.achievements.khumpiKnowsYou.description,
    icon: 'heart',
  },
  'ach-report-ready': {
    id: 'ach-report-ready',
    title: AGENT_ES.achievements.reportReady.title,
    description: AGENT_ES.achievements.reportReady.description,
    icon: 'document',
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Set of achievement ids already present in state — used for idempotency. */
function existingIds(state: AppState): Set<string> {
  return new Set(state.achievements.map((a) => a.id));
}

/** All confirmed log entries for the current person. */
function personLogs(state: AppState) {
  return state.logs.filter(
    (l) => l.personId === state.currentPersonId && l.confirmed,
  );
}

/** Builds an Achievement from a definition and an unlock timestamp. */
function makeAchievement(def: AchievementDef, unlockedAt: string): Achievement {
  const result: Achievement = {
    id: def.id,
    title: def.title,
    description: def.description,
    unlockedAt,
  };
  if (def.icon !== undefined) {
    result.icon = def.icon;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluates which achievements have been newly earned — i.e. the conditions
 * are met but the achievement is NOT already present in state.achievements.
 * Idempotent: re-running with the same state always returns the same result.
 *
 * Milestones evaluated:
 *   'ach-first-log'        — ≥ 1 confirmed log
 *   'ach-first-week'       — span between earliest and latest log ≥ 7 days
 *   'ach-5-readings-week'  — ≥ 5 glucose readings in the last 7 days
 *   'ach-khumpi-knows'     — ≥ 10 total confirmed logs
 *   'ach-report-ready'     — opts.reportGenerated === true
 *
 * @param state - Current application state.
 * @param now   - Reference time (injectable for testing). Defaults to new Date().
 * @param opts  - Optional flags for event-driven achievements.
 * @returns Array of newly-earned Achievement objects (may be empty).
 */
export function evaluateAchievements(
  state: AppState,
  now?: Date,
  opts?: { reportGenerated?: boolean },
): Achievement[] {
  const reference = now ?? new Date();
  const unlockedAt = reference.toISOString();
  const already = existingIds(state);
  const logs = personLogs(state);
  const newly: Achievement[] = [];

  // -------------------------------------------------------------------------
  // ach-first-log — first confirmed log exists
  // -------------------------------------------------------------------------
  if (!already.has('ach-first-log') && logs.length >= 1) {
    newly.push(makeAchievement(ACHIEVEMENT_DEFS['ach-first-log'], unlockedAt));
  }

  // -------------------------------------------------------------------------
  // ach-first-week — span between earliest and latest log ≥ 7 days
  // -------------------------------------------------------------------------
  if (!already.has('ach-first-week') && logs.length >= 2) {
    const timestamps = logs.map((l) => l.timestamp);
    const earliest = timestamps.reduce((a, b) => (a < b ? a : b));
    const latest = timestamps.reduce((a, b) => (a > b ? a : b));
    const spanMs = new Date(latest).getTime() - new Date(earliest).getTime();
    const spanDays = spanMs / (1000 * 60 * 60 * 24);
    if (spanDays >= 7) {
      newly.push(makeAchievement(ACHIEVEMENT_DEFS['ach-first-week'], unlockedAt));
    }
  }

  // -------------------------------------------------------------------------
  // ach-5-readings-week — ≥ 5 glucose readings in the last 7 days
  // -------------------------------------------------------------------------
  if (!already.has('ach-5-readings-week')) {
    const sevenDaysAgoMs = reference.getTime() - 7 * 24 * 60 * 60 * 1000;
    const recentGlucoseCount = state.logs.filter(
      (l): l is GlucoseLog =>
        l.type === 'glucose' &&
        l.personId === state.currentPersonId &&
        l.confirmed &&
        new Date(l.timestamp).getTime() >= sevenDaysAgoMs,
    ).length;
    if (recentGlucoseCount >= 5) {
      newly.push(makeAchievement(ACHIEVEMENT_DEFS['ach-5-readings-week'], unlockedAt));
    }
  }

  // -------------------------------------------------------------------------
  // ach-khumpi-knows — ≥ 10 total confirmed logs
  // -------------------------------------------------------------------------
  if (!already.has('ach-khumpi-knows') && logs.length >= 10) {
    newly.push(makeAchievement(ACHIEVEMENT_DEFS['ach-khumpi-knows'], unlockedAt));
  }

  // -------------------------------------------------------------------------
  // ach-report-ready — report has been generated (event flag)
  // -------------------------------------------------------------------------
  if (!already.has('ach-report-ready') && opts?.reportGenerated === true) {
    newly.push(makeAchievement(ACHIEVEMENT_DEFS['ach-report-ready'], unlockedAt));
  }

  return newly;
}
