import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { deleteDB } from "idb";
import { songFixture, writerFixture } from "../testHelpers";
import { Repository } from "../data/repository";
import { openDatabase, defaults } from "../db";
import { PresentationRepository } from "../data/presentationRepository";
import { PresentationController } from "./controller";
import { generateSlides } from "./generateSlides";
import { paginate, wrap, fits, type Measure } from "./layout";
import { Receiver, validMessage, type Pairing, type Message } from "./protocol";
import { clone, validDeck, validLive, frameText, type Style } from "./models";
const style: Style = {
  font: "Arial",
  fontSize: 64,
  safeMargin: 8,
  theme: "black",
  lines: 6,
};
const measure: Measure = (text, style) =>
  Array.from(text).length * style.fontSize * 0.6;
describe("generation, authorization, immutable LIVE and recovery", () => {
  let name: string,
    writer: ReturnType<typeof writerFixture>,
    repo: Repository,
    storage: PresentationRepository,
    controller: PresentationController;
  beforeEach(async () => {
    name = crypto.randomUUID();
    writer = writerFixture();
    repo = new Repository(writer.gate, name);
    storage = new PresentationRepository(writer.gate, name);
    controller = new PresentationController(writer.gate, storage, measure);
    await controller.loadRecovery();
  });
  afterEach(async () => {
    await controller.settled();
    vi.restoreAllMocks();
    writer.stop();
    await deleteDB(name);
  });
  async function seed() {
    const input = songFixture("song");
    input.sections.push({
      ...input.sections[0],
      id: "chorus",
      type: "Chorus",
      label: "Chorus",
      text: "Original chorus for software tests.",
    });
    input.order = [input.sections[0].id, "chorus", input.sections[0].id];
    await repo.createSong("song", input);
    return input;
  }
  it("expands repeated sections and repeated scheduled songs into distinct occurrences", async () => {
    await seed();
    const schedule = await repo.createSchedule("Service");
    await repo.addSong(schedule.id, "song", 1);
    await repo.addSong(schedule.id, "song", 2);
    const data = await repo.load();
    const { deck } = await generateSlides(
      data,
      { kind: "schedule", scheduleId: schedule.id },
      style,
      measure,
    );
    expect(deck.frames).toHaveLength(6);
    expect(deck.pages).toHaveLength(2);
    expect(new Set(deck.frames.map((f) => f.id)).size).toBe(6);
    expect(deck.frames.map((f) => f.label)).toEqual([
      "Verse 1",
      "Chorus",
      "Verse 1",
      "Verse 1",
      "Chorus",
      "Verse 1",
    ]);
  });
  it("paginates exact logical lines and preserves long Unicode tokens without clipping", () => {
    const text = Array.from(
      { length: 13 },
      (_, i) => `Original line ${i + 1}`,
    ).join("\n");
    expect(paginate(text, style, measure)).toHaveLength(3);
    expect(wrap("a".repeat(100), style, measure).join("")).toBe(
      "a".repeat(100),
    );
    expect(
      wrap("👨‍👩‍👧‍👦".repeat(10), { ...style, fontSize: 120 }, measure).join(""),
    ).toBe("👨‍👩‍👧‍👦".repeat(10));
    expect(fits(text, style, measure)).toBe(false);
  });
  it("rejects invalid/missing dependencies, bounded decks, and cancelled preparation", async () => {
    await seed();
    const data = await repo.load();
    await expect(
      generateSlides(data, { kind: "song", songId: "missing" }, style, measure),
    ).rejects.toThrow();
    await expect(
      generateSlides(
        data,
        { kind: "song", songId: "song" },
        style,
        measure,
        () => true,
      ),
    ).rejects.toThrow("dibatalkan");
    expect(validDeck({ frames: [] })).toBe(false);
    expect(validLive({})).toBe(false);
  });
  it("keeps LIVE and its remaining queue unchanged through Preview/source edits, deletion and preferences", async () => {
    const input = await seed();
    const data = await repo.load();
    await controller.prepare(data, { kind: "song", songId: "song" }, style);
    controller.goLive();
    const before = clone(controller.snapshot().live);
    controller.select(1);
    await controller.apply("Temporary preview text", {
      ...style,
      theme: "purple",
    });
    expect(controller.snapshot().live).toEqual(before);
    await repo.updateSong("song", { ...input, title: "Revised source" }, 1);
    await repo.savePreferences({ ...defaults, theme: "ocean" });
    await repo.deleteSong("song", 2);
    controller.observeSources(await repo.load());
    expect(controller.snapshot().sourceChanged).toBe(true);
    expect(controller.snapshot().live).toEqual(before);
    controller.navigate(1);
    expect(frameText(controller.snapshot().live!.deck, 1)).toBe(
      "Original chorus for software tests.",
    );
    controller.goLive();
    expect(frameText(controller.snapshot().live!.deck, 1)).toBe(
      "Temporary preview text",
    );
  });
  it("navigates across schedule boundaries without wrapping and preserves output modes", async () => {
    await seed();
    await repo.createSong("other", songFixture("other", "Other original"));
    const s = await repo.createSchedule("Service");
    await repo.addSong(s.id, "song", 1);
    await repo.addSong(s.id, "other", 2);
    await controller.prepare(
      await repo.load(),
      { kind: "schedule", scheduleId: s.id },
      style,
    );
    controller.goLive();
    controller.navigate(-1);
    expect(controller.snapshot().live?.index).toBe(0);
    controller.toggle("black");
    controller.navigate(3);
    expect(controller.snapshot().live).toMatchObject({
      index: 3,
      mode: "black",
    });
    controller.navigate(1);
    expect(controller.snapshot().live?.index).toBe(3);
    controller.toggle("clearText");
    expect(controller.snapshot().live?.mode).toBe("clearText");
    controller.mode("normal");
    expect(controller.snapshot().live?.mode).toBe("normal");
  });
  it("requires authorization for Go Live, navigation, modes, Apply, Resume, Discard and checkpoint writes", async () => {
    await seed();
    await controller.prepare(
      await repo.load(),
      { kind: "song", songId: "song" },
      style,
    );
    controller.goLive();
    await controller.settled();
    const before = clone(controller.snapshot().live);
    writer.gate.revoke();
    expect(() => controller.goLive()).toThrow("hanya baca");
    expect(() => controller.navigate(1)).toThrow("hanya baca");
    expect(() => controller.mode("black")).toThrow("hanya baca");
    await expect(controller.apply("Unauthorized", style)).rejects.toThrow(
      "hanya baca",
    );
    await expect(controller.resume()).rejects.toThrow("hanya baca");
    await expect(controller.discard()).rejects.toThrow("hanya baca");
    await expect(storage.checkpoint(before, "other", 99, 1)).rejects.toThrow(
      "hanya baca",
    );
    expect(controller.snapshot().live).toEqual(before);
  });
  it("leaves LIVE usable including Black after checkpoint storage fails and supports retry", async () => {
    await seed();
    await controller.prepare(
      await repo.load(),
      { kind: "song", songId: "song" },
      style,
    );
    vi.spyOn(storage, "checkpoint").mockRejectedValueOnce(
      new DOMException("quota", "QuotaExceededError"),
    );
    controller.goLive();
    await controller.settled();
    expect(controller.snapshot().checkpoint).toContain("gagal");
    controller.toggle("black");
    expect(controller.snapshot().live?.mode).toBe("black");
    await controller.settled();
    expect((await storage.loadCheckpoint())?.live?.mode).toBe("black");
  });
  it("shows a validated alert ticker that survives Go Live, navigation, Black and checkpoints", async () => {
    await seed();
    await controller.prepare(
      await repo.load(),
      { kind: "song", songId: "song" },
      style,
    );
    expect(() => controller.alert("Too early")).toThrow("Go Live");
    controller.goLive();
    controller.alert("  Parkir penuh  ");
    expect(controller.snapshot().live?.alert).toEqual({ text: "Parkir penuh" });
    expect(validLive(controller.snapshot().live)).toBe(true);
    expect(() => controller.alert("x".repeat(301))).toThrow("maksimal");
    expect(controller.snapshot().live?.alert?.text).toBe("Parkir penuh");
    controller.navigate(1);
    controller.toggle("black");
    expect(controller.snapshot().live).toMatchObject({
      index: 1,
      mode: "black",
      alert: { text: "Parkir penuh" },
    });
    controller.select(2);
    controller.goLive();
    expect(controller.snapshot().live).toMatchObject({
      index: 2,
      alert: { text: "Parkir penuh" },
    });
    await controller.settled();
    expect((await storage.loadCheckpoint())?.live?.alert?.text).toBe(
      "Parkir penuh",
    );
    controller.alert("   ");
    expect(controller.snapshot().live).not.toHaveProperty("alert");
    controller.alert("Again");
    controller.alert(null);
    expect(controller.snapshot().live).not.toHaveProperty("alert");
    const live = clone(controller.snapshot().live)!;
    expect(validLive({ ...live, alert: { text: "" } })).toBe(false);
    expect(validLive({ ...live, alert: { text: "a", extra: 1 } })).toBe(false);
    expect(validLive({ ...live, alert: { text: "x".repeat(301) } })).toBe(
      false,
    );
    expect(validLive({ ...live, alert: { text: "ok" } })).toBe(true);
    writer.gate.revoke();
    expect(() => controller.alert("Unauthorized")).toThrow("hanya baca");
  });
  it("offers explicit Resume/Discard after restart and never starts LIVE automatically", async () => {
    await seed();
    await controller.prepare(
      await repo.load(),
      { kind: "song", songId: "song" },
      style,
    );
    controller.goLive();
    controller.mode("black");
    await controller.settled();
    const fresh = new PresentationController(writer.gate, storage, measure);
    await fresh.loadRecovery();
    expect(fresh.snapshot().live).toBeNull();
    expect(fresh.snapshot().recovery?.live?.mode).toBe("black");
    expect(() => fresh.goLive()).toThrow("Resume");
    await fresh.resume();
    expect(fresh.snapshot().live?.mode).toBe("black");
    await fresh.settled();
    const discard = new PresentationController(writer.gate, storage, measure);
    await discard.loadRecovery();
    await discard.discard();
    expect(discard.snapshot().live).toBeNull();
    expect((await storage.loadCheckpoint())?.live).toBeNull();
  });
  it("preserves corrupt checkpoints and unrelated Phase 1/2 records", async () => {
    const db = await openDatabase(name);
    await db.put("live_session_state", { id: "phase3:checkpoint", bad: true });
    await db.put("settings", { id: "preferences", value: defaults });
    db.close();
    await expect(storage.loadCheckpoint()).rejects.toThrow("rusak");
    await expect(storage.checkpoint(null, "session", 1, 0)).rejects.toThrow(
      "rusak",
    );
    const reopened = await openDatabase(name);
    expect(
      await reopened.get("live_session_state", "phase3:checkpoint"),
    ).toEqual({ id: "phase3:checkpoint", bad: true });
    expect((await reopened.get("settings", "preferences")).value).toEqual(
      defaults,
    );
    expect(reopened.version).toBe(1);
    reopened.close();
  });
  it("rejects stale checkpoint writes and rolls back a quota failure without deleting prior state", async () => {
    const first = await storage.checkpoint(null, "session", 1, 0);
    await expect(storage.checkpoint(null, "session", 2, 0)).rejects.toThrow(
      "Konflik",
    );
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "live_session_state") throw new Error("injected quota");
      return original.apply(this, args);
    });
    await expect(storage.checkpoint(null, "session", 2, 1)).rejects.toThrow(
      "quota",
    );
    vi.restoreAllMocks();
    expect(await storage.loadCheckpoint()).toEqual(first);
  });
  it("rejects a superseded async preparation and keeps the latest selection", async () => {
    await seed();
    await repo.createSong("other", songFixture("other", "Latest"));
    const data = await repo.load();
    await Promise.all([
      controller.prepare(data, { kind: "song", songId: "song" }, style),
      controller.prepare(data, { kind: "song", songId: "other" }, style),
    ]);
    expect(controller.snapshot().preview?.deck.label).toBe("Latest");
  });
  it("persists occurrence-specific overrides but does not write source songs", async () => {
    await seed();
    await controller.prepare(
      await repo.load(),
      { kind: "song", songId: "song" },
      style,
    );
    const songBefore = (await repo.load()).songs[0];
    await controller.apply("Only first occurrence", style);
    controller.select(2);
    expect(controller.text().replace(/\s+/g, " ")).toBe(
      songBefore.sections[0].text,
    );
    await controller.prepare(
      await repo.load(),
      { kind: "song", songId: "song" },
      style,
    );
    expect(controller.text()).toBe("Only first occurrence");
    expect((await repo.load()).songs[0]).toEqual(songBefore);
  });
});
describe("versioned projector receiver", () => {
  const pairing: Pairing = { session: "session", epoch: "epoch", pair: "pair" };
  it("rejects old sessions, document nonces, invalid versions and incomplete state", () => {
    const receiver = new Receiver(pairing, "document");
    for (const value of [
      {
        ...pairing,
        v: 99,
        nonce: "document",
        seq: 1,
        type: "STATE",
        live: null,
      },
      {
        ...pairing,
        v: 1,
        nonce: "old-document",
        seq: 1,
        type: "STATE",
        live: null,
      },
      {
        ...pairing,
        session: "old-session",
        v: 1,
        nonce: "document",
        seq: 1,
        type: "STATE",
        live: null,
      },
      { ...pairing, v: 1, nonce: "document", seq: 1, type: "STATE" },
    ])
      expect(receiver.accept(value)).toBe("rejected");
    expect(receiver.sequence).toBe(-1);
  });
  it("accepts complete newer states, gaps, and ignores duplicate or out-of-order delivery", () => {
    const receiver = new Receiver(pairing, "document");
    const message: Message = {
      ...pairing,
      v: 1,
      nonce: "document",
      seq: 10,
      type: "STATE",
      live: null,
    };
    expect(receiver.accept(message)).toBe("applied");
    expect(receiver.accept(message)).toBe("duplicate");
    expect(receiver.accept({ ...message, seq: 9 })).toBe("stale");
    expect(receiver.accept({ ...message, seq: 13 })).toBe("applied");
    expect(validMessage({ ...message, seq: NaN })).toBe(false);
    expect(receiver.sequence).toBe(13);
  });
});

