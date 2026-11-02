import "fake-indexeddb/auto";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { deleteDB } from "idb";
import { writerFixture, songFixture } from "../testHelpers";
import { openDatabase, defaults } from "../db";
import { MediaRepository } from "../data/mediaRepository";
import { Repository } from "../data/repository";
import { PresentationRepository } from "../data/presentationRepository";
import { PresentationController } from "../presentation/controller";
import { payload } from "./integrity";
import { readAsset } from "./assetReader";
import { identify } from "./validation";
import { validAsset, validSelection, type AssetRef } from "./models";
import { generateSlides } from "../presentation/generateSlides";
import { validCheckpoint, validDeck, type Style } from "../presentation/models";
import { validMessage } from "../presentation/protocol";
let name: string,
  writer: ReturnType<typeof writerFixture>,
  repo: MediaRepository,
  songs: Repository;
const style: Style = {
  font: "Arial",
  fontSize: 64,
  safeMargin: 8,
  theme: "black",
  lines: 6,
};
const measure = (s: string) => s.length * 32;
async function prepared(suffix = "a") {
  const p = await payload(
      new Blob([`synthetic image ${suffix}`], { type: "image/png" }),
    ),
    t = await payload(
      new Blob([`synthetic thumbnail ${suffix}`], { type: "image/png" }),
    );
  const ref = (v: typeof p): AssetRef => ({
    id: v.id,
    digest: v.digest,
    mime: v.mime,
    size: v.size,
    width: 1,
    height: 1,
    kind: "image",
  });
  return {
    asset: {
      id: `meta:${crypto.randomUUID()}`,
      format: 1 as const,
      revision: 1 as const,
      title: `Fixture ${suffix}`,
      filename: "fixture.png",
      kind: "image" as const,
      original: ref(p),
      thumbnail: ref(t),
      pages: 1,
      createdAt: new Date().toISOString(),
      compatibility: "Synthetic unit fixture",
    },
    payloads: [p, t],
  };
}
beforeEach(() => {
  name = `media-test-${crypto.randomUUID()}`;
  writer = writerFixture();
  repo = new MediaRepository(writer.gate, name);
  songs = new Repository(writer.gate, name);
});
afterEach(async () => {
  vi.restoreAllMocks();
  writer.stop();
  await deleteDB(name);
});
it("imports immutable payloads with metadata-only listing, reload, preferences and schema v1", async () => {
  const a = await repo.import(await prepared());
  expect(validAsset(a)).toBe(true);
  const reopened = new MediaRepository(writer.gate, name);
  expect((await reopened.list()).assets).toEqual([a]);
  expect((await readAsset(a.original, [a.original], name)).size).toBe(
    a.original.size,
  );
  const db = await openDatabase(name);
  expect(db.version).toBe(1);
  await songs.savePreferences(defaults);
  expect((await db.get("settings", "preferences")).value).toEqual(defaults);
  db.close();
});
it("rejects duplicates, corrupt payloads, invalid metadata and scope escalation without overwriting", async () => {
  const p = await prepared();
  await repo.import(p);
  const next = await prepared();
  await expect(repo.import(next)).rejects.toThrow("identik");
  await expect(readAsset(p.asset.original, [], name)).rejects.toThrow(
    "snapshot",
  );
  const broken = await prepared("b");
  broken.payloads[0].blob = new Blob(["modified"], { type: "image/png" });
  await expect(repo.import(broken)).rejects.toThrow("rusak");
  expect(
    validSelection({
      assetId: "meta:a",
      digest: "0".repeat(64),
      pages: [2, 1],
    }),
  ).toBe(false);
  expect((await repo.list()).assets).toHaveLength(1);
});
it("rolls back payloads if metadata add fails and preserves an existing dataset", async () => {
  const existing = await repo.import(await prepared());
  const add = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["add"]>
  ) {
    if ((args[0] as { id: string }).id.startsWith("meta:"))
      throw new DOMException("quota injected", "QuotaExceededError");
    return add.apply(this, args);
  });
  await expect(repo.import(await prepared("new"))).rejects.toThrow("quota");
  vi.restoreAllMocks();
  const db = await openDatabase(name);
  expect(await db.count("media_assets")).toBe(3);
  expect((await repo.list()).assets).toEqual([existing]);
  db.close();
});
it.each(["ownership", "cancel"])(
  "rolls back an import on %s loss inside its transaction",
  async (kind) => {
    const p = await prepared(),
      abort = new AbortController(),
      add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      const r = add.apply(this, args);
      if ((args[0] as { id: string }).id.startsWith("meta:")) {
        if (kind === "ownership") writer.gate.revoke();
        else abort.abort();
      }
      return r;
    });
    await expect(repo.import(p, abort.signal)).rejects.toThrow();
    const db = await openDatabase(name);
    expect(await db.count("media_assets")).toBe(0);
    db.close();
  },
);
it("read-only mutations fail at repository boundary", async () => {
  writer.gate.revoke();
  await expect(repo.import(await prepared())).rejects.toThrow("hanya baca");
  await expect(repo.delete("meta:a", "0".repeat(64))).rejects.toThrow(
    "hanya baca",
  );
  await expect(repo.collect()).rejects.toThrow("hanya baca");
});
it("mixed schedules duplicate and reorder; deletion retains frozen Preview, LIVE and checkpoint assets", async () => {
  const a = await repo.import(await prepared());
  await songs.createSong("song", songFixture("song"));
  const s = await songs.createSchedule("Mixed");
  const first = await songs.addSong(s.id, "song", 1);
  const selection = { assetId: a.id, digest: a.original.digest, pages: [1] };
  const item = await repo.addToSchedule(s.id, selection, 2);
  await songs.reorderItems(s.id, [item.id, first.id], 3);
  const copy = await songs.duplicateSchedule(s.id, 4);
  expect(copy.itemIds).toHaveLength(2);
  const workspace = await repo.resolveWorkspace(await songs.load(), {
    kind: "schedule",
    scheduleId: s.id,
  });
  const deck = await generateSlides(
    workspace,
    { kind: "schedule", scheduleId: s.id },
    style,
    measure,
  );
  expect(deck.deck.frames[0].kind).toBe("media");
  const store = new PresentationRepository(writer.gate, name),
    controller = new PresentationController(writer.gate, store, measure);
  await controller.loadRecovery();
  await controller.prepare(
    workspace,
    { kind: "schedule", scheduleId: s.id },
    style,
  );
  await controller.goLive();
  await controller.settled();
  const before = structuredClone(controller.snapshot().live);
  await repo.delete(a.id, a.original.digest);
  await repo.collect();
  expect(controller.snapshot().live).toEqual(before);
  expect(await readAsset(a.original, [a.original], name)).toBeInstanceOf(Blob);
  const checkpoint = await store.loadCheckpoint();
  expect(checkpoint?.format).toBe(4);
  expect(validCheckpoint(checkpoint)).toBe(true);
  expect((await songs.load()).items.every((i) => i.type === "song")).toBe(true);
  expect(validCheckpoint({ ...checkpoint, format: 2 })).toBe(false);
  expect(validDeck(deck.deck)).toBe(true);
  expect(
    validMessage({
      v: 2,
      type: "STATE",
      session: "s",
      epoch: "e",
      pair: "p",
      nonce: "n",
      seq: 1,
      live: before,
    }),
  ).toBe(false);
});
it("deletion rollback restores schedule refs and metadata when final tombstone fails", async () => {
  const a = await repo.import(await prepared()),
    s = await songs.createSchedule("Delete rollback");
  await repo.addToSchedule(
    s.id,
    { assetId: a.id, digest: a.original.digest, pages: [1] },
    1,
  );
  const before = await songs.load();
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    if ((args[0] as { id: string }).id.startsWith("deleted:"))
      throw new Error("injected failure");
    return put.apply(this, args);
  });
  await expect(repo.delete(a.id, a.original.digest)).rejects.toThrow(
    "injected",
  );
  vi.restoreAllMocks();
  expect((await songs.load()).schedules).toEqual(before.schedules);
  expect((await songs.load()).items).toEqual(before.items);
  expect((await repo.list()).assets).toEqual([a]);
});
it("missing pin dependencies abort a checkpoint and preserve the previous checkpoint", async () => {
  const a = await repo.import(await prepared()),
    selection = { assetId: a.id, digest: a.original.digest, pages: [1] },
    workspace = await repo.resolveWorkspace(await songs.load(), {
      kind: "media",
      selection,
    }),
    { deck } = await generateSlides(
      workspace,
      { kind: "media", selection },
      style,
      measure,
    );
  const store = new PresentationRepository(writer.gate, name);
  await store.checkpoint(null, "session", 0, 0);
  const db = await openDatabase(name);
  await db.delete("media_assets", a.original.id);
  await expect(
    store.checkpoint({ deck, index: 0, mode: "normal" }, "session", 1, 1),
  ).rejects.toThrow("hilang");
  expect((await store.loadCheckpoint())?.live).toBeNull();
  db.close();
});
it("conservative cleanup refuses unknown/corrupt pins and reports payload tampering", async () => {
  const a = await repo.import(await prepared()),
    db = await openDatabase(name),
    row = await db.get("media_assets", a.original.id);
  await db.put("media_assets", {
    ...row,
    blob: new Blob(["tamper"], { type: "image/png" }),
  });
  await expect(readAsset(a.original, [a.original], name)).rejects.toThrow(
    "rusak",
  );
  await db.put("media_assets", { id: "pin:corrupt", kind: "pin", refs: [] });
  await expect(repo.collect()).rejects.toThrow("Pin rusak");
  expect(await db.get("media_assets", a.original.id)).toBeDefined();
  db.close();
});
it("rejects malformed signatures, unsupported PPTX and excessive files before import", async () => {
  await expect(
    identify(new File(["not png"], "bad.png", { type: "image/png" })),
  ).rejects.toThrow("signature");
  await expect(identify(new File(["PK"], "test.pptx"))).rejects.toThrow(
    "disetujui",
  );
});

