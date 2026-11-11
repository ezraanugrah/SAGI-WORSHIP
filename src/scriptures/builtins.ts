import { editionKey, type Translation, type TranslationInfo } from "./models";
/**
 * Bibles listed under "Alkitab bawaan". One with a `file` ships with the app
 * as a static SAGI Scripture v1 file in public/scriptures (built by
 * scripts/scripture/build-datasets.mjs); installing it downloads the file once
 * and runs it through the normal import (validation, license review,
 * attestation), so it is then stored offline like any other dataset.
 * One without a `file` is waiting for the rights holder's permission; it shows
 * as installed once a licensed file with the same edition is imported.
 */
export type BuiltinBible = {
  key: "tb2" | "kjv";
  file?: string;
  short: string;
  label: string;
  language: string;
  /** Shown instead of the install button while there is no file. */
  pending?: string;
  identity: Pick<
    TranslationInfo,
    "publisher" | "code" | "edition" | "language" | "versification"
  >;
};
export const BUILTIN_BIBLES: BuiltinBible[] = [
  {
    key: "tb2",
    short: "TB2",
    label: "Alkitab Terjemahan Baru Edisi Kedua",
    language: "Bahasa Indonesia · LAI 2023",
    pending: "Perlu izin LAI",
    identity: {
      publisher: "Lembaga Alkitab Indonesia",
      code: "TB2",
      edition: "2023",
      language: "id",
      versification: "LAI TB",
    },
  },
  {
    key: "kjv",
    file: "/scriptures/kjv.json",
    short: "KJV",
    label: "King James Version",
    language: "English · Public Domain",
    identity: {
      publisher: "Public Domain",
      code: "KJV",
      edition: "1769",
      language: "en",
      versification: "KJV",
    },
  },
];
export const installedBuiltin = (
  bible: BuiltinBible,
  translations: Translation[],
) =>
  translations.find(
    (t) => editionKey(t.info) === editionKey(bible.identity),
  );
/** Downloads the bundled file and hands it back as a File for ImportCoordinator.choose. */
export async function downloadBuiltin(
  bible: BuiltinBible,
  fetcher: typeof fetch = fetch,
): Promise<File> {
  if (!bible.file)
    throw new Error(`${bible.short} belum tersedia: ${bible.pending ?? ""}.`);
  let response: Response;
  try {
    response = await fetcher(bible.file, { cache: "no-cache" });
  } catch {
    throw new Error(
      `Tidak bisa mengunduh ${bible.short}. Periksa koneksi internet; cukup sekali, setelah itu Alkitab tersimpan offline.`,
    );
  }
  if (!response.ok)
    throw new Error(
      `Gagal mengunduh ${bible.short} (HTTP ${response.status}). Coba lagi.`,
    );
  return new File([await response.blob()], `${bible.key}.json`, {
    type: "application/json",
  });
}
