// Builds the bundled King James Version in SAGI Scripture v1 format:
//   public/scriptures/kjv.json
//
//   node scripts/scripture/fetch-sabda.mjs av      # once, fills .cache/sabda/av
//   node scripts/scripture/build-datasets.mjs
//
// Text comes from Alkitab Mobile SABDA (version "av"), read the same way as
// alkitab-api-master. Every chapter must have contiguous verse numbers; any
// paragraph without a verse number is reported in .cache/scripture-report.txt.
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { BOOKS, catalogEntry } from "./books.mjs";
import { readChapter } from "./sabda.mjs";

const root = join(import.meta.dirname, "..", "..");

// Same algorithm as canonicalJSON/sha256 in src/scriptures/importFormat.ts.
function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const tidy = (text) => text.replace(/\s+/g, " ").trim();

const KJV = {
  publisher: "Public Domain",
  code: "KJV",
  name: "King James Version",
  abbreviation: "KJV",
  edition: "1769",
  language: "en",
  versification: "KJV",
  coverage: "complete",
  source: "Alkitab Mobile SABDA (alkitab.mobi/av), read the way alkitab-api-master does",
  license: {
    kind: "public-domain",
    notice:
      "The King James Version (1769 text) is in the public domain in most countries; in the United Kingdom it is under Crown copyright. Brackets around supplied (italic) words, the << >> marks around Psalm titles and the Hebrew letter headings of Psalm 119 are left out; the words themselves are unchanged. The subscriptions printed after Paul's letters (\"Written from Rome…\") are not verse text and are left out.",
    reference: "Public domain",
    displayAttribution: "Public Domain",
    permissions: {
      offlineStorage: true,
      projection: true,
      localSnapshots: true,
      export: true,
    },
  },
};

const psalm119Letters =
  /^(ALEPH|BETH|GIMEL|DALETH|HE|VAU|ZAIN|CHETH|TETH|JOD|CAPH|LAMED|MEM|NUN|SAMECH|AIN|PE|TZADDI|KOPH|RESH|SCHIN|TAU)\.\s+/;
function clean(book, chapter, text) {
  let result = text
    // Subscriptions after Paul's letters ("<<[Written from Rome…]>>") are not verse text.
    .replace(/(\S)\s*«[^«»]*»\s*$/, "$1")
    .replace(/«\s*([^«»]*?)\s*»/g, "$1") // Psalm titles: <<A Psalm of David.>>
    .replace(/\[([^\]]*)\]/g, "$1"); // supplied (italic) words: [is]
  if (book.osis === "Ps" && chapter === 119) result = result.replace(psalm119Letters, "");
  return tidy(result);
}

const report = [],
  verses = [],
  books = [];
for (const book of BOOKS) {
  const chapters = [];
  for (let number = 1; number <= book.chapters; number++) {
    const page = await readChapter("av", book, number);
    for (const line of page.joined)
      report.push(`${book.osis} ${number}:${line} (paragraf tanpa nomor, digabung ke ayat sebelumnya)`);
    if (page.extra.length)
      throw new Error(`${book.osis} ${number}: text before verse 1: ${page.extra.join(" | ")}`);
    const numbers = page.verses.map((v) => v.verse);
    if (!numbers.length || numbers.some((n, i) => n !== i + 1))
      throw new Error(`${book.osis} ${number}: verse numbers not 1..n: ${numbers.join(",")}`);
    for (const { verse, text } of page.verses) {
      const value = clean(book, number, text);
      if (!value || /[<>[\]]|&\w+;/.test(value))
        throw new Error(`${book.osis} ${number}:${verse}: suspicious text: ${value}`);
      verses.push({ book: book.osis, chapter: number, verse, text: value });
    }
    chapters.push({ number, verses: numbers });
  }
  books.push({ ...catalogEntry(book, "en"), chapters });
}

const body = { format: "sagi-scripture", version: 1, translation: KJV, books, verses };
const dataset = { ...body, integrity: { algorithm: "SHA-256", contentHash: sha256(canonicalJSON(body)) } };
const json = JSON.stringify(dataset);
await mkdir(join(root, "public", "scriptures"), { recursive: true });
await writeFile(join(root, "public", "scriptures", "kjv.json"), json);
await mkdir(join(root, ".cache"), { recursive: true });
await writeFile(join(root, ".cache", "scripture-report.txt"), report.join("\n") + "\n");
console.log(
  `kjv.json: ${books.length} books, ${books.reduce((n, b) => n + b.chapters.length, 0)} chapters, ${verses.length} verses, ${(json.length / 1048576).toFixed(1)} MiB, sha256 ${dataset.integrity.contentHash}`,
);
console.log(`${report.length} notes in .cache/scripture-report.txt`);
