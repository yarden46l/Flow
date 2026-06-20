/**
 * frictionAnalyzer.ts
 * Phase 9.1 — KaizenFlow Friction Analysis Engine
 *
 * Scans recent Task history to identify behavioral friction patterns:
 *   - Hours where scheduled tasks are consistently missed (friction zones)
 *   - Whether "Eat the Frog" (isFrog / type === "frog") tasks are being
 *     delayed or skipped relative to normal tasks
 *   - An overall ImprovementScore (0–100) derived from completion rate
 *
 * Strictly typed against the unified Task schema in src/lib/db.ts.
 * This module is pure logic — no UI side-effects.
 */

import type { Task } from "@/lib/db";

// ---------------------------------------------------------------------------
// Output Types
// ---------------------------------------------------------------------------

/** A contiguous block of clock hours that shows high miss rates. */
export interface FrictionZone {
  /** Human-readable label, e.g. "14:00 – 16:00" */
  label: string;
  /** Start of window (0–23) */
  startHour: number;
  /** End of window, exclusive (1–24) */
  endHour: number;
  /** 0–1  (1 = 100 % of tasks in this window were missed) */
  missRate: number;
  /** Brief machine-generated explanation */
  reason: string;
}

/** Detected pattern about Frog-task execution discipline. */
export interface FrogInsight {
  /** Was a delay pattern detected? */
  frogDelayDetected: boolean;
  /**
   * Ratio of frog tasks that were completed vs scheduled.
   * undefined when there are no frog tasks in the window.
   */
  frogCompletionRate: number | undefined;
  /** Plain-English summary */
  summary: string;
}

/** Full output of analyzeFriction(). */
export interface FrictionAnalysisResult {
  /** Ordered list of detected friction zones (worst first). */
  identifiedFrictionZones: FrictionZone[];
  /** Frog/Eat-the-Frog behavioural insight. */
  frogInsight: FrogInsight;
  /**
   * Holistic improvement score 0–100.
   * 100 = every scheduled task in the window was completed.
   * Penalised by miss rate and Frog delay multiplier.
   */
  improvementScore: number;
  /** Number of tasks analysed (excludes inbox-only items). */
  analyzedTaskCount: number;
  /** ISO timestamp when analysis was run. */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOOKBACK_DAYS = 7;

/**
 * Miss-rate threshold above which a time window is considered a friction zone.
 * 0.4 = 40 % of tasks in that hour bucket were not completed.
 */
const FRICTION_THRESHOLD = 0.4;

/**
 * Grouping granularity: hours are bucketed into windows of this size.
 * 2 = two-hour windows (0–2, 2–4, … 22–24).
 */
const BUCKET_SIZE_HOURS = 2;

// Well-known label for the afternoon energy dip.
const AFTERNOON_SLUMP_START = 13;
const AFTERNOON_SLUMP_END = 16;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM" → hour integer (0–23).  Returns NaN on bad input. */
function parseHour(timeStr: string | undefined): number {
  if (!timeStr) return NaN;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10);
  return isNaN(h) || h < 0 || h > 23 ? NaN : h;
}

/**
 * Parse an ISO-8601 completedAt string OR a relative age string
 * ("2h", "1d", "now") and decide whether it falls within the lookback window.
 *
 * Tasks use `createdAt` for relative display ages; `completedAt` is a proper
 * ISO string when set.  For scheduling purposes we use `startTime` + implied
 * today because the schema stores only day-of-week, not a full date.
 *
 * Strategy: if `completedAt` exists and is a valid ISO string, use it.
 * Otherwise, the task is treated as "recent" (within the 7-day window) if
 * its status is "scheduled" or "archived" (i.e. not sitting in the inbox).
 */
function isWithinLookback(task: Task, nowMs: number): boolean {
  if (task.completedAt) {
    const ts = Date.parse(task.completedAt);
    if (!isNaN(ts)) {
      return nowMs - ts <= LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    }
  }
  // Fallback: treat all non-inbox tasks as recent (no full date stored).
  return task.status !== "inbox";
}

