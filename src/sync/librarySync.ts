/**
 * Syncs the Media library and custom Themes between laptops, next to the
 * Musik songs (see songSync.ts, docs/SYNC.md, supabase/library-sync.sql).
 *
 * Media: the asset description and the SHA-256 list of its 4 MiB chunks go
 * in the `media` table; the chunks go in the private Storage bucket
 * `sagi-media`, named after their hash (so a big video is many small
 * uploads, and a file is stored once). A laptop that downloads a file checks
 * every chunk and the whole file before saving it, exactly as a local import.
 * The same file imported on two laptops is recognised by its digest and not
 * downloaded again.
 *
 * Themes: name and look in the `themes` table. A theme's background refers to
 * a media file; it is applied once that file is on this laptop.
 *
 * Like songs, every row has a version that goes up by one per change, and
 * nothing is overwritten silently.
 */
import { canonicalJSON, sha256 } from "../scriptures/importFormat";
import { CHUNK, sha } from "../media/integrity";
import {
  validAsset,
  type AssetRef,
  type MediaAsset,
  type Payload,
} from "../media/models";
import {
  validSpec,
  type ThemeSnapshot,
  type ThemeSpec,
} from "../themes/models";

export const MEDIA_BUCKET = "sagi-media";
export type MediaSyncRepo = {
  list(): Promise<MediaAsset[]>;
  /** A local payload (verified), with its chunk hashes. */
  payload(ref: AssetRef): Promise<Payload>;
  /** Save a downloaded asset and its two payloads (verified again). */
  importRemote(asset: MediaAsset, payloads: Payload[]): Promise<void>;
  remove(id: string, digest: string): Promise<void>;
};
export type ThemeSyncRepo = {
  /** Custom themes only (built-in themes are the same everywhere). */
  list(): Promise<ThemeSnapshot[]>;
  /** Create or replace a theme with this content. */
  apply(id: string, name: string, spec: ThemeSpec): Promise<void>;
};
export type LibraryRepos = { media?: MediaSyncRepo; themes?: ThemeSyncRepo };
export type Row = {
  id: string;
  data: unknown;
  version: number;
  deleted: boolean;
  updated_at: string;
};
/** What the library sync needs from the signed-in Supabase connection. */
export type SyncApi = {
  /** Rows changed since `since` (ISO), oldest first; null: table missing. */
  select(
    table: string,
    since: string,
    offset: number,
    limit: number,
  ): Promise<Row[] | null>;
  /** null: the row already exists. */
  insert(table: string, row: Omit<Row, "updated_at">): Promise<Row[] | null>;
  /** [] when the server's version moved on. */
  update(
    table: string,
    id: string,
    version: number,
    patch: Partial<Row>,
  ): Promise<Row[]>;
  /** "missing": no bucket; "full": the project's storage is full. */
  upload(path: string, blob: Blob): Promise<"ok" | "missing" | "full">;
  download(path: string): Promise<Blob | null>;
};
type Known = Record<string, { version: number; hash: string; local?: string }>;
export type LibraryState = {
  email: string;
  cursor: string;
  known: Known;
  /** Chunk hashes this laptop already uploaded. */
  uploaded?: string[];
};
export type LibraryResult = {
  pulled: number;
  pushed: number;
  skipped: number;
  count: number;
  /** Why a file or theme waits for the next run (first reason only). */
  problem?: string;
};
/** This laptop's stored copy no longer matches its fingerprint. */
class LocalDamaged extends Error {
  constructor() {
    super("file di laptop ini rusak, tidak dikirim. Impor ulang file aslinya.");
  }
}
/** The server has no media/themes tables or no bucket yet (admin step). */
export class LibraryNotReady extends Error {
  constructor() {
    super(
      "Media & Tema belum aktif di server sinkron. Admin: jalankan supabase/library-sync.sql di Supabase (sekali).",
    );
  }
}
export class StorageFull extends Error {
  constructor() {
    super(
      "Penyimpanan Supabase penuh: media baru belum terkirim. Hapus media yang tidak dipakai atau naikkan paket Supabase.",
    );
  }
}
const DELETED = "deleted",
  OVERLAP_MS = 60000,
  PAGE = 500;
const mediaHash = (a: MediaAsset) =>
  sha256(canonicalJSON({ title: a.title, digest: a.original.digest }));
const themeHash = (name: string, spec: ThemeSpec) =>
  sha256(canonicalJSON({ name, spec }));

type FileList = {
  chunks: string[];
  size: number;
  mime: string;
  digest: string;
};
type MediaData = {
  asset: MediaAsset;
  files: { original: FileList; thumbnail: FileList };
};
const isHash = (v: unknown) =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
function validFiles(f: unknown, ref: AssetRef): f is FileList {
  const x = f as FileList;
  return (
    !!x &&
    Array.isArray(x.chunks) &&
    x.chunks.length === Math.ceil(ref.size / CHUNK) &&
    x.chunks.every(isHash) &&
    x.size === ref.size &&
    x.mime === ref.mime &&
    x.digest === ref.digest
  );
}
function validMediaData(d: unknown, id: string): d is MediaData {
  const x = d as MediaData;
  return (
    !!x &&
    validAsset(x.asset) &&
    x.asset.id === id &&
    !!x.files &&
    validFiles(x.files.original, x.asset.original) &&
    validFiles(x.files.thumbnail, x.asset.thumbnail)
  );
}

