import "fake-indexeddb/auto";
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { deleteDB } from "idb";
import { ThemeRepository } from "../data/themeRepository";
import { MediaRepository } from "../data/mediaRepository";
import { Repository } from "../data/repository";
import { PresentationRepository } from "../data/presentationRepository";
import { PresentationController } from "../presentation/controller";
import { writerFixture, songFixture } from "../testHelpers";
import { openDatabase, defaults } from "../db";
import {
  defaultType,
  validSpec,
  validRender,
  advancedDefaults,
  type ThemeSpec,
  type ThemeSnapshot,
} from "./models";
import { builtins, signature, contrast } from "./builtins";
import { layoutText, resolveAppearance } from "../presentation/appearance";
import { generateSlides } from "../presentation/generateSlides";
import { validCheckpoint, validDeck, type Style } from "../presentation/models";
import { validMessage } from "../presentation/protocol";
import { payload } from "../media/integrity";
import { mediaRefs, type AssetRef } from "../media/models";
import { readAsset } from "../media/assetReader";
import { ScriptureRepository } from "../data/scriptureRepository";
import { preparedFixture } from "../scriptures/testFixtures";
import { resolveReference } from "../scriptures/references";
import { LYRIC_FONTS, fontStack, lyricFont } from "../presentation/fonts";
let name: string,
  writer: ReturnType<typeof writerFixture>,
  repo: ThemeRepository,
  songs: Repository;
const style: Style = {
    font: "Arial",
    fontSize: 64,
    safeMargin: 8,
    theme: "black",
    lines: 6,
  },
  measure = (text: string, s: Style & { weight?: number }) =>
    text.length * s.fontSize * (s.weight === 700 ? 0.58 : 0.5);
