import { validAsset } from "../media/models";
import { metadataRange } from "./mediaRepository";
import { validTranslation } from "../scriptures/importFormat";
import { type IDBPTransaction } from "idb";
import { openDatabase, validatePreferences, type Preferences } from "../db";
import {
  id,
  now,
  requireSong,
  validDraft,
  validItem,
  validName,
  validSchedule,
  validSong,
  type MediaScheduleItem,
  type Schedule,
  type ScheduleItem,
  type ScriptureScheduleItem,
  type Song,
  type SongScheduleItem,
  type SongDraft,
  type SongInput,
  type SongSection,
  type Workspace,
} from "../domain/models";
import { WriterGate } from "./writer";
import { weekName, weekSchedules } from "../domain/weeks";
type Tx = IDBPTransaction<unknown, string[], "readwrite">;
const writeStores = [
  "songs",
  "song_sections",
  "schedules",
  "schedule_items",
  "settings",
];
const draftKey = (songId: string) => `phase2:draft:song:${songId}`;
const tombstone = (songId: string) => `phase2:deleted:song:${songId}`;
export function assembleSong(
  row: { id: string; sectionIds?: unknown },
  allSections: SongSection[],
) {
  const sections = allSections.filter((section) => section.songId === row.id);
  if (row.sectionIds === undefined) return { ...row, sections };
  if (
    !Array.isArray(row.sectionIds) ||
    row.sectionIds.length !== sections.length ||
    new Set(row.sectionIds).size !== row.sectionIds.length ||
    row.sectionIds.some(
      (key) => !sections.some((section) => section.id === key),
    )
  )
    return null;
  return {
    ...row,
    sections: row.sectionIds.map((key) =>
      sections.find((section) => section.id === key)!,
    ),
  };
}

