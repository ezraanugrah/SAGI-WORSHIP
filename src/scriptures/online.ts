/**
 * Online Bible text through the publishers' official APIs, with the church's
 * own API key: Alkitab Terjemahan Baru Edisi Kedua (TB2) from LAI's Bible API
 * and the English Standard Version (ESV) from Crossway's ESV API.
 *
 * Their terms do not allow bundling a whole Bible, so:
 * - API keys and choices are kept only in this browser (localStorage); they
 *   are never in the code, the public site or backups.
 * - Only verses the operator picks are fetched; at most ONLINE_LIMIT verses
 *   per version are kept, entries expire after CACHE_DAYS and can be cleared.
 * - AYT/KJV stay the backbone: selections are stored on AYT, and when slides
 *   are prepared the cached TB2/ESV text replaces a column (applyOnline).
 *   A verse that is not cached falls back to AYT/KJV and says so.
 * - Text is never reworded; only the API's verse markers and indentation are
 *   removed. A response that does not match the requested verses is refused.
 */
import { canonicalJSON, sha256 } from "./importFormat";
import {
  editionKey,
  verseKey,
  type ScriptureSnapshot,
  type Translation,
  type Verse,
} from "./models";
import { ENGLISH, INDONESIAN } from "./bilingual";
import type { Workspace } from "../domain/models";

export type OnlineVersion = "tb2" | "esv";
export const ONLINE_LIMIT = 500,
  CACHE_DAYS = 30;
export const LAI_BASE = "https://bible-api.alkitab.or.id/bible-api/api/v1",
  ESV_URL = "https://api.esv.org/v3/passage/text/";
export type OnlineSettings = {
  tb2: { key: string; base: string; version: string; agreed: boolean } | null;
  esv: { key: string; agreed: boolean } | null;
  /** Left (Indonesian) and right (English) column sources. */
  left: "ayt" | "tb2";
  right: "kjv" | "esv";
};
export const NO_SETTINGS: OnlineSettings = {
  tb2: null,
  esv: null,
  left: "ayt",
  right: "kjv",
};
const SETTINGS_KEY = "sagi-bible-online",
  CACHE_KEY = "sagi-bible-online-cache";
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
export function loadSettings(store = storage()): OnlineSettings {
  try {
    const value = JSON.parse(store?.getItem(SETTINGS_KEY) ?? "null");
    if (!value || typeof value !== "object") return { ...NO_SETTINGS };
    const tb2 =
      value.tb2 && typeof value.tb2.key === "string" && value.tb2.key
        ? {
            key: value.tb2.key,
            base:
              typeof value.tb2.base === "string" && value.tb2.base
                ? value.tb2.base
                : LAI_BASE,
            version:
              typeof value.tb2.version === "string" && value.tb2.version
                ? value.tb2.version
                : "tb2",
            agreed: value.tb2.agreed === true,
          }
        : null;
    const esv =
      value.esv && typeof value.esv.key === "string" && value.esv.key
        ? { key: value.esv.key, agreed: value.esv.agreed === true }
        : null;
    return {
      tb2,
      esv,
      left: value.left === "tb2" && tb2?.agreed ? "tb2" : "ayt",
      right: value.right === "esv" && esv?.agreed ? "esv" : "kjv",
    };
  } catch {
    return { ...NO_SETTINGS };
  }
}
export function saveSettings(settings: OnlineSettings, store = storage()) {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    throw new Error("Pengaturan tidak bisa disimpan di browser ini.");
  }
}
export const usesOnline = (s: OnlineSettings) =>
  (s.left === "tb2" && !!s.tb2?.agreed) ||
  (s.right === "esv" && !!s.esv?.agreed);

type Entry = { text: string; at: number };
type CacheData = Record<OnlineVersion, Record<string, Entry>>;
const cacheKey = (book: string, chapter: number, verse: number) =>
  `${book}|${chapter}|${verse}`;
