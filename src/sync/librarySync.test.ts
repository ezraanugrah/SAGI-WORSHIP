import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteDB, openDB } from "idb";
import { Repository } from "../data/repository";
import { MediaRepository } from "../data/mediaRepository";
import { ThemeRepository } from "../data/themeRepository";
import { writerFixture } from "../testHelpers";
import { payload } from "../media/integrity";
import { readAsset } from "../media/assetReader";
import { defaultType, type ThemeSpec } from "../themes/models";
import type { AssetRef, MediaAsset, Payload } from "../media/models";
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
const config = { url: "https://sync.test", key: "anon-key" };
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
/** One laptop: its own IndexedDB and browser storage, the shared server. */
async function laptop(fetcher: typeof fetch = server.fetch) {
  const name = `library-${crypto.randomUUID()}`;
  names.push(name);
  const songs = new Repository(writer.gate, name),
    media = new MediaRepository(writer.gate, name),
    themes = new ThemeRepository(writer.gate, name),
    sync = new SongSync(config, songs, memory(), fetcher);
  sync.library = libraryRepos(media, themes);
  await sync.signIn("tim@gereja.id", "rahasia");
  return { name, songs, media, themes, sync };
}
const ref = (p: Payload, kind: "image" | "video", duration?: number) =>
  ({
    id: p.id,
    digest: p.digest,
    mime: p.mime,
    size: p.size,
    width: 1,
    height: 1,
    kind,
    ...(duration ? { duration } : {}),
  }) as AssetRef;
/** A media file as the app imports it (original + thumbnail). */
async function file(
  media: MediaRepository,
  title: string,
  bytes: BlobPart,
  kind: "image" | "video" = "image",
  createdAt = new Date().toISOString(),
) {
  const original = await payload(
      new Blob([bytes], {
        type: kind === "video" ? "video/webm" : "image/png",
      }),
    ),
    poster = await payload(
      new Blob([`poster of ${title}`], { type: "image/png" }),
    );
  return media.import({
    asset: {
      id: `meta:${crypto.randomUUID()}`,
      format: 1,
      revision: 1,
      title,
      filename: title,
      kind,
      original: ref(original, kind, kind === "video" ? 12 : undefined),
      thumbnail: ref(poster, "image"),
      pages: 1,
      createdAt,
      compatibility: "synthetic test",
    } satisfies MediaAsset,
    payloads: [original, poster],
  });
}
const imageTheme = (a: MediaAsset): ThemeSpec => ({
  background: {
    kind: "image",
    asset: a.original,
    poster: a.thumbnail,
    libraryId: a.id,
    fit: "cover",
    x: 50,
    y: 50,
    dim: 0.3,
    fallback: "#000000",
  },
  type: structuredClone(defaultType),
});