async function* changed(api: SyncApi, table: string, state: LibraryState) {
  const since = state.cursor
    ? new Date(Date.parse(state.cursor) - OVERLAP_MS).toISOString()
    : "";
  for (let offset = 0; ; offset += PAGE) {
    const rows = await api.select(table, since, offset, PAGE);
    if (rows === null) throw new LibraryNotReady();
    for (const row of rows) yield row;
    if (rows.length < PAGE) return;
  }
}
/**
 * Where the next pull starts: after the newest row seen, but never past a
 * row that has to be read again (a file not complete on the server yet, a
 * theme waiting for its background).
 */
class Cursor {
  private newest: string;
  private hold = "";
  constructor(private state: LibraryState) {
    this.newest = state.cursor;
  }
  saw(row: Row) {
    if (row.updated_at > this.newest) this.newest = row.updated_at;
  }
  retry(row: Row) {
    if (!this.hold || row.updated_at < this.hold) this.hold = row.updated_at;
  }
  save() {
    this.state.cursor =
      this.hold && this.hold < this.newest ? this.hold : this.newest;
  }
}
const goodRow = (row: Row) =>
  typeof row?.id === "string" &&
  Number.isInteger(row.version) &&
  typeof row.updated_at === "string";

/** Download one payload chunk by chunk, checking every chunk's hash. */
async function fetchPayload(
  api: SyncApi,
  ref: AssetRef,
  files: FileList,
): Promise<Payload> {
  const parts: Blob[] = [];
  for (const hash of files.chunks) {
    const blob = await api.download(`chunks/${hash}`);
    if (!blob) throw new Error("Potongan file media belum ada di server.");
    if ((await sha(new Uint8Array(await blob.arrayBuffer()))) !== hash)
      throw new Error("Potongan file media rusak di server.");
    parts.push(blob);
  }
  return {
    id: ref.id,
    format: 1,
    blob: new Blob(parts, { type: ref.mime }),
    chunks: [...files.chunks],
    digest: ref.digest,
    size: ref.size,
    mime: ref.mime,
  };
}

export async function syncMedia(
  api: SyncApi,
  repo: MediaSyncRepo,
  state: LibraryState,
  result: LibraryResult,
) {
  // Pull: new files from other laptops, and deletions.
  let local = await repo.list();
  const seen = new Cursor(state);
  for await (const row of changed(api, "media", state)) {
    if (!goodRow(row)) {
      result.skipped++;
      continue;
    }
    seen.saw(row);
    const known = state.known[row.id];
    if (known && known.version >= row.version) continue;
    if (row.deleted) {
      const mine = local.find((a) => a.id === (known?.local ?? row.id));
      if (mine) {
        try {
          await repo.remove(mine.id, mine.original.digest);
          result.pulled++;
          local = local.filter((a) => a.id !== mine.id);
        } catch {
          result.skipped++;
          seen.retry(row);
          continue;
        }
      }
      state.known[row.id] = { version: row.version, hash: DELETED };
    } else if (!validMediaData(row.data, row.id)) {
      result.skipped++;
    } else {
      const { asset, files } = row.data;
      const hash = await mediaHash(asset);
      const same =
        local.find((a) => a.id === asset.id) ??
        local.find((a) => a.original.digest === asset.original.digest);
      if (same) {
        state.known[row.id] = {
          version: row.version,
          hash,
          ...(same.id !== row.id ? { local: same.id } : {}),
        };
      } else {
        try {
          const payloads = [
            await fetchPayload(api, asset.original, files.original),
            await fetchPayload(api, asset.thumbnail, files.thumbnail),
          ];
          await repo.importRemote(asset, payloads);
          local = [...local, asset];
          state.known[row.id] = { version: row.version, hash };
          result.pulled++;
        } catch (e) {
          // Not complete on the server yet, or damaged: try again later.
          if ((e as { stopsSync?: boolean }).stopsSync) throw e;
          result.skipped++;
          result.problem ??= (e as Error).message;
          seen.retry(row);
        }
      }
    }
  }
  seen.save();
  // Push: files imported here, and files deleted here.
  const onServer = new Set(
    Object.entries(state.known)
      .filter(([, k]) => k.hash !== DELETED)
      .map(([id, k]) => k.local ?? id),
  );
  const uploaded = new Set(state.uploaded ?? []);
  let stale = false;
  try {
    for (const asset of local) {
      if (onServer.has(asset.id)) continue;
      const files = {} as MediaData["files"];
      try {
        for (const key of ["original", "thumbnail"] as const) {
          const ref = asset[key],
            p = await repo.payload(ref);
          for (let i = 0; i < p.chunks.length; i++) {
            const hash = p.chunks[i];
            if (uploaded.has(hash)) continue;
            // Each chunk is hashed once, right before it is sent: a damaged
            // copy here never reaches the server under a good name.
            const part = p.blob.slice(i * CHUNK, (i + 1) * CHUNK);
            if ((await sha(new Uint8Array(await part.arrayBuffer()))) !== hash)
              throw new LocalDamaged();
            const answer = await api.upload(`chunks/${hash}`, part);
            if (answer === "missing") throw new LibraryNotReady();
            if (answer === "full") throw new StorageFull();
            uploaded.add(hash);
          }
          files[key] = {
            chunks: [...p.chunks],
            size: ref.size,
            mime: ref.mime,
            digest: ref.digest,
          };
        }
      } catch (e) {
        if (
          !(e instanceof LocalDamaged) &&
          !/Integritas|Aset hilang/.test((e as Error).message)
        )
          throw e;
        // This laptop's copy is damaged: not sent; the others are.
        result.skipped++;
        result.problem ??= `${asset.title}: ${new LocalDamaged().message}`;
        continue;
      }
      const rows = await api.insert("media", {
        id: asset.id,
        data: { asset, files } satisfies MediaData,
        version: 1,
        deleted: false,
      });
      if (rows?.length) {
        state.known[asset.id] = {
          version: rows[0].version,
          hash: await mediaHash(asset),
        };
        result.pushed++;
      } else stale = true;
    }
  } finally {
    state.uploaded = [...uploaded].slice(-20000);
  }
  for (const [id, k] of Object.entries(state.known)) {
    if (k.hash === DELETED || local.some((a) => a.id === (k.local ?? id)))
      continue;
    const rows = await api.update("media", id, k.version, {
      version: k.version + 1,
      deleted: true,
    });
    if (rows.length) {
      state.known[id] = { version: k.version + 1, hash: DELETED };
      result.pushed++;
    } else stale = true;
  }
  result.count = local.length;
  return stale;
}

