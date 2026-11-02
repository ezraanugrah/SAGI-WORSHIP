import { object, integer, string } from "../presentation/models";
import {
  aliasKey,
  FILE_LIMIT,
  VERSE_LIMIT,
  type Dataset,
  type Translation,
  type Verse,
  type License,
  type PreparedDataset,
} from "./models";
const hashPattern = /^[0-9a-f]{64}$/;
function fail(message: string): never {
  throw new Error(`Dataset ditolak: ${message}`);
}
function keys(
  value: unknown,
  required: string[],
  optional: string[] = [],
): asserts value is Record<string, unknown> {
  if (
    !object(value) ||
    required.some((k) => !Object.hasOwn(value, k)) ||
    Object.keys(value).some(
      (k) => !required.includes(k) && !optional.includes(k),
    )
  )
    fail("struktur/field tidak didukung.");
}
function label(v: unknown, max: number) {
  return (
    string(v, max) &&
    v.trim() === v &&
    !!v.trim() &&
    !/[\u0000-\u001f]/u.test(v)
  );
}
export function exactText(v: unknown, max = 30000): v is string {
  return (
    typeof v === "string" &&
    !!v.trim() &&
    v.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v) &&
    !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      v,
    )
  );
}
export function validLicense(value: unknown): value is License {
  try {
    keys(value, [
      "kind",
      "notice",
      "reference",
      "displayAttribution",
      "permissions",
    ]);
    keys(value.permissions, [
      "offlineStorage",
      "projection",
      "localSnapshots",
      "export",
    ]);
    return (
      ["public-domain", "licensed", "permission"].includes(
        value.kind as string,
      ) &&
      exactText(value.notice, 10000) &&
      label(value.reference, 1000) &&
      exactText(value.displayAttribution, 300) &&
      value.permissions.offlineStorage === true &&
      value.permissions.projection === true &&
      value.permissions.localSnapshots === true &&
      typeof value.permissions.export === "boolean"
    );
  } catch {
    return false;
  }
}
export function validateDataset(
  value: unknown,
  metadataOnly = false,
): asserts value is Dataset {
  keys(value, [
    "format",
    "version",
    "translation",
    "books",
    "verses",
    "integrity",
  ]);
  if (value.format !== "sagi-scripture" || value.version !== 1)
    fail("format/version harus sagi-scripture v1.");
  const t = value.translation;
  keys(t, [
    "publisher",
    "code",
    "name",
    "abbreviation",
    "edition",
    "language",
    "versification",
    "coverage",
    "source",
    "license",
  ]);
  for (const key of [
    "publisher",
    "code",
    "name",
    "edition",
    "versification",
    "source",
  ])
    if (!label(t[key], key === "source" ? 1000 : 200))
      fail(`metadata ${key} tidak valid.`);
  if (
    !label(t.abbreviation, 40) ||
    !label(t.language, 60) ||
    !["complete", "partial"].includes(t.coverage as string)
  )
    fail("bahasa/abbreviation/coverage tidak valid.");
  try {
    if (Intl.getCanonicalLocales(t.language as string).length !== 1)
      fail("kode bahasa tidak valid.");
  } catch {
    fail("kode bahasa tidak valid.");
  }
  if (!validLicense(t.license))
    fail(
      "izin offlineStorage, projection, localSnapshots dan metadata lisensi wajib; kondisi lain tidak didukung.",
    );
  keys(value.integrity, ["algorithm", "contentHash"]);
  if (
    value.integrity.algorithm !== "SHA-256" ||
    typeof value.integrity.contentHash !== "string" ||
    !hashPattern.test(value.integrity.contentHash)
  )
    fail("integrity SHA-256 tidak valid.");
  if (
    !Array.isArray(value.books) ||
    !value.books.length ||
    value.books.length > 256 ||
    !Array.isArray(value.verses) ||
    (!metadataOnly && !value.verses.length) ||
    value.verses.length > VERSE_LIMIT
  )
    fail("batas koleksi terlampaui.");
  const bookIds = new Set<string>(),
    aliases = new Map<string, string>(),
    expected: { book: string; chapter: number; verse: number }[] = [];
  let expectedCount = 0;
  for (let index = 0; index < value.books.length; index++) {
    const b = value.books[index];
    keys(b, ["id", "name", "aliases", "order", "chapters"]);
    if (
      !label(b.id, 64) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(b.id as string) ||
      !label(b.name, 100) ||
      b.order !== index + 1 ||
      bookIds.has(b.id as string) ||
      !Array.isArray(b.aliases) ||
      b.aliases.length > 50 ||
      !b.aliases.every((a) => label(a, 100))
    )
      fail("book ID/order/alias tidak valid atau duplikat.");
    bookIds.add(b.id as string);
    for (const alias of [b.id, b.name, ...b.aliases] as string[]) {
      const key = aliasKey(alias);
      if (!key || (aliases.has(key) && aliases.get(key) !== b.id))
        fail(`alias ambigu: ${alias}.`);
      aliases.set(key, b.id as string);
    }
    if (
      !Array.isArray(b.chapters) ||
      !b.chapters.length ||
      b.chapters.length > 999
    )
      fail("manifest pasal tidak valid.");
    let previous = 0;
    for (const chapter of b.chapters) {
      keys(chapter, ["number", "verses"]);
      if (
        !integer(chapter.number, 1, 999) ||
        chapter.number <= previous ||
        !Array.isArray(chapter.verses) ||
        !chapter.verses.length ||
        chapter.verses.length > 9999
      )
        fail("manifest pasal/ayat tidak valid.");
      previous = chapter.number;
      let last = 0;
      for (const number of chapter.verses) {
        if (!integer(number, 1, 9999) || number <= last)
          fail("nomor ayat duplikat/tidak berurutan.");
        last = number;
        expectedCount++;
        if (expectedCount > VERSE_LIMIT) fail("manifest terlalu besar.");
        if (!metadataOnly)
          expected.push({
            book: b.id as string,
            chapter: chapter.number,
            verse: number,
          });
        if (expected.length > VERSE_LIMIT) fail("manifest terlalu besar.");
      }
    }
  }
  if (metadataOnly) return;
  if (expected.length !== value.verses.length)
    fail("jumlah ayat tidak cocok dengan manifest.");
  for (let i = 0; i < expected.length; i++) {
    const v = value.verses[i];
    keys(v, ["book", "chapter", "verse", "text"]);
    const e = expected[i];
    if (
      v.book !== e.book ||
      v.chapter !== e.chapter ||
      v.verse !== e.verse ||
      !exactText(v.text)
    )
      fail(
        `ayat ${i + 1} hilang, duplikat, tidak berurutan, atau teks tidak valid.`,
      );
  }
}
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function sha256(text: string | Uint8Array) {
  const data = typeof text === "string" ? new TextEncoder().encode(text) : text;
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function unsigned(dataset: Dataset) {
  const { integrity: _, ...body } = dataset;
  return body;
}
export async function verifyDataset(value: unknown) {
  validateDataset(value);
  const bytes = new TextEncoder().encode(canonicalJSON(value)).byteLength;
  if (bytes > FILE_LIMIT) fail("dataset melebihi 32 MiB.");
  if (
    (await sha256(canonicalJSON(unsigned(value)))) !==
    value.integrity.contentHash
  )
    fail("checksum konten tidak cocok.");
  return value;
}
export async function parseDataset(
  bytes: Uint8Array,
): Promise<PreparedDataset> {
  if (bytes.byteLength > FILE_LIMIT) fail("file melebihi 32 MiB.");
  let value: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(text);
  } catch {
    fail("file harus JSON UTF-8 yang valid.");
  }
  const dataset = await verifyDataset(value);
  return {
    dataset,
    fileHash: await sha256(bytes),
    byteLength: bytes.byteLength,
  };
}
export function validTranslation(value: unknown): value is Translation {
  try {
    if (
      !object(value) ||
      !string(value.id, 160) ||
      value.format !== 1 ||
      value.revision !== 1 ||
      !integer(value.verseCount, 1, VERSE_LIMIT) ||
      !integer(value.byteLength, 1, FILE_LIMIT) ||
      typeof value.contentHash !== "string" ||
      !hashPattern.test(value.contentHash) ||
      typeof value.fileHash !== "string" ||
      !hashPattern.test(value.fileHash) ||
      !string(value.createdAt) ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      !string(value.attestedAt) ||
      !Number.isFinite(Date.parse(value.attestedAt))
    )
      return false;
    const books = value.books as Dataset["books"];
    const info = value.info as Dataset["translation"];
    // Use the same strict structural validator without reconstructing verse text from storage.
    const fake = {
      format: "sagi-scripture",
      version: 1,
      translation: info,
      books,
      verses: [],
      integrity: { algorithm: "SHA-256", contentHash: value.contentHash },
    };
    validateDataset(fake, true);
    if (
      books.reduce(
        (sum, b) => sum + b.chapters.reduce((n, c) => n + c.verses.length, 0),
        0,
      ) !== value.verseCount
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
export function validVerse(value: unknown): value is Verse {
  return (
    object(value) &&
    string(value.id, 160) &&
    string(value.datasetId, 160) &&
    label(value.book, 64) &&
    integer(value.bookOrder, 1, 256) &&
    integer(value.chapter, 1, 999) &&
    integer(value.verse, 1, 9999) &&
    typeof value.textHash === "string" &&
    hashPattern.test(value.textHash) &&
    exactText(value.text)
  );
}