describe("defensive payload validation", () => {
  it("rejects cyclic snapshots and excessive frame counts without throwing", async () => {
    const writer = writerFixture(),
      name = crypto.randomUUID(),
      repo = new Repository(writer.gate, name);
    try {
      await repo.createSong("song", songFixture("song"));
      const { deck } = await generateSlides(
        await repo.load(),
        { kind: "song", songId: "song" },
        style,
        measure,
      );
      const cyclic = deck as typeof deck & { cycle?: unknown };
      cyclic.cycle = cyclic;
      expect(validDeck(cyclic)).toBe(false);
      delete cyclic.cycle;
      expect(
        validDeck({ ...deck, frames: Array(10001).fill(deck.frames[0]) }),
      ).toBe(false);
    } finally {
      writer.stop();
      await deleteDB(name);
    }
  });
  it("revision-fences persisted Preview overrides and leaves a newer override intact", async () => {
    const writer = writerFixture(),
      name = crypto.randomUUID(),
      repo = new PresentationRepository(writer.gate, name);
    const value = {
      id: "phase3:frame",
      format: 1 as const,
      frameId: "frame",
      text: "Original override test.",
      style,
      sourceSignature: "source",
    };
    try {
      await repo.saveOverride(value, 0);
      await expect(
        repo.saveOverride({ ...value, text: "Stale replacement" }, 0),
      ).rejects.toThrow("Konflik");
      expect((await repo.loadOverrides()).values[0].text).toBe(value.text);
    } finally {
      writer.stop();
      await deleteDB(name);
    }
  });
});
