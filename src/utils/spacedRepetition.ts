/**
 * 2357 Spaced Repetition Engine
 *
 * When a user adds a task tagged as "Lecture" or "Study Material",
 * this utility auto-generates 4 review tasks following the 2357 schedule:
 *   - Day 1: 1st Review
 *   - Day 3: 2nd Review
 *   - Day 5: 3rd Review
 *   - Day 7: 4th Review
 */

export interface InboxItem {
  id: string;
  text: string;
  createdAt: string;
}

const REVIEW_SCHEDULE = [
  { day: 1, label: "Day 1 Review" },
  { day: 3, label: "Day 3 Review" },
  { day: 5, label: "Day 5 Review" },
  { day: 7, label: "Day 7 Review" },
];

/**
 * Checks whether a given text string contains keywords that should
 * trigger spaced repetition task generation.
 */
export function shouldTriggerSpacedRepetition(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("lecture") ||
    lower.includes("study material") ||
    lower.includes("summary")
  );
}

/**
 * Generates 4 review inbox items following the 2357 spaced repetition
 * schedule based on the original task title.
 */
export function generate2357Reviews(baseTitle: string): InboxItem[] {
  const timestamp = Date.now();

  return REVIEW_SCHEDULE.map((entry, idx) => ({
    id: `inbox-review-${timestamp}-${idx}`,
    text: `${baseTitle} — ${entry.label}`,
    createdAt: `+${entry.day}d`,
  }));
}

// ── Sprint Recall Engine ──────────────────────────────────────────────────────
/**
 * Accelerated recall schedule designed for exam-prep Sprint Mode.
 * Instead of the 7-day 2357 spread, reviews fire at:
 *   +12h  → same-day evening consolidation
 *   +24h  → next-morning active recall
 *   +48h  → two-day reinforcement
 *
 * This compresses the short-term retention cycle for immediate high-stakes
 * performance (e.g., exam in 3 days).
 */
const SPRINT_RECALL_SCHEDULE = [
  { hours: 12,  label: "Sprint Recall (+12h)" },
  { hours: 24,  label: "Sprint Recall (+24h)" },
  { hours: 48,  label: "Sprint Recall (+48h)" },
];

export function generateSprintRecallReviews(baseTitle: string): InboxItem[] {
  const timestamp = Date.now();
  return SPRINT_RECALL_SCHEDULE.map((entry, idx) => ({
    id: `inbox-sprint-review-${timestamp}-${idx}`,
    text: `⚡ ${baseTitle} — ${entry.label}`,
    createdAt: `+${entry.hours}h`,
  }));
}