/** Picked verses only, at most ONLINE_LIMIT per version, oldest dropped first. */
export class OnlineCache {
  constructor(
    private store = storage(),
    private now = () => Date.now(),
  ) {}
  private read(): CacheData {
    const empty: CacheData = { tb2: {}, esv: {} };
    try {
      const value = JSON.parse(this.store?.getItem(CACHE_KEY) ?? "null");
      if (!value || typeof value !== "object") return empty;
      const oldest = this.now() - CACHE_DAYS * 86400000;
      for (const version of ["tb2", "esv"] as const)
        for (const [key, entry] of Object.entries(value[version] ?? {}) as [
          string,
          Entry,
        ][])
          if (
            entry &&
            typeof entry.text === "string" &&
            entry.text.trim() &&
            typeof entry.at === "number" &&
            entry.at >= oldest
          )
            empty[version][key] = { text: entry.text, at: entry.at };
      return empty;
    } catch {
      return empty;
    }
  }
  private write(data: CacheData) {
    try {
      this.store?.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* storage full or blocked: the text is simply fetched again */
    }
  }
  get(version: OnlineVersion, book: string, chapter: number, verse: number) {
    return this.read()[version][cacheKey(book, chapter, verse)]?.text;
  }
  put(
    version: OnlineVersion,
    verses: { book: string; chapter: number; verse: number; text: string }[],
  ) {
    const data = this.read(),
      at = this.now();
    for (const v of verses)
      data[version][cacheKey(v.book, v.chapter, v.verse)] = {
        text: v.text,
        at,
      };
    const keys = Object.entries(data[version]).sort(
      (a, b) => b[1].at - a[1].at,
    );
    data[version] = Object.fromEntries(keys.slice(0, ONLINE_LIMIT));
    this.write(data);
  }
  count(version: OnlineVersion) {
    return Object.keys(this.read()[version]).length;
  }
  clear(version: OnlineVersion) {
    const data = this.read();
    data[version] = {};
    this.write(data);
  }
}

