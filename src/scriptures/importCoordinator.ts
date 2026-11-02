import { WriterGate } from "../data/writer";
import { ScriptureRepository } from "../data/scriptureRepository";
import { FILE_LIMIT, type PreparedDataset } from "./models";
export type ImportState = {
  phase: "idle" | "validating" | "review" | "writing" | "done" | "error";
  message: string;
  prepared: PreparedDataset | null;
  progress: number;
};
export class ImportCoordinator {
  private state: ImportState = {
    phase: "idle",
    message: "",
    prepared: null,
    progress: 0,
  };
  private listeners = new Set<() => void>();
  private worker: Worker | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  constructor(
    private gate: WriterGate,
    private repo: ScriptureRepository,
  ) {}
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(patch: Partial<ImportState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  start() {
    return this.gate.subscribe(() => {
      if (
        !this.gate.active &&
        ["validating", "review", "writing"].includes(this.state.phase)
      )
        this.cancel("Hak tulis hilang; impor dibatalkan.");
    });
  }
  async choose(file: File) {
    try {
      const ticket = this.gate.ticket();
      this.cancel();
      if (
        !file.name.toLowerCase().endsWith(".json") ||
        file.size > FILE_LIMIT ||
        file.size === 0
      )
        throw new Error("Pilih file JSON UTF-8, maksimum 32 MiB.");
      const generation = ++this.generation;
      this.update({
        phase: "validating",
        message: "Memvalidasi struktur dan SHA-256…",
        prepared: null,
        progress: 0,
      });
      const worker = new Worker(
        new URL("./import.worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker = worker;
      worker.onmessage = (event) => {
        if (generation !== this.generation) return;
        try {
          this.gate.assert(ticket);
          if (event.data.error) throw new Error(event.data.error);
          this.update({
            phase: "review",
            message: "Validasi berhasil. Periksa metadata dan hak penggunaan.",
            prepared: event.data.prepared,
          });
        } catch (e) {
          this.update({
            phase: "error",
            message: (e as Error).message,
            prepared: null,
          });
        } finally {
          worker.terminate();
          this.worker = null;
        }
      };
      worker.onerror = () => {
        if (generation === this.generation)
          this.update({
            phase: "error",
            message: "Worker validasi gagal. Tidak ada data disimpan.",
            prepared: null,
          });
        worker.terminate();
        this.worker = null;
      };
      worker.postMessage({ jobId: String(generation), file });
    } catch (e) {
      this.update({
        phase: "error",
        message: (e as Error).message,
        prepared: null,
      });
    }
  }
  async confirm(accepted: boolean) {
    const generation = this.generation;
    try {
      this.gate.ticket();
      if (!accepted || this.state.phase !== "review" || !this.state.prepared)
        throw new Error(
          "Periksa dan konfirmasi hak penggunaan terlebih dahulu.",
        );
      const prepared = this.state.prepared;
      this.abort = new AbortController();
      this.update({
        phase: "writing",
        message: "Mengimpor secara atomik…",
        progress: 0,
      });
      const estimate = await navigator.storage?.estimate();
      if (
        estimate?.quota &&
        estimate.usage !== undefined &&
        estimate.quota - estimate.usage < prepared.byteLength * 3 + 1048576
      )
        throw new Error(
          "Perkiraan storage tidak mencukupi. Data lama dipertahankan.",
        );
      if (generation !== this.generation) return;
      await this.repo.importDataset(prepared, true, {
        signal: this.abort.signal,
        progress: (n, total) =>
          this.update({ progress: Math.round((n / total) * 100) }),
      });
      if (generation === this.generation)
        this.update({
          phase: "done",
          message: "Dataset diimpor. Seluruh ayat tersimpan offline.",
          prepared: null,
          progress: 100,
        });
    } catch (e) {
      if (generation === this.generation)
        this.update({ phase: "error", message: (e as Error).message });
    }
  }
  cancel(message = "Impor dibatalkan. Tidak ada dataset parsial diterbitkan.") {
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
    this.abort?.abort();
    this.abort = null;
    this.update({ phase: "idle", message, prepared: null, progress: 0 });
  }
  dispose() {
    this.cancel();
  }
}
