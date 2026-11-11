import { openDatabase } from "../db";
import { WriterGate } from "./writer";
import { assembleSong } from "./repository";
import {
  validItem,
  validSchedule,
  validScriptureSelection,
  validSong,
  type Workspace,
  type ScriptureScheduleItem,
} from "../domain/models";
import {
  verifyDataset,
  canonicalJSON,
  sha256,
  validTranslation,
  validVerse,
} from "../scriptures/importFormat";
import {
  datasetRange,
  chapterRange,
  editionKey,
  verseKey,
  reference,
  type Translation,
  type Verse,
  type PreparedDataset,
  type ScriptureSelection,
  type ScriptureSnapshot,
} from "../scriptures/models";
import { partnerKey, partnerOf } from "../scriptures/bilingual";
import type { IDBPTransaction } from "idb";
type Tx = IDBPTransaction<unknown, string[], "readwrite">;
export function notifyScriptures() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("sagi-library-changed"));
  try {
    const channel = new BroadcastChannel("sagi-library-changes");
    channel.postMessage("changed");
    channel.close();
  } catch {
    /* reload/focus fallback */
  }
}
function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Impor dibatalkan.");
}
export function selectionLabel(t: Translation, verses: Verse[]) {
  return `${reference(t, verses[0])}${verses.length > 1 ? ` (+${verses.length - 1} ayat)` : ""}`;
}
export async function checkVerses(
  t: Translation,
  rows: unknown[],
): Promise<Verse[]> {
  const verses: Verse[] = [];
  for (let start = 0; start < rows.length; start += 512)
    await Promise.all(
      rows.slice(start, start + 512).map(async (row) => {
        if (!validVerse(row) || row.datasetId !== t.id)
          throw new Error(
            "Data ayat rusak/tidak tersedia; tidak dilewati otomatis.",
          );
        const book = t.books.find((b) => b.id === row.book);
        if (
          !book ||
          book.order !== row.bookOrder ||
          row.id !== verseKey(t.id, book.order, row.chapter, row.verse) ||
          !book.chapters
            .find((c) => c.number === row.chapter)
            ?.verses.includes(row.verse)
        )
          throw new Error("Referensi ayat rusak; data dipertahankan.");
        const { book: b, chapter, verse, text } = row;
        if (
          (await sha256(canonicalJSON({ book: b, chapter, verse, text }))) !==
          row.textHash
        )
          throw new Error("Integritas teks ayat gagal; data dipertahankan.");
      }),
    );
  for (const row of rows) verses.push(row as Verse);
  return verses;
}
export class ScriptureRepository {
  constructor(
    private gate: WriterGate,
    private name = "sagi-worship",
  ) {}
  private async write<T>(
    stores: string[],
    fn: (tx: Tx) => Promise<T>,
    signal?: AbortSignal,
    ticket = this.gate.ticket(),
  ) {
    this.gate.assert(ticket);
    cancelled(signal);
    const db = await openDatabase(this.name);
    let tx: Tx | undefined;
    const abort = () => {
      try {
        tx?.abort();
      } catch {
        /* finished */
      }
    };
    try {
      this.gate.assert(ticket);
      cancelled(signal);
      tx = db.transaction(stores, "readwrite");
      this.gate.track(tx, ticket);
      signal?.addEventListener("abort", abort, { once: true });
      const result = await fn(tx);
      this.gate.assert(ticket);
      cancelled(signal);
      await tx.done;
      notifyScriptures();
      return result;
    } catch (e) {
      abort();
      await tx?.done.catch(() => {});
      throw e;
    } finally {
      signal?.removeEventListener("abort", abort);
      db.close();
    }
  }
  async list() {
    const db = await openDatabase(this.name);
    try {
      const rows = await db.getAll("scripture_translations");
      return {
        translations: rows.filter(validTranslation),
        issues: rows
          .filter((v) => !validTranslation(v))
          .map(
            (v) =>
              `Dataset ${String(v.id)} rusak/tidak didukung; data dipertahankan.`,
          ),
      };
    } finally {
      db.close();
    }
  }
  async importDataset(
    prepared: PreparedDataset,
    attested: boolean,
    options: {
      signal?: AbortSignal;
      progress?: (count: number, total: number) => void;
    } = {},
  ) {
    const ticket = this.gate.ticket();
    cancelled(options.signal);
    if (attested !== true) throw new Error("Konfirmasi hak penggunaan wajib.");
    const value = structuredClone(prepared);
    const dataset = await verifyDataset(value.dataset);
    if (
      !/^[0-9a-f]{64}$/.test(value.fileHash) ||
      !Number.isSafeInteger(value.byteLength) ||
      value.byteLength < 1 ||
      value.byteLength > 32 * 1024 * 1024
    )
      throw new Error("Metadata file tidak valid.");
    const id = `scripture:${crypto.randomUUID()}`,
      time = new Date().toISOString(),
      translation: Translation = {
        id,
        format: 1,
        revision: 1,
        info: dataset.translation,
        books: dataset.books,
        contentHash: dataset.integrity.contentHash,
        fileHash: value.fileHash,
        byteLength: value.byteLength,
        verseCount: dataset.verses.length,
        createdAt: time,
        attestedAt: time,
      };
    const rows: Verse[] = [];
    for (let offset = 0; offset < dataset.verses.length; offset += 512) {
      this.gate.assert(ticket);
      cancelled(options.signal);
      const chunk = await Promise.all(
        dataset.verses.slice(offset, offset + 512).map(async (v) => {
          const book = dataset.books.find((b) => b.id === v.book)!;
          return {
            ...v,
            id: verseKey(id, book.order, v.chapter, v.verse),
            datasetId: id,
            bookOrder: book.order,
            textHash: await sha256(canonicalJSON(v)),
          };
        }),
      );
      rows.push(...chunk);
    }
    this.gate.assert(ticket);
    cancelled(options.signal);
    return this.write(
      ["scripture_translations", "scripture_verses"],
      async (tx) => {
        const store = tx.objectStore("scripture_translations"),
          existing = await store.getAll();
        for (const row of existing) {
          if (!validTranslation(row)) continue;
          if (editionKey(row.info) === editionKey(translation.info)) {
            if (row.contentHash === translation.contentHash)
              throw new Error(
                "Dataset identik sudah tersedia. Tidak ada data ditimpa.",
              );
            throw new Error(
              "Konflik identitas edisi. Gunakan edisi berbeda yang sah; tidak ada penggantian otomatis.",
            );
          }
        }
        await store.add(translation);
        for (let offset = 0; offset < rows.length; offset += 512) {
          this.gate.assert(ticket);
          cancelled(options.signal);
          await Promise.all(
            rows
              .slice(offset, offset + 512)
              .map(async (row) => tx.objectStore("scripture_verses").add(row)),
          );
          options.progress?.(Math.min(offset + 512, rows.length), rows.length);
        }
        return translation;
      },
      options.signal,
      ticket,
    );
  }
  async chapter(datasetId: string, bookId: string, chapter: number) {
    const db = await openDatabase(this.name);
    let t: Translation, rows: unknown[];
    try {
      const tx = db.transaction(
        ["scripture_translations", "scripture_verses"],
        "readonly",
      );
      const row = await tx.objectStore("scripture_translations").get(datasetId);
      if (!validTranslation(row))
        throw new Error("Dataset tidak tersedia/rusak.");
      t = row;
      const book = t.books.find((b) => b.id === bookId),
        manifest = book?.chapters.find((c) => c.number === chapter);
      if (!book || !manifest) throw new Error("Pasal tidak tersedia.");
      rows = await tx
        .objectStore("scripture_verses")
        .getAll(chapterRange(datasetId, book.order, chapter));
      await tx.done;
      if (rows.length !== manifest.verses.length)
        throw new Error("Pasal tidak lengkap; ayat tidak dilewati otomatis.");
    } finally {
      db.close();
    }
    return checkVerses(t!, rows!);
  }
  async batch(t: Translation, after: string | null = null, count = 512) {
    const db = await openDatabase(this.name);
    try {
      const range = after
        ? IDBKeyRange.bound(after, `v|${t.id}|\uffff`, true, false)
        : datasetRange(t.id);
      const rows = await db.getAll("scripture_verses", range, count);
      return checkVerses(t, rows);
    } finally {
      db.close();
    }
  }
  private async snapshotIn(
    tx: IDBPTransaction<unknown, string[], "readonly" | "readwrite">,
    selection: ScriptureSelection,
    translations?: Translation[],
  ): Promise<ScriptureSnapshot> {
    if (!validScriptureSelection(selection))
      throw new Error("Pilihan ayat tidak valid.");
    const t = await tx
      .objectStore("scripture_translations")
      .get(selection.datasetId);
    if (!validTranslation(t) || t.contentHash !== selection.checksum)
      throw new Error("Sumber Scripture berubah/hilang.");
    const verses = await Promise.all(
      selection.verseIds.map((key) =>
        tx.objectStore("scripture_verses").get(key),
      ),
    );
    if (verses.some((v) => !validVerse(v)))
      throw new Error("Pilihan mengandung ayat hilang/rusak.");
    const snapshot: ScriptureSnapshot = {
      translation: t,
      verses: verses as Verse[],
    };
    // Two-language Bible: attach the same verses from the English partner
    // when it is installed and has every one of them.
    const partner = translations && partnerOf(t, translations);
    if (partner) {
      const rows = await Promise.all(
        selection.verseIds.map((key) =>
          tx.objectStore("scripture_verses").get(partnerKey(key, partner.id)),
        ),
      );
      if (rows.every((v) => validVerse(v) && v.datasetId === partner.id))
        snapshot.parallel = { translation: partner, verses: rows as Verse[] };
    }
    return snapshot;
  }
  async resolve(selection: ScriptureSelection) {
    const db = await openDatabase(this.name);
    let result: ScriptureSnapshot;
    try {
      const tx = db.transaction(
        ["scripture_translations", "scripture_verses"],
        "readonly",
      );
      result = await this.snapshotIn(tx, selection);
      await tx.done;
    } finally {
      db.close();
    }
    await checkVerses(result!.translation, result!.verses);
    return result!;
  }
  async addToSchedule(
    scheduleId: string,
    selection: ScriptureSelection,
    revision: number,
  ) {
    const ticket = this.gate.ticket(),
      snapshot = await this.resolve(selection);
    this.gate.assert(ticket);
    const canonical = {
      ...structuredClone(selection),
      label: selectionLabel(snapshot.translation, snapshot.verses),
    };
    return this.write(
      [
        "schedules",
        "schedule_items",
        "scripture_translations",
        "scripture_verses",
      ],
      async (tx) => {
        const schedule = await tx.objectStore("schedules").get(scheduleId);
        if (
          !validSchedule(schedule) ||
          schedule.revision !== revision ||
          schedule.itemIds.length >= 5000
        )
          throw new Error("Konflik revisi jadwal/batas item.");
        const current = await this.snapshotIn(tx, canonical);
        if (
          current.verses.some(
            (v, i) =>
              v.text !== snapshot.verses[i].text ||
              v.textHash !== snapshot.verses[i].textHash,
          )
        )
          throw new Error(
            "Ayat berubah selama validasi; penambahan dibatalkan.",
          );
        const time = new Date().toISOString(),
          item: ScriptureScheduleItem = {
            id: crypto.randomUUID(),
            type: "scripture",
            scheduleId,
            selection: canonical,
            createdAt: time,
            updatedAt: time,
          };
        await tx.objectStore("schedule_items").add(item);
        await tx.objectStore("schedules").put({
          ...schedule,
          itemIds: [...schedule.itemIds, item.id],
          revision: revision + 1,
          updatedAt: time,
        });
        return item;
      },
      undefined,
      ticket,
    );
  }
  async deleteDataset(datasetId: string, checksum: string) {
    return this.write(
      [
        "scripture_translations",
        "scripture_verses",
        "schedules",
        "schedule_items",
      ],
      async (tx) => {
        const t = await tx.objectStore("scripture_translations").get(datasetId);
        if (!validTranslation(t) || t.contentHash !== checksum)
          throw new Error("Dataset berubah/rusak; penghapusan dibatalkan.");
        const all = await tx.objectStore("schedule_items").getAll(),
          affected = all.filter(
            (i) =>
              i.type === "scripture" && i.selection?.datasetId === datasetId,
          );
        if (affected.some((i) => !validItem(i)))
          throw new Error("Referensi jadwal rusak.");
        for (const scheduleId of new Set(affected.map((i) => i.scheduleId))) {
          const s = await tx.objectStore("schedules").get(scheduleId);
          if (
            !validSchedule(s) ||
            s.itemIds.some(
              (key) =>
                !all.some(
                  (i) => i.id === key && i.scheduleId === s.id && validItem(i),
                ),
            )
          )
            throw new Error("Jadwal rusak; penghapusan dibatalkan.");
          await tx.objectStore("schedules").put({
            ...s,
            itemIds: s.itemIds.filter(
              (key) => !affected.some((i) => i.id === key),
            ),
            revision: s.revision + 1,
            updatedAt: new Date().toISOString(),
          });
        }
        for (const item of affected)
          await tx.objectStore("schedule_items").delete(item.id);
        await tx
          .objectStore("scripture_verses")
          .delete(datasetRange(datasetId));
        await tx.objectStore("scripture_translations").delete(datasetId);
      },
    );
  }
  async resolveWorkspace(
    base: Workspace,
    selection: {
      kind: string;
      scheduleId?: string;
      selection?: ScriptureSelection;
    },
  ) {
    const db = await openDatabase(this.name);
    let result: Workspace;
    try {
      const tx = db.transaction(
        [
          "songs",
          "song_sections",
          "schedules",
          "schedule_items",
          "scripture_translations",
          "scripture_verses",
        ],
        "readonly",
      );
      const [songs, sections, schedules, items, translations] =
        await Promise.all(
          [
            "songs",
            "song_sections",
            "schedules",
            "schedule_items",
            "scripture_translations",
          ].map((store) => tx.objectStore(store).getAll()),
        );
      result = {
        ...structuredClone(base),
        songs: songs
          .map((row) => assembleSong(row, sections))
          .filter(validSong),
        schedules: schedules.filter(validSchedule),
        items: items.filter(validItem),
        translations: translations.filter(validTranslation),
        scriptureSnapshots: {},
      };
      const selections: [string, ScriptureSelection][] = [];
      if (selection.kind === "scripture" && selection.selection)
        selections.push(["standalone", selection.selection]);
      if (selection.kind === "schedule") {
        const s = result.schedules.find((s) => s.id === selection.scheduleId);
        if (!s) throw new Error("Jadwal tidak tersedia.");
        for (const key of s.itemIds) {
          const item = result.items.find((i) => i.id === key);
          if (item?.type === "scripture")
            selections.push([key, item.selection]);
        }
      }
      for (const [key, chosen] of selections)
        result.scriptureSnapshots![key] = await this.snapshotIn(
          tx,
          chosen,
          result.translations,
        );
      await tx.done;
    } finally {
      db.close();
    }
    for (const snapshot of Object.values(result!.scriptureSnapshots!)) {
      await checkVerses(snapshot.translation, snapshot.verses);
      if (snapshot.parallel)
        await checkVerses(
          snapshot.parallel.translation,
          snapshot.parallel.verses,
        );
    }
    return result!;
  }
}
