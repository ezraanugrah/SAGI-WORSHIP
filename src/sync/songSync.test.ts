import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { Repository } from "../data/repository";
import { writerFixture, songFixture } from "../testHelpers";
import { id as newId } from "../domain/models";
import { OfflineError, SignedOutError, SongSync } from "./songSync";
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
/** One laptop: its own IndexedDB, its own browser storage, the shared server. */
function laptop() {
  const name = `sync-${crypto.randomUUID()}`;
  names.push(name);
  const repo = new Repository(writer.gate, name),
    sync = new SongSync(config, repo, memory(), server.fetch);
  return { repo, sync };
}
const titles = async (repo: Repository) =>
  (await repo.load()).songs.map((s) => s.title).sort();
const add = async (repo: Repository, title: string) => {
  const id = newId();
  return repo.createSong(id, { ...songFixture(id), title });
};
beforeEach(() => {
  server = createFakeSupabase({ "tim@gereja.id": "rahasia" });
  writer = writerFixture();
  names = [];
});
afterEach(async () => {
  writer.stop();
  await Promise.all(names.map((n) => deleteDB(n)));
});

describe("signing in", () => {
  it("refuses a wrong password and keeps the session after a right one", async () => {
    const a = laptop();
    await expect(a.sync.signIn("tim@gereja.id", "salah")).rejects.toThrow(
      "Email atau password salah.",
    );
    await expect(a.sync.run()).rejects.toBeInstanceOf(SignedOutError);
    await a.sync.signIn(" tim@gereja.id ", "rahasia");
    expect(a.sync.session()?.email).toBe("tim@gereja.id");
  });
  it("refreshes an expiring token and reports offline", async () => {
    server.expiresIn = 30; // expires within the refresh margin
    const a = laptop();
    await a.sync.signIn("tim@gereja.id", "rahasia");
    await a.sync.run();
    expect(server.refreshes).toBe(1);
    const offline = new SongSync(config, a.repo, memory(), (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch);
    await expect(
      offline.signIn("tim@gereja.id", "rahasia"),
    ).rejects.toBeInstanceOf(OfflineError);
  });
});

describe("Musik on two laptops", () => {
  it("a song added, edited and deleted on one laptop follows on the other", async () => {
    const a = laptop(),
      b = laptop();
    await a.sync.signIn("tim@gereja.id", "rahasia");
    await b.sync.signIn("tim@gereja.id", "rahasia");
    const song = await add(a.repo, "Kasih Setia");
    expect((await a.sync.run()).pushed).toBe(1);
    expect((await b.sync.run()).pulled).toBe(1);
    const onB = (await b.repo.load()).songs[0];
    expect(onB.id).toBe(song.id);
    expect(onB.sections).toEqual(song.sections);
    expect(onB.order).toEqual(song.order);

    await b.repo.updateSong(
      onB.id,
      { ...onB, title: "Kasih Setia-Mu" },
      onB.revision,
    );
    await b.sync.run();
    await a.sync.run();
    expect(await titles(a.repo)).toEqual(["Kasih Setia-Mu"]);
    // Nothing echoes back once both agree.
    expect(await a.sync.run()).toMatchObject({ pulled: 0, pushed: 0 });

    const current = (await a.repo.load()).songs[0];
    await a.repo.deleteSong(current.id, current.revision);
    await a.sync.run();
    expect(server.rows.get(current.id)?.deleted).toBe(true);
    await b.sync.run();
    expect(await titles(b.repo)).toEqual([]);
  });
  it("keeps both versions when the same song was edited on both laptops", async () => {
    const a = laptop(),
      b = laptop();
    await a.sync.signIn("tim@gereja.id", "rahasia");
    await b.sync.signIn("tim@gereja.id", "rahasia");
    const song = await add(a.repo, "Bapa Engkau");
    await a.sync.run();
    await b.sync.run();
    const sa = (await a.repo.load()).songs[0],
      sb = (await b.repo.load()).songs[0];
    await a.repo.updateSong(
      song.id,
      { ...sa, title: "Bapa Engkau (A)" },
      sa.revision,
    );
    await b.repo.updateSong(
      song.id,
      { ...sb, title: "Bapa Engkau (B)" },
      sb.revision,
    );
    await a.sync.run();
    const result = await b.sync.run();
    expect(result.copies).toEqual(["Bapa Engkau (B)"]);
    expect(await titles(b.repo)).toEqual([
      "Bapa Engkau (A)",
      "Bapa Engkau (B) (salinan laptop ini)",
    ]);
    await a.sync.run();
    expect(await titles(a.repo)).toEqual(await titles(b.repo));
  });
  it("a change pushed by another laptop in the middle of a run is not overwritten", async () => {
    const a = laptop();
    await a.sync.signIn("tim@gereja.id", "rahasia");
    const song = await add(a.repo, "Ku Mau Cinta Yesus");
    await a.sync.run();
    // Another laptop updates the row right before this laptop's PATCH lands.
    let raced = false;
    const racing: typeof fetch = async (input, init) => {
      if (!raced && init?.method === "PATCH") {
        raced = true;
        const row = server.rows.get(song.id)!;
        row.version += 1;
        row.data = {
          ...(row.data as object),
          title: "Ku Mau Cinta Yesus (lain)",
        };
        row.updated_at = "2026-11-11T10:59:59.999999+00:00";
      }
      return server.fetch(input, init);
    };
    const racer = new SongSync(config, a.repo, memory(), racing);
    await racer.signIn("tim@gereja.id", "rahasia");
    await racer.run(); // learns version 1 first
    const mine = (await a.repo.load()).songs[0];
    await a.repo.updateSong(
      mine.id,
      { ...mine, title: "Ku Mau Cinta Yesus (sini)" },
      mine.revision,
    );
    const result = await racer.run();
    expect(raced).toBe(true);
    expect(result.copies).toEqual(["Ku Mau Cinta Yesus (sini)"]);
    expect(await titles(a.repo)).toEqual([
      "Ku Mau Cinta Yesus (lain)",
      "Ku Mau Cinta Yesus (sini) (salinan laptop ini)",
    ]);
    expect((server.rows.get(song.id)!.data as { title: string }).title).toBe(
      "Ku Mau Cinta Yesus (lain)",
    );
  });
  it("an edit from another laptop wins over a deletion that was not synced yet", async () => {
    const a = laptop(),
      b = laptop();
    await a.sync.signIn("tim@gereja.id", "rahasia");
    await b.sync.signIn("tim@gereja.id", "rahasia");
    await add(a.repo, "Hosana");
    await a.sync.run();
    await b.sync.run();
    const sa = (await a.repo.load()).songs[0],
      sb = (await b.repo.load()).songs[0];
    await a.repo.deleteSong(sa.id, sa.revision);
    await b.repo.updateSong(
      sb.id,
      { ...sb, title: "Hosana di tempat tinggi" },
      sb.revision,
    );
    await b.sync.run();
    await a.sync.run();
    expect(await titles(a.repo)).toEqual(["Hosana di tempat tinggi"]);
    expect(server.rows.get(sa.id)?.deleted).toBe(false);
  });
  it("first sign-in on a laptop with its own songs merges both libraries", async () => {
    const a = laptop(),
      b = laptop();
    await add(a.repo, "Dari A");
    await add(b.repo, "Dari B");
    await a.sync.signIn("tim@gereja.id", "rahasia");
    await b.sync.signIn("tim@gereja.id", "rahasia");
    await a.sync.run();
    await b.sync.run();
    await a.sync.run();
    expect(await titles(a.repo)).toEqual(["Dari A", "Dari B"]);
    expect(await titles(b.repo)).toEqual(["Dari A", "Dari B"]);
  });
  it("skips server rows that are not valid songs", async () => {
    const a = laptop();
    await a.sync.signIn("tim@gereja.id", "rahasia");
    server.rows.set("rusak", {
      id: "rusak",
      data: { title: "" },
      version: 1,
      deleted: false,
      updated_at: "2026-11-11T09:00:00.000001+00:00",
    });
    expect((await a.sync.run()).skipped).toBe(1);
    expect(await titles(a.repo)).toEqual([]);
  });
});
