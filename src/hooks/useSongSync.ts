import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OfflineError,
  SignedOutError,
  SongSync,
  syncConfig,
  type SyncRepo,
} from "../sync/songSync";
import type { LibraryRepos, Transfer } from "../sync/librarySync";

export const SYNC_INTERVAL_MS = 15000;
export type SyncStatus = {
  phase: "off" | "signed-out" | "syncing" | "ok" | "offline" | "error";
  message: string;
};
const clock = () =>
  new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
/**
 * Runs song sync while the app is open in the writer tab: right away, every
 * SYNC_INTERVAL_MS, a moment after any local change, on window focus and
 * when the connection comes back. Runs never overlap.
 */
export function useSongSync(
  repo: SyncRepo,
  editable: boolean,
  library?: LibraryRepos,
) {
  const config = useMemo(() => syncConfig(), []);
  const engine = useMemo(() => {
    if (!config) return null;
    const sync = new SongSync(config, repo);
    // Media and themes sync with the same account as the songs.
    if (library) sync.library = library;
    return sync;
  }, [config, repo, library]);
  const [email, setEmail] = useState(() => engine?.session()?.email ?? ""),
    [status, setStatus] = useState<SyncStatus>(() =>
      !engine
        ? { phase: "off", message: "" }
        : engine.session()
          ? { phase: "syncing", message: "Menyiapkan sinkron…" }
          : { phase: "signed-out", message: "" },
    );
  // A media file on its way ("Mengirim media: … 3/8 bagian").
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  useEffect(() => {
    if (!engine) return;
    engine.onProgress = setTransfer;
    return () => {
      engine.onProgress = undefined;
    };
  }, [engine]);
  const running = useRef(false),
    again = useRef(false);
  const syncNow = useCallback(async () => {
    if (!engine || !engine.session() || !editable) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus((s) =>
      s.phase === "ok"
        ? s
        : { phase: "syncing", message: "Menyinkron lagu, media, dan tema…" },
    );
    try {
      do {
        again.current = false;
        const r = await engine.run();
        const pulled =
            r.pulled + (r.media?.pulled ?? 0) + (r.themes?.pulled ?? 0),
          pushed = r.pushed + (r.media?.pushed ?? 0) + (r.themes?.pushed ?? 0);
        const notes = [
          `Tersinkron ${clock()} · ${r.songs} lagu`,
          r.media ? `${r.media.count} media` : "",
          r.themes ? `${r.themes.count} tema` : "",
          pulled ? `${pulled} dari laptop lain` : "",
          pushed ? `${pushed} terkirim` : "",
          r.copies.length
            ? `bentrok: ${r.copies.join(", ")} disimpan juga sebagai salinan`
            : "",
          r.skipped ? `${r.skipped} data server dilewati (tidak valid)` : "",
          ...r.notes,
        ].filter(Boolean);
        setStatus({ phase: "ok", message: notes.join(" · ") });
      } while (again.current);
    } catch (e) {
      if (e instanceof SignedOutError) {
        setEmail("");
        setStatus({ phase: "signed-out", message: e.message });
      } else if (e instanceof OfflineError)
        setStatus({ phase: "offline", message: e.message });
      else setStatus({ phase: "error", message: (e as Error).message });
    } finally {
      running.current = false;
    }
  }, [engine, editable]);
  useEffect(() => {
    if (!engine || !email || !editable) return;
    void syncNow();
    let changed: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(changed);
      changed = setTimeout(() => void syncNow(), 2000);
    };
    const tick = () => {
      if (document.visibilityState !== "hidden") void syncNow();
    };
    const timer = setInterval(tick, SYNC_INTERVAL_MS);
    window.addEventListener("sagi-library-changed", soon);
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(timer);
      clearTimeout(changed);
      window.removeEventListener("sagi-library-changed", soon);
      window.removeEventListener("focus", tick);
      window.removeEventListener("online", tick);
    };
  }, [engine, email, editable, syncNow]);
  async function signIn(address: string, password: string) {
    if (!engine) return;
    setStatus({ phase: "syncing", message: "Masuk…" });
    try {
      await engine.signIn(address, password);
      setEmail(engine.session()?.email ?? address);
    } catch (e) {
      setStatus({
        phase: e instanceof OfflineError ? "offline" : "signed-out",
        message: (e as Error).message,
      });
    }
  }
  function signOut() {
    engine?.signOut();
    setEmail("");
    setStatus({
      phase: "signed-out",
      message: "Keluar. Lagu, media, dan tema di laptop ini tetap ada.",
    });
  }
  return {
    configured: !!engine,
    email,
    status,
    transfer,
    signIn,
    signOut,
    syncNow,
  };
}
