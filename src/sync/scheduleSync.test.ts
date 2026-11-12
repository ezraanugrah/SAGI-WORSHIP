import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { Repository } from "../data/repository";
import { MediaRepository } from "../data/mediaRepository";
import { ThemeRepository } from "../data/themeRepository";
import { ScriptureRepository } from "../data/scriptureRepository";
import { songFixture, writerFixture } from "../testHelpers";
import { preparedFixture } from "../scriptures/testFixtures";
import { resolveReference } from "../scriptures/references";
import { payload } from "../media/integrity";
import type { AssetRef, MediaAsset, Payload } from "../media/models";
import { weekSchedules } from "../domain/weeks";
import { SongSync } from "./songSync";
import { libraryRepos } from "./libraryAdapters";
import { createFakeSupabase } from "./fakeSupabase";

function memory(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}
let server: ReturnType<typeof createFakeSupabase>,
  writer: ReturnType<typeof writerFixture>,
  names: string[];
beforeEach(() => {
  server = createFakeSupabase({ "tim@gereja.id": "rahasia" });
  writer = writerFixture();
  names = [];
});
afterEach(async () => {
  writer.stop();
  await Promise.all(names.map((n) => deleteDB(n)));
});
/** One laptop: its own database and browser storage, the shared server. */
async function laptop(bible = true) {
  const name = `weeks-${crypto.randomUUID()}`;
  names.push(name);
  const songs = new Repository(writer.gate, name),
    media = new MediaRepository(writer.gate, name),
    themes = new ThemeRepository(writer.gate, name),
    scriptures = new ScriptureRepository(writer.gate, name),
    sync = new SongSync(
      { url: "https://sync.test", key: "anon-key" },
      songs,
      memory(),
      server.fetch,
    );
  sync.library = libraryRepos(media, themes, songs);
  // Each laptop installs the Bible itself (its own random dataset id).
  if (bible) await scriptures.importDataset(await preparedFixture(), true);
  await sync.signIn("tim@gereja.id", "rahasia");
  const week = async (n: number) =>
    weekSchedules((await songs.load()).schedules)[n - 1];
  /** Week n's items as shown: "song:<title>", "verse:<label>", "media:<title>". */
  const shown = async (n: number) => {
    const data = await songs.load(),
      w = weekSchedules(data.schedules)[n - 1];
    if (!w) return null;
    return w.itemIds.map((key) => {
      const i = data.items.find((x) => x.id === key)!;
      return i.type === "song"
        ? `song:${data.songs.find((s) => s.id === i.songId)?.title}`
        : i.type === "scripture"
          ? `verse:${i.selection.label}`
          : `media:${i.label}`;
    });
  };
  return { name, songs, media, themes, scriptures, sync, week, shown };
}
type Laptop = Awaited<ReturnType<typeof laptop>>;
async function weekWith(l: Laptop, n: number) {
  return (await l.week(n)) ?? (await l.songs.createSchedule(`Week ${n}`));
}
async function addSong(l: Laptop, n: number, songId: string, title: string) {
  if (!(await l.songs.load()).songs.some((s) => s.id === songId))
    await l.songs.createSong(songId, songFixture(songId, title));
  const w = await weekWith(l, n);
  await l.songs.addSong(w.id, songId, w.revision);
}
async function addVerses(l: Laptop, n: number, ref: string) {
  const t = (await l.songs.load()).translations![0],
    w = await weekWith(l, n);
  await l.scriptures.addToSchedule(
    w.id,
    {
      datasetId: t.id,
      checksum: t.contentHash,
      verseIds: resolveReference(t, ref),
      label: ref,
    },
    w.revision,
  );
}
async function addPicture(l: Laptop, n: number, title: string) {
  const ref = (p: Payload): AssetRef => ({
    id: p.id,
    digest: p.digest,
    mime: p.mime,
    size: p.size,
    width: 1,
    height: 1,
    kind: "image",
  });
  const original = await payload(
      new Blob([`pixels of ${title}`], { type: "image/png" }),
    ),
    poster = await payload(
      new Blob([`poster ${title}`], { type: "image/png" }),
    );
  const asset = await l.media.import({
    asset: {
      id: `meta:${crypto.randomUUID()}`,
      format: 1,
      revision: 1,
      title,
      filename: title,
      kind: "image",
      original: ref(original),
      thumbnail: ref(poster),
      pages: 1,
      createdAt: new Date().toISOString(),
      compatibility: "synthetic test",
    } satisfies MediaAsset,
    payloads: [original, poster],
  });
  const w = await weekWith(l, n);
  await l.media.addToSchedule(
    w.id,
    { assetId: asset.id, digest: asset.original.digest, pages: [1] },
    w.revision,
  );
}

