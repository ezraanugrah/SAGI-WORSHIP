import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { LIMITS } from "./models";
import { cancelled } from "./integrity";
import { dimensions } from "./validation";
export async function openPdf(blob: Blob, signal?: AbortSignal) {
  const pdf = await import("pdfjs-dist");
  pdf.GlobalWorkerOptions.workerSrc = workerUrl;
  const root = `${import.meta.env.BASE_URL}pdf-assets/`;
  const task = pdf.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    cMapUrl: root + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: root + "standard_fonts/",
    wasmUrl: root + "wasm/",
    iccUrl: root + "iccs/",
    enableXfa: false,
    useWorkerFetch: true,
    stopAtErrors: true,
  });
  task.onPassword = () => {
    void task.destroy();
  };
  const abort = () => {
    void task.destroy();
  };
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 30000);
  try {
    cancelled(signal);
    const doc = await task.promise;
    if (doc.numPages > LIMITS.pages)
      throw new Error("PDF maksimum 300 halaman.");
    return {
      doc,
      close: async () => {
        signal?.removeEventListener("abort", abort);
        await task.destroy();
      },
    };
  } catch (e) {
    await task.destroy();
    signal?.removeEventListener("abort", abort);
    throw new Error(
      signal?.aborted
        ? "Impor dibatalkan"
        : "PDF rusak, terenkripsi, terlalu besar, atau tidak didukung. " +
            (e as Error).message,
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function renderPdfPage(
  doc: Awaited<ReturnType<typeof openPdf>>["doc"],
  pageNumber: number,
  signal?: AbortSignal,
  max = 1920,
) {
  cancelled(signal);
  let setupTimer: ReturnType<typeof setTimeout> | undefined;
  const page = await Promise.race([
      doc.getPage(pageNumber),
      new Promise<never>((_resolve, reject) => {
        setupTimer = setTimeout(() => {
          void doc.loadingTask.destroy();
          reject(new Error("Batas waktu pemuatan halaman PDF"));
        }, 20000);
      }),
    ]).finally(() => clearTimeout(setupTimer)),
    base = page.getViewport({ scale: 1 });
  dimensions(Math.ceil(base.width), Math.ceil(base.height));
  const viewport = page.getViewport({
      scale: Math.min(max / base.width, 1080 / base.height),
    }),
    canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas tidak tersedia.");
  const task = page.render({
    canvas,
    canvasContext: context,
    viewport,
    annotationMode: 0,
  });
  const abort = () => task.cancel();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    await task.promise;
    cancelled(signal);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Rasterisasi PDF gagal"))),
        "image/png",
      ),
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    page.cleanup();
    canvas.width = canvas.height = 0;
  }
}