describe("media and themes sync with the same account as the songs", () => {
  it("sends a picture and its theme to the other laptop, file checked chunk by chunk", async () => {
    const a = await laptop(),
      b = await laptop();
    const asset = await file(a.media, "altar.png", "original altar pixels");
    await a.themes.save("theme:altar", "Altar", imageTheme(asset), 0);
    const ra = await a.sync.run();
    expect(ra.media).toMatchObject({ pushed: 1, count: 1 });
    expect(ra.themes).toMatchObject({ pushed: 1, count: 1 });
    expect(server.tables.media.size).toBe(1);
    expect(server.objects.size).toBe(2); // one chunk each: file + thumbnail
    const rb = await b.sync.run();
    expect(rb.media).toMatchObject({ pulled: 1, count: 1 });
    expect(rb.themes).toMatchObject({ pulled: 1, count: 1 });
    const there = (await b.media.list()).assets;
    expect(there.map((x) => x.title)).toEqual(["altar.png"]);
    expect(
      await (
        await readAsset(there[0].original, [there[0].original], b.name)
      ).text(),
    ).toBe("original altar pixels");
    const theme = (await b.themes.list()).themes.find(
      (t) => t.id === "theme:altar",
    )!;
    expect(theme.name).toBe("Altar");
    expect(theme.spec.background).toMatchObject({
      kind: "image",
      libraryId: there[0].id,
    });
    // Nothing new on the next runs either side.
    expect((await a.sync.run()).media).toMatchObject({ pulled: 0, pushed: 0 });
    expect((await b.sync.run()).themes).toMatchObject({ pulled: 0, pushed: 0 });
  });
  it("moves a big video in 4 MiB chunks and stores a chunk only once", async () => {
    const a = await laptop(),
      b = await laptop();
    const bytes = new Uint8Array(9 * 1024 * 1024).map((_, i) => i % 251);
    await file(a.media, "worship.webm", bytes, "video");
    await a.sync.run();
    expect(server.objects.size).toBe(3 + 1); // 3 video chunks + thumbnail
    await b.sync.run();
    const [video] = (await b.media.list()).assets;
    expect(video.original.size).toBe(bytes.length);
    expect(
      (await readAsset(video.original, [video.original], b.name)).size,
    ).toBe(bytes.length);
  });
  it("recognises the same file imported on both laptops, and a theme then uses this laptop's copy", async () => {
    const a = await laptop(),
      b = await laptop();
    const mine = await file(b.media, "salib.png", "same cross pixels");
    const theirs = await file(a.media, "salib.png", "same cross pixels");
    await a.themes.save("theme:salib", "Salib", imageTheme(theirs), 0);
    await a.sync.run();
    const rb = await b.sync.run();
    // Not downloaded again, not listed twice.
    expect((await b.media.list()).assets.map((x) => x.id)).toEqual([mine.id]);
    const theme = (await b.themes.list()).themes.find(
      (t) => t.id === "theme:salib",
    )!;
    expect(theme.spec.background).toMatchObject({ libraryId: mine.id });
    expect(rb.themes?.pulled).toBe(1);
  });
  it("passes a deletion on, and waits for a file that is not complete on the server yet", async () => {
    const a = await laptop(),
      b = await laptop();
    const asset = await file(a.media, "pagi.png", "morning pixels");
    await a.sync.run();
    // A chunk is missing on the server: B tries again on a later run.
    const [chunk] = [...server.objects.keys()];
    const saved = server.objects.get(chunk)!;
    server.objects.delete(chunk);
    const first = await b.sync.run();
    expect(first.media).toMatchObject({ pulled: 0, skipped: 1, count: 0 });
    expect(first.notes).toContain(
      "Media/Tema: Potongan file media belum ada di server.",
    );
    server.objects.set(chunk, saved);
    expect((await b.sync.run()).media).toMatchObject({ pulled: 1, count: 1 });
    // Deleted on A: deleted on B too.
    await a.media.delete(asset.id, asset.original.digest);
    expect((await a.sync.run()).media?.pushed).toBe(1);
    expect(server.tables.media.get(asset.id)?.deleted).toBe(true);
    await b.sync.run();
    expect((await b.media.list()).assets).toEqual([]);
  });
  it("does not send a file whose copy on this laptop is damaged, and sends the rest", async () => {
    const a = await laptop();
    const bad = await file(a.media, "rusak.png", "good bytes 1");
    await file(a.media, "baik.png", "other bytes");
    const db = await openDB(a.name);
    const row = await db.get("media_assets", bad.original.id);
    await db.put("media_assets", {
      ...row,
      blob: new Blob(["evil bytes 1"], { type: row.blob.type }),
    });
    db.close();
    const r = await a.sync.run();
    expect(r.media).toMatchObject({ pushed: 1, skipped: 1, count: 2 });
    expect(r.notes).toContain(
      "Media/Tema: rusak.png: file di laptop ini rusak, tidak dikirim. Impor ulang file aslinya.",
    );
    expect(
      [...server.tables.media.values()].map(
        (x) => (x.data as { asset: MediaAsset }).asset.title,
      ),
    ).toEqual(["baik.png"]);
  });
  it("sends the newest file first, reports progress, and resumes after the connection drops", async () => {
    let posts = 0,
      dropAfter = Infinity;
    const flaky: typeof fetch = async (url, init) => {
      if (String(url).includes("/storage/") && init?.method === "POST")
        if (++posts > dropAfter) throw new TypeError("Failed to fetch");
      return server.fetch(url, init);
    };
    const a = await laptop(flaky),
      b = await laptop();
    const big = new Uint8Array(9 * 1024 * 1024).map((_, i) => (i * 7) % 253);
    await file(
      a.media,
      "lama.png",
      "old pixels",
      "image",
      "2026-01-01T00:00:00.000Z",
    );
    await file(a.media, "baru.webm", big, "video", "2026-11-12T09:00:00.000Z");
    const seen: string[] = [];
    a.sync.onProgress = (t) => {
      if (t) seen.push(`${t.direction} ${t.title} ${t.done}/${t.total}`);
      else seen.push("idle");
    };
    // The connection drops after two pieces of the video.
    dropAfter = 2;
    await expect(a.sync.run()).rejects.toThrow(/Offline/);
    expect(seen[0]).toBe("up baru.webm 0/4"); // 3 video pieces + its thumbnail
    expect(seen.at(-1)).toBe("idle");
    const sent = server.objects.size;
    expect(sent).toBeGreaterThanOrEqual(2);
    // Back online: only the missing pieces go, then the older picture.
    posts = 0;
    dropAfter = Infinity;
    seen.length = 0;
    expect((await a.sync.run()).media).toMatchObject({ pushed: 2, count: 2 });
    expect(posts).toBe(4 - sent + 2); // rest of the video + picture & thumbnail
    expect(seen.filter((x) => x.startsWith("up")).at(-1)).toBe(
      "up lama.png 2/2",
    );
    // The other laptop gets both and reports what it receives.
    const got: string[] = [];
    b.sync.onProgress = (t) => t && got.push(`${t.direction} ${t.title}`);
    expect((await b.sync.run()).media).toMatchObject({ pulled: 2, count: 2 });
    expect(new Set(got)).toEqual(new Set(["down lama.png", "down baru.webm"]));
    const video = (await b.media.list()).assets.find(
      (x) => x.title === "baru.webm",
    )!;
    expect(
      (await readAsset(video.original, [video.original], b.name)).size,
    ).toBe(big.length);
  });
  it("keeps syncing songs and says what the admin must do when the server is not ready or full", async () => {
    const a = await laptop();
    await file(a.media, "x.png", "pixels");
    server.libraryReady = false;
    const r = await a.sync.run();
    expect(r.songs).toBe(0);
    expect(r.notes.join(" ")).toMatch(
      /Media & Tema belum aktif di server sinkron.*library-sync\.sql/,
    );
    server.libraryReady = true;
    server.storageFull = true;
    expect((await a.sync.run()).notes.join(" ")).toMatch(
      /Penyimpanan Supabase penuh/,
    );
    server.storageFull = false;
    expect((await a.sync.run()).media).toMatchObject({ pushed: 1 });
  });
});
