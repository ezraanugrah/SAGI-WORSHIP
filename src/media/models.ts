export type MediaKind = "image" | "video" | "pdf";
export type AssetRef = {
  id: string;
  digest: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  kind: "image" | "video";
  duration?: number;
};
export type MediaAsset = {
  id: string;
  format: 1;
  revision: 1;
  title: string;
  filename: string;
  kind: MediaKind;
  original: AssetRef;
  thumbnail: AssetRef;
  pages: number;
  createdAt: string;
  compatibility: string;
};
export type Payload = {
  id: string;
  format: 1;
  blob: Blob;
  chunks: string[];
  digest: string;
  size: number;
  mime: string;
};
export type MediaSelection = {
  assetId: string;
  digest: string;
  pages: number[];
};
export type MediaSnapshot = {
  title: string;
  assetId: string;
  digest: string;
  frames: AssetRef[];
  pageNumbers: number[];
};
export type Playback = {
  revision: number;
  frameId: string;
  paused: boolean;
  position: number;
  loop: boolean;
  muted: boolean;
  volume: number;
  target?: string;
};
export type PlaybackFeedback = {
  frameId: string;
  revision: number;
  position: number;
  paused: boolean;
  ended: boolean;
  error?: string;
};
export const LIMITS = {
  image: 25 * 1024 * 1024,
  video: 256 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
  pixels: 40000000,
  pages: 300,
  selection: 100,
  derived: 64 * 1024 * 1024,
};
const hash = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9:_-]{1,160}$/.test(v);
export function validRef(v: unknown): v is AssetRef {
  const r = v as AssetRef;
  return (
    !!r &&
    Object.keys(r).every((k) =>
      [
        "id",
        "digest",
        "mime",
        "size",
        "width",
        "height",
        "kind",
        "duration",
      ].includes(k),
    ) &&
    id(r.id) &&
    r.id.startsWith("blob:") &&
    hash(r.digest) &&
    ["image", "video"].includes(r.kind) &&
    [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
      "video/mp4",
      "video/webm",
    ].includes(r.mime) &&
    Number.isSafeInteger(r.size) &&
    r.size > 0 &&
    r.size <= LIMITS.video &&
    Number.isSafeInteger(r.width) &&
    r.width > 0 &&
    Number.isSafeInteger(r.height) &&
    r.height > 0 &&
    r.width * r.height <= LIMITS.pixels &&
    (r.duration === undefined ||
      (Number.isFinite(r.duration) && r.duration > 0 && r.duration <= 86400))
  );
}
export function validAsset(v: unknown): v is MediaAsset {
  const a = v as MediaAsset;
  return (
    !!a &&
    id(a.id) &&
    a.id.startsWith("meta:") &&
    a.format === 1 &&
    a.revision === 1 &&
    typeof a.title === "string" &&
    !!a.title.trim() &&
    a.title.length <= 250 &&
    typeof a.filename === "string" &&
    a.filename.length <= 250 &&
    ["image", "video", "pdf"].includes(a.kind) &&
    validRef(a.original) &&
    a.original.size <= LIMITS[a.kind] &&
    (a.kind === "video"
      ? a.original.kind === "video" &&
        a.original.mime.startsWith("video/") &&
        !!a.original.duration &&
        a.pages === 1
      : a.original.kind === "image" &&
        (a.kind === "pdf"
          ? a.original.mime === "application/pdf"
          : a.original.mime.startsWith("image/") && a.pages === 1)) &&
    validRef(a.thumbnail) &&
    a.thumbnail.kind === "image" &&
    a.thumbnail.mime.startsWith("image/") &&
    Number.isSafeInteger(a.pages) &&
    a.pages > 0 &&
    a.pages <= LIMITS.pages &&
    typeof a.compatibility === "string" &&
    Number.isFinite(Date.parse(a.createdAt))
  );
}
export function validSelection(v: unknown): v is MediaSelection {
  const s = v as MediaSelection;
  return (
    !!s &&
    id(s.assetId) &&
    s.assetId.startsWith("meta:") &&
    hash(s.digest) &&
    Array.isArray(s.pages) &&
    s.pages.length > 0 &&
    s.pages.length <= LIMITS.selection &&
    s.pages.every(
      (p, i) =>
        Number.isSafeInteger(p) &&
        p > 0 &&
        p <= LIMITS.pages &&
        (i === 0 || s.pages[i - 1] < p),
    )
  );
}
export function validPlayback(v: unknown): v is Playback {
  const p = v as Playback;
  return (
    !!p &&
    Object.keys(p).every((k) =>
      [
        "frameId",
        "revision",
        "paused",
        "position",
        "loop",
        "muted",
        "volume",
        "target",
      ].includes(k),
    ) &&
    typeof p.frameId === "string" &&
    p.frameId.length > 0 &&
    p.frameId.length <= 1000 &&
    Number.isSafeInteger(p.revision) &&
    p.revision >= 0 &&
    Number.isFinite(p.position) &&
    p.position >= 0 &&
    p.position <= 86400 &&
    typeof p.paused === "boolean" &&
    typeof p.loop === "boolean" &&
    typeof p.muted === "boolean" &&
    Number.isFinite(p.volume) &&
    p.volume >= 0 &&
    p.volume <= 2 && // up to 200% (volume boost on the projector)
    (p.target === undefined || id(p.target))
  );
}
export function validFeedback(v: unknown): v is PlaybackFeedback {
  const p = v as PlaybackFeedback;
  return (
    !!p &&
    typeof p.frameId === "string" &&
    p.frameId.length <= 1000 &&
    Number.isSafeInteger(p.revision) &&
    p.revision >= 0 &&
    Number.isFinite(p.position) &&
    p.position >= 0 &&
    p.position <= 86400 &&
    typeof p.paused === "boolean" &&
    typeof p.ended === "boolean" &&
    (p.error === undefined ||
      (typeof p.error === "string" && p.error.length <= 500))
  );
}
/** Shared collector for standalone frames and every frozen theme background/poster. */
export const mediaRefs = (deck: {
  frames: { kind?: string; media?: AssetRef }[];
  render?: { themes: Record<string, { spec: { background: unknown } }> };
}): AssetRef[] => {
  const refs = deck.frames.flatMap((f) =>
    f.kind === "media" && f.media ? [f.media] : [],
  );
  for (const theme of Object.values(deck.render?.themes ?? {})) {
    const b = theme.spec.background as {
      kind?: string;
      asset?: AssetRef;
      poster?: AssetRef;
    };
    if (b.kind === "image" || b.kind === "video") {
      if (b.asset) refs.push(b.asset);
      if (b.poster) refs.push(b.poster);
    }
  }
  return [...new Map(refs.map((r) => [r.id, r])).values()];
};
