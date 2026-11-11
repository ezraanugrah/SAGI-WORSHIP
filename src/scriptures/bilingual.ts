import { editionKey, type Translation, type TranslationInfo } from "./models";
/**
 * The bundled two-language Bible: Alkitab Yang Terbuka (Indonesian, left)
 * paired with the King James Version (English, right). Both files live in
 * public/scriptures and share book IDs and the verse manifest, so a verse in
 * one has exactly one partner in the other (same book, chapter and verse).
 */
type Identity = Pick<
  TranslationInfo,
  "publisher" | "code" | "edition" | "language" | "versification"
>;
export type BundledBible = {
  key: "ayt" | "kjv";
  file: string;
  label: string;
  language: string;
  identity: Identity;
};
export const INDONESIAN: BundledBible = {
  key: "ayt",
  file: "/scriptures/ayt.json",
  label: "Alkitab Yang Terbuka (AYT)",
  language: "Indonesia",
  identity: {
    publisher: "Yayasan Lembaga SABDA (YLSA)",
    code: "AYT",
    edition: "2024",
    language: "id",
    versification: "KJV",
  },
};
export const ENGLISH: BundledBible = {
  key: "kjv",
  file: "/scriptures/kjv.json",
  label: "King James Version (KJV)",
  language: "English",
  identity: {
    publisher: "Public Domain",
    code: "KJV",
    edition: "1769",
    language: "en",
    versification: "KJV",
  },
};
export const BUNDLED_BIBLES = [INDONESIAN, ENGLISH];
export const findBible = (bible: BundledBible, translations: Translation[]) =>
  translations.find((t) => editionKey(t.info) === editionKey(bible.identity));
/** The English partner of an Indonesian translation, if both are installed. */
export function partnerOf(
  translation: Translation,
  translations: Translation[],
): Translation | undefined {
  if (editionKey(translation.info) !== editionKey(INDONESIAN.identity))
    return undefined;
  return findBible(ENGLISH, translations);
}
/** Same book, chapter and verse in the partner dataset. */
export const partnerKey = (verseId: string, partnerId: string) =>
  verseId.replace(/^v\|.+(\|\d{3}\|\d{3}\|\d{4})$/, `v|${partnerId}$1`);
/** Downloads a bundled file as a File for ImportCoordinator.choose. */
export async function downloadBible(
  bible: BundledBible,
  fetcher: typeof fetch = fetch,
): Promise<File> {
  let response: Response;
  try {
    response = await fetcher(bible.file, { cache: "no-cache" });
  } catch {
    throw new Error(
      `Tidak bisa mengunduh ${bible.label}. Periksa koneksi internet; cukup sekali, setelah itu tersimpan offline.`,
    );
  }
  if (!response.ok)
    throw new Error(
      `Gagal mengunduh ${bible.label} (HTTP ${response.status}). Coba lagi.`,
    );
  return new File([await response.blob()], `${bible.key}.json`, {
    type: "application/json",
  });
}