type Fetched = { verse: number; text: string }[];
/** Strips API layout only (verse markers, indentation, blank lines); words are kept. */
const layoutOnly = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
function expectRange(found: Fetched, from: number, to: number, label: string) {
  const missing: number[] = [];
  for (let n = from; n <= to; n++)
    if (!found.some((v) => v.verse === n && v.text.trim())) missing.push(n);
  if (missing.length)
    throw new Error(
      `${label} tidak memuat ayat ${missing.join(", ")}. Pilih rentang lain atau pakai versi offline.`,
    );
  if (found.some((v) => v.verse < from || v.verse > to))
    throw new Error(`${label} mengirim ayat di luar rentang yang diminta.`);
  return found
    .filter((v, i) => found.findIndex((x) => x.verse === v.verse) === i)
    .sort((a, b) => a.verse - b.verse);
}
async function call(
  url: string,
  headers: Record<string, string>,
  label: string,
  fetcher: typeof fetch,
) {
  let response: Response;
  try {
    response = await fetcher(url, { headers, cache: "no-store" });
  } catch {
    throw new Error(`${label} tidak bisa dihubungi. Periksa koneksi internet.`);
  }
  if (response.status === 401 || response.status === 403)
    throw new Error(`${label}: API key ditolak (HTTP ${response.status}).`);
  if (response.status === 429)
    throw new Error(`${label}: terlalu banyak permintaan, coba lagi sebentar.`);
  if (!response.ok)
    throw new Error(`${label}: permintaan gagal (HTTP ${response.status}).`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}: jawaban bukan JSON.`);
  }
}

/** ESV API passage text, asked for by numeric verse IDs (BBCCCVVV). */
export function esvUrl(
  order: number,
  chapter: number,
  from: number,
  to: number,
) {
  const id = (v: number) =>
    `${String(order).padStart(2, "0")}${String(chapter).padStart(3, "0")}${String(v).padStart(3, "0")}`;
  const params = new URLSearchParams({
    q: `${id(from)}-${id(to)}`,
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-copyright": "false",
    "include-passage-horizontal-lines": "false",
    "include-heading-horizontal-lines": "false",
    "include-selahs": "true",
    "indent-paragraphs": "0",
    "indent-poetry": "false",
    "indent-poetry-lines": "0",
    "indent-declares": "0",
    "indent-psalm-doxology": "0",
    "line-length": "0",
  });
  return `${ESV_URL}?${params}`;
}
export async function fetchEsv(
  key: string,
  order: number,
  chapter: number,
  from: number,
  to: number,
  fetcher: typeof fetch = fetch,
): Promise<Fetched> {
  const json = await call(
    esvUrl(order, chapter, from, to),
    { Authorization: `Token ${key}` },
    "ESV API",
    fetcher,
  );
  if (
    !json ||
    !Array.isArray(json.passages) ||
    json.passages.length !== 1 ||
    typeof json.passages[0] !== "string"
  )
    throw new Error("ESV API: format jawaban tidak dikenali.");
  const parts = (json.passages[0] as string)
    .replace(/\s*\(ESV\)\s*$/, "")
    .split(/\[(?:\d+:)?(\d+)\]/);
  const found: Fetched = [];
  for (let i = 1; i < parts.length; i += 2)
    found.push({
      verse: Number(parts[i]),
      text: layoutOnly(parts[i + 1] ?? ""),
    });
  return expectRange(found, from, to, "ESV");
}

/** LAI's URL book name: "Kejadian" -> "kejadian", "1 Raja-raja" -> "1-raja-raja". */
export const laiBook = (name: string) =>
  name.toLocaleLowerCase("id").trim().replace(/\s+/g, "-");
export function laiUrl(
  settings: NonNullable<OnlineSettings["tb2"]>,
  bookName: string,
  chapter: number,
  from: number,
  to: number,
) {
  return `${settings.base.replace(/\/+$/, "")}/bible/${encodeURIComponent(settings.version)}/${encodeURIComponent(laiBook(bookName))}/${chapter}/${from === to ? from : `${from}-${to}`}`;
}
const NUMBER_FIELDS = [
    "verse",
    "number",
    "ayat",
    "verse_number",
    "verseNumber",
  ],
  TEXT_FIELDS = ["text", "content", "isi", "firman"];
function verseOf(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>,
    n = NUMBER_FIELDS.map((k) => v[k]).find(
      (x) =>
        typeof x === "number" || (typeof x === "string" && /^\d+$/.test(x)),
    ),
    t = TEXT_FIELDS.map((k) => v[k]).find(
      (x) => typeof x === "string" && x.trim(),
    );
  return n !== undefined && typeof t === "string"
    ? { verse: Number(n), text: layoutOnly(t) }
    : null;
}
/** Accepts the response shapes LAI's example implies; anything else is refused. */
export function laiVerses(json: unknown): Fetched {
  const j = json as Record<string, any> | null,
    candidates = [
      j?.data?.verses,
      j?.verses,
      Array.isArray(j?.data) ? j?.data : undefined,
      j?.data?.data,
      j?.data?.verse ? [j.data.verse] : undefined,
      j?.verse ? [j.verse] : undefined,
    ];
  for (const list of candidates)
    if (Array.isArray(list) && list.length) {
      const verses = list.map(verseOf);
      if (verses.every(Boolean)) return verses as Fetched;
    }
  throw new Error(
    `Bible API LAI: format jawaban belum dikenali (kunci: ${Object.keys(j ?? {}).join(", ") || "-"}). Kirim contoh jawaban ke pengembang.`,
  );
}
export async function fetchLai(
  settings: NonNullable<OnlineSettings["tb2"]>,
  bookName: string,
  chapter: number,
  from: number,
  to: number,
  fetcher: typeof fetch = fetch,
): Promise<Fetched> {
  const json = await call(
    laiUrl(settings, bookName, chapter, from, to),
    { Authorization: `Bearer ${settings.key}`, Accept: "application/json" },
    "Bible API LAI",
    fetcher,
  );
  return expectRange(laiVerses(json), from, to, "TB2");
}

export type Passage = {
  book: { id: string; order: number; idName: string; enName: string };
  chapter: number;
  from: number;
  to: number;
};
/** Fetches the passage for every online column that does not have it cached yet. */
export async function ensureOnline(
  settings: OnlineSettings,
  passage: Passage,
  cache = new OnlineCache(),
  fetcher: typeof fetch = fetch,
) {
  const { book, chapter, from, to } = passage;
  const missing = (version: OnlineVersion) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i).some(
      (n) => cache.get(version, book.id, chapter, n) === undefined,
    );
  if (settings.left === "tb2" && settings.tb2?.agreed && missing("tb2"))
    cache.put(
      "tb2",
      (
        await fetchLai(settings.tb2, book.idName, chapter, from, to, fetcher)
      ).map((v) => ({ ...v, book: book.id, chapter })),
    );
  if (settings.right === "esv" && settings.esv?.agreed && missing("esv"))
    cache.put(
      "esv",
      (
        await fetchEsv(settings.esv.key, book.order, chapter, from, to, fetcher)
      ).map((v) => ({ ...v, book: book.id, chapter })),
    );
}

const INFO = {
  tb2: {
    publisher: "Lembaga Alkitab Indonesia",
    code: "TB2",
    name: "Alkitab Terjemahan Baru Edisi Kedua",
    abbreviation: "TB2",
    edition: "2023",
    language: "id",
    source: "Bible API LAI (bible-api.alkitab.or.id), API key gereja",
    license: {
      kind: "permission" as const,
      notice:
        "Alkitab Terjemahan Baru Edisi Kedua © Lembaga Alkitab Indonesia 2023. Diambil lewat Bible API LAI dengan API key gereja sesuai perjanjian lisensi LAI. Hanya ayat yang dipilih yang disimpan di perangkat ini.",
      reference: "Lembaga Alkitab Indonesia · bible-api.alkitab.or.id",
      displayAttribution: "TB2 © LAI 2023",
      permissions: {
        offlineStorage: true as const,
        projection: true as const,
        localSnapshots: true as const,
        export: false,
      },
    },
  },
  esv: {
    publisher: "Crossway",
    code: "ESV",
    name: "English Standard Version",
    abbreviation: "ESV",
    edition: "2016",
    language: "en",
    source: "ESV API (api.esv.org), API key gereja",
    license: {
      kind: "permission" as const,
      notice:
        "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
      reference: "www.esv.org",
      displayAttribution: "ESV® © Crossway · esv.org",
      permissions: {
        offlineStorage: true as const,
        projection: true as const,
        localSnapshots: true as const,
        export: false,
      },
    },
  },
};
export const ONLINE_ATTRIBUTION = {
  tb2: INFO.tb2.license.displayAttribution,
  esv: INFO.esv.license.displayAttribution,
  esvNotice: INFO.esv.license.notice,
};
/** Rebuilds a column from cached online text, or null if any verse is missing. */
async function overlay(
  version: OnlineVersion,
  base: Translation,
  verses: Verse[],
  cache: OnlineCache,
): Promise<{ translation: Translation; verses: Verse[] } | null> {
  const texts = verses.map((v) =>
    cache.get(version, v.book, v.chapter, v.verse),
  );
  if (texts.some((t) => t === undefined)) return null;
  const datasetId = `online:${version}`,
    rows: Verse[] = [];
  for (let i = 0; i < verses.length; i++) {
    const { book, chapter, verse, bookOrder } = verses[i],
      text = texts[i]!;
    rows.push({
      book,
      chapter,
      verse,
      text,
      bookOrder,
      datasetId,
      id: verseKey(datasetId, bookOrder, chapter, verse),
      textHash: await sha256(canonicalJSON({ book, chapter, verse, text })),
    });
  }
  const hash = await sha256(
    canonicalJSON(
      rows.map(({ book, chapter, verse, text }) => ({
        book,
        chapter,
        verse,
        text,
      })),
    ),
  );
  const time = new Date().toISOString();
  return {
    translation: {
      id: datasetId,
      format: 1,
      revision: 1,
      info: {
        ...INFO[version],
        versification: base.info.versification,
        coverage: "partial",
      },
      books: base.books,
      contentHash: hash,
      fileHash: hash,
      verseCount: rows.length,
      byteLength: 1,
      createdAt: time,
      attestedAt: time,
    },
    verses: rows,
  };
}
const isBible = (t: Translation, identity: typeof INDONESIAN.identity) =>
  editionKey(t.info) === editionKey(identity);
/**
 * Swaps the AYT (left) and KJV (right) columns of prepared Scripture for the
 * chosen online versions where their text is cached. Returns a note for
 * every passage that had to stay on the offline version.
 */
export async function applyOnline(
  data: Workspace,
  settings: OnlineSettings,
  cache = new OnlineCache(),
): Promise<{ data: Workspace; notes: string[] }> {
  if (!usesOnline(settings) || !data.scriptureSnapshots)
    return { data, notes: [] };
  const snapshots: Record<string, ScriptureSnapshot> = {},
    notes: string[] = [];
  for (const [key, snapshot] of Object.entries(data.scriptureSnapshots)) {
    let next = snapshot;
    const first = snapshot.verses[0],
      label = `${snapshot.translation.books.find((b) => b.id === first?.book)?.name ?? ""} ${first?.chapter}:${first?.verse}`;
    if (
      settings.left === "tb2" &&
      settings.tb2?.agreed &&
      isBible(snapshot.translation, INDONESIAN.identity)
    ) {
      const swapped = await overlay(
        "tb2",
        snapshot.translation,
        snapshot.verses,
        cache,
      );
      if (swapped) next = { ...next, ...swapped };
      else notes.push(`${label}: teks TB2 belum tersimpan, memakai AYT.`);
    }
    if (
      settings.right === "esv" &&
      settings.esv?.agreed &&
      next.parallel &&
      isBible(next.parallel.translation, ENGLISH.identity)
    ) {
      const swapped = await overlay(
        "esv",
        next.parallel.translation,
        next.parallel.verses,
        cache,
      );
      if (swapped) next = { ...next, parallel: swapped };
      else notes.push(`${label}: teks ESV belum tersimpan, memakai KJV.`);
    }
    snapshots[key] = next;
  }
  return { data: { ...data, scriptureSnapshots: snapshots }, notes };
}
