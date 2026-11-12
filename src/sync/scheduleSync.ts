/**
 * Syncs Jadwal Ibadah (Week 1–4) between laptops, with the same account as
 * the songs, media and themes (supabase/schedule-sync.sql, docs/SYNC.md).
 *
 * One row per Week ("week-1" … "week-4") holds its items in order. Each
 * laptop gives its Weeks its own ids, so items are written in a form every
 * laptop can read: songs by id (the same everywhere), media by file
 * fingerprint, verses by Bible edition (content hash) and verse. A Week
 * whose items are not all on this laptop yet (a song, media file, theme or
 * the Bible) waits and is read again on the next run.
 *
 * The active Week stays per laptop. When two laptops change the same Week
 * before syncing, the version that reached the server first is kept; the
 * very first sync of a laptop adds its own items to what the server has.
 */
import { canonicalJSON, sha256 } from "../scriptures/importFormat";
import {
  changed,
  Cursor,
  goodRow,
  type LibraryResult,
  type LibraryState,
  type SyncApi,
} from "./librarySync";

export type PortableItem =
  | { kind: "song"; id: string; songId: string; themeId?: string | null }
  | {
      kind: "scripture";
      id: string;
      themeId?: string | null;
      /** The Bible edition's content hash. */
      checksum: string;
      label: string;
      /** Verse keys without the laptop's dataset id ("Gen|1|3"). */
      verses: string[];
    }
  | {
      kind: "media";
      id: string;
      label: string;
      digest: string;
      pages: number[];
    };
export type WeekData = { name: string; items: PortableItem[] };
export type ScheduleSyncRepo = {
  /** Week 1–4 here, as portable items (null: that Week is not used here). */
  weeks(): Promise<(PortableItem[] | null)[]>;
  /** Make Week n hold these items; says what is missing here instead. */
  apply(n: number, items: PortableItem[]): Promise<{ waiting?: string }>;
};
/** The schedules table is missing (admin step). */
export class SchedulesNotReady extends Error {
  constructor() {
    super(
      "Jadwal belum aktif di server sinkron. Admin: jalankan supabase/schedule-sync.sql di Supabase (sekali).",
    );
  }
}

const id = (n: number) => `week-${n}`;
const number = (rowId: string) => {
  const m = /^week-([1-4])$/.exec(rowId);
  return m ? Number(m[1]) : null;
};
const hash = (items: PortableItem[]) => sha256(canonicalJSON(items));
/** What an item shows, for spotting the same song added on two laptops. */
export const contentKey = (i: PortableItem) =>
  i.kind === "song"
    ? `song:${i.songId}`
    : i.kind === "media"
      ? `media:${i.digest}:${i.pages.join(",")}`
      : `scripture:${i.checksum}:${i.verses.join(",")}`;

const text = (v: unknown, max: number) =>
  typeof v === "string" && !!v.trim() && v.length <= max;
const theme = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" &&
    /^(theme:[a-zA-Z0-9_-]+|builtin:(black|sunset|ocean|purple))$/.test(v));
function validItem(v: unknown): v is PortableItem {
  const x = v as Record<string, unknown>;
  if (!x || typeof x !== "object" || !text(x.id, 200)) return false;
  if (x.kind === "song") return text(x.songId, 200) && theme(x.themeId);
  if (x.kind === "media")
    return (
      text(x.label, 250) &&
      typeof x.digest === "string" &&
      /^[a-f0-9]{64}$/.test(x.digest) &&
      Array.isArray(x.pages) &&
      x.pages.length > 0 &&
      x.pages.length <= 100 &&
      x.pages.every((p) => Number.isInteger(p) && p > 0)
    );
  if (x.kind === "scripture")
    return (
      theme(x.themeId) &&
      typeof x.checksum === "string" &&
      /^[a-f0-9]{64}$/.test(x.checksum) &&
      text(x.label, 200) &&
      Array.isArray(x.verses) &&
      x.verses.length > 0 &&
      x.verses.length <= 500 &&
      x.verses.every((k) => text(k, 200))
    );
  return false;
}
function validWeek(d: unknown): d is WeekData {
  const x = d as WeekData;
  return (
    !!x &&
    typeof x.name === "string" &&
    Array.isArray(x.items) &&
    x.items.length <= 5000 &&
    x.items.every(validItem) &&
    new Set(x.items.map((i) => i.id)).size === x.items.length
  );
}

/**
 * Pull the Weeks changed on other laptops, then send this laptop's changes.
 * Returns true when the server moved on meanwhile (run again).
 */
export async function syncSchedules(
  api: SyncApi,
  repo: ScheduleSyncRepo,
  state: LibraryState,
  result: LibraryResult,
) {
  let local = await repo.weeks();
  const seen = new Cursor(state);
  for await (const row of changed(
    api,
    "schedules",
    state,
    () => new SchedulesNotReady(),
  )) {
    const n = number(row.id);
    if (!goodRow(row) || n === null || row.deleted || !validWeek(row.data)) {
      result.skipped++;
      continue;
    }
    seen.saw(row);
    const known = state.known[row.id];
    if (known && known.version >= row.version) continue;
    const server = row.data.items,
      mine = local[n - 1] ?? [];
    // First sync of this laptop: keep its own items too (added after the
    // server's, without repeating what the server already has).
    const merged = known
      ? server
      : [
          ...server,
          ...mine.filter(
            (i) =>
              !server.some((s) => contentKey(s) === contentKey(i)) &&
              !server.some((s) => s.id === i.id),
          ),
        ];
    const { waiting } = await repo.apply(n, merged);
    if (waiting) {
      result.skipped++;
      result.problem ??= waiting;
      seen.retry(row);
      continue;
    }
    // Known as the server's content: a merge differs and is sent back.
    state.known[row.id] = { version: row.version, hash: await hash(server) };
    if (merged !== server || (await hash(merged)) !== (await hash(mine)))
      result.pulled++;
    local = await repo.weeks();
  }
  seen.save();
  let stale = false;
  for (let n = 1; n <= 4; n++) {
    const items = local[n - 1];
    if (!items) continue;
    const key = id(n),
      known = state.known[key],
      h = await hash(items);
    if (known ? known.hash === h : !items.length) continue;
    const data: WeekData = { name: `Week ${n}`, items };
    const rows = known
      ? await api.update("schedules", key, known.version, {
          version: known.version + 1,
          data,
        })
      : await api.insert("schedules", {
          id: key,
          data,
          version: 1,
          deleted: false,
        });
    if (rows?.length) {
      state.known[key] = { version: rows[0].version, hash: h };
      result.pushed++;
    } else stale = true; // another laptop changed it first: read it again
  }
  result.count = local.filter((w) => w && w.length).length;
  return stale;
}
