import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { canonicalJSON, parseDataset, sha256, unsigned } from "./importFormat";
import { fixtureDataset } from "./testFixtures";
import { ENGLISH, INDONESIAN } from "./bilingual";
import {
  LAI_BASE,
  NO_SETTINGS,
  ONLINE_LIMIT,
  OnlineCache,
  applyOnline,
  ensureOnline,
  esvPassageUrl,
  esvUrl,
  fetchEsv,
  fetchLai,
  fetchSabda,
  sabdaChapterUrl,
  sabdaUrl,
  sabdaVerses,
  laiBook,
  laiUrl,
  laiVerses,
  loadSettings,
  saveSettings,
  type OnlineSettings,
} from "./online";
import { ScriptureRepository } from "../data/scriptureRepository";
import { Repository } from "../data/repository";
import { PresentationRepository } from "../data/presentationRepository";
import { PresentationController } from "../presentation/controller";
import { validDeck, type Style } from "../presentation/models";
import type { Measure } from "../presentation/layout";
import { writerFixture } from "../testHelpers";

/** In-memory stand-in for localStorage. */
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
const tb2 = { key: "lai-key", base: LAI_BASE, version: "tb2", agreed: true };
const online: OnlineSettings = {
  tb: null,
  tb2,
  esv: { key: "esv-key", agreed: true },
  left: "tb2",
  right: "esv",
};
/** A fake fetch that records calls and answers with the given JSON. */
function fake(answer: (url: string) => unknown, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(answer(url)), { status });
  }) as typeof fetch;
  return { calls, fetcher };
}
const esvAnswer = (url: string) => {
  const q = new URL(url).searchParams.get("q")!,
    [a, b] = q.split("-").map((id) => Number(id.slice(-3)));
  const text = Array.from(
    { length: b - a + 1 },
    (_, i) => `[${a + i}] ESV test ${a + i}.`,
  ).join("\n\n");
  return { passages: [`${text} (ESV)`], parsed: [] };
};
const laiAnswer = (url: string) => {
  const range = url.split("/").pop()!,
    [a, b = a] = range.split("-").map(Number);
  return {
    data: {
      verses: Array.from({ length: b - a + 1 }, (_, i) => ({
        verse: a + i,
        text: `TB2 uji ${a + i}.`,
      })),
    },
  };
};

describe("settings and cache stay on this device", () => {
  it("round-trips settings and never selects an unconfirmed online column", () => {
    const store = memory();
    expect(loadSettings(store)).toEqual(NO_SETTINGS);
    saveSettings(online, store);
    expect(loadSettings(store)).toEqual(online);
    saveSettings({ ...online, tb2: { ...tb2, agreed: false } }, store);
    expect(loadSettings(store).left).toBe("ayt");
    store.setItem("sagi-bible-online", "{broken");
    expect(loadSettings(store)).toEqual(NO_SETTINGS);
  });
  it("keeps at most 500 verses per version, expires after 30 days and clears", () => {
    let now = 1_000_000;
    const cache = new OnlineCache(memory(), () => now);
    cache.put(
      "esv",
      Array.from({ length: ONLINE_LIMIT }, (_, i) => ({
        book: "Ps",
        chapter: 119,
        verse: i + 1,
        text: `v${i + 1}`,
      })),
    );
    now += 1000;
    cache.put("esv", [{ book: "John", chapter: 3, verse: 16, text: "new" }]);
    expect(cache.count("esv")).toBe(ONLINE_LIMIT);
    expect(cache.get("esv", "John", 3, 16)).toBe("new");
    expect(cache.count("tb2")).toBe(0);
    now += 31 * 86400000;
    expect(cache.count("esv")).toBe(0);
    cache.put("tb2", [{ book: "Gen", chapter: 1, verse: 1, text: "x" }]);
    cache.clear("tb2");
    expect(cache.get("tb2", "Gen", 1, 1)).toBeUndefined();
  });
});

