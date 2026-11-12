import { openPdf, renderPdfPage } from "./pdfAdapter";
import { identify, dimensions, waitEvent } from "./validation";
import { payload, cancelled } from "./integrity";
import {
  type AssetRef,
  type MediaAsset,
  type MediaKind,
  type Payload,
} from "./models";
export type PreparedMedia = { asset: MediaAsset; payloads: Payload[] };
/** The Media tab takes pictures and videos; PDF presentations have their own tab. */
export const MEDIA_TAB_KINDS: readonly MediaKind[] = ["image", "video"];
export const PRESENTATION_KINDS: readonly MediaKind[] = ["pdf"];
const WRONG_TAB: Record<MediaKind, string> = {
  image: "Gambar diimpor di tab Media.",
  video: "Video diimpor di tab Media.",
  pdf: "Tab Media hanya untuk gambar dan video. PDF diimpor di tab Presentations.",
};
/**
 * Above this the video is likely to stutter on a church laptop: more than
 * 1080p, or a bitrate far beyond what a 1080p projector needs.
 */
export const HEAVY_VIDEO = { pixels: 1920 * 1088, bitsPerSecond: 25_000_000 };
export function heavyVideoHint(
  width: number,
  height: number,
  size: number,
  duration: number,
) {
  const reasons: string[] = [];
  if (width * height > HEAVY_VIDEO.pixels) reasons.push(`${width}×${height}`);
  const rate = (size * 8) / duration;
  if (Number.isFinite(rate) && rate > HEAVY_VIDEO.bitsPerSecond)
    reasons.push(`${Math.round(rate / 1_000_000)} Mbps`);
  return reasons.length
    ? `Video berat (${reasons.join(", ")}): bisa tersendat di laptop. Untuk proyektor cukup MP4 H.264 1080p (±8–12 Mbps).`
    : "";
}
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
  kinds?: readonly MediaKind[],
): Promise<PreparedMedia> {
  const { kind, mime } = await identify(file);
  // Refuse a file meant for another tab before hashing or decoding it.
  if (kinds && !kinds.includes(kind)) throw new Error(WRONG_TAB[kind]);
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
          ? heavyVideoHint(width, height, file.size, duration ?? 0) ||
            "Metadata dan frame awal didekode; playback penuh bergantung codec."
          : kind === "pdf"
            ? "PDF lokal; halaman terpilih diverifikasi saat Preview."
            : "Gambar didekode lokal.",
    },
    payloads: [original, poster],
  };
}
