/**
 * Syncs the Musik song library between laptops through Supabase (see
 * docs/SYNC.md and supabase/songs-sync.sql).
 *
 * Every laptop keeps working offline on its own IndexedDB copy. When signed
 * in and online, a sync run:
 *   1. pulls rows changed on the server (with a 60 s overlap so a slow
 *      commit is not missed) and applies them locally;
 *   2. pushes local songs that are new, changed or deleted since the last
 *      sync, each guarded by the version this laptop last saw.
 * Nothing is overwritten silently: when both sides changed a song, the
 * server's version is kept and this laptop's version is saved as a copy
 * ("… (salinan laptop ini)"), which then syncs as a new song.
 *
 * The session and the per-song sync bookkeeping live in this browser's
 * localStorage; they are not part of workspace backups.
 */
import { canonicalJSON, sha256 } from "../scriptures/importFormat";
import {
  id as newId,
  validSongInput,
  type Song,
  type SongInput,
} from "../domain/models";

export type SyncConfig = { url: string; key: string };
/** Supabase project address and public (anon) key, baked in at build time. */
export function syncConfig(): SyncConfig | null {
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>,
    // Test hook: E2E tests point the app at a mocked server.
    hook = (globalThis as { __SAGI_SYNC__?: Partial<SyncConfig> })
      .__SAGI_SYNC__,
    url = env.VITE_SYNC_URL || hook?.url,
    key = env.VITE_SYNC_KEY || hook?.key;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
export type SyncRepo = {
  load(): Promise<{ songs: Song[] }>;
  createSong(songId: string, input: SongInput): Promise<Song>;
  applyRemoteSong(songId: string, input: SongInput): Promise<Song>;
  applyRemoteDelete(songId: string): Promise<void>;
};
type Session = {
  access: string;
  refresh: string;
  expires: number;
  email: string;
};
type Known = Record<string, { version: number; hash: string }>;
type State = { email: string; cursor: string; known: Known };
export type SyncResult = {
  pulled: number;
  pushed: number;
  copies: string[];
  skipped: number;
  songs: number;
};
type Row = {
  id: string;
  data: unknown;
  version: number;
  deleted: boolean;
  updated_at: string;
};
const SESSION = "sagi-sync-session",
  STATE = "sagi-sync-state",
  DELETED = "deleted",
  OVERLAP_MS = 60000,
  PAGE = 1000;
export class OfflineError extends Error {
  constructor() {
    super("Offline: perubahan dikirim saat internet tersambung lagi.");
  }
}
export class SignedOutError extends Error {
  constructor() {
    super("Sesi berakhir. Masuk lagi untuk melanjutkan sinkron.");
  }
}
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
/** The synced part of a song (no local revision or timestamps). */
export const songPayload = (s: { id: string } & SongInput): SongInput => ({
  title: s.title.trim(),
  author: s.author,
  category: s.category,
  language: s.language,
  sections: s.sections.map(({ id, songId, type, label, text }) => ({
    id,
    songId,
    type,
    label,
    text,
  })),
  order: [...s.order],
});
export const songHash = (s: { id: string } & SongInput) =>
  sha256(canonicalJSON(songPayload(s)));

export class SongSync {
  constructor(
    private config: SyncConfig,
    private repo: SyncRepo,
    private store: Storage | null = storage(),
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
    private now = () => Date.now(),
  ) {}
  private read<T>(key: string): T | null {
    try {
      return JSON.parse(this.store?.getItem(key) ?? "null") as T | null;
    } catch {
      return null;
    }
  }
  private write(key: string, value: unknown) {
    try {
      if (value === null) this.store?.removeItem(key);
      else this.store?.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked: the next run starts from a full pull */
    }
  }
  session(): Session | null {
    const s = this.read<Session>(SESSION);
    return s && typeof s.access === "string" && typeof s.refresh === "string"
      ? s
      : null;
  }
  private state(email: string): State {
    const s = this.read<State>(STATE);
    return s && s.email === email && s.known && typeof s.cursor === "string"
      ? s
      : { email, cursor: "", known: {} };
  }
  private async call(url: string, init: RequestInit) {
    try {
      return await this.fetcher(url, init);
    } catch {
      throw new OfflineError();
    }
  }
  private async token(grant: string, body: object) {
    const response = await this.call(
      `${this.config.url}/auth/v1/token?grant_type=${grant}`,
      {
        method: "POST",
        headers: {
          apikey: this.config.key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (response.status === 400 || response.status === 401) return null;
    if (!response.ok)
      throw new Error(`Server login menolak (HTTP ${response.status}).`);
    const j = await response.json();
    if (
      typeof j?.access_token !== "string" ||
      typeof j?.refresh_token !== "string"
    )
      throw new Error("Jawaban login tidak dikenali.");
    return {
      access: j.access_token,
      refresh: j.refresh_token,
      expires: this.now() + Number(j.expires_in ?? 3600) * 1000,
      email: String(j.user?.email ?? ""),
    } satisfies Session;
  }
  async signIn(email: string, password: string) {
    const session = await this.token("password", {
      email: email.trim(),
      password,
    });
    if (!session) throw new Error("Email atau password salah.");
    session.email ||= email.trim();
    this.write(SESSION, session);
  }
  signOut() {
    this.write(SESSION, null);
  }
  /** A valid access token, refreshed shortly before it expires. */
  private async access(force = false) {
    const s = this.session();
    if (!s) throw new SignedOutError();
    if (!force && s.expires - this.now() > 60000) return s.access;
    const next = await this.token("refresh_token", {
      refresh_token: s.refresh,
    });
    if (!next) {
      this.signOut();
      throw new SignedOutError();
    }
    next.email ||= s.email;
    this.write(SESSION, next);
    return next.access;
  }
  private async api(path: string, method = "GET", body?: unknown) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.call(`${this.config.url}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: this.config.key,
          Authorization: `Bearer ${await this.access(attempt > 0)}`,
          "Content-Type": "application/json",
          ...(method === "GET" ? {} : { Prefer: "return=representation" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.status === 401 && attempt === 0) continue;
      if (response.status === 409) return null; // the row already exists
      if (!response.ok)
        throw new Error(`Server sinkron menolak (HTTP ${response.status}).`);
      return (await response.json()) as Row[];
    }
    throw new SignedOutError();
  }
  /** Keeps this laptop's edit as a separate song when the server changed too. */
  private async keepCopy(song: Song, copies: string[]) {
    const id = newId(),
      ids = new Map(song.sections.map((s) => [s.id, newId()])),
      input = songPayload(song);
    await this.repo.createSong(id, {
      ...input,
      title: `${input.title.slice(0, 175)} (salinan laptop ini)`,
      sections: input.sections.map((s) => ({
        ...s,
        id: ids.get(s.id)!,
        songId: id,
      })),
      order: input.order.map((key) => ids.get(key)!),
    });
    copies.push(song.title);
  }
  private async pull(state: State, result: SyncResult, full: boolean) {
    const since =
      !full && state.cursor
        ? new Date(Date.parse(state.cursor) - OVERLAP_MS).toISOString()
        : "";
    const local = new Map((await this.repo.load()).songs.map((s) => [s.id, s]));
    for (let offset = 0; ; offset += PAGE) {
      const rows =
        (await this.api(
          `songs?select=id,data,version,deleted,updated_at&order=updated_at.asc,id.asc&limit=${PAGE}&offset=${offset}${since ? `&updated_at=gte.${encodeURIComponent(since)}` : ""}`,
        )) ?? [];
      for (const row of rows) {
        if (
          typeof row?.id !== "string" ||
          !Number.isInteger(row.version) ||
          typeof row.updated_at !== "string"
        ) {
          result.skipped++;
          continue;
        }
        if (row.updated_at > state.cursor) state.cursor = row.updated_at;
        const known = state.known[row.id];
        if (known && known.version >= row.version) continue;
        const mine = local.get(row.id),
          mineHash = mine ? await songHash(mine) : "",
          editedHere = !!mine && (!known || mineHash !== known.hash);
        if (row.deleted) {
          if (mine) {
            if (editedHere) await this.keepCopy(mine, result.copies);
            await this.repo.applyRemoteDelete(row.id);
            result.pulled++;
          }
          state.known[row.id] = { version: row.version, hash: DELETED };
          continue;
        }
        if (!validSongInput(row.data, row.id)) {
          result.skipped++;
          continue;
        }
        const remote = songPayload({ id: row.id, ...(row.data as SongInput) }),
          remoteHash = await songHash({ id: row.id, ...remote });
        if (mineHash !== remoteHash) {
          if (mine && editedHere) await this.keepCopy(mine, result.copies);
          await this.repo.applyRemoteSong(row.id, remote);
          result.pulled++;
        }
        state.known[row.id] = { version: row.version, hash: remoteHash };
      }
      if (rows.length < PAGE) break;
    }
  }
  /** Returns true when the server had a newer version of something. */
  private async push(state: State, result: SyncResult) {
    const songs = (await this.repo.load()).songs;
    let stale = false;
    for (const song of songs) {
      const hash = await songHash(song),
        known = state.known[song.id];
      if (known?.hash === hash) continue;
      const data = songPayload(song);
      if (!known || known.hash === DELETED) {
        const rows = known
          ? await this.api(
              `songs?id=eq.${encodeURIComponent(song.id)}&version=eq.${known.version}`,
              "PATCH",
              { data, version: known.version + 1, deleted: false },
            )
          : await this.api("songs", "POST", {
              id: song.id,
              data,
              version: 1,
              deleted: false,
            });
        if (rows?.length) {
          state.known[song.id] = { version: rows[0].version, hash };
          result.pushed++;
        } else stale = true;
        continue;
      }
      const rows = await this.api(
        `songs?id=eq.${encodeURIComponent(song.id)}&version=eq.${known.version}`,
        "PATCH",
        { data, version: known.version + 1, deleted: false },
      );
      if (rows?.length) {
        state.known[song.id] = { version: known.version + 1, hash };
        result.pushed++;
      } else stale = true;
    }
    for (const [id, known] of Object.entries(state.known)) {
      if (known.hash === DELETED || songs.some((s) => s.id === id)) continue;
      const rows = await this.api(
        `songs?id=eq.${encodeURIComponent(id)}&version=eq.${known.version}`,
        "PATCH",
        { version: known.version + 1, deleted: true },
      );
      if (rows?.length) {
        state.known[id] = { version: known.version + 1, hash: DELETED };
        result.pushed++;
      } else stale = true;
    }
    result.songs = songs.length;
    return stale;
  }
  /** One sync run: pull, push, and pull again if the server moved meanwhile. */
  async run(): Promise<SyncResult> {
    const session = this.session();
    if (!session) throw new SignedOutError();
    const state = this.state(session.email),
      result: SyncResult = {
        pulled: 0,
        pushed: 0,
        copies: [],
        skipped: 0,
        songs: 0,
      };
    try {
      await this.pull(state, result, false);
      if (await this.push(state, result)) {
        await this.pull(state, result, true);
        await this.push(state, result);
      }
    } finally {
      this.write(STATE, state);
    }
    return result;
  }
}
