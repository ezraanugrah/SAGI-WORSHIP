import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { defaults, openDatabase } from "../db";
import { Repository } from "./repository";
import { WriterGate } from "./writer";
import { songFixture, writerFixture } from "../testHelpers";
import { now, type SongDraft } from "../domain/models";
describe("atomic songs and schedules repository", () => {
  let name: string, writer: ReturnType<typeof writerFixture>, repo: Repository;
  beforeEach(() => {
    name = crypto.randomUUID();
    writer = writerFixture();
    repo = new Repository(writer.gate, name);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    writer.stop();
    await deleteDB(name);
  });
  it("enforces writer authorization at every mutation boundary", async () => {
    const readOnly = new Repository(new WriterGate(), name);
    await expect(
      readOnly.createSong("song", songFixture("song")),
    ).rejects.toThrow("hanya baca");
    await expect(readOnly.createSchedule("Service")).rejects.toThrow(
      "hanya baca",
    );
    await expect(readOnly.setActive("missing")).rejects.toThrow();
    await expect(
      readOnly.saveDraft({
        id: "phase2:draft:song:song",
        kind: "song-draft",
        songId: "song",
        baseRevision: 0,
        sequence: 1,
        value: songFixture("song"),
        updatedAt: now(),
      }),
    ).rejects.toThrow("hanya baca");
    for (const operation of [
      () => readOnly.updateSong("song", songFixture("song"), 1),
      () => readOnly.duplicateSong("song", 1),
      () => readOnly.deleteSong("song", 1),
      () => readOnly.renameSchedule("service", "Renamed", 1),
      () => readOnly.duplicateSchedule("service", 1),
      () => readOnly.deleteSchedule("service", 1),
      () => readOnly.addSong("service", "song", 1),
      () => readOnly.removeItem("service", "item", 1),
      () => readOnly.reorderItems("service", [], 1),
      () => readOnly.discardDraft("song", 1),
      () => readOnly.savePreferences(defaults),
    ])
      await expect(operation()).rejects.toThrow("hanya baca");
    expect((await repo.load()).songs).toHaveLength(0);
  });
  it("creates, edits, duplicates and deletes songs across database reconnections", async () => {
    const input = songFixture("song");
    input.order.push(input.order[0]);
    const created = await repo.createSong("song", input);
    expect(created.revision).toBe(1);
    const updated = await repo.updateSong(
      "song",
      { ...input, title: "Revised" },
      1,
    );
    expect(updated.createdAt).toBe(created.createdAt);
    const copy = await repo.duplicateSong("song", updated.revision);
    expect(copy.id).not.toBe("song");
    expect(copy.sections[0].id).not.toBe(input.sections[0].id);
    expect(copy.sections[0].songId).toBe(copy.id);
    expect(copy.order[0]).toBe(copy.order[1]);
    await expect(
      new Repository(writer.gate, name).load(),
    ).resolves.toMatchObject({
      songs: expect.any(Array),
    });
    await repo.deleteSong("song", 2);
    expect((await repo.load()).songs.map((s) => s.id)).toEqual([copy.id]);
  });
  it("retains section definition order independently from repeated presentation order", async () => {
    const input = songFixture("song");
    input.sections = [
      { ...input.sections[0], id: "z-section" },
      { ...input.sections[0], id: "a-section", label: "Second" },
    ];
    input.order = ["a-section", "z-section", "a-section"];
    await repo.createSong("song", input);
    const reloaded = (await repo.load()).songs[0];
    expect(reloaded.sections.map((section) => section.id)).toEqual([
      "z-section",
      "a-section",
    ]);
    expect(reloaded.order).toEqual(input.order);
  });
  it("validates before writing and rejects stale updates and deleted-record resurrection", async () => {
    const input = songFixture("song");
    await repo.createSong("song", input);
    await expect(
      repo.updateSong("song", { ...input, title: "" }, 1),
    ).rejects.toThrow("tidak valid");
    await repo.updateSong("song", { ...input, title: "New" }, 1);
    await expect(repo.updateSong("song", input, 1)).rejects.toThrow("revisi");
    await repo.deleteSong("song", 2);
    await expect(repo.updateSong("song", input, 2)).rejects.toThrow();
    await expect(repo.createSong("song", input)).rejects.toThrow();
    await expect(
      repo.saveDraft({
        id: "phase2:draft:song:song",
        kind: "song-draft",
        songId: "song",
        baseRevision: 2,
        sequence: 1,
        value: input,
        updatedAt: now(),
      }),
    ).rejects.toThrow();
    expect((await repo.load()).songs).toHaveLength(0);
  });
  it("supports schedule CRUD, activation, duplicates, repeated songs, ordering and source-safe removal", async () => {
    await repo.createSong("song", songFixture("song"));
    const a = await repo.createSchedule("Morning"),
      b = await repo.createSchedule("Evening");
    expect((await repo.load()).activeId).toBe(b.id);
    await repo.setActive(a.id);
    const first = await repo.addSong(a.id, "song", 1),
      second = await repo.addSong(a.id, "song", 2);
    await repo.reorderItems(a.id, [second.id, first.id], 3);
    await expect(repo.reorderItems(a.id, [first.id], 4)).rejects.toThrow(
      "Urutan",
    );
    await expect(repo.renameSchedule(a.id, "Stale", 1)).rejects.toThrow(
      "revisi",
    );
    await repo.renameSchedule(a.id, "Sunday", 4);
    const copy = await repo.duplicateSchedule(a.id, 5);
    expect(copy.itemIds).toHaveLength(2);
    expect(copy.itemIds).not.toEqual([second.id, first.id]);
    await repo.removeItem(a.id, first.id, 5);
    await repo.deleteSchedule(a.id, 6);
    const data = await repo.load();
    expect(data.songs).toHaveLength(1);
    expect(data.schedules.map((s) => s.id)).toEqual([b.id, copy.id]);
    expect(data.items.every((i) => i.scheduleId === copy.id)).toBe(true);
  });
  it("clears a schedule's items without touching songs or other schedules", async () => {
    await repo.createSong("song", songFixture("song"));
    const week = await repo.createSchedule("Week 1"),
      other = await repo.createSchedule("Week 2");
    await repo.addSong(week.id, "song", 1);
    await repo.addSong(week.id, "song", 2);
    await repo.addSong(other.id, "song", 1);
    await expect(repo.clearSchedule(week.id, 1)).rejects.toThrow();
    await repo.clearSchedule(week.id, 3);
    const data = await repo.load();
    const cleared = data.schedules.find((s) => s.id === week.id)!;
    expect(cleared).toMatchObject({ itemIds: [], revision: 4 });
    expect(data.items.filter((i) => i.scheduleId === week.id)).toHaveLength(0);
    expect(data.items.filter((i) => i.scheduleId === other.id)).toHaveLength(1);
    expect(data.songs).toHaveLength(1);
    await expect(
      new Repository(new WriterGate(), name).clearSchedule(week.id, 4),
    ).rejects.toThrow("hanya baca");
  });
  it("atomically deletes song sections and references in multiple schedules", async () => {
    await repo.createSong("song", songFixture("song"));
    const a = await repo.createSchedule("A"),
      b = await repo.createSchedule("B");
    await repo.addSong(a.id, "song", 1);
    await repo.addSong(b.id, "song", 1);
    await repo.deleteSong("song", 1);
    const data = await repo.load();
    expect(data.items).toHaveLength(0);
    expect(
      data.schedules.every((s) => s.itemIds.length === 0 && s.revision === 3),
    ).toBe(true);
    const db = await openDatabase(name);
    expect(await db.getAll("song_sections")).toEqual([]);
    db.close();
  });
  it("rolls back song row and section replacement on a later section failure", async () => {
    const input = songFixture("song");
    await repo.createSong("song", input);
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "song_sections")
        throw new DOMException("Injected quota failure", "QuotaExceededError");
      return original.apply(this, args);
    });
    await expect(
      repo.updateSong("song", { ...input, title: "Not committed" }, 1),
    ).rejects.toThrow("quota");
    vi.restoreAllMocks();
    expect((await repo.load()).songs[0]).toMatchObject({
      title: input.title,
      revision: 1,
      sections: input.sections,
    });
  });
  it("rolls back a newly added item when the schedule update fails", async () => {
    await repo.createSong("song", songFixture("song"));
    const schedule = await repo.createSchedule("Service");
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "schedules")
        throw new Error("Injected schedule failure");
      return original.apply(this, args);
    });
    await expect(repo.addSong(schedule.id, "song", 1)).rejects.toThrow(
      "Injected",
    );
    vi.restoreAllMocks();
    expect((await repo.load()).items).toEqual([]);
    expect((await repo.load()).schedules[0].revision).toBe(1);
  });
  it("rolls back copied items when duplicate schedule creation fails", async () => {
    await repo.createSong("song", songFixture("song"));
    const schedule = await repo.createSchedule("Service");
    await repo.addSong(schedule.id, "song", 1);
    const original = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "schedules")
        throw new Error("Injected duplicate failure");
      return original.apply(this, args);
    });
    await expect(repo.duplicateSchedule(schedule.id, 2)).rejects.toThrow(
      "Injected",
    );
    vi.restoreAllMocks();
    expect((await repo.load()).items).toHaveLength(1);
    expect((await repo.load()).schedules).toHaveLength(1);
  });
  it("rolls back earlier schedule edits when a later deletion dependency is corrupt", async () => {
    await repo.createSong("song", songFixture("song"));
    const a = await repo.createSchedule("A"),
      b = await repo.createSchedule("B");
    await repo.addSong(a.id, "song", 1);
    await repo.addSong(b.id, "song", 1);
    const db = await openDatabase(name);
    const row = await db.get("schedules", b.id);
    await db.put("schedules", { ...row, itemIds: ["missing"] });
    db.close();
    await expect(repo.deleteSong("song", 1)).rejects.toThrow("rusak");
    const data = await repo.load();
    expect(data.songs).toHaveLength(1);
    expect(data.items).toHaveLength(2);
    expect(data.schedules.find((s) => s.id === a.id)?.revision).toBe(2);
  });
  it("cancels tracked transactions and rejects future writes when authority is revoked", async () => {
    const original = writer.gate.track.bind(writer.gate);
    vi.spyOn(writer.gate, "track").mockImplementation((tx, ticket) => {
      original(tx, ticket);
      queueMicrotask(() => writer.gate.revoke("lock lost"));
    });
    await expect(
      repo.createSong("song", songFixture("song")),
    ).rejects.toThrow();
    expect((await repo.load()).songs).toEqual([]);
    await expect(repo.createSchedule("No access")).rejects.toThrow(
      "hanya baca",
    );
  });
  it("preserves corruption and allows unrelated healthy records to be used", async () => {
    const db = await openDatabase(name);
    await db.put("songs", { id: "broken", title: 42 });
    await db.put("settings", { id: "phase2:draft:song:broken", bad: true });
    db.close();
    await repo.createSong("healthy", songFixture("healthy"));
    const data = await repo.load();
    expect(data.songs.map((s) => s.id)).toEqual(["healthy"]);
    expect(data.issues.length).toBeGreaterThanOrEqual(2);
    await expect(
      repo.updateSong("broken", songFixture("broken"), 1),
    ).rejects.toThrow("rusak");
    const reopened = await openDatabase(name);
    expect(await reopened.get("songs", "broken")).toEqual({
      id: "broken",
      title: 42,
    });
    reopened.close();
  });
  it("recovers drafts independently and rejects old sequence numbers and base revisions", async () => {
    await repo.createSong("song", songFixture("song"));
    const draft: SongDraft = {
      id: "phase2:draft:song:song",
      kind: "song-draft",
      songId: "song",
      baseRevision: 1,
      sequence: 2,
      value: { ...songFixture("song"), title: "" },
      updatedAt: now(),
    };
    await repo.saveDraft(draft);
    await expect(repo.saveDraft({ ...draft, sequence: 1 })).rejects.toThrow(
      "revisi",
    );
    expect((await repo.load()).drafts[0].value.title).toBe("");
    expect((await repo.load()).songs[0].title).not.toBe("");
    await expect(repo.discardDraft("song", 1)).rejects.toThrow();
    await repo.discardDraft("song", 2);
    expect((await repo.load()).drafts).toEqual([]);
  });
});

describe("late authorization and concurrent revision fences", () => {
  it("does not write when the grant is revoked while opening the database", async () => {
    const name = crypto.randomUUID(),
      writer = writerFixture(),
      repo = new Repository(writer.gate, name);
    try {
      const pending = repo.createSchedule("Late");
      writer.gate.revoke();
      await expect(pending).rejects.toThrow("hanya baca");
      expect((await repo.load()).schedules).toEqual([]);
    } finally {
      writer.stop();
      await deleteDB(name);
    }
  });
  it("allows only one concurrent update with the same expected revision", async () => {
    const name = crypto.randomUUID(),
      writer = writerFixture(),
      repo = new Repository(writer.gate, name),
      input = songFixture("song");
    try {
      await repo.createSong("song", input);
      const outcomes = await Promise.allSettled([
        repo.updateSong("song", { ...input, title: "First" }, 1),
        repo.updateSong("song", { ...input, title: "Second" }, 1),
      ]);
      expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect((await repo.load()).songs[0].revision).toBe(2);
    } finally {
      writer.stop();
      await deleteDB(name);
    }
  });
});
