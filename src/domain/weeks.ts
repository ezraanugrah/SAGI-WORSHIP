import type { Schedule } from "./models";

/** The Songs tab offers exactly four worship schedules: Week 1–4. */
export const WEEKS = [1, 2, 3, 4] as const;
export const weekName = (n: number) => `Week ${n}`;

/** 1–4 for "Week 1" … "Week 4" (also "week1", "WEEK 2"), otherwise null. */
export function weekNumber(name: string): number | null {
  const match = /^week\s*([1-4])$/i.exec(name.trim());
  return match ? Number(match[1]) : null;
}

/**
 * The schedule for Week 1–4 (index 0–3), or undefined when that week has not
 * been used yet. With duplicates the oldest wins; other schedules are kept in
 * storage but not listed.
 */
export function weekSchedules(schedules: Schedule[]): (Schedule | undefined)[] {
  const ordered = [...schedules].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  return WEEKS.map((n) => ordered.find((s) => weekNumber(s.name) === n));
}
