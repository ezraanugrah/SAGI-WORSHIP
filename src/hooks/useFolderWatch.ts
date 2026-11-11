import { useCallback, useEffect, useRef, useState } from "react";
import {
  POLL_MS,
  clearWatch,
  fileKey,
  inLibrary,
  loadWatch,
  permission,
  pickFolder,
  saveWatch,
  scanFolder,
  watchSupported,
  type StoredWatch,
  type WatchedFile,
} from "../media/folderWatch";
import type { MediaAsset } from "../media/models";

export type WatchState =
  | { status: "unsupported" | "loading" | "none" }
  | { status: "permission"; name: string }
  | {
      status: "watching";
      name: string;
      files: WatchedFile[];
      /** Keys of files that appeared or changed after the folder was chosen. */
      fresh: Set<string>;
      /** Keys unchanged since the previous scan (a download that has finished). */
      stable: Set<string>;
    };
/**
 * Keeps an eye on the chosen folder while the app is open: rescans every
 * POLL_MS and on window focus. With auto-import on, a new file is imported
 * once its size has stayed the same for two scans (so a download that is
 * still being written is not picked up), and each file is tried only once.
 */
export function useFolderWatch({
  enabled,
  assets,
  editable,
  working,
  importFiles,
}: {
  enabled: boolean;
  assets: MediaAsset[];
  editable: boolean;
  working: boolean;
  importFiles: (files: File[]) => Promise<void>;
}) {
  const [state, setState] = useState<WatchState>(() =>
    watchSupported() ? { status: "loading" } : { status: "unsupported" },
  );
  const [auto, setAutoState] = useState(false),
    [note, setNote] = useState(""),
    // Show every file not in the library, not only new ones.
    [showAll, setShowAll] = useState(false);
  const stored = useRef<StoredWatch | null>(null),
    baseline = useRef<Set<string> | null>(null),
    previous = useRef(new Set<string>()),
    attempted = useRef(new Set<string>());
  const start = (watch: StoredWatch) => {
    stored.current = watch;
    baseline.current = null;
    previous.current = new Set();
    setAutoState(watch.auto);
  };
  useEffect(() => {
    if (!enabled || !watchSupported()) return;
    let active = true;
    void loadWatch().then(async (watch) => {
      if (!active) return;
      if (!watch) return setState({ status: "none" });
      start(watch);
      const access = await permission(watch.handle);
      if (active)
        setState(
          access === "granted"
            ? {
                status: "watching",
                name: watch.handle.name,
                files: [],
                fresh: new Set(),
                stable: new Set(),
              }
            : { status: "permission", name: watch.handle.name },
        );
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  const watching = state.status === "watching";
  useEffect(() => {
    if (!enabled || !watching || !stored.current) return;
    let stopped = false,
      busy = false;
    const watch = stored.current;
    const tick = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const files = await scanFolder(watch.handle);
        if (stopped) return;
        const keys = files.map(fileKey);
        baseline.current ??= new Set(keys);
        const fresh = new Set(
          files
            .filter(
              (f) =>
                !baseline.current!.has(fileKey(f)) ||
                f.lastModified >= watch.since,
            )
            .map(fileKey),
        );
        const stable = new Set(keys.filter((k) => previous.current.has(k)));
        previous.current = new Set(keys);
        setState({
          status: "watching",
          name: watch.handle.name,
          files,
          fresh,
          stable,
        });
      } catch {
        if (!stopped)
          setState(
            (await permission(watch.handle)) === "granted"
              ? {
                  status: "watching",
                  name: watch.handle.name,
                  files: [],
                  fresh: new Set(),
                  stable: new Set(),
                }
              : { status: "permission", name: watch.handle.name },
          );
      } finally {
        busy = false;
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [enabled, watching]);
  const importNow = useCallback(
    async (files: WatchedFile[]) => {
      if (!files.length) return;
      try {
        const read = await Promise.all(files.map((f) => f.read()));
        await importFiles(read);
      } catch (e) {
        setNote(`Gagal membaca file dari folder: ${(e as Error).message}`);
      }
    },
    [importFiles],
  );
  // Auto-import: new, stable, not yet in the library, not tried before.
  useEffect(() => {
    if (state.status !== "watching" || !auto || !editable || working) return;
    const ready = state.files.filter((f) => {
      const key = fileKey(f);
      return (
        state.fresh.has(key) &&
        state.stable.has(key) &&
        !attempted.current.has(key) &&
        !inLibrary(f, assets)
      );
    });
    if (!ready.length) return;
    ready.forEach((f) => attempted.current.add(fileKey(f)));
    setNote(`Impor otomatis: ${ready.map((f) => f.name).join(", ")}`);
    void importNow(ready);
  }, [state, auto, editable, working, assets, importNow]);
  async function choose() {
    setNote("");
    try {
      const handle = await pickFolder();
      const watch = { handle, since: Date.now(), auto };
      start(watch);
      if (!(await saveWatch(watch)))
        setNote(
          "Folder dipantau selama tab ini terbuka; browser ini tidak bisa mengingatnya.",
        );
      setState({
        status: "watching",
        name: handle.name,
        files: [],
        fresh: new Set(),
        stable: new Set(),
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setNote(`Folder tidak bisa dibuka: ${(e as Error).message}`);
    }
  }
  async function allow() {
    const watch = stored.current;
    if (!watch) return;
    if ((await permission(watch.handle, true)) === "granted")
      setState({
        status: "watching",
        name: watch.handle.name,
        files: [],
        fresh: new Set(),
        stable: new Set(),
      });
    else setNote("Akses folder belum diizinkan.");
  }
  async function forget() {
    await clearWatch();
    stored.current = null;
    setNote("");
    setState({ status: "none" });
  }
  async function setAuto(value: boolean) {
    setAutoState(value);
    const watch = stored.current;
    if (watch) {
      stored.current = { ...watch, auto: value };
      await saveWatch(stored.current);
    }
  }
  return {
    state,
    auto,
    note,
    showAll,
    setShowAll,
    choose,
    allow,
    forget,
    setAuto,
    importNow,
  };
}
