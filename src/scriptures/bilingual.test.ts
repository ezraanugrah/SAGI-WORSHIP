import "fake-indexeddb/auto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { canonicalJSON, parseDataset, sha256, unsigned } from "./importFormat";
import {
  editionKey,
  verseKey,
  type Dataset,
  type ScriptureSelection,
  type Translation,
} from "./models";
import { resolveReference } from "./references";
import {
  ENGLISH,
  INDONESIAN,
  downloadBible,
  partnerKey,
  partnerOf,
} from "./bilingual";
import { ScriptureRepository } from "../data/scriptureRepository";
import { Repository } from "../data/repository";
import { PresentationRepository } from "../data/presentationRepository";
import { PresentationController } from "../presentation/controller";
import { validDeck, type Deck, type Style } from "../presentation/models";
import { fitsFrame } from "../presentation/scriptureAdapter";
import type { Measure } from "../presentation/layout";
import { writerFixture } from "../testHelpers";

const style: Style = {
    font: "Arial",
    fontSize: 64,
    safeMargin: 8,
    lines: 6,
    theme: "black",
  },
  measure: Measure = (text, s) => text.length * s.fontSize * 0.5;

// The bundled files exactly as the app serves them (public/scriptures).
const sets: Record<"ayt" | "kjv", Dataset> = {} as never;
beforeAll(async () => {
  const files = {
    ayt: () => import("../../public/scriptures/ayt.json?raw"),
    kjv: () => import("../../public/scriptures/kjv.json?raw"),
  };
  for (const key of ["ayt", "kjv"] as const)
    sets[key] = (
      await parseDataset(
        new TextEncoder().encode((await files[key]()).default),
      )
    ).dataset;
}, 60000);
const text = (d: Dataset, book: string, chapter: number, verse: number) =>
  d.verses.find(
    (v) => v.book === book && v.chapter === chapter && v.verse === verse,
  )?.text;
const asTranslation = (d: Dataset, id: string): Translation => ({
  id,
  format: 1,
  revision: 1,
  info: d.translation,
  books: d.books,
  contentHash: d.integrity.contentHash,
  fileHash: "0".repeat(64),
  verseCount: d.verses.length,
  byteLength: 1,
  createdAt: new Date(0).toISOString(),
  attestedAt: new Date(0).toISOString(),
});

describe("bundled two-language Bible (AYT + KJV)", () => {
  it("both files pass the app's import validation and match their catalog identity", () => {
    expect(editionKey(sets.ayt.translation)).toBe(
      editionKey(INDONESIAN.identity),
    );
    expect(editionKey(sets.kjv.translation)).toBe(
      editionKey(ENGLISH.identity),
    );
    expect(sets.ayt.translation.license.displayAttribution).toBe(
      "AYT © YLSA · CC BY-NC-SA",
    );
    expect(sets.kjv.translation.license.displayAttribution).toBe(
      "Public Domain",
    );
  });
  it("are complete and pair verse for verse from Genesis to Revelation", () => {
    for (const d of [sets.ayt, sets.kjv]) {
      expect(d.books).toHaveLength(66);
      expect(d.verses).toHaveLength(31102);
      expect(d.books.reduce((n, b) => n + b.chapters.length, 0)).toBe(1189);
    }
    sets.ayt.books.forEach((book, i) => {
      const other = sets.kjv.books[i];
      expect([book.id, book.order]).toEqual([other.id, other.order]);
      expect(book.chapters).toEqual(other.chapters);
    });
    expect(sets.ayt.books[0].name).toBe("Kejadian");
    expect(sets.ayt.books[65].name).toBe("Wahyu");
    expect(text(sets.ayt, "Gen", 1, 3)).toBe(
      "Kemudian, Allah berfirman, “Jadilah terang.” Lalu, terang itu jadi.",
    );
    expect(text(sets.kjv, "Gen", 1, 3)).toBe(
      "And God said, Let there be light: and there was light.",
    );
    expect(text(sets.ayt, "Rev", 22, 21)).toBe(
      "Anugerah Tuhan Yesus menyertai kamu semua. Amin.",
    );
  });
  it("finds the same verses from Indonesian or English references", () => {
    const ayt = asTranslation(sets.ayt, "scripture:ayt"),
      kjv = asTranslation(sets.kjv, "scripture:kjv");
    const genesis = resolveReference(ayt, "Kej 1:3-10");
    expect(genesis).toHaveLength(8);
    expect(resolveReference(ayt, "Genesis 1:3-10")).toEqual(genesis);
    expect(
      resolveReference(kjv, "Kejadian 1:3-10").map((k) =>
        partnerKey(k, "scripture:ayt"),
      ),
    ).toEqual(genesis);
    expect(resolveReference(ayt, "Yoh 3:16")).toEqual([
      verseKey(ayt.id, 43, 3, 16),
    ]);
    expect(partnerKey(verseKey("scripture:a", 1, 1, 3), "scripture:b")).toBe(
      verseKey("scripture:b", 1, 1, 3),
    );
    expect(partnerOf(ayt, [ayt, kjv])?.id).toBe(kjv.id);
    expect(partnerOf(kjv, [ayt, kjv])).toBeUndefined();
    expect(partnerOf(ayt, [ayt])).toBeUndefined();
  });
});

