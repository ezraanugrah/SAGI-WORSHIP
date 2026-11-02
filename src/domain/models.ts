import { themeId as validThemeId } from "../themes/models";
import {
  validSelection as validMediaSelection,
  type MediaSelection,
  type MediaAsset,
  type MediaSnapshot,
} from "../media/models";
import type {
  ScriptureSelection,
  Translation,
  ScriptureSnapshot,
} from "../scriptures/models";
export const sectionTypes = [
  "Intro",
  "Verse",
  "Chorus",
  "Bridge",
  "Ending",
] as const;
export type SectionType = (typeof sectionTypes)[number];
export type SongSection = {
  id: string;
  songId: string;
  type: SectionType;
  label: string;
  text: string;
};
export type SongInput = {
  title: string;
  author: string;
  category: string;
  language: string;
  sections: SongSection[];
  order: string[];
};
export type Song = SongInput & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type Schedule = {
  id: string;
  name: string;
  itemIds: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type SongScheduleItem = {
  id: string;
  scheduleId: string;
  songId: string;
  type: "song";
  themeId?: string | null;
  selection?: never;
  createdAt: string;
  updatedAt: string;
};
export type ScriptureScheduleItem = {
  id: string;
  scheduleId: string;
  type: "scripture";
  themeId?: string | null;
  songId?: never;
  selection: ScriptureSelection;
  createdAt: string;
  updatedAt: string;
};
export type MediaScheduleItem = {
  id: string;
  scheduleId: string;
  type: "media";
  songId?: never;
  selection?: never;
  media: MediaSelection;
  label: string;
  createdAt: string;
  updatedAt: string;
};
export type ScheduleItem =
  SongScheduleItem | ScriptureScheduleItem | MediaScheduleItem;
export function validScriptureSelection(v: unknown): v is ScriptureSelection {
  if (
    !record(v) ||
    !validId(v.datasetId) ||
    typeof v.checksum !== "string" ||
    !/^[0-9a-f]{64}$/.test(v.checksum) ||
    typeof v.label !== "string" ||
    !v.label.trim() ||
    v.label.length > 200 ||
    !Array.isArray(v.verseIds) ||
    !v.verseIds.length ||
    v.verseIds.length > 500
  )
    return false;
  const ids = v.verseIds;
  return ids.every(
    (key, index) =>
      validId(key) &&
      key.startsWith(`v|${v.datasetId}|`) &&
      (index === 0 || ids[index - 1] < key),
  );
}
export type SongDraft = {
  id: string;
  kind: "song-draft";
  songId: string;
  baseRevision: number;
  sequence: number;
  value: SongInput;
  updatedAt: string;
};
export type Workspace = {
  songs: Song[];
  schedules: Schedule[];
  items: ScheduleItem[];
  activeId: string | null;
  drafts: SongDraft[];
  issues: string[];
  translations?: Translation[];
  mediaAssets?: MediaAsset[];
  mediaSnapshots?: Record<string, MediaSnapshot>;
  scriptureSnapshots?: Record<string, ScriptureSnapshot>;
};
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function emptySong(songId: string): SongInput {
  const sectionId = id();
  return {
    title: "",
    author: "",
    category: "",
    language: "Indonesia",
    sections: [
      { id: sectionId, songId, type: "Verse", label: "Verse 1", text: "" },
    ],
    order: [sectionId],
  };
}
function text(value: unknown, max: number, required = false): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (!required || !!value.trim())
  );
}
export function validId(value: unknown): value is string {
  return text(value, 160, true);
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function validSongInput(
  value: unknown,
  songId: string,
  draft = false,
): value is SongInput {
  if (!validId(songId) || !record(value)) return false;
  const s = value as unknown as SongInput;
  return (
    text(s.title, 200, !draft) &&
    text(s.author, 200) &&
    text(s.category, 100) &&
    text(s.language, 100) &&
    Array.isArray(s.sections) &&
    s.sections.length > 0 &&
    s.sections.length <= 200 &&
    s.sections.every(
      (x) =>
        record(x) &&
        validId(x.id) &&
        x.songId === songId &&
        sectionTypes.includes(x.type) &&
        text(x.label, 100, true) &&
        text(x.text, 30000, !draft),
    ) &&
    new Set(s.sections.map((x) => x.id)).size === s.sections.length &&
    Array.isArray(s.order) &&
    s.order.length > 0 &&
    s.order.length <= 1000 &&
    s.order.every(
      (x) =>
        typeof x === "string" && s.sections.some((section) => section.id === x),
    )
  );
}
export function requireSong(
  value: unknown,
  songId: string,
  draft = false,
): asserts value is SongInput {
  if (!validSongInput(value, songId, draft))
    throw new Error(
      "Lagu tidak valid: isi judul dan lirik setiap bagian; periksa urutan serta batas panjang teks.",
    );
}
function meta(v: Record<string, unknown>) {
  return (
    validId(v.id) &&
    Number.isSafeInteger(v.revision) &&
    (v.revision as number) > 0 &&
    typeof v.createdAt === "string" &&
    Number.isFinite(Date.parse(v.createdAt)) &&
    typeof v.updatedAt === "string" &&
    Number.isFinite(Date.parse(v.updatedAt))
  );
}
export function validSong(value: unknown): value is Song {
  return (
    record(value) && meta(value) && validSongInput(value, value.id as string)
  );
}
export function validSchedule(value: unknown): value is Schedule {
  return (
    record(value) &&
    meta(value) &&
    text(value.name, 200, true) &&
    Array.isArray(value.itemIds) &&
    value.itemIds.length <= 5000 &&
    value.itemIds.every(validId) &&
    new Set(value.itemIds).size === value.itemIds.length
  );
}
export function validItem(value: unknown): value is ScheduleItem {
  return (
    record(value) &&
    validId(value.id) &&
    validId(value.scheduleId) &&
    (value.themeId === undefined ||
      value.themeId === null ||
      (value.type !== "media" && validThemeId(value.themeId))) &&
    ((value.type === "song" && validId(value.songId)) ||
      (value.type === "scripture" &&
        validScriptureSelection(value.selection)) ||
      (value.type === "media" &&
        validMediaSelection(value.media) &&
        text(value.label, 250, true))) &&
    typeof value.createdAt === "string" &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt))
  );
}
export function validDraft(value: unknown): value is SongDraft {
  return (
    record(value) &&
    value.kind === "song-draft" &&
    validId(value.songId) &&
    value.id === `phase2:draft:song:${value.songId}` &&
    Number.isSafeInteger(value.baseRevision) &&
    (value.baseRevision as number) >= 0 &&
    Number.isSafeInteger(value.sequence) &&
    (value.sequence as number) > 0 &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    validSongInput(value.value, value.songId, true)
  );
}
export function validName(name: string) {
  if (!text(name, 200, true))
    throw new Error("Nama jadwal wajib diisi (maksimal 200 karakter).");
  return name.trim();
}
export function move<T>(values: T[], from: number, to: number): T[] {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= values.length ||
    to >= values.length
  )
    return values;
  const next = [...values];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
export function searchSongs(songs: Song[], query: string) {
  const q = query.trim().normalize("NFKC").toLocaleLowerCase("id");
  return songs.filter((s) =>
    [s.title, s.author, ...s.sections.map((x) => x.text)].some((t) =>
      t.normalize("NFKC").toLocaleLowerCase("id").includes(q),
    ),
  );
}
