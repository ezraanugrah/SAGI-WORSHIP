import { describe, it, expect, beforeAll } from "vitest";
import { parseDataset } from "./importFormat";
import { resolveReference } from "./references";
import { editionKey, verseKey, type Dataset, type Translation } from "./models";
import { BUILTIN_BIBLES, downloadBuiltin, installedBuiltin } from "./builtins";

const kjvEntry = BUILTIN_BIBLES.find((b) => b.key === "kjv")!,
  tb2Entry = BUILTIN_BIBLES.find((b) => b.key === "tb2")!;
const asTranslation = (dataset: Dataset, id: string): Translation => ({
  id,
  format: 1,
  revision: 1,
  info: dataset.translation,
  books: dataset.books,
  contentHash: dataset.integrity.contentHash,
  fileHash: "0".repeat(64),
  verseCount: dataset.verses.length,
  byteLength: 1,
  createdAt: new Date(0).toISOString(),
  attestedAt: new Date(0).toISOString(),
});

// The bundled file exactly as the app serves it (public/scriptures/kjv.json).
let kjv: Dataset;
const text = (book: string, chapter: number, verse: number) =>
  kjv.verses.find(
    (v) => v.book === book && v.chapter === chapter && v.verse === verse,
  )?.text;
beforeAll(async () => {
  const raw = (await import("../../public/scriptures/kjv.json?raw")).default;
  kjv = (await parseDataset(new TextEncoder().encode(raw))).dataset;
}, 60000);

describe("bundled King James Version", () => {
  it("passes the app's own import validation and matches its catalog entry", () => {
    expect(editionKey(kjv.translation)).toBe(editionKey(kjvEntry.identity));
    expect(kjv.translation.coverage).toBe("complete");
    expect(kjv.translation.license.kind).toBe("public-domain");
    expect(kjv.translation.license.displayAttribution).toBe("Public Domain");
  });
  it("is complete from Genesis to Revelation", () => {
    expect(kjv.books).toHaveLength(66);
    expect(kjv.books[0]).toMatchObject({ id: "Gen", name: "Genesis" });
    expect(kjv.books[65]).toMatchObject({ id: "Rev", name: "Revelation" });
    expect(kjv.books.reduce((n, b) => n + b.chapters.length, 0)).toBe(1189);
    // The standard KJV count, and every chapter numbered 1..n without gaps.
    expect(kjv.verses).toHaveLength(31102);
    for (const book of kjv.books)
      for (const chapter of book.chapters)
        expect(chapter.verses).toEqual(
          chapter.verses.map((_, index) => index + 1),
        );
    const count = (id: string, chapter: number) =>
      kjv.books.find((b) => b.id === id)!.chapters[chapter - 1].verses.length;
    expect(count("Ps", 119)).toBe(176);
    expect(count("Gen", 1)).toBe(31);
    expect(count("John", 3)).toBe(36);
    expect(count("3John", 1)).toBe(14);
    expect(count("Rev", 22)).toBe(21);
  });
  it("has clean, known verse text", () => {
    expect(text("Gen", 1, 1)).toBe(
      "In the beginning God created the heaven and the earth.",
    );
    expect(text("John", 3, 16)).toBe(
      "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    );
    expect(text("Ps", 23, 1)).toBe(
      "A Psalm of David. The LORD is my shepherd; I shall not want.",
    );
    expect(text("Ps", 119, 9)).toMatch(/^Wherewithal shall a young man/);
    expect(text("Rev", 22, 21)).toBe(
      "The grace of our Lord Jesus Christ be with you all. Amen.",
    );
    for (const v of kjv.verses) {
      expect(v.text).not.toMatch(/[[\]<>]|&\w+;/);
      expect(v.text).toBe(v.text.trim());
    }
  });
  it("accepts Indonesian and English book names", () => {
    const t = asTranslation(kjv, "scripture:kjv");
    const john316 = [verseKey(t.id, 43, 3, 16)];
    for (const ref of ["Yoh 3:16", "Yohanes 3:16", "John 3:16", "Jn 3:16"])
      expect(resolveReference(t, ref)).toEqual(john316);
    expect(resolveReference(t, "1 Yoh 1:9")).toEqual(
      resolveReference(t, "1 John 1:9"),
    );
    expect(resolveReference(t, "Mzm 23")).toEqual(
      resolveReference(t, "Psalm 23"),
    );
    expect(resolveReference(t, "Mzm 23")).toHaveLength(6);
    expect(resolveReference(t, "Kej 1:1-3")).toHaveLength(3);
    expect(resolveReference(t, "Hakim-hakim 1:1")).toEqual(
      resolveReference(t, "Judges 1:1"),
    );
    expect(resolveReference(t, "1 Raja-raja 4:32")).toEqual(
      resolveReference(t, "1 Kings 4:32"),
    );
    expect(resolveReference(t, "Why 22:21")).toEqual(
      resolveReference(t, "Rev 22:21"),
    );
  });
});

describe("Alkitab bawaan list", () => {
  it("lists TB2 as waiting for LAI permission, without a file", async () => {
    expect(tb2Entry.file).toBeUndefined();
    expect(tb2Entry.pending).toBe("Perlu izin LAI");
    await expect(downloadBuiltin(tb2Entry)).rejects.toThrow(/belum tersedia/);
  });
  it("downloads a bundled file as a JSON File for the normal import", async () => {
    const calls: string[] = [];
    const file = await downloadBuiltin(kjvEntry, (async (url: string) => {
      calls.push(url);
      return new Response('{"format":"sagi-scripture"}');
    }) as typeof fetch);
    expect(calls).toEqual(["/scriptures/kjv.json"]);
    expect(file.name).toBe("kjv.json");
    expect(file.type).toBe("application/json");
    expect(await file.text()).toBe('{"format":"sagi-scripture"}');
  });
  it("explains offline and server errors", async () => {
    await expect(
      downloadBuiltin(kjvEntry, (async () => {
        throw new TypeError("Failed to fetch");
      }) as typeof fetch),
    ).rejects.toThrow(/koneksi internet/);
    await expect(
      downloadBuiltin(
        kjvEntry,
        (async () => new Response("", { status: 404 })) as typeof fetch,
      ),
    ).rejects.toThrow(/HTTP 404/);
  });
  it("recognises an installed Bible by its edition, not its local ID", () => {
    const t = asTranslation(kjv, "scripture:any-uuid");
    expect(installedBuiltin(kjvEntry, [t])?.id).toBe("scripture:any-uuid");
    expect(installedBuiltin(tb2Entry, [t])).toBeUndefined();
    const licensedTb2 = {
      ...t,
      id: "scripture:tb2",
      info: { ...t.info, ...tb2Entry.identity },
    };
    expect(installedBuiltin(tb2Entry, [t, licensedTb2])?.id).toBe(
      "scripture:tb2",
    );
  });
});
