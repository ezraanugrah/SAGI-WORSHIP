import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { deleteDB } from "idb";
import { fixtureDataset, preparedFixture, signFixture } from "./testFixtures";
import {
  parseDataset,
  validateDataset,
  verifyDataset,
  validTranslation,
  canonicalJSON,
  sha256,
} from "./importFormat";
import { FILE_LIMIT, verseKey, reference, type Verse } from "./models";
import { resolveReference, searchVerses } from "./references";
import { ScriptureRepository } from "../data/scriptureRepository";
import { Repository } from "../data/repository";
import { openDatabase, defaults } from "../db";
import { writerFixture, songFixture } from "../testHelpers";
import { PresentationController } from "../presentation/controller";
import { PresentationRepository } from "../data/presentationRepository";
import { generateSlides } from "../presentation/generateSlides";
import { paginateExact, type Measure } from "../presentation/layout";
import {
  frameText,
  validDeck,
  validCheckpoint,
  type Style,
} from "../presentation/models";
import { validMessage } from "../presentation/protocol";
const style: Style = {
    font: "Arial",
    fontSize: 64,
    safeMargin: 8,
    lines: 6,
    theme: "black",
  },
  measure: Measure = (text, s) => text.length * s.fontSize * 0.5;
describe("strict import format and references", () => {
  it("checks SHA-256 and keeps exact Unicode/CRLF/whitespace verse text", async () => {
    const value = fixtureDataset();
    value.verses[0].text = "  Original café 👨‍👩‍👧‍👦\r\n  second\tline  ";
    const prepared = await preparedFixture(value);
    expect(prepared.dataset.verses[0].text).toBe(value.verses[0].text);
    expect(await verifyDataset(prepared.dataset)).toEqual(prepared.dataset);
    const changed = structuredClone(prepared.dataset);
    changed.verses[0].text += "tampered";
    await expect(verifyDataset(changed)).rejects.toThrow("checksum");
  });
  it("rejects invalid UTF-8, malformed JSON and oversized input before writes", async () => {
    await expect(parseDataset(new Uint8Array([0xff]))).rejects.toThrow("UTF-8");
    await expect(
      parseDataset(new TextEncoder().encode("{bad")),
    ).rejects.toThrow("JSON");
    await expect(parseDataset(new Uint8Array(FILE_LIMIT + 1))).rejects.toThrow(
      "32 MiB",
    );
  });
  it.each([
    "version",
    "permission",
    "unknown",
    "missing",
    "duplicate",
    "order",
    "ambiguous",
    "unpaired",
  ])("rejects %s corruption", async (kind) => {
    const v = fixtureDataset();
    if (kind === "version") (v as unknown as { version: number }).version = 2;
    if (kind === "permission")
      (
        v.translation.license.permissions as unknown as { projection: boolean }
      ).projection = false;
    if (kind === "unknown")
      (
        v.translation.license as unknown as { unsupported: string }
      ).unsupported = "custom restriction";
    if (kind === "missing") v.verses.pop();
    if (kind === "duplicate") v.verses[1] = { ...v.verses[0] };
    if (kind === "order") v.verses.reverse();
    if (kind === "ambiguous") v.books[1].aliases.push("John");
    if (kind === "unpaired") v.verses[0].text = "broken\ud800";
    expect(() => validateDataset(v)).toThrow("Dataset ditolak");
  });
  it("permits declared partial datasets without assuming a fixed canon", async () => {
    const value = fixtureDataset();
    value.books[0].chapters[0].verses = [16, 18, 20];
    value.verses = value.verses.filter(
      (v) => !(v.chapter === 3 && v.verse === 17),
    );
    await expect(preparedFixture(value)).resolves.toBeDefined();
  });
  it("preserves the exact source when paginating long passages", () => {
    const text =
      "  Start  with spaces.\r\n" +
      "Original synthetic long text café 👋. ".repeat(120) +
      "\n\nEnd.  ";
    const pages = paginateExact(text, style, measure);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.join("")).toBe(text);
  });
});
describe("Scripture persistence, mixed schedules, and immutable snapshots", () => {
  let name: string,
    writer: ReturnType<typeof writerFixture>,
    repo: ScriptureRepository,
    songs: Repository;
  beforeEach(() => {
    name = crypto.randomUUID();
    writer = writerFixture();
    repo = new ScriptureRepository(writer.gate, name);
    songs = new Repository(writer.gate, name);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    writer.stop();
    await deleteDB(name);
  });
  async function seed() {
    return repo.importDataset(await preparedFixture(), true);
  }
  it("imports atomically, verifies chapters, and persists legacy settings/schema", async () => {
    const db = await openDatabase(name);
    await db.put("settings", { id: "preferences", value: defaults });
    db.close();
    const t = await seed();
    expect(validTranslation(t)).toBe(true);
    const chapter = await repo.chapter(t.id, "John", 3);
    expect(chapter).toHaveLength(4);
    expect(chapter[0].text).toBe(fixtureDataset().verses[0].text);
    expect(
      (await new ScriptureRepository(writer.gate, name).list()).translations,
    ).toHaveLength(1);
    const reopened = await openDatabase(name);
    expect(reopened.version).toBe(1);
    expect((await reopened.get("settings", "preferences")).value).toEqual(
      defaults,
    );
    reopened.close();
  });
  it("resolves aliases, numbered books, sparse ranges and cross-chapter selections exactly", async () => {
    const t = await seed();
    expect(resolveReference(t, "Yohanes 3:16-18,20")).toHaveLength(4);
    expect(resolveReference(t, "1 John 1:1")).toEqual([
      verseKey(t.id, 2, 1, 1),
    ]);
    expect(resolveReference(t, "John 3:20-4:2")).toHaveLength(3);
    expect(() => resolveReference(t, "John 3:18-20")).toThrow("tidak tersedia");
    expect(() => resolveReference(t, "John 3:18-16")).toThrow("terbalik");
    expect(() => resolveReference(t, "Unknown 1:1")).toThrow("Kitab");
    expect(resolveReference(t, "John 4")).toHaveLength(2);
  });
  it("searches imported text offline with Unicode case normalization", async () => {
    const t = await seed(),
      rows = await repo.chapter(t.id, "John", 3);
    expect(searchVerses(rows, "LANTERNS").total).toBe(1);
    expect(searchVerses(rows, "missing coordinate").results[0].verse).toBe(20);
  });
  it("requires WriterGate, attestation, and valid checksums before importing", async () => {
    const p = await preparedFixture();
    await expect(repo.importDataset(p, false)).rejects.toThrow("Konfirmasi");
    p.dataset.verses[0].text = "tampered";
    await expect(repo.importDataset(p, true)).rejects.toThrow("checksum");
    writer.gate.revoke();
    await expect(
      repo.importDataset(await preparedFixture(), true),
    ).rejects.toThrow("hanya baca");
    expect((await repo.list()).translations).toHaveLength(0);
  });
  it("refuses duplicate/conflicting editions without replacing existing data", async () => {
    const t = await seed();
    await expect(seed()).rejects.toThrow("identik");
    const v = fixtureDataset();
    v.verses[0].text = "Different text under the same edition identity.";
    await expect(
      repo.importDataset(await preparedFixture(v), true),
    ).rejects.toThrow("Konflik");
    expect((await repo.chapter(t.id, "John", 3))[0].text).toBe(
      fixtureDataset().verses[0].text,
    );
    const next = fixtureDataset();
    next.translation.edition = "2.0";
    await repo.importDataset(await preparedFixture(next), true);
    expect((await repo.list()).translations).toHaveLength(2);
  });
  it("rolls back every dataset row when a later verse write exceeds quota", async () => {
    const existing = await seed();
    const next = fixtureDataset();
    next.translation.edition = "2.0";
    const original = IDBObjectStore.prototype.add;
    let count = 0;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "scripture_verses" && ++count === 3)
        throw new DOMException("injected quota", "QuotaExceededError");
      return original.apply(this, args);
    });
    await expect(
      repo.importDataset(await preparedFixture(next), true),
    ).rejects.toThrow("quota");
    vi.restoreAllMocks();
    const db = await openDatabase(name);
    expect(await db.getAll("scripture_translations")).toEqual([existing]);
    expect(await db.getAll("scripture_verses")).toHaveLength(7);
    expect((await repo.chapter(existing.id, "John", 3))[0].text).toBe(
      fixtureDataset().verses[0].text,
    );
    db.close();
  });
  it.each(["cancel", "ownership"])(
    "aborts all writes on %s during a bulk import",
    async (kind) => {
      const controller = new AbortController();
      await expect(
        repo.importDataset(await preparedFixture(), true, {
          signal: controller.signal,
          progress: () => {
            if (kind === "cancel") controller.abort();
            else writer.gate.revoke();
          },
        }),
      ).rejects.toThrow();
      const db = await openDatabase(name);
      expect(await db.getAll("scripture_translations")).toEqual([]);
      expect(await db.getAll("scripture_verses")).toEqual([]);
      db.close();
    },
  );
  it("supports mixed schedule duplication/removal/reorder and atomic dataset deletion", async () => {
    const t = await seed();
    await songs.createSong("song", songFixture("song"));
    const schedule = await songs.createSchedule("Mixed");
    const a = await songs.addSong(schedule.id, "song", 1),
      choice = {
        datasetId: t.id,
        checksum: t.contentHash,
        verseIds: resolveReference(t, "John 3:16-18"),
        label: "selection",
      },
      b = await repo.addToSchedule(schedule.id, choice, 2);
    await songs.reorderItems(schedule.id, [b.id, a.id], 3);
    const copy = await songs.duplicateSchedule(schedule.id, 4);
    expect(copy.itemIds).toHaveLength(2);
    await songs.removeItem(schedule.id, b.id, 4);
    await repo.deleteDataset(t.id, t.contentHash);
    const data = await songs.load();
    expect(data.songs).toHaveLength(1);
    expect(data.items.every((i) => i.type === "song")).toBe(true);
    expect(data.schedules.every((s) => s.itemIds.length === 1)).toBe(true);
  });
  it("rolls back dataset deletion and schedule revisions if the final store write fails", async () => {
    const t = await seed(),
      schedule = await songs.createSchedule("Atomic removal");
    await repo.addToSchedule(
      schedule.id,
      {
        datasetId: t.id,
        checksum: t.contentHash,
        verseIds: resolveReference(t, "John 3:16"),
        label: "Scripture",
      },
      1,
    );
    const before = await songs.load();
    const original = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["delete"]>
    ) {
      if (this.name === "scripture_translations")
        throw new Error("injected final delete failure");
      return original.apply(this, args);
    });
    await expect(repo.deleteDataset(t.id, t.contentHash)).rejects.toThrow(
      "final delete",
    );
    vi.restoreAllMocks();
    const after = await songs.load();
    expect(after.schedules).toEqual(before.schedules);
    expect(after.items).toEqual(before.items);
    expect((await repo.list()).translations).toEqual([t]);
    expect(await repo.chapter(t.id, "John", 3)).toHaveLength(4);
  });
  it("detects missing and tampered verse records without inventing replacements", async () => {
    const t = await seed(),
      db = await openDatabase(name),
      key = verseKey(t.id, 1, 3, 16);
    const old = await db.get("scripture_verses", key);
    await db.put("scripture_verses", { ...old, text: "tampered" });
    await expect(repo.chapter(t.id, "John", 3)).rejects.toThrow("Integritas");
    expect((await db.get("scripture_verses", key)).text).toBe("tampered");
    await db.delete("scripture_verses", key);
    await expect(repo.chapter(t.id, "John", 3)).rejects.toThrow(
      "tidak lengkap",
    );
    db.close();
  });
  it("preserves corrupt manifests rather than overwriting them", async () => {
    const db = await openDatabase(name);
    await db.put("scripture_translations", { id: "broken", format: 99 });
    db.close();
    const data = await repo.list();
    expect(data.issues).toHaveLength(1);
    await seed();
    const reopened = await openDatabase(name);
    expect(await reopened.get("scripture_translations", "broken")).toEqual({
      id: "broken",
      format: 99,
    });
    reopened.close();
  });
  it("frozen Scripture LIVE retains exact text/citation/attribution after source deletion", async () => {
    const value = fixtureDataset();
    value.verses[0].text =
      " Exact original\r\n" + "synthetic long verse ".repeat(400);
    const t = await repo.importDataset(await preparedFixture(value), true),
      selection = {
        datasetId: t.id,
        checksum: t.contentHash,
        verseIds: resolveReference(t, "John 3:16-17"),
        label: "Scripture test",
      };
    const data = await repo.resolveWorkspace(await songs.load(), {
      kind: "scripture",
      selection,
    });
    const storage = new PresentationRepository(writer.gate, name),
      controller = new PresentationController(writer.gate, storage, measure);
    await controller.loadRecovery();
    await controller.prepare(data, { kind: "scripture", selection }, style);
    expect(controller.snapshot().preview?.deck.frames.length).toBeGreaterThan(
      2,
    );
    controller.goLive();
    const before = structuredClone(controller.snapshot().live!);
    expect(
      before.deck.frames
        .filter(
          (f) =>
            f.kind === "scripture" &&
            f.scripture.verseId === selection.verseIds[0],
        )
        .map((f) => before.deck.pages[f.page].text)
        .join(""),
    ).toBe(value.verses[0].text);
    await expect(controller.apply("Edited Bible text", style)).rejects.toThrow(
      "baca-saja",
    );
    await repo.deleteDataset(t.id, t.contentHash);
    controller.observeSources(await songs.load());
    expect(controller.snapshot().sourceChanged).toBe(true);
    expect(controller.snapshot().live).toEqual(before);
    await controller.settled();
    const checkpoint = await storage.loadCheckpoint();
    expect(checkpoint?.format).toBe(4);
    expect(checkpoint?.live?.deck.frames[0]).toMatchObject({
      kind: "scripture",
      scripture: {
        reference: "John 3:16",
        attribution: value.translation.license.displayAttribution,
        originalText: value.verses[0].text,
      },
    });
  });
  it("preserves legacy song checkpoints and blocks v1 Scripture messages", async () => {
    await songs.createSong("song", songFixture("song"));
    const { deck } = await generateSlides(
      await songs.load(),
      { kind: "song", songId: "song" },
      style,
      measure,
    );
    const live = { deck, index: 0, mode: "normal" as const },
      record = {
        id: "phase3:checkpoint",
        format: 1,
        revision: 1,
        sessionId: "legacy",
        sequence: 1,
        live,
        updatedAt: new Date().toISOString(),
      };
    expect(validCheckpoint(record)).toBe(true);
    const db = await openDatabase(name);
    await db.put("live_session_state", record);
    db.close();
    const store = new PresentationRepository(writer.gate, name);
    expect(await store.loadCheckpoint()).toEqual(record);
    const t = await seed(),
      selection = {
        datasetId: t.id,
        checksum: t.contentHash,
        verseIds: resolveReference(t, "John 3:16"),
        label: "Scripture",
      };
    const data = await repo.resolveWorkspace(await songs.load(), {
      kind: "scripture",
      selection,
    });
    const generated = await generateSlides(
      data,
      { kind: "scripture", selection },
      style,
      measure,
    );
    expect(validDeck(generated.deck)).toBe(true);
    const message = {
      v: 1,
      session: "session",
      epoch: "epoch",
      pair: "pair",
      nonce: "nonce",
      seq: 1,
      type: "STATE",
      live: { deck: generated.deck, index: 0, mode: "normal" },
    };
    expect(validMessage(message)).toBe(false);
    expect(validMessage({ ...message, v: 2 })).toBe(true);
    const broken = structuredClone(generated.deck);
    if (broken.frames[0].kind === "scripture")
      broken.frames[0].scripture.attribution = "omitted";
    expect(validDeck(broken)).toBe(false);
    expect(validDeck({ ...generated.deck, overrides: {} })).toBe(false);
    expect(validDeck({ ...generated.deck, sources: null })).toBe(false);
  });
});
