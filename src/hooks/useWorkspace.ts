import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Repository } from "../data/repository";
import { WriterGate } from "../data/writer";
import type { Workspace } from "../domain/models";
export function useWriter() {
  const [gate] = useState(() => new WriterGate());
  const active = useSyncExternalStore(gate.subscribe, () => gate.active);
  const message = useSyncExternalStore(gate.subscribe, () => gate.message);
  useEffect(() => {
    const stop = gate.start();
    const blocked = () =>
      gate.revoke(
        "Database berubah. Penulisan dibatalkan. Muat ulang aplikasi.",
      );
    const hide = () =>
      gate.revoke(
        "Halaman ditangguhkan. Muat ulang untuk mendapatkan hak tulis kembali.",
      );
    window.addEventListener("sagi-db-blocked", blocked);
    window.addEventListener("pagehide", hide);
    return () => {
      stop();
      window.removeEventListener("sagi-db-blocked", blocked);
      window.removeEventListener("pagehide", hide);
    };
  }, [gate]);
  const [repo] = useState(() => new Repository(gate));
  /** Take edit rights from another SAGI tab (it becomes read-only), then
   * reload so this tab starts as the only writer. */
  const takeOver = useCallback(async () => {
    if (!navigator.locks) throw new Error("Browser tidak mendukung Web Locks.");
    await navigator.locks.request(
      "sagi-workspace-writer",
      { steal: true },
      async () => {},
    );
    location.reload();
  }, []);
  return { gate, repo, editable: active, writerMessage: message, takeOver };
}
const empty: Workspace = {
  songs: [],
  schedules: [],
  items: [],
  activeId: null,
  drafts: [],
  issues: [],
};
export function useWorkspace(repo: Repository) {
  const [data, setData] = useState<Workspace>(empty),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const token = ++request.current;
    try {
      const value = await repo.load();
      if (token !== request.current) return;
      setData(value);
      setError("");
    } catch (e) {
      if (token === request.current)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (token === request.current) setLoading(false);
    }
  }, [repo]);
  useEffect(() => {
    void reload();
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined")
        channel = new BroadcastChannel("sagi-library-changes");
    } catch {
      /* Focus/reload remains available if channels are disabled. */
    }
    const listener = () => {
      void reload();
    };
    channel?.addEventListener("message", listener);
    window.addEventListener("sagi-library-changed", listener);
    window.addEventListener("focus", listener);
    return () => {
      request.current++;
      channel?.close();
      window.removeEventListener("sagi-library-changed", listener);
      window.removeEventListener("focus", listener);
    };
  }, [reload]);
  return { data, error, loading, reload };
}
