import { validatePreferences } from "../db";
import { assembleSong } from "../data/repository";
import {
  validSong,
  validItem,
  validSchedule,
  validDraft,
  validSongInput,
} from "../domain/models";
import {
  validTranslation,
  validVerse,
  canonicalJSON,
  sha256,
  verifyDataset,
} from "../scriptures/importFormat";
import { verseKey, editionKey } from "../scriptures/models";
import {
  validAsset,
  validRef,
  mediaRefs,
  type AssetRef,
} from "../media/models";
import { fingerprint } from "../media/integrity";
import { validTheme, validAdvanced, backgroundRefs } from "../themes/models";
import { validCheckpoint } from "../presentation/models";
import { validOverride } from "../data/presentationRepository";
import {
  hashPattern,
  checkCancel,
  fail,
  LIMITS,
  type Row,
  type Snapshot,
} from "./models";
export function fields(v: any, allowed: string[]) {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !allowed.includes(k))
  )
    fail("field/record tidak didukung");
}
function dated(v: any) {
  return typeof v === "string" && Number.isFinite(Date.parse(v));
}
export function byStore(rows: Snapshot, store: string) {
  return rows.filter((r) => r.store === store).map((r) => r.value);
}
export function dependencyRoots(
  rows: Snapshot,
): { id: string; refs: AssetRef[] }[] {
  const roots: { id: string; refs: AssetRef[] }[] = [];
  for (const v of byStore(rows, "themes"))
    if (validTheme(v))
      roots.push({ id: `pin:theme:${v.id}`, refs: backgroundRefs(v.spec) });
  for (const v of byStore(rows, "live_session_state"))
    if (validCheckpoint(v))
      roots.push({
        id: "pin:checkpoint",
        refs: v.live ? mediaRefs(v.live.deck) : [],
      });
  for (const v of byStore(rows, "backup_manifest"))
    if (v.kind === "candidate" && validCheckpoint(v.checkpoint))
      roots.push({
        id: `pin:recovery:${v.id}`,
        refs: v.checkpoint.live ? mediaRefs(v.checkpoint.live.deck) : [],
      });
  return roots;
}
async function exactCheckpoint(c: any) {
  fields(c, [
    "id",
    "format",
    "revision",
    "sessionId",
    "sequence",
    "live",
    "updatedAt",
  ]);
  if (!validCheckpoint(c)) fail("checkpoint tidak valid/tidak didukung");
  if (!c.live) return;
  const l = c.live;
  fields(l, [
    "deck",
    "index",
    "mode",
    "playback",
    "backgroundPlayback",
    "alert",
  ]);
  if (l.alert) fields(l.alert, ["text"]);
  const d = l.deck;
  fields(d, [
    "id",
    "label",
    "createdAt",
    "style",
    "pages",
    "frames",
    "sources",
    "schedule",
    "overrides",
    "render",
    "videoDefaults",
    "scriptureLicenses",
  ]);
  fields(d.style, ["font", "fontSize", "safeMargin", "theme", "lines"]);
  for (const p of d.pages) fields(p, ["text", "scripture", "media", "themed"]);
  for (const f of d.frames) {
    fields(f, [
      "id",
      "page",
      "itemId",
      "title",
      "label",
      "occurrence",
      "kind",
      "songId",
      "scripture",
      "media",
      "sourceId",
      "sourceDigest",
      "pageNumber",
    ]);
    if (f.scripture)
      fields(f.scripture, [
        "datasetId",
        "verseId",
        "reference",
        "translation",
        "attribution",
        "originalText",
        "part",
        "total",
      ]);
  }
  for (const s of d.sources) fields(s, ["id", "revision", "kind", "checksum"]);
  if (d.schedule) fields(d.schedule, ["id", "revision"]);
  for (const o of d.overrides) fields(o, ["frameId", "text"]);
  if (d.videoDefaults) fields(d.videoDefaults, ["loop", "muted", "volume"]);
  for (const license of d.scriptureLicenses ?? [])
    fields(license, ["datasetId", "license", "translation", "checksum"]);
  for (const snapshot of Object.values(d.render?.themes ?? {}) as any[])
    if ((await sha256(canonicalJSON(snapshot.spec))) !== snapshot.signature)
      fail("signature tema checkpoint rusak");
}
export async function validateRows(
  rows: Snapshot,
  signal?: AbortSignal,
  verifyBlobs = true,
) {
  if (rows.length > LIMITS.records) fail("record berlebihan");
  const keys = new Set<string>();
  let metadata = 0;
  const index = new Map(rows.map((r) => [r.store + "|" + r.value.id, r.value]));
  const grouped = new Map<string, Record<string, any>[]>();
  for (const r of rows) {
    if (!grouped.has(r.store)) grouped.set(r.store, []);
    grouped.get(r.store)!.push(r.value);
  }
  const get = (s: string, id: string) => index.get(s + "|" + id);
  const list = (s: string) => grouped.get(s) ?? [];
  for (const { store, value: v } of rows) {
    checkCancel(signal);
    if (
      typeof v?.id !== "string" ||
      v.id.length > 2000 ||
      keys.has(store + "|" + v.id)
    )
      fail("ID tidak valid/duplikat");
    keys.add(store + "|" + v.id);
    const { blob, ...plain } = v;
    metadata += new TextEncoder().encode(canonicalJSON(plain)).length;
    if (metadata > LIMITS.metadata) fail("metadata berlebihan");
    let valid = false;
    switch (store) {
      case "songs":
        fields(v, [
          "id",
          "title",
          "author",
          "category",
          "language",
          "order",
          "sectionIds",
          "revision",
          "createdAt",
          "updatedAt",
        ]);
        valid = validSong(assembleSong(v as any, list("song_sections") as any));
        break;
      case "song_sections":
        fields(v, ["id", "songId", "type", "label", "text"]);
        valid = !!get("songs", v.songId);
        break;
      case "schedules":
        fields(v, [
          "id",
          "name",
          "itemIds",
          "revision",
          "createdAt",
          "updatedAt",
        ]);
        valid =
          validSchedule(v) &&
          v.itemIds.every(
            (id: string) => get("schedule_items", id)?.scheduleId === v.id,
          );
        break;
      case "schedule_items": {
        fields(v, [
          "id",
          "scheduleId",
          "type",
          "songId",
          "themeId",
          "selection",
          "media",
          "label",
          "createdAt",
          "updatedAt",
        ]);
        valid =
          validItem(v) &&
          get("schedules", v.scheduleId)?.itemIds.includes(v.id);
        if (v.type === "song") valid &&= !!get("songs", v.songId);
        else if (v.type === "scripture") {
          fields(v.selection, ["datasetId", "checksum", "verseIds", "label"]);
          const t = get("scripture_translations", v.selection.datasetId);
          valid &&=
            !!t &&
            t.contentHash === v.selection.checksum &&
            v.selection.verseIds.every(
              (id: string) => get("scripture_verses", id)?.datasetId === t.id,
            );
        } else if (v.type === "media") {
          fields(v.media, ["assetId", "digest", "pages"]);
          const a = get("media_assets", v.media.assetId);
          valid &&=
            validAsset(a) &&
            a.original.digest === v.media.digest &&
            v.media.pages.every((p: number) => p <= a.pages);
        }
        if (v.themeId)
          valid &&=
            v.themeId.startsWith("builtin:") ||
            validTheme(get("themes", v.themeId));
        break;
      }
      case "scripture_translations":
        fields(v, [
          "id",
          "format",
          "revision",
          "info",
          "books",
          "contentHash",
          "fileHash",
          "verseCount",
          "byteLength",
          "createdAt",
          "attestedAt",
        ]);
        valid = validTranslation(v);
        break;
      case "scripture_verses":
        fields(v, [
          "id",
          "datasetId",
          "bookOrder",
          "book",
          "chapter",
          "verse",
          "text",
          "textHash",
        ]);
        valid =
          validVerse(v) &&
          v.id === verseKey(v.datasetId, v.bookOrder, v.chapter, v.verse) &&
          !!get("scripture_translations", v.datasetId) &&
          (await sha256(
            canonicalJSON({
              book: v.book,
              chapter: v.chapter,
              verse: v.verse,
              text: v.text,
            }),
          )) === v.textHash;
        break;
      case "themes":
        if (v.id.startsWith("deleted:")) {
          fields(v, ["id", "format", "deletedAt"]);
          valid =
            v.format === 1 &&
            dated(v.deletedAt) &&
            !get("themes", v.id.slice(8));
        } else {
          fields(v, [
            "id",
            "format",
            "revision",
            "name",
            "spec",
            "signature",
            "createdAt",
            "updatedAt",
          ]);
          valid =
            validTheme(v) &&
            (await sha256(canonicalJSON(v.spec))) === v.signature;
        }
        break;
      case "media_assets":
        if (v.id.startsWith("meta:")) {
          fields(v, [
            "id",
            "format",
            "revision",
            "title",
            "filename",
            "kind",
            "original",
            "thumbnail",
            "pages",
            "createdAt",
            "compatibility",
          ]);
          valid = validAsset(v);
        } else if (v.id.startsWith("pin:")) {
          fields(v, ["id", "format", "kind", "refs", "createdAt"]);
          valid =
            v.format === 1 &&
            v.kind === "pin" &&
            dated(v.createdAt) &&
            Array.isArray(v.refs) &&
            v.refs.length <= 30000 &&
            v.refs.every(validRef);
        } else if (v.id.startsWith("deleted:")) {
          fields(v, ["id", "format", "kind", "deletedAt"]);
          valid =
            v.format === 1 &&
            v.kind === "tombstone" &&
            dated(v.deletedAt) &&
            !get("media_assets", v.id.slice(8));
        } else if (v.id.startsWith("blob:")) {
          fields(v, [
            "id",
            "format",
            "blob",
            "chunks",
            "digest",
            "size",
            "mime",
          ]);
          valid =
            v.format === 1 &&
            blob instanceof Blob &&
            blob.size === v.size &&
            Number.isSafeInteger(v.size) &&
            v.size > 0 &&
            typeof v.digest === "string" &&
            hashPattern.test(v.digest) &&
            Array.isArray(v.chunks) &&
            v.chunks.every(
              (h: unknown) => typeof h === "string" && hashPattern.test(h),
            ) &&
            v.size <= 256 * 1024 ** 2 &&
            blob.type === v.mime &&
            [
              "image/jpeg",
              "image/png",
              "image/webp",
              "video/mp4",
              "video/webm",
              "application/pdf",
            ].includes(v.mime) &&
            Array.isArray(v.chunks) &&
            v.chunks.length === Math.ceil(v.size / LIMITS.chunk);
          if (valid && verifyBlobs) {
            const got = await fingerprint(blob, signal);
            valid =
              got.digest === v.digest &&
              canonicalJSON(got.chunks) === canonicalJSON(v.chunks);
          }
        }
        break;
      case "settings":
        if (v.id === "preferences") {
          fields(v, ["id", "value", "updatedAt"]);
          fields(v.value, [
            "font",
            "fontSize",
            "safeMargin",
            "loopPreview",
            "loopLive",
            "muted",
            "volume",
            "theme",
          ]);
          valid = validatePreferences(v.value);
        } else if (v.id === "phase6:settings")
          valid =
            validAdvanced(v) &&
            (v.defaultThemeId === null ||
              v.defaultThemeId.startsWith("builtin:") ||
              validTheme(get("themes", v.defaultThemeId)));
        else if (v.id === "phase2:active-schedule") {
          fields(v, ["id", "value"]);
          valid = v.value === null || !!get("schedules", v.value);
        } else if (v.id.startsWith("phase2:deleted:song:")) {
          fields(v, ["id", "deletedAt"]);
          valid =
            dated(v.deletedAt) &&
            !get("songs", v.id.slice("phase2:deleted:song:".length));
        } else if (v.id.startsWith("phase2:draft:song:")) {
          fields(v, [
            "id",
            "kind",
            "songId",
            "baseRevision",
            "sequence",
            "value",
            "updatedAt",
          ]);
          fields(v.value, [
            "title",
            "author",
            "category",
            "language",
            "sections",
            "order",
          ]);
          for (const section of v.value.sections ?? [])
            fields(section, ["id", "songId", "type", "label", "text"]);
          valid =
            validDraft(v) &&
            validSongInput(v.value, v.songId, true) &&
            v.id === `phase2:draft:song:${v.songId}` &&
            !get("settings", `phase2:deleted:song:${v.songId}`);
        }
        break;
      case "slide_overrides":
        fields(v, [
          "id",
          "format",
          "frameId",
          "text",
          "style",
          "sourceSignature",
          "revision",
        ]);
        fields(v.style, ["font", "fontSize", "safeMargin", "theme", "lines"]);
        valid = validOverride(v);
        break;
      case "live_session_state":
        fields(v, [
          "id",
          "format",
          "revision",
          "sessionId",
          "sequence",
          "live",
          "updatedAt",
        ]);
        await exactCheckpoint(v);
        valid = true;
        break;
      case "backup_manifest":
        fields(v, ["id", "format", "kind", "checkpoint", "createdAt"]);
        valid =
          v.id.startsWith("phase7:candidate:") &&
          v.format === 1 &&
          v.kind === "candidate" &&
          validCheckpoint(v.checkpoint) &&
          dated(v.createdAt);
        if (valid) await exactCheckpoint(v.checkpoint);
        break;
    }
    if (!valid) fail(`record tidak valid/tidak didukung: ${store}/${v.id}`);
  }
  const editions = new Set<string>();
  for (const t of list("scripture_translations")) {
    const key = editionKey(t.info);
    if (editions.has(key)) fail("edisi Scripture berkonflik");
    editions.add(key);
    const verses = byStore(rows, "scripture_verses")
      .filter((v) => v.datasetId === t.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (verses.length !== t.verseCount) fail("jumlah ayat berbeda");
    await verifyDataset({
      format: "sagi-scripture",
      version: 1,
      translation: t.info,
      books: t.books,
      verses: verses.map(({ book, chapter, verse, text }) => ({
        book,
        chapter,
        verse,
        text,
      })),
      integrity: { algorithm: "SHA-256", contentHash: t.contentHash },
    });
  }
  const refs: AssetRef[] = [];
  for (const v of byStore(rows, "media_assets")) {
    if (validAsset(v)) refs.push(v.original, v.thumbnail);
    else if (v.kind === "pin") refs.push(...v.refs);
  }
  for (const root of dependencyRoots(rows)) refs.push(...root.refs);
  for (const ref of refs) {
    const p = get("media_assets", ref.id);
    if (
      !p ||
      p.digest !== ref.digest ||
      p.size !== ref.size ||
      p.mime !== ref.mime
    )
      fail(`dependensi media hilang/rusak: ${ref.id}`);
  }
}
export function portableRows(rows: Snapshot): {
  rows: Snapshot;
  omissions: string[];
} {
  const blocked = new Set(
    byStore(rows, "scripture_translations")
      .filter((t) => !t.info.license.permissions.export)
      .map((t) => t.id),
  );
  const omitSchedules = new Set(
    byStore(rows, "schedule_items")
      .filter(
        (i) => i.type === "scripture" && blocked.has(i.selection.datasetId),
      )
      .map((i) => i.scheduleId),
  );
  const omissions: string[] = [];
  const selected = rows.filter((r) => {
    const v = r.value;
    let omit = false;
    if (r.store === "scripture_translations") omit = blocked.has(v.id);
    if (r.store === "scripture_verses") omit = blocked.has(v.datasetId);
    if (r.store === "schedules") omit = omitSchedules.has(v.id);
    if (r.store === "schedule_items") omit = omitSchedules.has(v.scheduleId);
    if (r.store === "live_session_state" || r.store === "backup_manifest") {
      const c = r.store === "backup_manifest" ? v.checkpoint : v;
      omit = !!c?.live?.deck?.scriptureLicenses?.some(
        (l: any) => !l.license.permissions.export,
      );
    }
    if (r.store === "settings" && v.id === "phase2:active-schedule")
      omit = omitSchedules.has(v.value);
    if (omit && r.store !== "scripture_verses" && r.store !== "schedule_items")
      omissions.push(
        `${r.store}/${v.id}: izin ekspor Scripture membatasi agregat ini`,
      );
    return !omit;
  });
  return { rows: selected, omissions };
}
