import { PresentationController } from "../presentation/controller";
import "fake-indexeddb/auto";
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { deleteDB } from "idb";
import { openDatabase, defaults } from "../db";
import { writerFixture, songFixture } from "../testHelpers";
import { Repository } from "../data/repository";
import { BackupRepository, readSnapshot } from "../data/backupRepository";
import { RestoreRepository } from "../data/restoreRepository";
import { HealthRepository } from "../data/healthRepository";
import { WriterGate } from "../data/writer";
import { ThemeRepository } from "../data/themeRepository";
import { MediaRepository } from "../data/mediaRepository";
import { ScriptureRepository } from "../data/scriptureRepository";
import { PresentationRepository } from "../data/presentationRepository";
import { payload } from "../media/integrity";
import { defaultType } from "../themes/models";
import { preparedFixture } from "../scriptures/testFixtures";
import {
  parseDataset,
  canonicalJSON,
  sha256,
  unsigned,
} from "../scriptures/importFormat";
import { generateSlides } from "../presentation/generateSlides";
import { encodeArchive, decodeArchive } from "./container";
import { validateRows, portableRows } from "./validation";
import { makePlan, snapshotHash } from "../recovery/restorePlan";
let name: string,
  dest: string,
  w: ReturnType<typeof writerFixture>,
  repo: Repository,
  backup: BackupRepository,
  stages: string[];
