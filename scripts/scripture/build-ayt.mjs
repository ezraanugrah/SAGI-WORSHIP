// Builds the bundled Indonesian Bible, Alkitab Yang Terbuka (AYT), in SAGI
// Scripture v1 format: public/scriptures/ayt.json
//
//   # download indayt_vpl.zip from https://ebible.org/details.php?id=indayt
//   node scripts/scripture/build-ayt.mjs <path to indayt_vpl.txt>
//
// The eBible.org VPL file has one verse per line ("GEN 1:1 Pada mulanya, …").
// Verse text is kept exactly as published (AYT is CC BY-NC-SA; only the file
// format changes). The build stops on any gap, duplicate or unknown book.
import { readFile } from "node:fs/promises";
import { BOOKS, catalogEntry } from "./books.mjs";
import { writeDataset } from "./dataset.mjs";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/scripture/build-ayt.mjs <indayt_vpl.txt>");
  process.exit(1);
}
// eBible.org book codes, in the same order as BOOKS.
const CODES =
  "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SOL ISA JER LAM EZE DAN HOS JOE AMO OBA JON MIC NAH HAB ZEP HAG ZEC MAL MAT MAR LUK JOH ACT ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI TIT PHM HEB JAM 1PE 2PE 1JO 2JO 3JO JUD REV".split(
    " ",
  );
if (CODES.length !== BOOKS.length) throw new Error("book code table out of sync");

const AYT = {
  publisher: "Yayasan Lembaga SABDA (YLSA)",
  code: "AYT",
  name: "Alkitab Yang Terbuka",
  abbreviation: "AYT",
  edition: "2024",
  language: "id",
  versification: "KJV",
  coverage: "complete",
  source: "eBible.org indayt_vpl.zip (Alkitab Yang Terbuka, YLSA-AYT)",
  license: {
    kind: "licensed",
    notice:
      "Alkitab Yang Terbuka (AYT) © 2011–2024 YLSA-AYT. Creative Commons Attribution-NonCommercial-ShareAlike (CC BY-NC-SA): boleh dipakai dan disebarkan untuk keperluan non-komersial dengan mencantumkan sumber. AYT dan Alkitab Yang Terbuka adalah merek YLSA. Teks tidak diubah; hanya formatnya.",
    reference: "https://ayt.co · https://ebible.org/details.php?id=indayt",
    displayAttribution: "AYT © YLSA · CC BY-NC-SA",
    permissions: {
      offlineStorage: true,
      projection: true,
      localSnapshots: true,
      export: true,
    },
  },
};

const rows = new Map(); // "order|chapter" -> [{verse, text}]
let trimmed = 0;
for (const [index, raw] of (await readFile(source, "utf8")).split(/\r?\n/).entries()) {
  if (!raw.trim()) continue;
  const match = raw.match(/^([1-3A-Z]{3}) (\d+):(\d+) (.*)$/);
  if (!match) throw new Error(`line ${index + 1}: unexpected format: ${raw.slice(0, 60)}`);
  const order = CODES.indexOf(match[1]) + 1;
  if (!order) throw new Error(`line ${index + 1}: unknown book ${match[1]}`);
  const text = match[4].trim();
  if (text !== match[4]) trimmed++;
  if (!text || /[\u0000-\u001f<>]/.test(text))
    throw new Error(`line ${index + 1}: empty or suspicious text`);
  const key = `${order}|${Number(match[2])}`;
  if (!rows.has(key)) rows.set(key, []);
  rows.get(key).push({ verse: Number(match[3]), text });
}

const books = [],
  verses = [];
for (const book of BOOKS) {
  const chapters = [];
  for (let number = 1; number <= book.chapters; number++) {
    const list = rows.get(`${book.order}|${number}`) ?? [];
    const numbers = list.map((v) => v.verse);
    if (!numbers.length || numbers.some((n, i) => n !== i + 1))
      throw new Error(`${book.osis} ${number}: verse numbers not 1..n: ${numbers.join(",")}`);
    rows.delete(`${book.order}|${number}`);
    for (const { verse, text } of list)
      verses.push({ book: book.osis, chapter: number, verse, text });
    chapters.push({ number, verses: numbers });
  }
  books.push({ ...catalogEntry(book, "id"), chapters });
}
if (rows.size) throw new Error(`unexpected chapters: ${[...rows.keys()].join(", ")}`);
if (trimmed) console.log(`${trimmed} verses had surrounding spaces removed`);
await writeDataset("ayt", AYT, books, verses);