/** A small signed dataset with the same identity, for fast IndexedDB tests. */
async function subset(full: Dataset, keep: [string, number][]) {
  const books = full.books
    .filter((b) => keep.some(([id]) => id === b.id))
    .map((b, i) => ({
      ...b,
      order: i + 1,
      chapters: b.chapters.filter((c) =>
        keep.some(([id, ch]) => id === b.id && ch === c.number),
      ),
    }));
  const value: Dataset = {
    ...structuredClone(full),
    translation: { ...full.translation, coverage: "partial" },
    books,
    verses: full.verses.filter((v) =>
      keep.some(([id, ch]) => id === v.book && ch === v.chapter),
    ),
  };
  value.integrity.contentHash = await sha256(canonicalJSON(unsigned(value)));
  return parseDataset(new TextEncoder().encode(JSON.stringify(value)));
}

describe("two-language slides", () => {
  const keep: [string, number][] = [
    ["Gen", 1],
    ["Esth", 8],
  ];
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
  async function prepare(selection: ScriptureSelection) {
    const data = await repo.resolveWorkspace(await songs.load(), {
      kind: "scripture",
      selection,
    });
    const controller = new PresentationController(
      writer.gate,
      new PresentationRepository(writer.gate, name),
      measure,
    );
    await controller.loadRecovery();
    await controller.prepare(data, { kind: "scripture", selection }, style);
    return { data, deck: controller.snapshot().preview!.deck };
  }
  const choose = (t: Translation, ref: string): ScriptureSelection => ({
    datasetId: t.id,
    checksum: t.contentHash,
    verseIds: resolveReference(t, ref),
    label: ref,
  });
  it("put Indonesian left and English right, with both references and attributions", async () => {
    const ayt = await repo.importDataset(await subset(sets.ayt, keep), true);
    await repo.importDataset(await subset(sets.kjv, keep), true);
    const { data, deck } = await prepare(choose(ayt, "Kej 1:3-10"));
    expect(data.scriptureSnapshots?.standalone.parallel?.verses).toHaveLength(
      8,
    );
    expect(validDeck(deck)).toBe(true);
    // 8 verses; a long one may take two slides.
    expect(
      new Set(
        deck.frames.map((f) => f.kind === "scripture" && f.scripture.verseId),
      ).size,
    ).toBe(8);
    const first = deck.frames[0];
    expect(deck.pages[first.page]).toMatchObject({
      text: text(sets.ayt, "Gen", 1, 3),
      parallel: text(sets.kjv, "Gen", 1, 3),
    });
    expect(first.kind === "scripture" && first.scripture).toMatchObject({
      reference: "Kejadian 1:3",
      translation: "AYT · 2024",
      attribution: "AYT © YLSA · CC BY-NC-SA",
      parallel: {
        reference: "Genesis 1:3",
        translation: "KJV · 1769",
        attribution: "Public Domain",
      },
    });
    expect(deck.scriptureLicenses?.map((l) => l.translation)).toEqual([
      "AYT · 2024",
      "KJV · 1769",
    ]);
    expect(deck.frames.every((_, i) => fitsFrame(deck, i, measure))).toBe(
      true,
    );
  });
  it("splits a long verse over several slides, each column keeping its exact text", async () => {
    const ayt = await repo.importDataset(await subset(sets.ayt, keep), true);
    await repo.importDataset(await subset(sets.kjv, keep), true);
    const { deck } = await prepare(choose(ayt, "Ester 8:9"));
    expect(deck.frames.length).toBeGreaterThan(2);
    expect(deck.frames.map((f) => deck.pages[f.page].text).join("")).toBe(
      text(sets.ayt, "Esth", 8, 9),
    );
    expect(deck.frames.map((f) => deck.pages[f.page].parallel).join("")).toBe(
      text(sets.kjv, "Esth", 8, 9),
    );
    expect(deck.frames.every((_, i) => fitsFrame(deck, i, measure))).toBe(
      true,
    );
    const tampered = structuredClone(deck) as Deck;
    tampered.pages[tampered.frames[0].page].parallel += " extra";
    expect(validDeck(tampered)).toBe(false);
    const unlicensed = structuredClone(deck) as Deck;
    unlicensed.scriptureLicenses = unlicensed.scriptureLicenses!.slice(0, 1);
    expect(validDeck(unlicensed)).toBe(false);
    const dropped = structuredClone(deck) as Deck;
    delete dropped.pages[dropped.frames[0].page].parallel;
    expect(validDeck(dropped)).toBe(false);
  });
  it("stays one-language until the English Bible is installed", async () => {
    const ayt = await repo.importDataset(await subset(sets.ayt, keep), true);
    const { data, deck } = await prepare(choose(ayt, "Kej 1:3"));
    expect(data.scriptureSnapshots?.standalone.parallel).toBeUndefined();
    expect(validDeck(deck)).toBe(true);
    expect(deck.pages[deck.frames[0].page].parallel).toBeUndefined();
  });
});

describe("downloading the bundled files", () => {
  it("hands back a JSON File and explains offline and server errors", async () => {
    const file = await downloadBible(INDONESIAN, (async () =>
      new Response("{}")) as typeof fetch);
    expect([file.name, file.type]).toEqual(["ayt.json", "application/json"]);
    await expect(
      downloadBible(ENGLISH, (async () => {
        throw new TypeError("Failed to fetch");
      }) as typeof fetch),
    ).rejects.toThrow(/koneksi internet/);
    await expect(
      downloadBible(
        ENGLISH,
        (async () => new Response("", { status: 503 })) as typeof fetch,
      ),
    ).rejects.toThrow(/HTTP 503/);
  });
});
