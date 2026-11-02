import { LIMITS, type MediaKind } from "./models";
export async function identify(
  file: File,
): Promise<{ kind: MediaKind; mime: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase(),
    h = new Uint8Array(await file.slice(0, 32).arrayBuffer()),
    ascii = (a: number, b: number) => String.fromCharCode(...h.slice(a, b));
  let kind: MediaKind, mime: string;
  if (
    (ext === "jpg" || ext === "jpeg") &&
    h[0] === 255 &&
    h[1] === 216 &&
    h[2] === 255
  ) {
    kind = "image";
    mime = "image/jpeg";
  } else if (
    ext === "png" &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => h[i] === n)
  ) {
    kind = "image";
    mime = "image/png";
  } else if (
    ext === "webp" &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 12) === "WEBP"
  ) {
    kind = "image";
    mime = "image/webp";
  } else if (ext === "mp4" && ascii(4, 8) === "ftyp") {
    kind = "video";
    mime = "video/mp4";
  } else if (ext === "webm" && [26, 69, 223, 163].every((n, i) => h[i] === n)) {
    kind = "video";
    mime = "video/webm";
  } else if (ext === "pdf" && ascii(0, 5) === "%PDF-") {
    kind = "pdf";
    mime = "application/pdf";
  } else
    throw new Error(
      ext === "pptx"
        ? "PPTX belum disetujui. Ekspor lokal sebagai PDF/gambar."
        : "Format atau signature file tidak didukung.",
    );
  if (!file.size || file.size > LIMITS[kind])
    throw new Error(`Batas ${kind}: ${LIMITS[kind] / 1048576} MiB.`);
  if (
    file.name.length > 250 ||
    (file.type &&
      file.type !== mime &&
      file.type !== "application/octet-stream")
  )
    throw new Error("Nama/MIME file tidak sesuai.");
  if (kind === "image") {
    if (mime === "image/png" && h.length >= 24) {
      const view = new DataView(h.buffer, h.byteOffset, h.byteLength);
      dimensions(view.getUint32(16), view.getUint32(20));
    }
    if (mime === "image/webp" && ascii(12, 16) === "VP8X" && h.length >= 30) {
      const u24 = (i: number) => h[i] + (h[i + 1] << 8) + (h[i + 2] << 16);
      dimensions(1 + u24(24), 1 + u24(27));
    }
    if (mime === "image/jpeg") {
      const bytes = new Uint8Array(await file.slice(0, 262144).arrayBuffer());
      let i = 2;
      while (i + 8 < bytes.length) {
        if (bytes[i] !== 255) break;
        const marker = bytes[i + 1];
        if (marker === 218 || marker === 217) break;
        const length = (bytes[i + 2] << 8) + bytes[i + 3];
        if (length < 2) break;
        if (
          marker >= 192 &&
          marker <= 207 &&
          ![196, 200, 204].includes(marker)
        ) {
          dimensions(
            (bytes[i + 7] << 8) + bytes[i + 8],
            (bytes[i + 5] << 8) + bytes[i + 6],
          );
          break;
        }
        i += length + 2;
      }
    }
  }
  return { kind, mime };
}
export function dimensions(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > LIMITS.pixels
  )
    throw new Error("Dimensi media melebihi batas 40 megapiksel.");
}
export function waitEvent(
  target: HTMLMediaElement,
  event: string,
  signal?: AbortSignal,
  ms = 20000,
) {
  return new Promise<void>((resolve, reject) => {
    const done = (e?: Event) => {
      cleanup();
      if (signal?.aborted) reject(new DOMException("Dibatalkan", "AbortError"));
      else if (e?.type === "error")
        reject(new Error("Codec/file tidak dapat didekode browser."));
      else resolve();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Batas waktu decode media."));
    }, ms);
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(event, done);
      target.removeEventListener("error", done);
      signal?.removeEventListener("abort", done);
    };
    target.addEventListener(event, done, { once: true });
    target.addEventListener("error", done, { once: true });
    signal?.addEventListener("abort", done, { once: true });
    if (signal?.aborted) done();
  });
}