describe("ESV API", () => {
  it("asks by numeric verse IDs with the church's key and splits verses without rewording", async () => {
    expect(new URL(esvUrl(1, 1, 3, 10)).searchParams.get("q")).toBe(
      "01001003-01001010",
    );
    expect(new URL(esvUrl(66, 22, 21, 21)).searchParams.get("q")).toBe(
      "66022021-66022021",
    );
    const { calls, fetcher } = fake(() => ({
      passages: [
        "[3] First line.\n\n[4] Poetry line one\n    poetry line two.\n\n[5] Last. (ESV)",
      ],
    }));
    expect(await fetchEsv("esv-key", 1, 1, 3, 5, fetcher)).toEqual([
      { verse: 3, text: "First line." },
      { verse: 4, text: "Poetry line one\npoetry line two." },
      { verse: 5, text: "Last." },
    ]);
    expect(calls[0].headers.Authorization).toBe("Token esv-key");
    expect(calls[0].url).toContain("include-footnotes=false");
    expect(calls[0].url).toContain("include-headings=false");
  });
  it("links the picked passage on www.esv.org", () => {
    expect(esvPassageUrl("Genesis", 1, 3, 10)).toBe(
      "https://www.esv.org/Genesis+1:3-10/",
    );
    expect(esvPassageUrl("Song of Solomon", 2, 1, 1)).toBe(
      "https://www.esv.org/Song+of+Solomon+2:1/",
    );
    expect(esvPassageUrl("1 John", 1, 9, 9)).toBe(
      "https://www.esv.org/1+John+1:9/",
    );
  });
  it("refuses missing verses, wrong keys and unknown answers", async () => {
    await expect(
      fetchEsv(
        "k",
        40,
        17,
        20,
        22,
        fake(() => ({
          passages: ["[20] a. [22] c."],
        })).fetcher,
      ),
    ).rejects.toThrow(/tidak memuat ayat 21/);
    await expect(
      fetchEsv("k", 1, 1, 1, 1, fake(() => ({}), 403).fetcher),
    ).rejects.toThrow(/API key ditolak/);
    await expect(
      fetchEsv("k", 1, 1, 1, 1, fake(() => ({ text: "x" })).fetcher),
    ).rejects.toThrow(/format/);
  });
});

describe("Bible API LAI (TB2)", () => {
  it("builds the documented URL with a Bearer token", async () => {
    expect(laiBook("1 Raja-raja")).toBe("1-raja-raja");
    expect(laiBook("Kisah Para Rasul")).toBe("kisah-para-rasul");
    expect(laiUrl(tb2, "Kejadian", 1, 1, 5)).toBe(
      `${LAI_BASE}/bible/tb2/kejadian/1/1-5`,
    );
    expect(laiUrl({ ...tb2, base: `${LAI_BASE}/` }, "Yohanes", 3, 16, 16)).toBe(
      `${LAI_BASE}/bible/tb2/yohanes/3/16`,
    );
    const { calls, fetcher } = fake(laiAnswer);
    expect(await fetchLai(tb2, "Kejadian", 1, 3, 4, fetcher)).toEqual([
      { verse: 3, text: "TB2 uji 3." },
      { verse: 4, text: "TB2 uji 4." },
    ]);
    expect(calls[0].headers.Authorization).toBe("Bearer lai-key");
  });
  it("reads the likely answer shapes and refuses anything else", async () => {
    for (const shape of [
      { data: { verses: [{ verse: 1, text: "a" }] } },
      { verses: [{ number: "1", content: "a" }] },
      { data: [{ ayat: 1, isi: "a" }] },
      { data: { verse: { verse: 1, text: "a" } } },
      { verse: { verse_number: 1, text: "a" } },
    ])
      expect(laiVerses(shape)).toEqual([{ verse: 1, text: "a" }]);
    expect(() => laiVerses({ status: "ok", result: "a" })).toThrow(
      /belum dikenali \(kunci: status, result\)/,
    );
    await expect(
      fetchLai(
        tb2,
        "Kejadian",
        1,
        1,
        2,
        fake(() => ({
          data: {
            verses: [
              { verse: 1, text: "a" },
              { verse: 3, text: "c" },
            ],
          },
        })).fetcher,
      ),
    ).rejects.toThrow(/tidak memuat ayat 2/);
  });
  it("fetches only what is not cached yet", async () => {
    const cache = new OnlineCache(memory()),
      lai = fake(laiAnswer),
      esv = fake(esvAnswer);
    const both: typeof fetch = (url, init) =>
      String(url).startsWith(LAI_BASE)
        ? lai.fetcher(url, init)
        : esv.fetcher(url, init);
    const passage = {
      book: { id: "Gen", order: 1, idName: "Kejadian", enName: "Genesis" },
      chapter: 1,
      from: 3,
      to: 5,
    };
    await ensureOnline(online, passage, cache, both);
    await ensureOnline(online, passage, cache, both);
    expect([lai.calls.length, esv.calls.length]).toEqual([1, 1]);
    expect(cache.get("tb2", "Gen", 1, 4)).toBe("TB2 uji 4.");
    expect(cache.get("esv", "Gen", 1, 5)).toBe("ESV test 5.");
  });
});

