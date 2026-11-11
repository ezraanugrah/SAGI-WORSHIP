// Builds the bundled King James Version in SAGI Scripture v1 format:
//   public/scriptures/kjv.json
//
//   node scripts/scripture/fetch-sabda.mjs av      # once, fills .cache/sabda/av
//   node scripts/scripture/build-kjv.mjs
//
// Text comes from Alkitab Mobile SABDA (version "av"), read the same way as
// alkitab-api-master. Every chapter must have contiguous verse numbers; any
// paragraph without a verse number is reported in .cache/scripture-report.txt.
import { BOOKS, catalogEntry } from "./books.mjs";
import { readChapter } from "./sabda.mjs";
import { writeDataset } from "./dataset.mjs";

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

await writeDataset("kjv", KJV, books, verses);
if (report.length) console.log(report.join("\n"));