it("a delayed media Go Live cannot override a newer emergency Black", async () => {
  const a = await repo.import(await prepared()),
    selection = { assetId: a.id, digest: a.original.digest, pages: [1] };
  await songs.createSong("song", songFixture("song"));
  const store = new PresentationRepository(writer.gate, name),
    controller = new PresentationController(writer.gate, store, measure);
  await controller.loadRecovery();
  await controller.prepare(
    await songs.load(),
    { kind: "song", songId: "song" },
    style,
  );
  controller.goLive();
  const media = await repo.resolveWorkspace(await songs.load(), {
    kind: "media",
    selection,
  });
  await controller.prepare(media, { kind: "media", selection }, style);
  const storage = store.mediaRepository();
  let release!: () => void;
  vi.spyOn(storage, "pin").mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  vi.spyOn(store, "mediaRepository").mockReturnValue(storage);
  const pending = controller.goLive();
  controller.mode("black");
  release();
  await pending;
  expect(controller.snapshot().live?.mode).toBe("black");
  expect(controller.snapshot().live?.deck.frames[0].kind).not.toBe("media");
  await controller.settled();
});

it("reclaims deleted bytes only after acknowledged LIVE replacement and checkpoint release", async () => {
  const a = await repo.import(await prepared());
  const selection = { assetId: a.id, digest: a.original.digest, pages: [1] };
  const data = await repo.resolveWorkspace(await songs.load(), {
      kind: "media",
      selection,
    }),
    { deck } = await generateSlides(
      data,
      { kind: "media", selection },
      style,
      measure,
    );
  await repo.pin(deck, "live:session:old-deck");
  const store = new PresentationRepository(writer.gate, name);
  await store.checkpoint({ deck, index: 0, mode: "normal" }, "session", 1, 0);
  await repo.delete(a.id, a.original.digest);
  await repo.collect();
  expect(await readAsset(a.original, [a.original], name)).toBeInstanceOf(Blob);
  await repo.releaseRetired("session", "new-deck");
  await repo.collect();
  expect(await readAsset(a.original, [a.original], name)).toBeInstanceOf(Blob);
  await store.checkpoint(null, "session", 2, 1);
  await repo.collect();
  await expect(readAsset(a.original, [a.original], name)).rejects.toThrow(
    "hilang",
  );
});
it("rejects file-size and decoded-header pixel limits before decoding", async () => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, 100000);
  new DataView(bytes.buffer).setUint32(20, 100000);
  await expect(
    identify(new File([bytes], "huge.png", { type: "image/png" })),
  ).rejects.toThrow("40 megapiksel");
  const small = new File([bytes], "large.png", { type: "image/png" });
  Object.defineProperty(small, "size", { value: 26 * 1024 * 1024 });
  await expect(identify(small)).rejects.toThrow("25 MiB");
});
