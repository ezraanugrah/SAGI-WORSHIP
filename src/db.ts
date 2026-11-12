import { openDB } from "idb";
import { FONT_VALUES } from "./presentation/fonts";
export type Preferences = {
  font: string;
  fontSize: number;
  safeMargin: number;
  loopPreview: boolean;
  loopLive: boolean;
  muted: boolean;
  volume: number;
  theme: string;
};
export const defaults: Preferences = {
  font: "Montserrat",
  fontSize: 64,
  safeMargin: 8,
  loopPreview: false,
  loopLive: true,
  muted: true,
  volume: 80,
  theme: "black",
};
export const stores = [
  "songs",
  "song_sections",
  "scripture_translations",
  "scripture_verses",
  "media_assets",
  "themes",
  "schedules",
  "schedule_items",
  "slide_overrides",
  "settings",
  "live_session_state",
  "backup_manifest",
] as const;
function notifyDatabaseUnavailable() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("sagi-db-blocked"));
}
export function openDatabase(name = "sagi-worship") {
  return openDB(name, 1, {
    upgrade(db) {
      for (const store of stores)
        if (!db.objectStoreNames.contains(store))
          db.createObjectStore(store, { keyPath: "id" });
    },
    blocked() {
      notifyDatabaseUnavailable();
    },
    terminated() {
      notifyDatabaseUnavailable();
    },
    blocking(_a, _b, event) {
      (event.target as IDBDatabase).close();
      notifyDatabaseUnavailable();
    },
  });
}
export function validatePreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object") return false;
  const p = value as Preferences;
  return (
    FONT_VALUES.includes(p.font) &&
    Number.isFinite(p.fontSize) &&
    p.fontSize >= 24 &&
    p.fontSize <= 120 &&
    Number.isFinite(p.safeMargin) &&
    p.safeMargin >= 0 &&
    p.safeMargin <= 20 &&
    Number.isFinite(p.volume) &&
    p.volume >= 0 &&
    p.volume <= 200 &&
    ["black", "sunset", "ocean", "purple"].includes(p.theme) &&
    [p.loopPreview, p.loopLive, p.muted].every((v) => typeof v === "boolean")
  );
}
export async function loadPreferences() {
  const db = await openDatabase();
  try {
    const row = await db.get("settings", "preferences");
    if (!row) return { ...defaults };
    if (!validatePreferences(row.value))
      throw new Error(
        "Preferensi lokal tidak valid. Data dipertahankan; muat ulang atau pulihkan dari backup pada fase berikutnya.",
      );
    return row.value as Preferences;
  } finally {
    db.close();
  }
}
