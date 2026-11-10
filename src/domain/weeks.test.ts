import { describe, expect, it } from "vitest";
import { weekName, weekNumber, weekSchedules, WEEKS } from "./weeks";
import type { Schedule } from "./models";

const schedule = (id: string, name: string, createdAt: string): Schedule => ({
  id,
  name,
  itemIds: [],
  revision: 1,
  createdAt,
  updatedAt: createdAt,
});

describe("fixed Week 1–4 playlists", () => {
  it("recognises Week 1–4 names only", () => {
    expect(WEEKS.map(weekName)).toEqual([
      "Week 1",
      "Week 2",
      "Week 3",
      "Week 4",
    ]);
    expect(weekNumber("Week 1")).toBe(1);
    expect(weekNumber(" week4 ")).toBe(4);
    expect(weekNumber("WEEK 2")).toBe(2);
    expect(weekNumber("Week 5")).toBeNull();
    expect(weekNumber("Week 1 (salinan)")).toBeNull();
    expect(weekNumber("Ibadah Minggu")).toBeNull();
  });
  it("maps the oldest matching schedule to each week and ignores others", () => {
    const list = [
      schedule("late-1", "Week 1", "2026-11-03T00:00:00.000Z"),
      schedule("legacy", "Sunday service", "2026-11-01T00:00:00.000Z"),
      schedule("early-1", "week1", "2026-11-02T00:00:00.000Z"),
      schedule("w3", "Week 3", "2026-11-04T00:00:00.000Z"),
    ];
    expect(weekSchedules(list).map((s) => s?.id)).toEqual([
      "early-1",
      undefined,
      "w3",
      undefined,
    ]);
  });
});
