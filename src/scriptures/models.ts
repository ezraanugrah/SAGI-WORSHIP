export const FILE_LIMIT = 32 * 1024 * 1024,
  VERSE_LIMIT = 100000,
  SELECTION_LIMIT = 500;
export type License = {
  kind: "public-domain" | "licensed" | "permission";
  notice: string;
  reference: string;
  displayAttribution: string;
  permissions: {
    offlineStorage: true;
    projection: true;
    localSnapshots: true;
    export: boolean;
  };
};
export type TranslationInfo = {
  publisher: string;
  code: string;
  name: string;
  abbreviation: string;
  edition: string;
  language: string;
  versification: string;
  coverage: "complete" | "partial";
  source: string;
  license: License;
};
export type Book = {
  id: string;
  name: string;
  aliases: string[];
  order: number;
  chapters: { number: number; verses: number[] }[];
};
export type InputVerse = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
};
export type Dataset = {
  format: "sagi-scripture";
  version: 1;
  translation: TranslationInfo;
  books: Book[];
  verses: InputVerse[];
  integrity: { algorithm: "SHA-256"; contentHash: string };
};
export type PreparedDataset = {
  dataset: Dataset;
  fileHash: string;
  byteLength: number;
};
export type Translation = {
  id: string;
  format: 1;
  revision: 1;
  info: TranslationInfo;
  books: Book[];
  contentHash: string;
  fileHash: string;
  verseCount: number;
  byteLength: number;
  createdAt: string;
  attestedAt: string;
};
export type Verse = InputVerse & {
  id: string;
  datasetId: string;
  bookOrder: number;
  textHash: string;
};
export type ScriptureSelection = {
  datasetId: string;
  checksum: string;
  verseIds: string[];
  label: string;
};
export type ScriptureSnapshot = { translation: Translation; verses: Verse[] };
export const aliasKey = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/\./g, "")
    .replace(/\s+/gu, "")
    .trim();
export const verseKey = (
  datasetId: string,
  bookOrder: number,
  chapter: number,
  verse: number,
) =>
  `v|${datasetId}|${String(bookOrder).padStart(3, "0")}|${String(chapter).padStart(3, "0")}|${String(verse).padStart(4, "0")}`;
export const datasetRange = (datasetId: string) =>
  IDBKeyRange.bound(`v|${datasetId}|`, `v|${datasetId}|\uffff`);
export const chapterRange = (
  datasetId: string,
  order: number,
  chapter: number,
) => {
  const prefix = `v|${datasetId}|${String(order).padStart(3, "0")}|${String(chapter).padStart(3, "0")}|`;
  return IDBKeyRange.bound(prefix, `${prefix}\uffff`);
};
export const editionKey = (
  info: Pick<
    TranslationInfo,
    "publisher" | "code" | "edition" | "language" | "versification"
  >,
) =>
  JSON.stringify([
    info.publisher,
    info.code,
    info.edition,
    info.language,
    info.versification,
  ]);
export const reference = (
  t: Translation,
  v: Pick<Verse, "book" | "chapter" | "verse">,
) =>
  `${t.books.find((b) => b.id === v.book)?.name ?? v.book} ${v.chapter}:${v.verse}`;