/** Build a human-readable label from bucket start/end hours. */
function bucketLabel(start: number, end: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(start)}:00 – ${pad(Math.min(end, 24))}:00`;
}

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Core Analyser
// ---------------------------------------------------------------------------

/**
 * Analyse an array of Tasks and surface friction patterns.
 *
 * @param tasks   All tasks for the user (mix of statuses is fine; the function
 *                filters internally to scheduled/archived tasks within the
 *                7-day lookback window).
 * @returns       A fully-typed FrictionAnalysisResult.
 */
export function analyzeFriction(tasks: Task[]): FrictionAnalysisResult {
  const nowMs = Date.now();
  const generatedAt = new Date(nowMs).toISOString();

  // ── 1. Filter to relevant tasks ──────────────────────────────────────────
  const recent = tasks.filter(
    (t) =>
      t.status !== "inbox" &&
      t.startTime !== undefined &&
      isWithinLookback(t, nowMs)
  );

  const analyzedTaskCount = recent.length;

  // Edge-case: no historical data.
  if (analyzedTaskCount === 0) {
    return {
      identifiedFrictionZones: [],
      frogInsight: {
        frogDelayDetected: false,
        frogCompletionRate: undefined,
        summary: "No scheduled task history found for the past 7 days.",
      },
      improvementScore: 100,
      analyzedTaskCount: 0,
      generatedAt,
    };
  }

  // ── 2. Build hourly buckets ───────────────────────────────────────────────
  // Map: bucketStart (0,2,4,…22) → { total, missed }
  const buckets = new Map<number, { total: number; missed: number }>();

  for (let h = 0; h < 24; h += BUCKET_SIZE_HOURS) {
    buckets.set(h, { total: 0, missed: 0 });
  }

  for (const task of recent) {
    const hour = parseHour(task.startTime);
    if (isNaN(hour)) continue;

    const bucketStart = Math.floor(hour / BUCKET_SIZE_HOURS) * BUCKET_SIZE_HOURS;
    const bucket = buckets.get(bucketStart)!;
    bucket.total += 1;
    if (!task.isCompleted) {
      bucket.missed += 1;
    }
  }

  // ── 3. Identify friction zones ───────────────────────────────────────────
  const frictionZones: FrictionZone[] = [];

  for (const [start, { total, missed }] of buckets) {
    if (total === 0) continue;
    const missRate = missed / total;
    if (missRate >= FRICTION_THRESHOLD) {
      const end = start + BUCKET_SIZE_HOURS;

      // Enrich with a contextual reason
      let reason = `${Math.round(missRate * 100)}% of tasks scheduled between ${bucketLabel(start, end)} were not completed.`;
      if (start >= AFTERNOON_SLUMP_START && start < AFTERNOON_SLUMP_END) {
        reason += " This aligns with the well-documented post-lunch energy dip — consider lighter tasks or a buffer here.";
      } else if (start >= 22 || start < 6) {
        reason += " Late-night or early-morning blocks often suffer from fatigue. Consider rescheduling to peak-energy hours.";
      } else if (start >= 6 && start < 9) {
        reason += " Morning friction may indicate a need for a stronger startup ritual before cognitive work.";
      }

      frictionZones.push({
        label: bucketLabel(start, end),
        startHour: start,
        endHour: end,
        missRate,
        reason,
      });
    }
  }

  // Sort worst first
  frictionZones.sort((a, b) => b.missRate - a.missRate);

  // ── 4. Frog insight ──────────────────────────────────────────────────────
  const frogTasks = recent.filter((t) => t.isFrog === true || t.type === "frog");
  const nonFrogTasks = recent.filter((t) => t.isFrog !== true && t.type !== "frog");

  const frogCompleted = frogTasks.filter((t) => t.isCompleted).length;
  const nonFrogCompleted = nonFrogTasks.filter((t) => t.isCompleted).length;

  const frogCompletionRate =
    frogTasks.length > 0 ? frogCompleted / frogTasks.length : undefined;
  const nonFrogCompletionRate =
    nonFrogTasks.length > 0 ? nonFrogCompleted / nonFrogTasks.length : undefined;

  let frogDelayDetected = false;
  let frogSummary: string;

  if (frogCompletionRate === undefined) {
    frogSummary = "No Frog tasks were scheduled in the past 7 days.";
  } else if (
    nonFrogCompletionRate !== undefined &&
    frogCompletionRate < nonFrogCompletionRate - 0.15
  ) {
    // Frog tasks complete at least 15 pp worse than normal tasks → delay pattern
    frogDelayDetected = true;
    frogSummary = `Frog tasks are completed only ${Math.round(frogCompletionRate * 100)}% of the time vs ${Math.round(nonFrogCompletionRate * 100)}% for regular tasks. You may be consistently avoiding your highest-impact work.`;
  } else if (frogCompletionRate >= 0.8) {
    frogSummary = `Strong Frog discipline: ${Math.round(frogCompletionRate * 100)}% of Eat-the-Frog tasks completed.`;
  } else {
    frogSummary = `Frog task completion is at ${Math.round(frogCompletionRate * 100)}%. Room for improvement — try scheduling Frog tasks before 10:00.`;
  }

  const frogInsight: FrogInsight = {
    frogDelayDetected,
    frogCompletionRate,
    summary: frogSummary,
  };

  // ── 5. Improvement score ─────────────────────────────────────────────────
  // Base: overall completion rate (0–100)
  const totalCompleted = recent.filter((t) => t.isCompleted).length;
  const baseScore = (totalCompleted / analyzedTaskCount) * 100;

  // Penalty multiplier for Frog delay (up to -10 points)
  const frogPenalty = frogDelayDetected ? 10 : 0;

  // Bonus: reward having no friction zones (up to +5 points)
  const frictionBonus = frictionZones.length === 0 ? 5 : 0;

  const improvementScore = clamp(
    Math.round(baseScore - frogPenalty + frictionBonus),
    0,
    100
  );

  return {
    identifiedFrictionZones: frictionZones,
    frogInsight,
    improvementScore,
    analyzedTaskCount,
    generatedAt,
  };
}