describe("TB from Alkitab SABDA", () => {
  const xml = (book: number, chap: number, verses: [number, string][]) =>
    `<?xml version="1.0"?><bible><title>x</title><book name="Kejadian"><book_id>${book}</book_id><chapter><chap>${chap}</chap><verses>${verses
      .map(
        ([n, t], i) =>
          `<verse><number>${n}</number>${i === 0 ? "<title>Judul perikop</title>" : ""}<text>${t}</text></verse>`,
      )
      .join("")}</verses></chapter></book></bible>`;
  it("asks SABDA's passage API through the app's own address", () => {
    expect(sabdaUrl("Kejadian", 1, 3, 10)).toBe(
      "/api/sabda?passage=Kejadian+1%3A3-10&version=tb",
    );
    expect(sabdaUrl("1 Raja-raja", 4, 32, 32)).toBe(
      "/api/sabda?passage=1+Raja-raja+4%3A32&version=tb",
    );
    expect(sabdaChapterUrl(33, 2)).toBe(
      "https://sabda.org/alkitab/tb/?kitab=33&pasal=2",
    );
  });
  it("reads verses, skips section titles, decodes entities and checks book and chapter", async () => {
    expect(
      sabdaVerses(
        xml(1, 1, [
          [3, "Berfirmanlah Allah: &quot;Jadilah terang.&quot;"],
          [4, "Satu &amp; dua"],
        ]),
        1,
        1,
      ),
    ).toEqual([
      { verse: 3, text: 'Berfirmanlah Allah: "Jadilah terang."' },
      { verse: 4, text: "Satu & dua" },
    ]);
    expect(() => sabdaVerses(xml(2, 1, [[1, "x"]]), 1, 1)).toThrow(
      /kitab\/pasal lain/,
    );
    const calls: string[] = [];
    const reply = (body: string, status = 200) =>
      (async (url: string) => {
        calls.push(url);
        return new Response(body, { status });
      }) as typeof fetch;
    expect(
      await fetchSabda(
        "Kejadian",
        1,
        1,
        3,
        4,
        reply(
          xml(1, 1, [
            [3, "tiga"],
            [4, "empat"],
          ]),
        ),
      ),
    ).toEqual([
      { verse: 3, text: "tiga" },
      { verse: 4, text: "empat" },
    ]);
    expect(calls[0]).toBe("/api/sabda?passage=Kejadian+1%3A3-4&version=tb");
    await expect(
      fetchSabda("Kejadian", 1, 1, 3, 5, reply(xml(1, 1, [[3, "tiga"]]))),
    ).rejects.toThrow(/tidak memuat ayat 4, 5/);
    await expect(
      fetchSabda("Kejadian", 1, 1, 3, 3, reply("", 502)),
    ).rejects.toThrow(/HTTP 502/);
  });
  it("keeps the TB choice only with consent", () => {
    const store = memory();
    saveSettings({ ...NO_SETTINGS, tb: { agreed: true }, left: "tb" }, store);
    expect(loadSettings(store)).toMatchObject({
      left: "tb",
      tb: { agreed: true },
    });
    saveSettings({ ...NO_SETTINGS, left: "tb" }, store);
    expect(loadSettings(store).left).toBe("ayt");
  });
});

