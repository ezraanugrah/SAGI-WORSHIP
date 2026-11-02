import { decodeArchive } from "./container";
import { validateRows, portableRows } from "./validation";
import { checkCancel, type Archive } from "./models";
export async function verifyArchive(
  file: Blob,
  signal?: AbortSignal,
): Promise<Archive> {
  checkCancel(signal);
  if (typeof Worker === "undefined") {
    const archive = await decodeArchive(file, signal);
    await validateRows(archive.rows, signal);
    if (portableRows(archive.rows).omissions.length)
      throw new Error("Scripture tanpa izin ekspor");
    return archive;
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./backup.worker.ts", import.meta.url), {
      type: "module",
    });
    const stop = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      stop();
      reject(new DOMException("Operasi dibatalkan", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (e) => {
      stop();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.archive);
    };
    worker.onerror = () => {
      stop();
      reject(
        new Error("Worker backup gagal; tidak ada data workspace diubah."),
      );
    };
    worker.postMessage({ file });
  });
}
