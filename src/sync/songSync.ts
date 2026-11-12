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
import {
  LibraryNotReady,
  MEDIA_BUCKET,
  syncMedia,
  syncThemes,
  type LibraryRepos,
  type LibraryResult,
  type LibraryState,
  type MediaHooks,
  type SyncApi,
  type Transfer,
} from "./librarySync";

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
  /** Media library and custom themes, when this laptop syncs them. */
  media?: LibraryResult;
  themes?: LibraryResult;
  /** Things the operator or admin should know (e.g. server not ready). */
  notes: string[];
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
  MEDIA_STATE = "sagi-sync-media",
  THEME_STATE = "sagi-sync-themes",
  DELETED = "deleted",
  OVERLAP_MS = 60000,
  PAGE = 1000;
/** Plain-language reason for a refused sign-in (Supabase Auth answer). */
export async function loginRefusal(response: Response) {
  let code = "",
    text = "";
  try {
    const j = await response.json();
    code = String(j?.error_code ?? j?.error ?? "");
    text = String(j?.msg ?? j?.message ?? j?.error_description ?? "");
  } catch {
    /* no JSON body */
  }
  if (response.status === 429 || code.includes("rate_limit"))
    return "Terlalu banyak percobaan masuk. Tunggu 1–2 menit, lalu coba lagi.";
  if (code === "email_not_confirmed" || /not confirmed/i.test(text))
    return "Akun ini belum dikonfirmasi. Admin: buka Supabase › Authentication › Users, pilih akun ini, lalu Confirm email (atau buat ulang dengan Auto Confirm User).";
  if (code === "user_banned")
    return "Akun ini diblokir di Supabase. Admin bisa membukanya di Authentication › Users.";
  if (response.status === 400 || response.status === 401)
    return "Email atau password salah. Password membedakan huruf besar/kecil. Bila lupa, admin bisa mengganti password akun ini di Supabase › Authentication › Users.";
  if (response.status >= 500)
    return `Server sinkron tidak menjawab (HTTP ${response.status}). Bila project Supabase sedang dijeda, admin klik Restore project di dashboard Supabase.`;
  return `Server login menolak (HTTP ${response.status}${text ? `: ${text}` : ""}).`;
}
export class OfflineError extends Error {
  /** Ends the whole run (media/themes do not just skip and retry). */
  readonly stopsSync = true;
  constructor() {
    super("Offline: perubahan dikirim saat internet tersambung lagi.");
  }
}
export class SignedOutError extends Error {
  readonly stopsSync = true;
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
  /** Media and themes to sync too (set by the app; songs always sync). */
  library: LibraryRepos = {};
  /** A media file on its way (null when none): the panel shows progress. */
  onProgress?: (transfer: Transfer | null) => void;
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
    // Signing in: say why Supabase refused, so the operator (or admin)
    // knows what to fix. Refreshing: a refused token just means signed out.
    if (grant === "password" && !response.ok)
      throw new Error(await loginRefusal(response));
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
  /** An authorised call; a refused token is refreshed once. */
  private async authed(
    url: string,
    init: (token: string) => RequestInit,
  ): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.call(
        url,
        init(await this.access(attempt > 0)),
      );
      if (response.status === 401 && attempt === 0) continue;
      return response;
    }
    throw new SignedOutError();
  }
  /** Tables and Storage for the media/themes sync. */
  private tables(): SyncApi {
    const rest = `${this.config.url}/rest/v1`,
      store = `${this.config.url}/storage/v1/object`,
      headers = (token: string) => ({
        apikey: this.config.key,
        Authorization: `Bearer ${token}`,
      });
    return {
      select: async (table, since, offset, limit) => {
        const r = await this.authed(
          `${rest}/${table}?select=id,data,version,deleted,updated_at&order=updated_at.asc,id.asc&limit=${limit}&offset=${offset}${since ? `&updated_at=gte.${encodeURIComponent(since)}` : ""}`,
          (token) => ({ headers: headers(token) }),
        );
        if (r.status === 404) return null; // table not created yet
        if (r.status === 401) throw new SignedOutError();
        if (!r.ok)
          throw new Error(`Server sinkron menolak (HTTP ${r.status}).`);
        return (await r.json()) as Row[];
      },
      insert: (table, row) => this.api(table, "POST", row),
      update: async (table, id, version, patch) =>
        (await this.api(
          `${table}?id=eq.${encodeURIComponent(id)}&version=eq.${version}`,
          "PATCH",
          patch,
        )) ?? [],
      upload: async (path, blob) => {
        const r = await this.authed(
          `${store}/${MEDIA_BUCKET}/${path}`,
          (token) => ({
            method: "POST",
            headers: {
              ...headers(token),
              "Content-Type": "application/octet-stream",
              "x-upsert": "false",
            },
            body: blob,
          }),
        );
        if (r.ok) return "ok";
        const text = await r.text().catch(() => "");
        // The chunk is there already (named after its content).
        if (r.status === 409 || /duplicate|already exists/i.test(text))
          return "ok";
        if (/bucket not found/i.test(text) || r.status === 404)
          return "missing";
        if (r.status === 413 || /quota|exceed|too large|size/i.test(text))
          return "full";
        throw new Error(`Penyimpanan media menolak (HTTP ${r.status}).`);
      },
      download: async (path) => {
        const r = await this.authed(
          `${store}/authenticated/${MEDIA_BUCKET}/${path}`,
          (token) => ({ headers: headers(token) }),
        );
        if (r.status === 400 || r.status === 404) return null;
        if (!r.ok)
          throw new Error(`Penyimpanan media menolak (HTTP ${r.status}).`);
        return await r.blob();
      },
    };
  }
  private libraryState(key: string, email: string): LibraryState {
    const s = this.read<LibraryState>(key);
    return s && s.email === email && s.known && typeof s.cursor === "string"
      ? s
      : { email, cursor: "", known: {} };
  }
  /** Media first (themes may need their background file), then themes. */
  private async library_(email: string, result: SyncResult) {
    const api = this.tables(),
      { media, themes } = this.library;
    if (media) {
      const state = this.libraryState(MEDIA_STATE, email),
        r: LibraryResult = { pulled: 0, pushed: 0, skipped: 0, count: 0 };
      let saved = 0;
      const hooks: MediaHooks = {
        progress: (t) => this.onProgress?.(t),
        // Uploaded chunks are kept as they go (at most every 2 s), so a
        // closed tab or a lost connection resumes where it stopped.
        persist: () => {
          if (this.now() - saved < 2000) return;
          saved = this.now();
          this.write(MEDIA_STATE, state);
        },
      };
      try {
        if (await syncMedia(api, media, state, r, hooks))
          await syncMedia(api, media, state, r, hooks);
      } finally {
        this.write(MEDIA_STATE, state);
        this.onProgress?.(null);
      }
      result.media = r;
      if (r.problem) result.notes.push(`Media/Tema: ${r.problem}`);
    }
    if (themes) {
      const state = this.libraryState(THEME_STATE, email),
        r: LibraryResult = { pulled: 0, pushed: 0, skipped: 0, count: 0 };
      try {
        if (await syncThemes(api, themes, media, state, r))
          await syncThemes(api, themes, media, state, r);
      } finally {
        this.write(THEME_STATE, state);
      }
      result.themes = r;
    }
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
        notes: [],
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
    // Media and themes: a problem there never stops the songs.
    if (this.library.media || this.library.themes)
      try {
        await this.library_(session.email, result);
      } catch (e) {
        if (e instanceof OfflineError || e instanceof SignedOutError) throw e;
        result.notes.push(
          e instanceof LibraryNotReady
            ? e.message
            : `Media/Tema: ${(e as Error).message}`,
        );
      }
    return result;
  }
}
