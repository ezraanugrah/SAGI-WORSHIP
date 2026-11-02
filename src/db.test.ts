import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { deleteDB, openDB } from "idb";
import { openDatabase, stores, defaults, validatePreferences } from "./db";
import { Repository } from "./data/repository";
import { writerFixture } from "./testHelpers";
describe("Phase 1 data compatibility", () => {
  let name: string, writer: ReturnType<typeof writerFixture>, repo: Repository;
  beforeEach(() => {
    name = crypto.randomUUID();
    writer = writerFixture();
    repo = new Repository(writer.gate, name);
  });
  afterEach(async () => {
    writer.stop();
    await deleteDB(name);
  });
  it("retains v1 and every original object store", async () => {
    const db = await openDatabase(name);
    expect([...db.objectStoreNames].sort()).toEqual([...stores].sort());
    expect(db.version).toBe(1);
    db.close();
  });
  it("preserves original preference format and unrelated records", async () => {
    const db = await openDatabase(name);
    await db.put("settings", { id: "preferences", value: defaults });
    await db.put("themes", { id: "custom-theme", label: "retained" });
    db.close();
    await repo.createSchedule("Service");
    await repo.savePreferences({ ...defaults, fontSize: 72 });
    const reopened = await openDatabase(name);
    expect((await reopened.get("settings", "preferences")).value.fontSize).toBe(
      72,
    );
    expect(await reopened.get("themes", "custom-theme")).toEqual({
      id: "custom-theme",
      label: "retained",
    });
    reopened.close();
  });
  it("rejects invalid preferences without replacing previous values", async () => {
    await repo.savePreferences(defaults);
    await expect(
      repo.savePreferences({ ...defaults, volume: 101 }),
    ).rejects.toThrow();
    expect(validatePreferences({ ...defaults, muted: "yes" })).toBe(false);
    const db = await openDatabase(name);
    expect((await db.get("settings", "preferences")).value).toEqual(defaults);
    db.close();
  });
  it("closes a blocking v1 connection without replacing data or downgrading a newer schema", async () => {
    const original = await openDatabase(name);
    await original.put("settings", { id: "retained", value: "unchanged" });
    const newer = await openDB(name, 2);
    expect(await newer.get("settings", "retained")).toEqual({
      id: "retained",
      value: "unchanged",
    });
    newer.close();
    await expect(openDatabase(name)).rejects.toThrow();
  });
  it("does not overwrite malformed preference records", async () => {
    const db = await openDatabase(name);
    await db.put("settings", { id: "preferences", value: { bad: true } });
    await expect(repo.savePreferences(defaults)).rejects.toThrow("rusak");
    expect((await db.get("settings", "preferences")).value).toEqual({
      bad: true,
    });
    db.close();
  });
});