const spec = (): ThemeSpec => ({
  background: { kind: "solid", color: "#08090b" },
  type: structuredClone(defaultType),
});
async function create(title = "Custom theme", value = spec()) {
  return repo.save(`theme:${crypto.randomUUID()}`, title, value, 0);
}
beforeEach(() => {
  name = `themes-${crypto.randomUUID()}`;
  writer = writerFixture();
  repo = new ThemeRepository(writer.gate, name);
  songs = new Repository(writer.gate, name);
});
afterEach(async () => {
  vi.restoreAllMocks();
  writer.stop();
  await deleteDB(name);
});
it("validates structured typography, colors, gradient ordering, dimensions and forbids arbitrary CSS/Blob refs", async () => {
  expect(validSpec(spec())).toBe(true);
  const bad = spec();
  bad.type.lineHeight = 0;
  expect(validSpec(bad)).toBe(false);
  expect(
    validSpec({
      ...spec(),
      background: { kind: "solid", color: "url(https://bad)" },
    }),
  ).toBe(false);
  expect(
    validSpec({
      ...spec(),
      background: {
        kind: "gradient",
        angle: 145,
        stops: [
          { color: "#ffffff", at: 80 },
          { color: "#000000", at: 20 },
        ],
      },
    }),
  ).toBe(false);
  expect(contrast("#ffffff", "#000000")).toBe(21);
  expect((await builtins()).map((t) => t.name)).toEqual([
    "Default Black",
    "Sunset",
    "Ocean",
    "Purple",
  ]);
});
it("CRUD persists without schema migration; rejects stale saves, built-in changes and resurrection", async () => {
  const row = await create(),
    edited = await repo.save(row.id, "Renamed", row.spec, 1);
  expect(edited.revision).toBe(2);
  await expect(repo.save(row.id, "Stale", row.spec, 1)).rejects.toThrow(
    "Konflik",
  );
  await expect(
    repo.save("builtin:black", "Edit built-in", spec(), 1),
  ).rejects.toThrow("valid");
  const copy = await create("Copy", edited.spec);
  await repo.delete(row.id, 2, null, { assignments: 0, isDefault: false });
  await expect(repo.save(row.id, "Resurrect", row.spec, 0)).rejects.toThrow(
    "dihapus",
  );
  const loaded = await new ThemeRepository(writer.gate, name).list();
  expect(loaded.issues).toEqual([]);
  expect(loaded.themes.find((t) => t.id === copy.id)?.name).toBe("Copy");
  const db = await openDatabase(name);
  expect(db.version).toBe(1);
  db.close();
});
it("assignments and defaults require explicit deletion replacement, with atomic schedule revision updates", async () => {
  const t = await create();
  await songs.createSong("song", songFixture("song"));
  const s = await songs.createSchedule("Theme service"),
    item = await songs.addSong(s.id, "song", 1);
  await repo.assign(item.id, t.id, 2);
  await repo.saveSettings({ ...advancedDefaults, defaultThemeId: t.id }, 0);
  await expect(
    repo.delete(t.id, 1, null, { assignments: 1, isDefault: true }),
  ).rejects.toThrow("pengganti");
  await repo.delete(t.id, 1, "builtin:black", {
    assignments: 1,
    isDefault: true,
  });
  expect((await repo.settings()).defaultThemeId).toBe("builtin:black");
  expect((await songs.load()).items[0]).toMatchObject({
    themeId: "builtin:black",
  });
  expect((await songs.load()).schedules[0].revision).toBe(4);
});
it("read-only and stale advanced setting revisions are enforced at the mutation boundary", async () => {
  const first = await repo.saveSettings(
    { ...advancedDefaults, reference: 720 },
    0,
  );
  expect(first.revision).toBe(1);
  await expect(repo.saveSettings(advancedDefaults, 0)).rejects.toThrow(
    "Konflik",
  );
  writer.gate.revoke();
  await expect(create()).rejects.toThrow("hanya baca");
  await expect(repo.saveSettings(first, 1)).rejects.toThrow("hanya baca");
  await expect(repo.assign("missing", "builtin:black", 1)).rejects.toThrow(
    "hanya baca",
  );
});
it("hash-validates theme records and preserves corrupt/unknown records", async () => {
  const row = await create(),
    db = await openDatabase(name);
  await db.put("themes", {
    ...row,
    spec: { ...row.spec, type: { ...row.spec.type, color: "#ff0000" } },
  });
  await expect(repo.resolve(row.id)).rejects.toThrow("rusak");
  expect((await repo.list()).issues).toHaveLength(1);
  expect((await db.get("themes", row.id)).spec.type.color).toBe("#ff0000");
  db.close();
});
it("theme and pin writes rollback completely on a final quota error", async () => {
  const original = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    if (this.name === "themes")
      throw new DOMException("injected quota", "QuotaExceededError");
    return original.apply(this, args);
  });
  await expect(create()).rejects.toThrow("quota");
  const db = await openDatabase(name);
  expect(await db.getAll("themes")).toEqual([]);
  expect(await db.getAll("media_assets")).toEqual([]);
  db.close();
});
it("writer loss during a theme transaction aborts its pins and records", async () => {
  const original = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    const result = original.apply(this, args);
    if (this.name === "themes") writer.gate.revoke();
    return result;
  });
  await expect(create()).rejects.toThrow();
  const db = await openDatabase(name);
  expect(await db.getAll("themes")).toEqual([]);
  expect(await db.getAll("media_assets")).toEqual([]);
  db.close();
});
it("rolls back assignment replacement and theme deletion if the final tombstone fails", async () => {
  const t = await create();
  await songs.createSong("song", songFixture("song"));
  const s = await songs.createSchedule("Rollback"),
    i = await songs.addSong(s.id, "song", 1);
  await repo.assign(i.id, t.id, 2);
  const before = await songs.load(),
    original = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    if (
      this.name === "themes" &&
      String((args[0] as { id: string }).id).startsWith("deleted:")
    )
      throw new Error("injected final failure");
    return original.apply(this, args);
  });
  await expect(
    repo.delete(t.id, 1, "builtin:black", { assignments: 1, isDefault: false }),
  ).rejects.toThrow("final failure");
  vi.restoreAllMocks();
  expect((await songs.load()).items).toEqual(before.items);
  expect((await repo.resolve(t.id)).name).toBe(t.name);
});
it("exact typography pagination preserves Unicode/CRLF/whitespace and bounded fitting", () => {
  const text =
    "  Original café 👋\r\n" +
    "original synthetic line ".repeat(140) +
    "\nEnd. ";
  const s = spec();
  s.type.weight = 700;
  s.type.italic = true;
  s.type.lineHeight = 1.8;
  s.type.margins.left = 20;
  s.type.outline.width = 4;
  const result = layoutText(text, s, measure, true);
  expect(result.pages.join("")).toBe(text);
  expect(result.pages.length).toBeGreaterThan(1);
  s.type.fit = "shrink";
  s.type.minSize = 48;
  const fit = layoutText(text, s, measure, true);
  expect(fit.size).toBeGreaterThanOrEqual(48);
  expect(fit.size).toBeLessThanOrEqual(64);
  expect(fit.pages.join("")).toBe(text);
});
it("new render snapshots freeze themes, preserve legacy records and enforce protocol/checkpoint v4", async () => {
  await songs.savePreferences(defaults);
  await songs.createSong("song", songFixture("song"));
  const t = await create(),
    ctx = await resolveAppearance(
      repo,
      await songs.load(),
      { kind: "song", songId: "song" },
      { id: t.id, scope: "all" },
    );
  ctx.settings.reference = 720;
  const storage = new PresentationRepository(writer.gate, name),
    controller = new PresentationController(writer.gate, storage, measure);
  await controller.loadRecovery();
  await controller.prepare(
    await songs.load(),
    { kind: "song", songId: "song" },
    style,
    undefined,
    ctx,
  );
  expect(controller.snapshot().preview?.deck.render?.canvas).toMatchObject({
    width: 1280,
    height: 720,
  });
  controller.goLive();
  const before = structuredClone(controller.snapshot().live!);
  const changed = spec();
  changed.type.color = "#ff0000";
  await repo.save(t.id, "Edited", changed, 1);
  expect(controller.snapshot().live).toEqual(before);
  await controller.settled();
  const checkpoint = await storage.loadCheckpoint();
  expect(checkpoint?.format).toBe(4);
  expect(validCheckpoint(checkpoint)).toBe(true);
  expect(validCheckpoint({ ...checkpoint, format: 3 })).toBe(false);
  const m = {
    v: 4,
    type: "STATE",
    session: "s",
    epoch: "e",
    pair: "p",
    nonce: "n",
    seq: 1,
    live: before,
  };
  expect(validMessage(m)).toBe(true);
  expect(validMessage({ ...m, v: 3 })).toBe(false);
  const db = await openDatabase(name);
  expect((await db.get("settings", "preferences")).value).toEqual(defaults);
  db.close();
});
it("Scripture themed pages retain all exact text, references and mandatory attribution", async () => {
  const scriptures = new ScriptureRepository(writer.gate, name),
    dataset = await scriptures.importDataset(await preparedFixture(), true),
    selection = {
      datasetId: dataset.id,
      checksum: dataset.contentHash,
      verseIds: resolveReference(dataset, "John 3:16-18"),
      label: "Synthetic selection",
    },
    workspace = await scriptures.resolveWorkspace(await songs.load(), {
      kind: "scripture",
      selection,
    }),
    t = await create(),
    ctx = await resolveAppearance(
      repo,
      workspace,
      { kind: "scripture", selection },
      { id: t.id, scope: "all" },
    ),
    { deck } = await generateSlides(
      workspace,
      { kind: "scripture", selection },
      style,
      measure,
      () => false,
      ctx,
    );
  expect(validDeck(deck)).toBe(true);
  expect(
    deck.frames.every(
      (f) =>
        f.kind === "scripture" &&
        f.scripture.attribution === dataset.info.license.displayAttribution,
    ),
  ).toBe(true);
  expect(
    validRender(
      deck.render,
      deck.frames.map((f) => f.id),
    ),
  ).toBe(true);
  const broken = structuredClone(deck);
  if (broken.frames[0].kind === "scripture")
    broken.frames[0].scripture.attribution = "omitted";
  expect(validDeck(broken)).toBe(false);
});
it("unified dependencies retain image backgrounds after library/theme deletion and checkpoint restore", async () => {
  const m = new MediaRepository(writer.gate, name),
    p = await payload(
      new Blob(["original synthetic pixels"], { type: "image/png" }),
    ),
    poster = await payload(
      new Blob(["original synthetic poster"], { type: "image/png" }),
    );
  const ref = (b: typeof p): AssetRef => ({
    id: b.id,
    digest: b.digest,
    mime: b.mime,
    size: b.size,
    width: 1,
    height: 1,
    kind: "image",
  });
  const asset = await m.import({
    asset: {
      id: `meta:${crypto.randomUUID()}`,
      format: 1,
      revision: 1,
      title: "Original background",
      filename: "synthetic.png",
      kind: "image",
      original: ref(p),
      thumbnail: ref(poster),
      pages: 1,
      createdAt: new Date().toISOString(),
      compatibility: "synthetic test",
    },
    payloads: [p, poster],
  });
  const themed = spec();
  themed.background = {
    kind: "image",
    asset: asset.original,
    poster: asset.thumbnail,
    libraryId: asset.id,
    fit: "cover",
    x: 50,
    y: 50,
    dim: 0.4,
    fallback: "#000000",
  };
  const t = await create("Background", themed);
  await songs.createSong("song", songFixture("song"));
  const data = await songs.load(),
    ctx = await resolveAppearance(
      repo,
      data,
      { kind: "song", songId: "song" },
      { id: t.id, scope: "all" },
    ),
    { deck } = await generateSlides(
      data,
      { kind: "song", songId: "song" },
      style,
      measure,
      () => false,
      ctx,
    );
  expect(
    mediaRefs(deck)
      .map((r) => r.id)
      .sort(),
  ).toEqual([p.id, poster.id].sort());
  const storage = new PresentationRepository(writer.gate, name);
  await storage.checkpoint({ deck, index: 0, mode: "normal" }, "session", 1, 0);
  await m.delete(asset.id, asset.original.digest);
  await repo.delete(t.id, 1, null, { assignments: 0, isDefault: false });
  await m.collect();
  expect(await readAsset(asset.original, mediaRefs(deck), name)).toBeInstanceOf(
    Blob,
  );
  expect((await storage.loadCheckpoint())?.live?.deck.render).toEqual(
    deck.render,
  );
});

