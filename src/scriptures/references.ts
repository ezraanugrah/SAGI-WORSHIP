import {
  aliasKey,
  verseKey,
  SELECTION_LIMIT,
  type Translation,
  type Verse,
} from "./models";
export function resolveReference(
  translation: Translation,
  input: string,
): string[] {
  const normalized = input.normalize("NFKC").trim();
  let book: Translation["books"][number] | undefined,
    rest = "";
  const candidates = translation.books
    .flatMap((b) =>
      [b.id, b.name, ...b.aliases].map((alias) => ({
        book: b,
        key: aliasKey(alias),
      })),
    )
    .sort((a, b) => b.key.length - a.key.length);
  const compact = aliasKey(normalized);
  for (const candidate of candidates)
    if (
      compact.startsWith(candidate.key) &&
      /^\d/.test(compact.slice(candidate.key.length))
    ) {
      book = candidate.book;
      rest = compact.slice(candidate.key.length);
      break;
    }
  if (!book)
    throw new Error(
      "Kitab tidak dikenali. Gunakan nama/alias dari dataset terpilih.",
    );
  const match = rest.match(
    /^(\d{1,3})(?::(\d{1,4})(?:-(?:(\d{1,3}):)?(\d{1,4}))?((?:,\d{1,4}(?:-\d{1,4})?)*))?$/,
  );
  if (!match)
    throw new Error("Referensi tidak valid. Contoh: John 3:16-18,20.");
  const chapter = Number(match[1]),
    start = match[2] ? Number(match[2]) : null,
    keys: string[] = [];
  const add = (c: number, v: number) => {
    const manifest = book!.chapters.find((x) => x.number === c);
    if (!manifest?.verses.includes(v))
      throw new Error(
        `Ayat ${c}:${v} tidak tersedia dalam dataset; tidak dilewati otomatis.`,
      );
    keys.push(verseKey(translation.id, book!.order, c, v));
    if (keys.length > SELECTION_LIMIT)
      throw new Error("Maksimal 500 ayat per pilihan.");
  };
  if (start === null) {
    const c = book.chapters.find((c) => c.number === chapter);
    if (!c) throw new Error("Pasal tidak tersedia.");
    for (const v of c.verses) add(chapter, v);
  } else {
    const endChapter = match[3] ? Number(match[3]) : chapter,
      endVerse = match[4] ? Number(match[4]) : start;
    if (endChapter < chapter || (endChapter === chapter && endVerse < start))
      throw new Error("Rentang ayat terbalik.");
    for (let c = chapter; c <= endChapter; c++) {
      const m = book.chapters.find((x) => x.number === c);
      if (!m) throw new Error("Pasal dalam rentang tidak tersedia.");
      const from = c === chapter ? start : m.verses[0],
        to = c === endChapter ? endVerse : m.verses.at(-1)!;
      for (let v = from; v <= to; v++) add(c, v);
    }
    if (match[5])
      for (const part of match[5].slice(1).split(",")) {
        const [a, b] = part.split("-").map(Number);
        if (b !== undefined && b < a) throw new Error("Rentang ayat terbalik.");
        for (let v = a; v <= (b ?? a); v++) add(chapter, v);
      }
  }
  return [...new Set(keys)].sort();
}
export const searchNormalize = (text: string) =>
  text.normalize("NFKC").toLocaleLowerCase("und").replace(/\s+/gu, " ").trim();
export function searchVerses(verses: Verse[], query: string, offset = 0) {
  const q = searchNormalize(query),
    matches = q
      ? verses.filter((v) => searchNormalize(v.text).includes(q))
      : [];
  return {
    total: matches.length,
    results: matches.slice(offset, offset + 100),
  };
}