describe("slides with TB2 / ESV columns", () => {
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
    writer.stop();
    await deleteDB(name);
  });
  /** Small datasets with the bundled AYT / KJV identities, so they pair. */
  async function bible(identity: typeof INDONESIAN.identity) {
    const value = fixtureDataset();
    value.translation = {
      ...value.translation,
      ...identity,
      abbreviation: identity.code,
    };
    value.integrity.contentHash = await sha256(canonicalJSON(unsigned(value)));
    return parseDataset(new TextEncoder().encode(JSON.stringify(value)));
  }
  const style: Style = {
      font: "Arial",
      fontSize: 64,
      safeMargin: 8,
      lines: 6,
      theme: "black",
    },
    measure: Measure = (text, s) => text.length * s.fontSize * 0.5;
  it("swap in cached TB2 and ESV text, keep it out of backups and do not flag a source change", async () => {
    const ayt = await repo.importDataset(
      await bible(INDONESIAN.identity),
      true,
    );
    await repo.importDataset(await bible(ENGLISH.identity), true);
    const selection = {
      datasetId: ayt.id,
      checksum: ayt.contentHash,
      verseIds: [`v|${ayt.id}|001|003|0016`, `v|${ayt.id}|001|003|0017`],
      label: "John 3:16–17",
    };
    const resolved = await repo.resolveWorkspace(await songs.load(), {
      kind: "scripture",
      selection,
    });
    const cache = new OnlineCache(memory());
    cache.put("tb2", [
      { book: "John", chapter: 3, verse: 16, text: "TB2 uji enam belas." },
      { book: "John", chapter: 3, verse: 17, text: "TB2 uji tujuh belas." },
    ]);
    cache.put("esv", [
      { book: "John", chapter: 3, verse: 16, text: "ESV test sixteen." },
      { book: "John", chapter: 3, verse: 17, text: "ESV test seventeen." },
    ]);
    const { data, notes } = await applyOnline(resolved, online, cache);
    expect(notes).toEqual([]);
    const controller = new PresentationController(
      writer.gate,
      new PresentationRepository(writer.gate, name),
      measure,
    );
    await controller.loadRecovery();
    await controller.prepare(data, { kind: "scripture", selection }, style);
    const deck = controller.snapshot().preview!.deck;
    expect(validDeck(deck)).toBe(true);
    const frame = deck.frames[0];
    // Both verses fit, so they share one slide with their numbers.
    expect(deck.frames).toHaveLength(1);
    expect(deck.pages[frame.page]).toMatchObject({
      text: "¹⁶\u2009TB2 uji enam belas. ¹⁷\u2009TB2 uji tujuh belas.",
      parallel: "¹⁶\u2009ESV test sixteen. ¹⁷\u2009ESV test seventeen.",
    });
    expect(frame.kind === "scripture" && frame.scripture).toMatchObject({
      reference: "John 3:16–17",
      translation: "TB2 · 2023",
      attribution: "TB2 © LAI 2023",
      parallel: {
        translation: "ESV · 2016",
        attribution: "ESV® © Crossway · esv.org",
      },
    });
    // Restricted: checkpoints holding this text are left out of backups.
    expect(
      deck.scriptureLicenses?.every((l) => !l.license.permissions.export),
    ).toBe(true);
    controller.observeSources(await songs.load());
    expect(controller.snapshot().sourceChanged).toBe(false);
  });
  it("uses cached SABDA TB text in the left column", async () => {
    const ayt = await repo.importDataset(
      await bible(INDONESIAN.identity),
      true,
    );
    await repo.importDataset(await bible(ENGLISH.identity), true);
    const selection = {
      datasetId: ayt.id,
      checksum: ayt.contentHash,
      verseIds: [`v|${ayt.id}|001|003|0016`],
      label: "John 3:16",
    };
    const cache = new OnlineCache(memory());
    cache.put("tb", [
      { book: "John", chapter: 3, verse: 16, text: "TB uji enam belas." },
    ]);
    const { data, notes } = await applyOnline(
      await repo.resolveWorkspace(await songs.load(), {
        kind: "scripture",
        selection,
      }),
      { ...NO_SETTINGS, tb: { agreed: true }, left: "tb" },
      cache,
    );
    expect(notes).toEqual([]);
    const controller = new PresentationController(
      writer.gate,
      new PresentationRepository(writer.gate, name),
      measure,
    );
    await controller.loadRecovery();
    await controller.prepare(data, { kind: "scripture", selection }, style);
    const deck = controller.snapshot().preview!.deck;
    expect(validDeck(deck)).toBe(true);
    const frame = deck.frames[0];
    expect(deck.pages[frame.page].text).toBe("TB uji enam belas.");
    expect(frame.kind === "scripture" && frame.scripture).toMatchObject({
      translation: "TB · 1974",
      attribution: "TB © LAI 1974",
    });
  });
  it("fall back to AYT / KJV with a note when the online text is not cached", async () => {
    const ayt = await repo.importDataset(
      await bible(INDONESIAN.identity),
      true,
    );
    await repo.importDataset(await bible(ENGLISH.identity), true);
    const resolved = await repo.resolveWorkspace(await songs.load(), {
      kind: "scripture",
      selection: {
        datasetId: ayt.id,
        checksum: ayt.contentHash,
        verseIds: [`v|${ayt.id}|001|003|0016`],
        label: "John 3:16",
      },
    });
    const { data, notes } = await applyOnline(
      resolved,
      online,
      new OnlineCache(memory()),
    );
    expect(notes).toEqual([
      "John 3:16: teks TB2 belum tersimpan, memakai AYT.",
      "John 3:16: teks ESV belum tersimpan, memakai KJV.",
    ]);
    expect(data.scriptureSnapshots?.standalone.translation.id).toBe(ayt.id);
  });
});