function conflict() {
  return new Error(
    "Konflik revisi atau data berubah. Muat ulang data; draft tidak ditimpa.",
  );
}
function checkRevision(
  row: { revision: number } | undefined,
  expected: number,
) {
  if (!row || row.revision !== expected) throw conflict();
}
export class Repository {
  constructor(
    private gate: WriterGate,
    private name = "sagi-worship",
  ) {}
  private async write<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
    const ticket = this.gate.ticket();
    const db = await openDatabase(this.name);
    let tx: Tx | undefined;
    try {
      this.gate.assert(ticket);
      tx = db.transaction(writeStores, "readwrite");
      this.gate.track(tx, ticket);
      const result = await operation(tx);
      this.gate.assert(ticket);
      await tx.done;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("sagi-library-changed"));
        if (typeof BroadcastChannel !== "undefined") {
          try {
            const channel = new BroadcastChannel("sagi-library-changes");
            channel.postMessage("changed");
            channel.close();
          } catch {
            /* A committed write remains successful; readers reload on focus. */
          }
        }
      }
      return result;
    } catch (e) {
      if (tx) {
        try {
          tx.abort();
        } catch {
          /* completed */
        }
        await tx.done.catch(() => {});
      }
      throw e;
    } finally {
      db.close();
    }
  }
  async load(): Promise<Workspace> {
    const db = await openDatabase(this.name);
    try {
      const tx = db.transaction(
        [...writeStores, "scripture_translations", "media_assets"],
        "readonly",
      );
      const [songRows, sections, scheduleRows, itemRows, settings] =
        await Promise.all(
          writeStores.map((store) => tx.objectStore(store).getAll()),
        );
      const translationRows = await tx
        .objectStore("scripture_translations")
        .getAll();
      const mediaRows = await tx
        .objectStore("media_assets")
        .getAll(metadataRange());
      await tx.done;
      const issues: string[] = [];
      const mediaAssets = mediaRows.filter(validAsset);
      if (mediaAssets.length !== mediaRows.length)
        issues.push("Metadata media rusak; data dipertahankan.");
      const translations = translationRows.filter((row) => {
        if (validTranslation(row)) return true;
        issues.push(
          `Dataset ${String(row.id)} rusak/tidak didukung; dipertahankan.`,
        );
        return false;
      });
      const songs: Song[] = [];
      for (const row of songRows) {
        const song = assembleSong(row, sections);
        if (validSong(song)) songs.push(song);
        else
          issues.push(
            `Lagu ${String(row.id)} rusak/tidak didukung; data asli dipertahankan.`,
          );
      }
      const items: ScheduleItem[] = itemRows.filter((row) => {
        if (validItem(row)) return true;
        issues.push(`Item ${String(row.id)} rusak; data asli dipertahankan.`);
        return false;
      });
      const schedules: Schedule[] = scheduleRows.filter((row) => {
        if (validSchedule(row)) return true;
        issues.push(`Jadwal ${String(row.id)} rusak; data asli dipertahankan.`);
        return false;
      });
      for (const s of schedules)
        if (
          s.itemIds.some(
            (itemId) =>
              !items.some((i) => i.id === itemId && i.scheduleId === s.id),
          )
        )
          issues.push(
            `Jadwal ${s.name} memiliki referensi item rusak. Perubahan jadwal diblokir sampai data diperiksa.`,
          );
      for (const item of items)
        if (
          !schedules.some(
            (s) => s.id === item.scheduleId && s.itemIds.includes(item.id),
          )
        )
          issues.push(
            `Item ${item.id} tanpa relasi jadwal yang valid dipertahankan.`,
          );
      for (const item of items)
        if (item.type === "song" && !songs.some((s) => s.id === item.songId))
          issues.push(
            `Sumber lagu untuk item ${item.id} tidak tersedia. Referensi dipertahankan.`,
          );
      for (const section of sections)
        if (!songRows.some((s) => s.id === section.songId))
          issues.push(
            `Bagian ${String(section.id)} tanpa sumber dipertahankan.`,
          );
      const drafts: SongDraft[] = [];
      for (const setting of settings)
        if (
          typeof setting.id === "string" &&
          setting.id.startsWith("phase2:draft:song:")
        ) {
          if (validDraft(setting)) drafts.push(setting);
          else issues.push(`Draft ${setting.id} rusak; data dipertahankan.`);
        }
      const active = settings.find((x) => x.id === "phase2:active-schedule");
      if (
        active &&
        active.value !== null &&
        !schedules.some((s) => s.id === active.value)
      )
        issues.push(
          "Referensi jadwal aktif tidak valid; pilih jadwal yang tersedia.",
        );
      return {
        songs: songs.sort((a, b) => a.title.localeCompare(b.title, "id")),
        schedules: schedules.sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
        items,
        activeId:
          active?.value && schedules.some((s) => s.id === active.value)
            ? active.value
            : null,
        drafts,
        translations,
        mediaAssets,
        issues,
      };
    } finally {
      db.close();
    }
  }
  private async song(tx: Tx, songId: string): Promise<Song | undefined> {
    const row = await tx.objectStore("songs").get(songId);
    if (!row) return undefined;
    const sections = (await tx.objectStore("song_sections").getAll()).filter(
      (x) => x.songId === songId,
    );
    const result = assembleSong(row, sections);
    if (!validSong(result))
      throw new Error(
        "Data lagu rusak; penulisan diblokir dan data dipertahankan.",
      );
    return result;
  }
  private async schedule(tx: Tx, scheduleId: string): Promise<Schedule> {
    const row = await tx.objectStore("schedules").get(scheduleId);
    if (!validSchedule(row)) throw conflict();
    const items = await tx.objectStore("schedule_items").getAll();
    if (
      row.itemIds.some(
        (itemId) =>
          !items.some(
            (i) =>
              i.id === itemId && i.scheduleId === scheduleId && validItem(i),
          ),
      ) ||
      items.some(
        (i) =>
          i.scheduleId === scheduleId &&
          (!validItem(i) || !row.itemIds.includes(i.id)),
      )
    )
      throw new Error(
        "Relasi jadwal rusak. Data dipertahankan; perubahan diblokir.",
      );
    return row;
  }
  private async putSong(tx: Tx, song: Song) {
    const { sections, ...row } = song;
    const all = await tx.objectStore("song_sections").getAll();
    for (const section of sections) {
      const existing = await tx.objectStore("song_sections").get(section.id);
      if (existing && existing.songId !== song.id)
        throw new Error("ID bagian sudah digunakan lagu lain.");
    }
    await tx
      .objectStore("songs")
      .put({ ...row, sectionIds: sections.map((section) => section.id) });
    for (const previous of all)
      if (previous.songId === song.id)
        await tx.objectStore("song_sections").delete(previous.id);
    for (const section of sections)
      await tx.objectStore("song_sections").put(section);
  }
  async createSong(
    songId: string,
    input: SongInput,
    sequence?: number,
  ): Promise<Song> {
    requireSong(input, songId);
    return this.write(async (tx) => {
      if (
        (await tx.objectStore("songs").get(songId)) ||
        (await tx.objectStore("settings").get(tombstone(songId)))
      )
        throw conflict();
      const draft = await tx.objectStore("settings").get(draftKey(songId));
      if (
        draft &&
        (!validDraft(draft) ||
          draft.baseRevision !== 0 ||
          (sequence !== undefined && draft.sequence !== sequence))
      )
        throw conflict();
      const time = now(),
        song = {
          ...input,
          id: songId,
          title: input.title.trim(),
          revision: 1,
          createdAt: time,
          updatedAt: time,
        };
      await this.putSong(tx, song);
      await tx.objectStore("settings").delete(draftKey(songId));
      return song;
    });
  }
  async updateSong(
    songId: string,
    input: SongInput,
    revision: number,
    sequence?: number,
  ): Promise<Song> {
    requireSong(input, songId);
    return this.write(async (tx) => {
      const previous = await this.song(tx, songId);
      checkRevision(previous, revision);
      const draft = await tx.objectStore("settings").get(draftKey(songId));
      if (
        draft &&
        (!validDraft(draft) ||
          draft.baseRevision !== revision ||
          (sequence !== undefined && draft.sequence !== sequence))
      )
        throw conflict();
      const song = {
        ...previous!,
        ...input,
        id: songId,
        title: input.title.trim(),
        revision: revision + 1,
        createdAt: previous!.createdAt,
        updatedAt: now(),
      };
      await this.putSong(tx, song);
      await tx.objectStore("settings").delete(draftKey(songId));
      return song;
    });
  }
  async duplicateSong(songId: string, revision: number) {
    return this.write(async (tx) => {
      const source = await this.song(tx, songId);
      checkRevision(source, revision);
      const newId = id(),
        map = new Map(source!.sections.map((s) => [s.id, id()])),
        time = now();
      const copy: Song = {
        ...source!,
        id: newId,
        title: `${source!.title.slice(0, 190)} (salinan)`,
        sections: source!.sections.map((s) => ({
          ...s,
          id: map.get(s.id)!,
          songId: newId,
        })),
        order: source!.order.map((key) => map.get(key)!),
        revision: 1,
        createdAt: time,
        updatedAt: time,
      };
      await this.putSong(tx, copy);
      return copy;
    });
  }
  async deleteSong(songId: string, revision: number) {
    return this.write(async (tx) => {
      const source = await this.song(tx, songId);
      checkRevision(source, revision);
      const items = await tx.objectStore("schedule_items").getAll();
      const affected = items.filter(
        (i) => i.type === "song" && i.songId === songId,
      );
      if (affected.some((i) => !validItem(i)))
        throw new Error("Referensi lagu rusak; penghapusan dibatalkan.");
      for (const scheduleId of new Set(affected.map((i) => i.scheduleId))) {
        const s = await this.schedule(tx, scheduleId);
        await tx.objectStore("schedules").put({
          ...s,
          itemIds: s.itemIds.filter((x) => !affected.some((i) => i.id === x)),
          revision: s.revision + 1,
          updatedAt: now(),
        });
      }
      for (const item of affected)
        await tx.objectStore("schedule_items").delete(item.id);
      for (const section of source!.sections)
        await tx.objectStore("song_sections").delete(section.id);
      await tx.objectStore("songs").delete(songId);
      await tx.objectStore("settings").delete(draftKey(songId));
      await tx
        .objectStore("settings")
        .put({ id: tombstone(songId), deletedAt: now() });
    });
  }
  /**
   * Sync: make the local song match the server's copy. Creates it when
   * missing (also over a local deletion, because the server's edit is newer)
   * or updates it in place; schedules that use it are left as they are.
   */
  async applyRemoteSong(songId: string, input: SongInput): Promise<Song> {
    requireSong(input, songId);
    return this.write(async (tx) => {
      const previous = await this.song(tx, songId),
        time = now(),
        song: Song = {
          ...input,
          id: songId,
          title: input.title.trim(),
          revision: (previous?.revision ?? 0) + 1,
          createdAt: previous?.createdAt ?? time,
          updatedAt: time,
        };
      await this.putSong(tx, song);
      await tx.objectStore("settings").delete(tombstone(songId));
      return song;
    });
  }
  /** Sync: the song was deleted on another device. */
  async applyRemoteDelete(songId: string) {
    const current = (await this.load()).songs.find((s) => s.id === songId);
    if (current) await this.deleteSong(songId, current.revision);
  }
  async saveDraft(draft: SongDraft) {
    if (!validDraft(draft))
      throw new Error("Draft tidak valid; data sebelumnya dipertahankan.");
    return this.write(async (tx) => {
      if (await tx.objectStore("settings").get(tombstone(draft.songId)))
        throw conflict();
      const source = await this.song(tx, draft.songId);
      if (
        source
          ? source.revision !== draft.baseRevision
          : draft.baseRevision !== 0
      )
        throw conflict();
      const old = await tx.objectStore("settings").get(draft.id);
      if (
        old &&
        (!validDraft(old) ||
          old.baseRevision !== draft.baseRevision ||
          old.sequence > draft.sequence ||
          (old.sequence === draft.sequence &&
            JSON.stringify(old.value) !== JSON.stringify(draft.value)))
      )
        throw conflict();
      await tx.objectStore("settings").put(draft);
    });
  }
  async discardDraft(songId: string, sequence: number) {
    return this.write(async (tx) => {
      const draft = await tx.objectStore("settings").get(draftKey(songId));
      if (!validDraft(draft) || draft.sequence !== sequence) throw conflict();
      await tx.objectStore("settings").delete(draft.id);
    });
  }
  async createSchedule(name: string): Promise<Schedule> {
    name = validName(name);
    return this.write(async (tx) => {
      const time = now(),
        schedule = {
          id: id(),
          name,
          itemIds: [],
          revision: 1,
          createdAt: time,
          updatedAt: time,
        };
      await tx.objectStore("schedules").add(schedule);
      await tx
        .objectStore("settings")
        .put({ id: "phase2:active-schedule", value: schedule.id });
      return schedule;
    });
  }
  async renameSchedule(scheduleId: string, name: string, revision: number) {
    name = validName(name);
    return this.write(async (tx) => {
      const s = await this.schedule(tx, scheduleId);
      checkRevision(s, revision);
      const next = { ...s, name, revision: revision + 1, updatedAt: now() };
      await tx.objectStore("schedules").put(next);
      return next;
    });
  }
  async setActive(scheduleId: string) {
    return this.write(async (tx) => {
      await this.schedule(tx, scheduleId);
      await tx
        .objectStore("settings")
        .put({ id: "phase2:active-schedule", value: scheduleId });
    });
  }
  async duplicateSchedule(scheduleId: string, revision: number) {
    return this.write(async (tx) => {
      const source = await this.schedule(tx, scheduleId);
      checkRevision(source, revision);
      const time = now(),
        newId = id();
      const itemIds: string[] = [];
      for (const oldId of source.itemIds) {
        const old = await tx.objectStore("schedule_items").get(oldId);
        const newItem = {
          ...old,
          id: id(),
          scheduleId: newId,
          createdAt: time,
          updatedAt: time,
        };
        await tx.objectStore("schedule_items").add(newItem);
        itemIds.push(newItem.id);
      }
      const copy = {
        ...source,
        id: newId,
        name: `${source.name.slice(0, 190)} (salinan)`,
        revision: 1,
        itemIds,
        createdAt: time,
        updatedAt: time,
      };
      await tx.objectStore("schedules").add(copy);
      await tx
        .objectStore("settings")
        .put({ id: "phase2:active-schedule", value: newId });
      return copy;
    });
  }
  async deleteSchedule(scheduleId: string, revision: number) {
    return this.write(async (tx) => {
      const source = await this.schedule(tx, scheduleId);
      checkRevision(source, revision);
      for (const itemId of source.itemIds)
        await tx.objectStore("schedule_items").delete(itemId);
      await tx.objectStore("schedules").delete(scheduleId);
      const active = await tx
        .objectStore("settings")
        .get("phase2:active-schedule");
      if (active?.value === scheduleId)
        await tx
          .objectStore("settings")
          .put({ id: "phase2:active-schedule", value: null });
    });
  }
  async addSong(scheduleId: string, songId: string, revision: number) {
    return this.write(async (tx) => {
      const s = await this.schedule(tx, scheduleId);
      checkRevision(s, revision);
      if (s.itemIds.length >= 5000)
        throw new Error("Maksimal 5000 item per jadwal.");
      if (!(await this.song(tx, songId)))
        throw new Error("Lagu tidak ditemukan.");
      const time = now(),
        item: ScheduleItem = {
          id: id(),
          scheduleId,
          songId,
          type: "song",
          createdAt: time,
          updatedAt: time,
        };
      await tx.objectStore("schedule_items").add(item);
      await tx.objectStore("schedules").put({
        ...s,
        itemIds: [...s.itemIds, item.id],
        revision: revision + 1,
        updatedAt: time,
      });
      return item;
    });
  }
  async removeItem(scheduleId: string, itemId: string, revision: number) {
    return this.write(async (tx) => {
      const s = await this.schedule(tx, scheduleId);
      checkRevision(s, revision);
      if (!s.itemIds.includes(itemId)) throw conflict();
      await tx.objectStore("schedule_items").delete(itemId);
      await tx.objectStore("schedules").put({
        ...s,
        itemIds: s.itemIds.filter((i) => i !== itemId),
        revision: revision + 1,
        updatedAt: now(),
      });
    });
  }
  /** Remove every item from a schedule (sources stay in the library). */
  async clearSchedule(scheduleId: string, revision: number) {
    return this.write(async (tx) => {
      const s = await this.schedule(tx, scheduleId);
      checkRevision(s, revision);
      for (const itemId of s.itemIds)
        await tx.objectStore("schedule_items").delete(itemId);
      await tx.objectStore("schedules").put({
        ...s,
        itemIds: [],
        revision: revision + 1,
        updatedAt: now(),
      });
    });
  }
  async reorderItems(scheduleId: string, itemIds: string[], revision: number) {
    return this.write(async (tx) => {
      const s = await this.schedule(tx, scheduleId);
      checkRevision(s, revision);
      if (
        itemIds.length !== s.itemIds.length ||
        new Set(itemIds).size !== itemIds.length ||
        itemIds.some((key) => !s.itemIds.includes(key))
      )
        throw new Error("Urutan jadwal tidak valid.");
      await tx.objectStore("schedules").put({
        ...s,
        itemIds: [...itemIds],
        revision: revision + 1,
        updatedAt: now(),
      });
    });
  }
  /**
   * Sync: Week n (1–4) gets exactly these items, in this order, as another
   * laptop has it. Creates that Week when this laptop has not used it yet;
   * the active Week does not change. Items keep their ids (one in use by
   * another Week here gets a new one).
   */
  async applyRemoteWeek(
    n: number,
    items: (
      | Omit<SongScheduleItem, "scheduleId" | "createdAt" | "updatedAt">
      | Omit<ScriptureScheduleItem, "scheduleId" | "createdAt" | "updatedAt">
      | Omit<MediaScheduleItem, "scheduleId" | "createdAt" | "updatedAt">
    )[],
  ) {
    return this.write(async (tx) => {
      const schedules = (await tx.objectStore("schedules").getAll()).filter(
          validSchedule,
        ),
        time = now();
      const week: Schedule = weekSchedules(schedules)[n - 1] ?? {
        id: id(),
        name: weekName(n),
        itemIds: [],
        revision: 0,
        createdAt: time,
        updatedAt: time,
      };
      const store = tx.objectStore("schedule_items");
      const old = new Map<string, ScheduleItem>();
      for (const itemId of week.itemIds) {
        const item = await store.get(itemId);
        if (item) old.set(itemId, item);
        await store.delete(itemId);
      }
      const itemIds: string[] = [];
      for (const item of items) {
        const taken = await store.get(item.id);
        const row = {
          ...item,
          id: taken ? id() : item.id,
          scheduleId: week.id,
          createdAt: old.get(item.id)?.createdAt ?? time,
          updatedAt: time,
        } as ScheduleItem;
        if (!validItem(row))
          throw new Error("Item jadwal dari server tidak valid.");
        await store.put(row);
        itemIds.push(row.id);
      }
      const next: Schedule = {
        ...week,
        itemIds,
        revision: week.revision + 1,
        updatedAt: time,
      };
      await tx.objectStore("schedules").put(next);
      return next;
    });
  }
  async savePreferences(value: Preferences) {
    if (!validatePreferences(value)) throw new Error("Preferensi tidak valid.");
    return this.write(async (tx) => {
      const old = await tx.objectStore("settings").get("preferences");
      if (old && !validatePreferences(old.value))
        throw new Error("Preferensi rusak; data asli dipertahankan.");
      await tx
        .objectStore("settings")
        .put({ id: "preferences", value, updatedAt: now() });
    });
  }
}