it("retains exact legacy override signatures and reloads an existing format-1 override", async () => {
  await songs.createSong("song", songFixture("song"));
  const data = await songs.load(),
    { deck } = await generateSlides(
      data,
      { kind: "song", songId: "song" },
      style,
      measure,
    ),
    frame = deck.frames[0];
  const storage = new PresentationRepository(writer.gate, name);
  await storage.saveOverride(
    {
      id: `phase3:${frame.id}`,
      format: 1,
      frameId: frame.id,
      text: "Existing legacy override.",
      style,
      sourceSignature: JSON.stringify(["song", 1, null, null]),
    },
    0,
  );
  const controller = new PresentationController(writer.gate, storage, measure);
  await controller.loadRecovery();
  await controller.prepare(data, { kind: "song", songId: "song" }, style);
  expect(controller.snapshot().preview?.deck.overrides[0]?.text).toBe(
    "Existing legacy override.",
  );
});

it("cleanup blocks missing theme pins rather than deleting a referenced background", async () => {
  const p = await payload(new Blob(["original pixels"], { type: "image/png" })),
    r: AssetRef = {
      id: p.id,
      digest: p.digest,
      mime: p.mime,
      size: p.size,
      width: 1,
      height: 1,
      kind: "image",
    },
    db = await openDatabase(name);
  await db.put("media_assets", p);
  const value = spec();
  value.background = {
    kind: "image",
    asset: r,
    poster: r,
    libraryId: "meta:synthetic",
    fit: "contain",
    x: 50,
    y: 50,
    dim: 0.3,
    fallback: "#000000",
  };
  const t = await create("Pinned", value);
  await db.delete("media_assets", `pin:theme:${t.id}`);
  await expect(
    new MediaRepository(writer.gate, name).collect(),
  ).rejects.toThrow("Pin dependensi");
  expect(await db.get("media_assets", p.id)).toBeDefined();
  db.close();
});
it("lyrics use the global text style and the fixed look on every theme; the theme keeps its background", async () => {
  await songs.createSong("song", songFixture("song", "Theme free lyric"));
  const t = await create("Small lyric theme", {
      background: { kind: "solid", color: "#224466" },
      type: {
        ...structuredClone(defaultType),
        font: "Arial",
        size: 40,
        minSize: 32,
        color: "#ffee00",
        margins: { top: 18, right: 18, bottom: 18, left: 18 },
        lines: 2,
      },
    }),
    data = await songs.load(),
    ctx = await resolveAppearance(
      repo,
      data,
      { kind: "song", songId: "song" },
      { id: t.id, scope: "item" },
    ),
    big: Style = {
      ...style,
      font: "Bebas Neue",
      fontSize: 110,
      safeMargin: 4,
      outline: 6,
    },
    { deck } = await generateSlides(
      data,
      { kind: "song", songId: "song" },
      big,
      measure,
      () => false,
      ctx,
    );
  expect(validDeck(deck)).toBe(true);
  const snapshot = Object.values(deck.render!.themes)[0];
  // Extra bold, white, black outline whatever the theme said.
  expect(snapshot.spec.type).toMatchObject({
    font: "Bebas Neue",
    size: 110,
    weight: 800,
    color: "#ffffff",
    outline: { width: 6, color: "#000000" },
    margins: { top: 4, right: 4, bottom: 4, left: 4 },
    lines: 6,
  });
  expect(snapshot.spec.background).toEqual({
    kind: "solid",
    color: "#224466",
  });
  // Re-signed for the content it now carries.
  expect(snapshot.signature).toBe(await signature(snapshot.spec));
  expect(Object.values(deck.render!.sizes)).toEqual([110]);
});
it("offers five lyric fonts and draws fonts of older versions as Montserrat", () => {
  expect(LYRIC_FONTS).toEqual([
    "Montserrat",
    "Poppins",
    "Bebas Neue",
    "Georgia",
    "Times New Roman",
  ]);
  expect(lyricFont("Arial")).toBe("Montserrat");
  expect(lyricFont("Times New Roman")).toBe("Times New Roman");
  expect(fontStack("Bebas Neue")).toBe('"Bebas Neue", sans-serif');
  expect(fontStack("Georgia")).toBe('"Georgia", serif');
  // Stored data from earlier versions stays valid.
  expect(
    validSpec({ ...spec(), type: { ...defaultType, font: "Verdana" } }),
  ).toBe(true);
  expect(
    validSpec({
      ...spec(),
      type: { ...defaultType, font: "Comic Sans" as never },
    }),
  ).toBe(false);
});
