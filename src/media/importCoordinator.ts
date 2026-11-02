import { openPdf, renderPdfPage } from "./pdfAdapter";
import { identify, dimensions, waitEvent } from "./validation";
import { payload, cancelled } from "./integrity";
import { type AssetRef, type MediaAsset, type Payload } from "./models";
export type PreparedMedia = { asset: MediaAsset; payloads: Payload[] };
async function thumbnail(
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  const c = document.createElement("canvas");
  const scale = Math.min(1, 320 / width, 180 / height);
  c.width = Math.max(1, Math.round(width * scale));
  c.height = Math.max(1, Math.round(height * scale));
  c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Thumbnail gagal"))),
      "image/png",
    ),
  );
}
const ref = (
  p: Payload,
  width: number,
  height: number,
  kind: "image" | "video" = "image",
  duration?: number,
): AssetRef => ({
  id: p.id,
  digest: p.digest,
  mime: p.mime,
  size: p.size,
  width,
  height,
  kind,
  ...(duration ? { duration } : {}),
});
export async function prepareFile(
  file: File,
  signal?: AbortSignal,
): Promise<PreparedMedia> {
  const { kind, mime } = await identify(file);
  cancelled(signal);
  const blob = file.slice(0, file.size, mime),
    original = await payload(blob, signal);
  let width = 1,
    height = 1,
    duration: number | undefined,
    pages = 1,
    thumb: Blob;
  if (kind === "pdf") {
    const pdf = await openPdf(blob, signal);
    try {
      pages = pdf.doc.numPages;
      const raster = await renderPdfPage(pdf.doc, 1, signal);
      const img = await createImageBitmap(raster);
      width = img.width;
      height = img.height;
      try {
        thumb = await thumbnail(img, width, height);
      } finally {
        img.close();
      }
    } finally {
      await pdf.close();
    }
  } else if (kind === "image") {
    const image = await createImageBitmap(blob);
    try {
      width = image.width;
      height = image.height;
      dimensions(width, height);
      thumb = await thumbnail(image, width, height);
    } finally {
      image.close();
    }
  } else {
    const url = URL.createObjectURL(blob),
      video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    try {
      const ready = waitEvent(video, "loadeddata", signal);
      video.src = url;
      await ready;
      width = video.videoWidth;
      height = video.videoHeight;
      duration = video.duration;
      dimensions(width, height);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 86400)
        throw new Error("Durasi video tidak didukung (maksimum 24 jam).");
      thumb = await thumbnail(video, width, height);
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
  }
  cancelled(signal);
  const poster = await payload(thumb!, signal);
  return {
    asset: {
      id: `meta:${crypto.randomUUID()}`,
      format: 1,
      revision: 1,
      title: file.name,
      filename: file.name,
      kind,
      original: ref(
        original,
        width,
        height,
        kind === "video" ? "video" : "image",
        duration,
      ),
      thumbnail: ref(
        poster,
        Math.max(1, Math.round(width * Math.min(1, 320 / width, 180 / height))),
        Math.max(
          1,
          Math.round(height * Math.min(1, 320 / width, 180 / height)),
        ),
      ),
      pages,
      createdAt: new Date().toISOString(),
      compatibility:
        kind === "video"
          ? "Metadata dan frame awal didekode; playback penuh bergantung codec."
          : kind === "pdf"
            ? "PDF lokal; halaman terpilih diverifikasi saat Preview."
            : "Gambar didekode lokal.",
    },
    payloads: [original, poster],
  };
}