describe("Jadwal Ibadah (Week 1–4) sync", () => {
  it("sends Week 1 with a song, verses and a picture; the other laptop gets it with its own Bible and media ids", async () => {
    const a = await laptop(),
      b = await laptop();
    await addSong(a, 1, "song-kasih", "Kasih Setia");
    await addVerses(a, 1, "John 3:16-17");
    await addPicture(a, 1, "altar.png");
    const ra = await a.sync.run();
    expect(ra.schedules).toMatchObject({ pushed: 1, count: 1 });
    expect(server.tables.schedules.get("week-1")).toBeDefined();
    // B's active Week stays as it was (none yet).
    const before = (await b.songs.load()).activeId;
    const rb = await b.sync.run();
    expect(rb.schedules).toMatchObject({ pulled: 1, count: 1 });
    // Exactly what A shows (the verse label is the app's own, e.g. "+1 ayat").
    expect(await b.shown(1)).toEqual(await a.shown(1));
    expect(await b.shown(1)).toEqual([
      "song:Kasih Setia",
      expect.stringMatching(/^verse:John 3:16/),
      "media:altar.png",
    ]);
    expect((await b.songs.load()).activeId).toBe(before);
    // The verse points at B's own Bible copy.
    const data = await b.songs.load(),
      verse = data.items.find((i) => i.type === "scripture")!;
    expect(verse.type === "scripture" && verse.selection.datasetId).toBe(
      data.translations![0].id,
    );
    expect((await a.songs.load()).translations![0].id).not.toBe(
      data.translations![0].id,
    );
    // Nothing new on the next runs.
    expect((await a.sync.run()).schedules).toMatchObject({
      pulled: 0,
      pushed: 0,
    });
    expect((await b.sync.run()).schedules).toMatchObject({
      pulled: 0,
      pushed: 0,
    });
  });

  it("passes on reordering, removing and emptying a Week, both ways", async () => {
    const a = await laptop(),
      b = await laptop();
    await addSong(a, 2, "s1", "Satu");
    await addSong(a, 2, "s2", "Dua");
    await addSong(a, 2, "s3", "Tiga");
    await a.sync.run();
    await b.sync.run();
    expect(await b.shown(2)).toEqual(["song:Satu", "song:Dua", "song:Tiga"]);
    // B: Tiga first, Dua removed.
    let w = (await b.week(2))!;
    await b.songs.reorderItems(
      w.id,
      [w.itemIds[2], w.itemIds[0], w.itemIds[1]],
      w.revision,
    );
    w = (await b.week(2))!;
    await b.songs.removeItem(w.id, w.itemIds[2], w.revision);
    expect((await b.sync.run()).schedules?.pushed).toBe(1);
    expect((await a.sync.run()).schedules?.pulled).toBe(1);
    expect(await a.shown(2)).toEqual(["song:Tiga", "song:Satu"]);
    // A empties it ("Kosongkan"): empty on B too.
    w = (await a.week(2))!;
    await a.songs.clearSchedule(w.id, w.revision);
    await a.sync.run();
    await b.sync.run();
    expect(await b.shown(2)).toEqual([]);
  });

  it("a laptop's first sync keeps its own items, after the server's, without doubles", async () => {
    const a = await laptop(),
      c = await laptop();
    await addSong(a, 1, "s1", "Satu");
    await a.sync.run();
    // C already planned Week 1 before signing in: the same song and another.
    await addSong(c, 1, "s1", "Satu");
    await addSong(c, 1, "s9", "Sembilan");
    const rc = await c.sync.run();
    expect(rc.schedules?.pushed).toBe(1);
    expect(await c.shown(1)).toEqual(["song:Satu", "song:Sembilan"]);
    await a.sync.run();
    expect(await a.shown(1)).toEqual(["song:Satu", "song:Sembilan"]);
  });

  it("waits for the Bible on a laptop without it, then follows", async () => {
    const a = await laptop(),
      d = await laptop(false);
    await addSong(a, 3, "s1", "Satu");
    await addVerses(a, 3, "John 3:16");
    await a.sync.run();
    const first = await d.sync.run();
    expect(await d.shown(3)).toBeNull();
    expect(first.notes).toContain(
      "Jadwal: Week 3 menunggu Alkitab: pasang di tab Scriptures.",
    );
    await d.scriptures.importDataset(await preparedFixture(), true);
    await d.sync.run();
    expect(await d.shown(3)).toEqual(["song:Satu", "verse:John 3:16"]);
  });

  it("says what the admin must do when the schedules table is missing, and keeps syncing songs", async () => {
    const a = await laptop();
    await addSong(a, 1, "s1", "Satu");
    server.schedulesReady = false;
    const r = await a.sync.run();
    expect(r.songs).toBe(1);
    expect(r.notes.join(" ")).toMatch(
      /Jadwal belum aktif di server sinkron.*schedule-sync\.sql/,
    );
    server.schedulesReady = true;
    expect((await a.sync.run()).schedules).toMatchObject({ pushed: 1 });
  });
});
