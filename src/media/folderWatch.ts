/**
 * Watched folder for the Media tab: the operator picks a folder on the
 * laptop once (for example Downloads) and media files that appear in it are
 * listed as new, ready to import. Uses the browser's File System Access API
 * (Chrome / Edge on a laptop); the app only reads the folder.
 *
 * The folder handle lives in its own small IndexedDB database, so it is not
 * part of workspace backups. After a restart the browser may ask for access
 * again, which needs one click.
 */
import { openDB } from "idb";
import type { MediaAsset } from "./models";

/** Pictures and videos only, like the Media tab (PDFs go to Presentations). */
export const WATCH_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp4",
  ".webm",
];
/** Unfinished downloads and temporary files. */
const PARTIAL = /\.(crdownload|part|partial|download|tmp)$/i;
export const POLL_MS = 5000;

export type WatchedFile = {
  name: string;
  size: number;
  lastModified: number;
  read: () => Promise<File>;
};
export type Permission = "granted" | "denied" | "prompt";
// Parts of the File System Access API that TypeScript's DOM types lack.
type Entry = {
  kind: "file" | "directory";
  name: string;
  getFile?: () => Promise<File>;
};
export type FolderHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<Entry>;
  queryPermission?: (o: { mode: "read" }) => Promise<Permission>;
  requestPermission?: (o: { mode: "read" }) => Promise<Permission>;
};
export type StoredWatch = {
  handle: FolderHandle;
  /** When the folder was chosen. */
  since: number;
  /** Import new files automatically. */
  auto: boolean;
};

export const watchSupported = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;
export const isWatchable = (name: string) =>
  !name.startsWith(".") &&
  !PARTIAL.test(name) &&
  WATCH_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
/** Same file name and size as a library item (identical files are refused on import anyway). */
export const inLibrary = (
  file: Pick<WatchedFile, "name" | "size">,
  assets: MediaAsset[],
) =>
  assets.some((a) => a.filename === file.name && a.original.size === file.size);
export const fileKey = (
  f: Pick<WatchedFile, "name" | "size" | "lastModified">,
) => `${f.name}|${f.size}|${f.lastModified}`;

const database = () =>
  openDB("sagi-folder-watch", 1, {
    upgrade(db) {
      db.createObjectStore("watch");
    },
  });
export async function loadWatch(): Promise<StoredWatch | null> {
  try {
    const db = await database();
    try {
      const value = await db.get("watch", "media");
      return value?.handle?.kind === "directory"
        ? (value as StoredWatch)
        : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}
/** Saves the choice; returns false if this browser cannot keep the folder across restarts. */
export async function saveWatch(value: StoredWatch) {
  try {
    const db = await database();
    try {
      await db.put("watch", value, "media");
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}
export async function clearWatch() {
  try {
    const db = await database();
    try {
      await db.delete("watch", "media");
    } finally {
      db.close();
    }
  } catch {
    /* nothing stored */
  }
}
export async function pickFolder(): Promise<FolderHandle> {
  const picker = (
    window as unknown as {
      showDirectoryPicker: (o: object) => Promise<FolderHandle>;
    }
  ).showDirectoryPicker;
  return picker({ id: "sagi-media", mode: "read", startIn: "downloads" });
}
/** Read access to the folder; `ask` shows the browser prompt (needs a click). */
export async function permission(
  handle: FolderHandle,
  ask = false,
): Promise<Permission> {
  try {
    const current =
      (await handle.queryPermission?.({ mode: "read" })) ?? "granted";
    if (current === "granted" || !ask) return current;
    return (await handle.requestPermission?.({ mode: "read" })) ?? "granted";
  } catch {
    return "denied";
  }
}
/** Supported media files directly in the folder, newest first. */
export async function scanFolder(
  handle: FolderHandle,
  limit = 300,
): Promise<WatchedFile[]> {
  const found: WatchedFile[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind !== "file" || !entry.getFile || !isWatchable(entry.name))
      continue;
    try {
      const file = await entry.getFile();
      if (file.size > 0)
        found.push({
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          read: () => entry.getFile!(),
        });
    } catch {
      /* removed or locked while scanning */
    }
  }
  return found.sort((a, b) => b.lastModified - a.lastModified).slice(0, limit);
}