beforeEach(() => {
  name = `backup-${crypto.randomUUID()}`;
  dest = `restore-${crypto.randomUUID()}`;
  w = writerFixture();
  repo = new Repository(w.gate, name);
  backup = new BackupRepository(w.gate, name);
  stages = [];
});
afterEach(async () => {
  w.stop();
  vi.restoreAllMocks();
  await Promise.all([name, dest, ...stages].map((n) => deleteDB(n)));
});
async function seed() {
  const id = crypto.randomUUID();
  const song = await repo.createSong(id, songFixture(id));
  const schedule = await repo.createSchedule("Synthetic service");
  await repo.addSong(schedule.id, id, schedule.revision);
  await repo.savePreferences({ ...defaults, volume: 43 });
  return song;
}
async function stageTo(target: string, blob: Blob) {
  const b = new BackupRepository(w.gate, target),
    s = await b.stage(blob);
  stages.push(s.name);
  return s;
}
async function media() {
  const p = await payload(
    new Blob(["original synthetic media bytes"], { type: "image/png" }),
  );
  const ref = {
    id: p.id,
    digest: p.digest,
    mime: p.mime,
    size: p.size,
    width: 1,
    height: 1,
    kind: "image" as const,
  };
  const thumb = await payload(
    new Blob(["synthetic thumbnail"], { type: "image/png" }),
  );
  const asset = {
    id: `meta:${crypto.randomUUID()}`,
    format: 1 as const,
    revision: 1 as const,
    title: "Synthetic media",
    filename: "fixture.png",
    kind: "image" as const,
    original: ref,
    thumbnail: { ...ref, id: thumb.id, digest: thumb.digest, size: thumb.size },
    pages: 1,
    createdAt: new Date().toISOString(),
    compatibility: "Synthetic unit fixture",
  };
  await new MediaRepository(w.gate, name).import({
    asset,
    payloads: [p, thumb],
  });
  return { asset, ref };
}
it("round trips songs, repeated sections, schedules, settings and binary media in fresh schema v1", async () => {
  await seed();
  const m = await media();
  const archive = await backup.create();
  expect(archive.manifest.complete).toBe(true);
  const stage = await stageTo(dest, archive.blob),
    restore = new RestoreRepository(w.gate, () => {}, dest),
    plan = await restore.preview(stage, "fresh");
  await restore.publish(plan.id, true);
  const result = await new Repository(w.gate, dest).load();
  expect(result.songs).toHaveLength(1);
  expect(result.schedules).toHaveLength(1);
  expect(result.issues).toEqual([]);
  const db = await openDatabase(dest);
  expect(db.version).toBe(1);
  expect((await db.get("settings", "preferences")).value.volume).toBe(43);
  expect(await (await db.get("media_assets", m.ref.id)).blob.text()).toBe(
    "original synthetic media bytes",
  );
  db.close();
});
it("round trips exportable Scripture, themes, signatures, frozen checkpoint and paused recovery", async () => {
  await seed();
  const { ref } = await media();
  const theme = await new ThemeRepository(w.gate, name).save(
    `theme:${crypto.randomUUID()}`,
    "Fixture",
    {
      background: {
        kind: "image",
        asset: ref,
        poster: ref,
        libraryId: "meta:removed",
        fit: "contain",
        x: 50,
        y: 50,
        dim: 0,
        fallback: "#000000",
      },
      type: structuredClone(defaultType),
    },
    0,
  );
  const p = await preparedFixture();
  p.dataset.translation.license.permissions.export = true;
  p.dataset.integrity.contentHash = await sha256(
    canonicalJSON(unsigned(p.dataset)),
  );
  const prepared = await parseDataset(
    new TextEncoder().encode(canonicalJSON(p.dataset)),
  );
  await new ScriptureRepository(w.gate, name).importDataset(prepared, true);
  const workspace = await repo.load();
  const { deck } = await generateSlides(
    workspace,
    { kind: "song", songId: workspace.songs[0].id },
    { font: "Arial", fontSize: 64, safeMargin: 8, theme: "black", lines: 6 },
    (t) => t.length * 30,
  );
  await new PresentationRepository(w.gate, name).checkpoint(
    { deck, index: 0, mode: "normal", alert: { text: "Parkir penuh" } },
    "old-session",
    2,
    0,
  );
  const archive = await backup.create(),
    s = await stageTo(dest, archive.blob),
    restore = new RestoreRepository(w.gate, () => {}, dest),
    plan = await restore.preview(s, "fresh");
  await restore.publish(plan.id, true);
  const rows = await readSnapshot(dest);
  await validateRows(rows);
  expect(
    rows.some((r) => r.store === "themes" && r.value.id === theme.id),
  ).toBe(true);
  expect(rows.filter((r) => r.store === "scripture_verses")).toHaveLength(7);
  const restored = await new PresentationRepository(
    w.gate,
    dest,
  ).loadCheckpoint();
  expect(restored?.sessionId).not.toBe("old-session");
  expect(restored?.live?.alert).toEqual({ text: "Parkir penuh" });
});
it("excludes restricted dataset and whole affected schedule/checkpoint without leaking verse text", async () => {
  const p = await preparedFixture();
  const t = await new ScriptureRepository(w.gate, name).importDataset(p, true);
  const schedule = await repo.createSchedule("Restricted service");
  const verses = await new ScriptureRepository(w.gate, name).chapter(
    t.id,
    "John",
    3,
  );
  await new ScriptureRepository(w.gate, name).addToSchedule(
    schedule.id,
    {
      datasetId: t.id,
      checksum: t.contentHash,
      verseIds: [verses[0].id],
      label: "Synthetic reference",
    },
    schedule.revision,
  );
  const a = await backup.create();
  expect(a.manifest.complete).toBe(false);
  const got = await backup.verify(a.blob);
  expect(got.rows.some((r) => r.store === "scripture_verses")).toBe(false);
  expect(got.rows.some((r) => r.store === "schedules")).toBe(false);
  expect(got.manifest.omissions.length).toBeGreaterThan(0);
  const raw = await encodeArchive(await readSnapshot(name));
  await expect(backup.verify(raw.blob)).rejects.toThrow("Scripture");
});
it("rejects truncated, future, corrupt, duplicate and malicious archives before staging", async () => {
  await seed();
  const a = await backup.create();
  await expect(backup.verify(a.blob.slice(0, -1))).rejects.toThrow();
  const bytes = new Uint8Array(await a.blob.arrayBuffer());
  bytes[7] = 57;
  await expect(decodeArchive(new Blob([bytes]))).rejects.toThrow("format");
  const damaged = new Uint8Array(await a.blob.arrayBuffer());
  damaged[damaged.length - 80] ^= 1;
  await expect(backup.verify(new Blob([damaged]))).rejects.toThrow();
  const rows = await readSnapshot(name),
    duplicate = await encodeArchive([...rows, rows[0]]);
  await expect(backup.verify(duplicate.blob)).rejects.toThrow("duplikat");
  const evil = await encodeArchive([
    {
      store: "settings",
      value: JSON.parse('{"id":"preferences","__proto__":{"polluted":true}}'),
    },
  ]);
  await expect(backup.verify(evil.blob)).rejects.toThrow("berbahaya");
  expect(({} as any).polluted).toBeUndefined();
});
it("requires writer authorization for staging, restore and repair", async () => {
  await seed();
  const a = await backup.create(),
    reader = new WriterGate();
  await expect(
    new BackupRepository(reader, dest).stage(a.blob),
  ).rejects.toThrow("hanya baca");
  const stage = await stageTo(dest, a.blob);
  await expect(
    new RestoreRepository(reader, () => {}, dest).preview(stage, "fresh"),
  ).rejects.toThrow();
  await expect(
    new HealthRepository(reader, () => {}, dest).repair("none", "none", true),
  ).rejects.toThrow();
});
it("maintenance prevents repository writes and invalidates stale authorization after completion", async () => {
  const old = w.gate.ticket();
  await w.gate.exclusive(async (permit) => {
    expect(() => w.gate.ticket()).toThrow();
    w.gate.assert(permit);
    await expect(repo.createSchedule("Forbidden")).rejects.toThrow();
  });
  expect(() => w.gate.assert(old)).toThrow();
  await repo.createSchedule("Allowed after maintenance");
});
it("requires explicit confirmation and End Session authority before atomic publication", async () => {
  await seed();
  const a = await backup.create(),
    s = await stageTo(dest, a.blob),
    ready = vi.fn(() => {
      throw new Error("LIVE active");
    }),
    r = new RestoreRepository(w.gate, ready, dest),
    p = await r.preview(s, "fresh");
  await expect(r.publish(p.id, false)).rejects.toThrow("konfirmasi");
  await expect(r.publish(p.id, true)).rejects.toThrow("LIVE active");
  expect((await new Repository(w.gate, dest).load()).songs).toHaveLength(0);
});
it("rolls back every destination store when final receipt exceeds quota", async () => {
  await seed();
  const a = await backup.create(),
    s = await stageTo(dest, a.blob),
    r = new RestoreRepository(w.gate, () => {}, dest),
    p = await r.preview(s, "fresh");
  const original = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
    this: IDBObjectStore,
    value: any,
    key?: IDBValidKey,
  ) {
    if (this.name === "backup_manifest" && value.kind === "receipt")
      throw new DOMException("Injected quota", "QuotaExceededError");
    return original.call(this, value, key);
  });
  await expect(r.publish(p.id, true)).rejects.toThrow("quota");
  expect((await readSnapshot(dest)).length).toBe(0);
});
it("rejects stale preview if destination changes and cancellation preserves destination", async () => {
  await seed();
  const a = await backup.create(),
    s = await stageTo(dest, a.blob),
    r = new RestoreRepository(w.gate, () => {}, dest),
    p = await r.preview(s, "fresh");
  await new Repository(w.gate, dest).createSchedule("New intent");
  await expect(r.publish(p.id, true)).rejects.toThrow("berubah");
  const abort = new AbortController();
  abort.abort();
  await expect(r.publish(p.id, true, abort.signal)).rejects.toThrow();
  expect((await new Repository(w.gate, dest).load()).schedules[0].name).toBe(
    "New intent",
  );
});
it("aborts atomic publication completely on ownership loss inside a write", async () => {
  await seed();
  const a = await backup.create(),
    s = await stageTo(dest, a.blob),
    r = new RestoreRepository(w.gate, () => {}, dest),
    p = await r.preview(s, "fresh");
  const original = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    value: any,
    key?: IDBValidKey,
  ) {
    const request = original.call(this, value, key);
    if (this.name === "songs") w.gate.revoke();
    return request;
  });
  await expect(r.publish(p.id, true)).rejects.toThrow();
  expect(await readSnapshot(dest)).toEqual([]);
});
it("merge keeps destination aggregates and safely duplicates conflicting song sections/schedules", async () => {
  const song = await seed(),
    rows = await readSnapshot(name);
  const target = new Repository(w.gate, dest);
  await target.createSong(song.id, songFixture(song.id, "Destination song"));
  const s = await stageTo(dest, (await backup.create()).blob),
    r = new RestoreRepository(w.gate, () => {}, dest),
    p = await r.preview(s, "both");
  await r.publish(p.id, true);
  const workspace = await target.load();
  expect(workspace.songs).toHaveLength(2);
  expect(workspace.issues).toEqual([]);
  expect(
    new Set(workspace.songs.flatMap((s) => s.sections.map((s) => s.id))).size,
  ).toBe(2);
  const merge = await makePlan(
    rows,
    await readSnapshot(dest),
    "existing",
    "unused",
    dest,
  );
  expect(merge.rows.some((r) => r.store === "songs")).toBe(false);
  expect(
    merge.summary.some((s) => s.includes("Pertahankan tujuan; lewati songs|")),
  ).toBe(true);
  await validateRows([...(await readSnapshot(dest))].filter(Boolean));
});
it("never resurrects a tombstoned song during merge and rejects unsafe override remapping", async () => {
  const song = await seed(),
    a = await backup.create(),
    target = new Repository(w.gate, dest);
  await target.createSong(song.id, songFixture(song.id));
  await target.deleteSong(song.id, 1);
  const s = await stageTo(dest, a.blob),
    r = new RestoreRepository(w.gate, () => {}, dest),
    p = await r.preview(s, "existing");
  await r.publish(p.id, true);
  expect((await target.load()).songs).toHaveLength(0);
});
it("diagnostics rebuild only missing verified dependency pins; no orphan deletion", async () => {
  await seed();
  const { ref } = await media();
  const theme = await new ThemeRepository(w.gate, name).save(
    `theme:${crypto.randomUUID()}`,
    "Retained",
    {
      background: {
        kind: "image",
        asset: ref,
        poster: ref,
        libraryId: "meta:source",
        fit: "cover",
        x: 50,
        y: 50,
        dim: 0,
        fallback: "#000000",
      },
      type: structuredClone(defaultType),
    },
    0,
  );
  const db = await openDatabase(name);
  await db.delete("media_assets", `pin:theme:${theme.id}`);
  db.close();
  const h = new HealthRepository(w.gate, () => {}, name),
    scan = await h.scan(true);
  const finding = scan.findings.find((f) => f.repair);
  expect(finding).toBeDefined();
  await h.repair(scan.id, finding!.id, true);
  const after = await h.scan(true);
  expect(after.findings.some((f) => f.repair)).toBe(false);
  expect(after.bytes).toBe(scan.bytes);
});
it("corruption blocks normal backup and repair while diagnostics preserve data", async () => {
  await seed();
  const { ref } = await media();
  const db = await openDatabase(name);
  const old = await db.get("media_assets", ref.id);
  await db.put("media_assets", {
    ...old,
    blob: new Blob(["tampered"], { type: "image/png" }),
  });
  db.close();
  await expect(backup.create()).rejects.toThrow();
  const h = await new HealthRepository(w.gate, () => {}, name).scan(true);
  expect(h.valid).toBe(false);
  expect(h.findings.some((f) => f.severity === "error")).toBe(true);
  expect((await readSnapshot(name)).some((r) => r.value.id === ref.id)).toBe(
    true,
  );
});
it("interrupted staging stays isolated and can be explicitly removed", async () => {
  await seed();
  const a = await backup.create();
  const controller = new AbortController();
  controller.abort();
  await expect(backup.stage(a.blob, controller.signal)).rejects.toThrow();
  const s = await stageTo(dest, a.blob),
    b = new BackupRepository(w.gate, dest);
  expect((await b.stages()).map((s) => s.id)).toContain(s.name);
  await b.removeStage(s.name);
  expect(await b.stages()).toEqual([]);
  expect(await readSnapshot(dest)).toEqual([]);
});
it("rejects keep-both when existing overrides make signature remapping unsafe", async () => {
  const song = await seed();
  const source = await readSnapshot(name);
  await new PresentationRepository(w.gate, name).saveOverride(
    {
      id: "phase3:fixture",
      format: 1,
      frameId: "frame",
      text: "Original override",
      style: {
        font: "Arial",
        fontSize: 64,
        safeMargin: 8,
        theme: "black",
        lines: 6,
      },
      sourceSignature: "fixture",
    },
    0,
  );
  await new Repository(w.gate, dest).createSong(
    song.id,
    songFixture(song.id, "Conflicting destination"),
  );
  await expect(
    makePlan(
      await readSnapshot(name),
      await readSnapshot(dest),
      "both",
      "stage",
      dest,
    ),
  ).rejects.toThrow("signature");
});
it("cancel during publication rolls back earlier writes and the completion receipt", async () => {
  await seed();
  const s = await stageTo(dest, (await backup.create()).blob),
    r = new RestoreRepository(w.gate, () => {}, dest),
    p = await r.preview(s, "fresh"),
    abort = new AbortController();
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    value: any,
    key?: IDBValidKey,
  ) {
    const request = put.call(this, value, key);
    if (this.name === "songs") abort.abort();
    return request;
  });
  await expect(r.publish(p.id, true, abort.signal)).rejects.toThrow();
  expect(await readSnapshot(dest)).toEqual([]);
});
it("an interrupted staging batch leaves only isolated data and a discoverable journal", async () => {
  await seed();
  const archive = await backup.create();
  const abort = new AbortController(),
    add = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
    this: IDBObjectStore,
    value: any,
    key?: IDBValidKey,
  ) {
    const req = add.call(this, value, key);
    if (this.name === "songs") abort.abort();
    return req;
  });
  const b = new BackupRepository(w.gate, dest);
  await expect(b.stage(archive.blob, abort.signal)).rejects.toThrow();
  expect(await readSnapshot(dest)).toEqual([]);
  const jobs = await b.stages();
  expect(jobs).toHaveLength(1);
  stages.push(jobs[0].id);
  expect(await readSnapshot(jobs[0].id)).toEqual([]);
  await expect(
    new RestoreRepository(w.gate, () => {}, dest).preview(
      { name: jobs[0].id, manifest: archive.manifest },
      "fresh",
    ),
  ).rejects.toThrow("belum lengkap");
});
it("unknown record versions and fields fail closed without hiding preserved data", async () => {
  await seed();
  const db = await openDatabase(name);
  await db.put("backup_manifest", {
    id: "future",
    format: 99,
    kind: "future",
    text: "must not vanish",
  });
  db.close();
  await expect(backup.create()).rejects.toThrow("tidak didukung");
  const health = await new HealthRepository(w.gate, () => {}, name).scan(true);
  expect(health.valid).toBe(false);
  expect((await readSnapshot(name)).some((r) => r.value.id === "future")).toBe(
    true,
  );
});
it("staging source changed after preview cannot publish", async () => {
  await seed();
  const s = await stageTo(dest, (await backup.create()).blob),
    r = new RestoreRepository(w.gate, () => {}, dest),
    p = await r.preview(s, "fresh");
  const db = await openDatabase(s.name);
  const rows = await db.getAll("songs");
  await db.put("songs", { ...rows[0], title: "Changed staging intent" });
  db.close();
  await expect(r.publish(p.id, true)).rejects.toThrow("berubah");
  expect(await readSnapshot(dest)).toEqual([]);
});
it("checkpoint candidate selection preserves the previous checkpoint and all retention pins", async () => {
  const s1 = await seed();
  const { deck } = await generateSlides(
    await repo.load(),
    { kind: "song", songId: s1.id },
    { font: "Arial", fontSize: 64, safeMargin: 8, theme: "black", lines: 6 },
    (t) => t.length * 30,
  );
  const p = new PresentationRepository(w.gate, name);
  await p.checkpoint({ deck, index: 0, mode: "black" }, "old", 1, 0);
  const db = await openDatabase(name);
  const old = await db.get("live_session_state", "phase3:checkpoint");
  await db.put("backup_manifest", {
    id: "phase7:candidate:fixture",
    format: 1,
    kind: "candidate",
    checkpoint: { ...old, live: { ...old.live, mode: "normal" } },
    createdAt: new Date().toISOString(),
  });
  db.close();
  const r = new RestoreRepository(w.gate, () => {}, name);
  await r.activateCandidate("phase7:candidate:fixture", true);
  expect((await p.loadCheckpoint())?.live?.mode).toBe("normal");
  expect(
    (await r.candidates()).some((c) => c.checkpoint.live.mode === "black"),
  ).toBe(true);
  await validateRows(await readSnapshot(name));
});
it("backup filters a restricted frozen checkpoint even after the source dataset was removed", async () => {
  await seed();
  const { deck } = await generateSlides(
    await repo.load(),
    { kind: "song", songId: (await repo.load()).songs[0].id },
    { font: "Arial", fontSize: 64, safeMargin: 8, theme: "black", lines: 6 },
    (t) => t.length * 30,
  );
  // License table can remain in a mixed snapshot even when this cursor is a song.
  const fixture = await preparedFixture();
  deck.scriptureLicenses = [
    {
      datasetId: "removed",
      license: fixture.dataset.translation.license,
      translation: "SYN",
      checksum: fixture.dataset.integrity.contentHash,
    },
  ];
  await new PresentationRepository(w.gate, name).checkpoint(
    { deck, index: 0, mode: "normal" },
    "session",
    1,
    0,
  );
  const a = await backup.create();
  expect(a.manifest.complete).toBe(false);
  expect(
    (await backup.verify(a.blob)).rows.some(
      (r) => r.store === "live_session_state",
    ),
  ).toBe(false);
});
it("archive canonical serialization supports absent optional playback fields", async () => {
  const rows: any = [
    {
      store: "settings",
      value: { id: "phase2:active-schedule", value: null, unused: undefined },
    },
  ];
  const a = await encodeArchive(rows);
  const decoded = await decodeArchive(a.blob);
  expect(decoded.rows[0].value).toEqual({
    id: "phase2:active-schedule",
    value: null,
  });
});
it("large binary entries are chunked at 4 MiB and preserve exact bytes without whole-file hashing", async () => {
  const raw = new Uint8Array(9 * 1024 ** 2);
  raw[raw.length - 1] = 237;
  raw[4 * 1024 ** 2] = 42;
  const p = await payload(new Blob([raw], { type: "video/webm" }));
  const a = await encodeArchive([{ store: "media_assets", value: p }]);
  expect(
    a.manifest.entries.filter((e) => e.kind === "chunk").map((e) => e.length),
  ).toEqual([4 * 1024 ** 2, 4 * 1024 ** 2, 1024 ** 2]);
  const decoded = await decodeArchive(a.blob);
  await validateRows(decoded.rows);
  const tail = new Uint8Array(
    await decoded.rows[0].value.blob.slice(-1).arrayBuffer(),
  );
  expect(tail[0]).toBe(237);
});
it("a forged future container or record version fails even after valid integrity recomputation", async () => {
  const a = await encodeArchive([
    {
      store: "themes",
      value: { id: "theme:future", format: 99, name: "Unknown" },
    },
  ]);
  await expect(backup.verify(a.blob)).rejects.toThrow();
  const good = await backup.create();
  const bytes = new Uint8Array(await good.blob.arrayBuffer());
  const n = new DataView(bytes.buffer).getUint32(8, true);
  const manifest = JSON.parse(
    new TextDecoder().decode(bytes.slice(12, 12 + n)),
  );
  manifest.version = 2;
  const json = new TextEncoder().encode(canonicalJSON(manifest));
  const header = bytes.slice(0, 12);
  new DataView(header.buffer).setUint32(8, json.length, true);
  const unknown = new Blob([
    header,
    json,
    bytes.slice(12 + n, -72),
    new TextEncoder().encode(await sha256(json)),
    new TextEncoder().encode("SAGIEND1"),
  ]);
  await expect(decodeArchive(unknown)).rejects.toThrow("manifest");
});
it("legacy checkpoint formats 1–3 and drafts/tombstones survive portable validation without migration", async () => {
  const song = await seed();
  const { deck } = await generateSlides(
    await repo.load(),
    { kind: "song", songId: song.id },
    { font: "Arial", fontSize: 64, safeMargin: 8, theme: "black", lines: 6 },
    (t) => t.length * 30,
  );
  const deletedId = crypto.randomUUID();
  await repo.createSong(deletedId, songFixture(deletedId));
  await repo.deleteSong(deletedId, 1);
  const draftId = crypto.randomUUID();
  const value = songFixture(draftId);
  value.title = "";
  await repo.saveDraft({
    id: `phase2:draft:song:${draftId}`,
    kind: "song-draft",
    songId: draftId,
    baseRevision: 0,
    sequence: 1,
    value,
    updatedAt: new Date().toISOString(),
  });
  for (const format of [1, 2, 3] as const) {
    const db = await openDatabase(name);
    await db.put("live_session_state", {
      id: "phase3:checkpoint",
      format,
      revision: 1,
      sessionId: "legacy",
      sequence: 1,
      live: { deck, index: 0, mode: "black" },
      updatedAt: new Date().toISOString(),
    });
    db.close();
    const a = await backup.create(),
      decoded = await backup.verify(a.blob),
      plan = await makePlan(decoded.rows, [], "fresh", "stage", dest);
    expect(
      plan.rows.find((r) => r.store === "live_session_state")?.value.format,
    ).toBe(format);
    expect(
      plan.rows.some((r) => r.value.id === `phase2:deleted:song:${deletedId}`),
    ).toBe(true);
    expect(
      plan.rows.some((r) => r.value.id === `phase2:draft:song:${draftId}`),
    ).toBe(true);
  }
});
it("canonical key ordering preserves compatible override application after fresh restore", async () => {
  const song = await seed();
  const style = {
      font: "Arial" as const,
      fontSize: 64,
      safeMargin: 8,
      theme: "black" as const,
      lines: 6,
    },
    measure = (t: string) => t.length * 30;
  const before = new PresentationController(
    w.gate,
    new PresentationRepository(w.gate, name),
    measure,
  );
  await before.prepare(
    await repo.load(),
    { kind: "song", songId: song.id },
    style,
  );
  await before.apply("Portable original override.", style);
  const s = await stageTo(dest, (await backup.create()).blob),
    r = new RestoreRepository(w.gate, () => {}, dest),
    plan = await r.preview(s, "fresh");
  await r.publish(plan.id, true);
  w.stop();
  w = writerFixture();
  const after = new PresentationController(
    w.gate,
    new PresentationRepository(w.gate, dest),
    measure,
  );
  await after.prepare(
    await new Repository(w.gate, dest).load(),
    { kind: "song", songId: song.id },
    style,
  );
  expect(after.snapshot().preview?.deck.overrides[0]?.text).toBe(
    "Portable original override.",
  );
});
it.each(["quota", "cancel", "ownership", "stale", "maintenance"])(
  "aggregate merge publication preserves populated destination under %s failure",
  async (failure) => {
    await seed();
    const source = await readSnapshot(name);
    const db = await openDatabase(dest);
    const tx = db.transaction(
      ["songs", "song_sections", "schedules", "schedule_items", "settings"],
      "readwrite",
    );
    for (const row of source)
      await tx.objectStore(row.store).put(structuredClone(row.value));
    const section = (await tx.objectStore("song_sections").getAll())[0];
    await tx
      .objectStore("song_sections")
      .put({ ...section, text: "Different destination lyrics" });
    await tx.done;
    db.close();
    const stage = await stageTo(dest, (await backup.create()).blob);
    const restore = new RestoreRepository(w.gate, () => {}, dest);
    const plan = await restore.preview(stage, "both");
    expect(plan.rows.some((r) => r.store === "songs")).toBe(true);
    expect(plan.rows.some((r) => r.store === "schedules")).toBe(true);
    const abort = new AbortController();
    if (failure === "stale") {
      const changed = await openDatabase(dest);
      const song = (await changed.getAll("songs"))[0];
      await changed.put("songs", { ...song, revision: song.revision + 1 });
      changed.close();
    }
    const before = await readSnapshot(dest);
    const rawBefore = await openDatabase(dest);
    const journals = await rawBefore.getAll("backup_manifest");
    rawBefore.close();
    if (failure === "quota") {
      const original = IDBObjectStore.prototype.add;
      vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
        this: IDBObjectStore,
        value: any,
        key?: IDBValidKey,
      ) {
        if (this.name === "backup_manifest" && value.kind === "receipt")
          throw new DOMException("Injected quota", "QuotaExceededError");
        return original.call(this, value, key);
      });
    }
    if (failure === "cancel" || failure === "ownership") {
      const original = IDBObjectStore.prototype.put;
      vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
        this: IDBObjectStore,
        value: any,
        key?: IDBValidKey,
      ) {
        const request = original.call(this, value, key);
        if (this.name === "songs") {
          if (failure === "cancel") abort.abort();
          else w.gate.revoke();
        }
        return request;
      });
    }
    if (failure === "maintenance") {
      await w.gate.exclusive(async () => {
        await expect(restore.publish(plan.id, true)).rejects.toThrow(
          "hanya baca",
        );
      });
    } else
      await expect(
        restore.publish(plan.id, true, abort.signal),
      ).rejects.toThrow();
    expect(await readSnapshot(dest)).toEqual(before);
    const after = await openDatabase(dest);
    expect(after.version).toBe(1);
    expect(await after.getAll("backup_manifest")).toEqual(journals);
    after.close();
  },
);
it("aggregate merge publishes a mixed schedule while preserving destination, tombstones and immutable references", async () => {
  await seed();
  const { asset } = await media();
  const prepared = await preparedFixture();
  prepared.dataset.translation.license.permissions.export = true;
  prepared.dataset.integrity.contentHash = await sha256(
    canonicalJSON(unsigned(prepared.dataset)),
  );
  const scriptures = new ScriptureRepository(w.gate, name);
  const translation = await scriptures.importDataset(
    await parseDataset(
      new TextEncoder().encode(canonicalJSON(prepared.dataset)),
    ),
    true,
  );
  let workspace = await repo.load();
  let schedule = workspace.schedules[0];
  await new MediaRepository(w.gate, name).addToSchedule(
    schedule.id,
    { assetId: asset.id, digest: asset.original.digest, pages: [1] },
    schedule.revision,
  );
  workspace = await repo.load();
  schedule = workspace.schedules[0];
  const verses = await scriptures.chapter(translation.id, "John", 3);
  await scriptures.addToSchedule(
    schedule.id,
    {
      datasetId: translation.id,
      checksum: translation.contentHash,
      verseIds: [verses[0].id],
      label: "Synthetic reference",
    },
    schedule.revision,
  );
  const source = await readSnapshot(name);
  const { stores } = await import("../db");
  const db = await openDatabase(dest);
  const tx = db.transaction([...stores], "readwrite");
  for (const row of source)
    await tx.objectStore(row.store).put(structuredClone(row.value));
  const section = (await tx.objectStore("song_sections").getAll())[0];
  await tx
    .objectStore("song_sections")
    .put({ ...section, text: "Destination lyrics stay unchanged" });
  await tx.objectStore("settings").put({
    id: "phase2:deleted:song:unrelated",
    deletedAt: new Date().toISOString(),
  });
  await tx.done;
  db.close();
  const before = await readSnapshot(dest);
  const stage = await stageTo(dest, (await backup.create()).blob);
  const restore = new RestoreRepository(w.gate, () => {}, dest);
  const plan = await restore.preview(stage, "both");
  const incomingItems = plan.rows.filter((r) => r.store === "schedule_items");
  expect(
    incomingItems.find((r) => r.value.type === "media")!.value.media,
  ).toEqual(
    source.find(
      (r) => r.store === "schedule_items" && r.value.type === "media",
    )!.value.media,
  );
  expect(
    incomingItems.find((r) => r.value.type === "scripture")!.value.selection,
  ).toEqual(
    source.find(
      (r) => r.store === "schedule_items" && r.value.type === "scripture",
    )!.value.selection,
  );
  await restore.publish(plan.id, true);
  const after = await readSnapshot(dest);
  for (const row of before)
    expect(
      after.find((r) => r.store === row.store && r.value.id === row.value.id),
    ).toEqual(row);
  expect(after.filter((r) => r.store === "songs")).toHaveLength(2);
  expect(after.filter((r) => r.store === "schedules")).toHaveLength(2);
  expect(
    after.filter((r) => r.store === "scripture_translations"),
  ).toHaveLength(1);
  expect(
    after.filter(
      (r) => r.store === "media_assets" && r.value.id.startsWith("blob:"),
    ),
  ).toHaveLength(
    source.filter(
      (r) => r.store === "media_assets" && r.value.id.startsWith("blob:"),
    ).length,
  );
  await validateRows(after);
  expect(w.gate.active).toBe(false);
  const check = await openDatabase(dest);
  expect(check.version).toBe(1);
  expect([...check.objectStoreNames].sort()).toEqual([...stores].sort());
  check.close();
});