/** A theme's background, pointed at this laptop's copy of the same file. */
function localSpec(spec: ThemeSpec, local: MediaAsset[]): ThemeSpec | null {
  const bg = spec.background;
  if (bg.kind !== "image" && bg.kind !== "video") return spec;
  const asset = local.find((a) => a.original.digest === bg.asset.digest);
  if (!asset) return null; // the file has not arrived yet
  return {
    ...spec,
    background: {
      ...bg,
      asset: asset.original,
      poster: asset.thumbnail,
      libraryId: asset.id,
    },
  };
}

export async function syncThemes(
  api: SyncApi,
  repo: ThemeSyncRepo,
  media: MediaSyncRepo | undefined,
  state: LibraryState,
  result: LibraryResult,
) {
  const assets = media ? await media.list() : [];
  let local = await repo.list();
  const seen = new Cursor(state);
  for await (const row of changed(api, "themes", state)) {
    if (!goodRow(row)) {
      result.skipped++;
      continue;
    }
    seen.saw(row);
    const known = state.known[row.id];
    if (!(known && known.version >= row.version)) {
      if (row.deleted) {
        // Themes are not deleted from the app any more; keep this laptop's.
        state.known[row.id] = { version: row.version, hash: DELETED };
      } else {
        const d = row.data as { name?: unknown; spec?: unknown };
        if (
          !row.id.startsWith("theme:") ||
          typeof d?.name !== "string" ||
          !d.name.trim() ||
          !validSpec(d.spec)
        ) {
          result.skipped++;
          continue;
        }
        const spec = localSpec(d.spec, assets);
        if (!spec) {
          // Waits for its background file; read again next time.
          result.skipped++;
          seen.retry(row);
          continue;
        }
        const mine = local.find((t) => t.id === row.id),
          hash = await themeHash(d.name, spec);
        if (!mine || (await themeHash(mine.name, mine.spec)) !== hash) {
          try {
            await repo.apply(row.id, d.name, spec);
            result.pulled++;
          } catch {
            result.skipped++;
            seen.retry(row);
            continue;
          }
        }
        state.known[row.id] = { version: row.version, hash };
      }
    }
  }
  seen.save();
  local = await repo.list();
  let stale = false;
  for (const theme of local) {
    const hash = await themeHash(theme.name, theme.spec),
      known = state.known[theme.id];
    if (known?.hash === hash) continue;
    const data = { name: theme.name, spec: theme.spec };
    const rows = !known
      ? await api.insert("themes", {
          id: theme.id,
          data,
          version: 1,
          deleted: false,
        })
      : await api.update("themes", theme.id, known.version, {
          data,
          version: known.version + 1,
          deleted: false,
        });
    if (rows?.length) {
      state.known[theme.id] = { version: rows[0].version, hash };
      result.pushed++;
    } else stale = true;
  }
  result.count = local.length;
  return stale;
}
