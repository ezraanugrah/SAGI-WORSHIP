import { expect, it } from "vitest";
import { makePlan } from "../recovery/restorePlan";
import { validateRows } from "./validation";
import type { Snapshot } from "./models";

function fixture() {
  const date = "2026-11-02T00:00:00.000Z";
  const source: Snapshot = [
    {
      store: "songs",
      value: {
        id: "song",
        title: "Synthetic",
        author: "",
        category: "",
        language: "Indonesia",
        order: ["section", "section"],
        sectionIds: ["section"],
        revision: 1,
        createdAt: date,
        updatedAt: date,
      },
    },
    {
      store: "song_sections",
      value: {
        id: "section",
        songId: "song",
        type: "Verse",
        label: "Verse 1",
        text: "Incoming lyrics",
      },
    },
    {
      store: "schedules",
      value: {
        id: "schedule",
        name: "Service",
        itemIds: ["item1", "item2"],
        revision: 1,
        createdAt: date,
        updatedAt: date,
      },
    },
    ...["item1", "item2"].map((id) => ({
      store: "schedule_items" as const,
      value: {
        id,
        scheduleId: "schedule",
        type: "song",
        songId: "song",
        createdAt: date,
        updatedAt: date,
      },
    })),
  ];
  return { source, destination: structuredClone(source) };
}
function combined(destination: Snapshot, rows: Snapshot) {
  return [
    ...destination.filter(
      (d) =>
        !rows.some((r) => r.store === d.store && r.value.id === d.value.id),
    ),
    ...rows,
  ];
}
it("aggregate regression: keep-existing skips incoming schedules when equal song parents hide different sections", async () => {
  const { source, destination } = fixture();
  destination.splice(2);
  destination[1].value.text = "Destination lyrics";
  const before = structuredClone(destination);
  const plan = await makePlan(
    source,
    destination,
    "existing",
    "unused",
    "unused",
  );
  expect(
    plan.rows.filter((r) =>
      ["songs", "song_sections", "schedules", "schedule_items"].includes(
        r.store,
      ),
    ),
  ).toEqual([]);
  expect(plan.summary.join(" ")).toContain("Lewati dependensi");
  expect(destination).toEqual(before);
});
it("aggregate regression: keep-both duplicates equal song and schedule parents when section dependencies differ", async () => {
  const { source, destination } = fixture();
  destination[1].value.text = "Destination lyrics";
  const before = structuredClone(destination);
  const plan = await makePlan(source, destination, "both", "unused", "unused");
  const song = plan.rows.find((r) => r.store === "songs")!.value;
  const section = plan.rows.find((r) => r.store === "song_sections")!.value;
  const schedule = plan.rows.find((r) => r.store === "schedules")!.value;
  const items = plan.rows
    .filter((r) => r.store === "schedule_items")
    .map((r) => r.value);
  expect(song.id).not.toBe("song");
  expect(section.id).not.toBe("section");
  expect(section.songId).toBe(song.id);
  expect(section.text).toBe("Incoming lyrics");
  expect(song.order).toEqual([section.id, section.id]);
  expect(song.sectionIds).toEqual([section.id]);
  expect(schedule.id).not.toBe("schedule");
  expect(schedule.itemIds).toEqual(items.map((i) => i.id));
  expect(new Set(items.map((i) => i.id)).size).toBe(2);
  expect(
    items.every((i) => i.scheduleId === schedule.id && i.songId === song.id),
  ).toBe(true);
  await validateRows(combined(destination, plan.rows));
  expect(destination).toEqual(before);
});
it("aggregate regression: schedule child assignment conflicts skip the whole existing aggregate or duplicate all items", async () => {
  const { source, destination } = fixture();
  destination[3].value.themeId = "builtin:black";
  const existing = await makePlan(
    source,
    destination,
    "existing",
    "unused",
    "unused",
  );
  expect(
    existing.rows.filter((r) =>
      ["schedules", "schedule_items"].includes(r.store),
    ),
  ).toEqual([]);
  const both = await makePlan(source, destination, "both", "unused", "unused");
  const schedule = both.rows.find((r) => r.store === "schedules")!.value;
  const items = both.rows.filter((r) => r.store === "schedule_items");
  expect(schedule.id).not.toBe("schedule");
  expect(items).toHaveLength(2);
  expect(items.every((r) => !["item1", "item2"].includes(r.value.id))).toBe(
    true,
  );
  expect(items[0].value.themeId).toBeUndefined();
  await validateRows(combined(destination, both.rows));
});
it("aggregate regression: conflicting children cannot bypass unsafe override rejection", async () => {
  const { source, destination } = fixture();
  destination[1].value.text = "Destination lyrics";
  source.push({
    store: "slide_overrides",
    value: {
      id: "phase3:fixture",
      format: 1,
      frameId: "frame",
      text: "Synthetic override",
      style: {
        font: "Arial",
        fontSize: 64,
        safeMargin: 8,
        theme: "black",
        lines: 6,
      },
      sourceSignature: "fixture",
      revision: 1,
    },
  });
  for (const mode of ["existing", "both"] as const)
    await expect(
      makePlan(source, destination, mode, "unused", "unused"),
    ).rejects.toThrow("signature");
});
it("aggregate regression: equal graphs reuse identities and preserve compatible overrides unchanged", async () => {
  const { source, destination } = fixture();
  const override = {
    id: "phase3:fixture",
    format: 2,
    frameId: "frame",
    text: "Compatible original",
    style: {
      font: "Arial",
      fontSize: 64,
      safeMargin: 8,
      theme: "black",
      lines: 6,
    },
    sourceSignature: "unchanged-source",
    revision: 1,
  };
  source.push({ store: "slide_overrides", value: override });
  for (const mode of ["existing", "both"] as const) {
    const plan = await makePlan(source, destination, mode, "unused", "unused");
    expect(plan.rows).toEqual([{ store: "slide_overrides", value: override }]);
    await validateRows(combined(destination, plan.rows));
  }
});
it("aggregate regression: section and occurrence ordering survives complete parent duplication", async () => {
  const { source, destination } = fixture();
  source.splice(2, 0, {
    store: "song_sections",
    value: {
      ...source[1].value,
      id: "chorus",
      label: "Chorus",
      text: "Synthetic chorus",
    },
  });
  source[0].value.sectionIds = ["chorus", "section"];
  source[0].value.order = ["section", "chorus", "section"];
  const plan = await makePlan(source, destination, "both", "unused", "unused");
  const song = plan.rows.find((r) => r.store === "songs")!.value;
  const sections = plan.rows
    .filter((r) => r.store === "song_sections")
    .map((r) => r.value);
  const verse = sections.find((s) => s.label === "Verse 1")!,
    chorus = sections.find((s) => s.label === "Chorus")!;
  expect(song.sectionIds).toEqual([chorus.id, verse.id]);
  expect(song.order).toEqual([verse.id, chorus.id, verse.id]);
  await validateRows(combined(destination, plan.rows));
});
it("aggregate regression: child ID collisions under new parents cannot mutate destination owners", async () => {
  const { source, destination } = fixture();
  source[0].value.id = "new-song";
  source[1].value.songId = "new-song";
  source
    .filter((r) => r.store === "schedule_items")
    .forEach((r) => (r.value.songId = "new-song"));
  for (const mode of ["existing", "both"] as const) {
    const plan = await makePlan(source, destination, mode, "unused", "unused");
    const result = combined(destination, plan.rows);
    await validateRows(result);
    expect(
      result.find(
        (r) => r.store === "song_sections" && r.value.id === "section",
      )!.value,
    ).toEqual(destination[1].value);
    if (mode === "existing") expect(plan.rows).toEqual([]);
    else
      expect(plan.rows.find((r) => r.store === "songs")!.value.id).not.toBe(
        "new-song",
      );
  }
});
it("aggregate regression: conflicting custom themes duplicate schedule assignments without changing destination", async () => {
  const { defaultType } = await import("../themes/models");
  const { canonicalJSON, sha256 } = await import("../scriptures/importFormat");
  const { source, destination } = fixture();
  const spec = {
    background: { kind: "solid", color: "#000000" },
    type: structuredClone(defaultType),
  };
  const theme = {
    id: "theme:fixture",
    format: 1,
    revision: 1,
    name: "Synthetic",
    spec,
    signature: await sha256(canonicalJSON(spec)),
    createdAt: source[0].value.createdAt,
    updatedAt: source[0].value.updatedAt,
  };
  source.push({ store: "themes", value: theme });
  const other = structuredClone(theme);
  other.spec.background.color = "#ffffff";
  other.signature = await sha256(canonicalJSON(other.spec));
  destination.push({ store: "themes", value: other });
  for (const rows of [source, destination])
    rows
      .filter((r) => r.store === "schedule_items")
      .forEach((r) => (r.value.themeId = theme.id));
  const existing = await makePlan(
    source,
    destination,
    "existing",
    "unused",
    "unused",
  );
  expect(
    existing.rows.filter((r) =>
      ["schedules", "schedule_items", "themes"].includes(r.store),
    ),
  ).toEqual([]);
  const both = await makePlan(source, destination, "both", "unused", "unused");
  const incomingTheme = both.rows.find((r) => r.store === "themes")!.value;
  expect(incomingTheme.id).not.toBe(theme.id);
  expect(
    both.rows
      .filter((r) => r.store === "schedule_items")
      .every((r) => r.value.themeId === incomingTheme.id),
  ).toBe(true);
  expect(both.rows.find((r) => r.store === "schedules")!.value.id).not.toBe(
    "schedule",
  );
  await validateRows(combined(destination, both.rows));
});
