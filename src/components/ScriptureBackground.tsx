import { t } from "../i18n";
import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { MediaAsset } from "../media/models";
import {
  SCRIPTURE_THEME_ID,
  defaultType,
  type ThemeSnapshot,
  type ThemeSpec,
} from "../themes/models";
import { cssBackground } from "../themes/builtins";
import { mediaBackground } from "./ThemeEditor";
import { AssetThumbnail } from "./MediaLibrary";

/** Plain black: the Scriptures background until another is chosen. */
export const BLACK_SPEC: ThemeSpec = {
  background: { kind: "solid", color: "#08090b" },
  type: defaultType,
};
const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";

/**
 * Scriptures › Latar ayat: the background behind verses on Live Output and
 * the projector, separate from Themes (a theme never changes it, and it
 * never changes songs). A picture or video fills the 16:9 output; videos
 * loop without sound.
 */
export function ScriptureBackground({
  themes,
  assets,
  editable,
  onImport,
  onSave,
}: {
  themes: ThemeSnapshot[];
  /** Media library: pictures and videos already imported. */
  assets: MediaAsset[];
  editable: boolean;
  /** Import an image/video file into Media and return it. */
  onImport: (file: File) => Promise<MediaAsset>;
  /** Store the new background and refresh verses on Live Output. */
  onSave: (spec: ThemeSpec) => Promise<void>;
}) {
  const current = themes.find((th) => th.id === SCRIPTURE_THEME_ID),
    background = current?.spec.background ?? BLACK_SPEC.background,
    media =
      background.kind === "image" || background.kind === "video"
        ? background
        : null,
    chosen = media ? assets.find((a) => a.id === media.libraryId) : undefined,
    pictures = assets.filter((a) => a.kind === "image" || a.kind === "video");
  const file = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(spec: () => Promise<ThemeSpec> | ThemeSpec) {
    setBusy(true);
    setError("");
    try {
      await onSave(await spec());
    } catch (e) {
      setError(t((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  const use = (asset: MediaAsset) => mediaBackground(BLACK_SPEC, asset);
  const name = media
    ? (chosen?.title ??
      (media.kind === "video" ? t("Video latar") : t("Gambar latar")))
    : t("Hitam polos");
  return (
    <div className="scripture-bg" role="group" aria-label="Latar ayat">
      <div
        className="scripture-bg-thumb"
        style={{ background: cssBackground(background) }}
        aria-hidden="true"
      >
        {media && <AssetThumbnail refValue={media.poster} />}
      </div>
      <div className="scripture-bg-text">
        <strong>{t("Latar ayat")}</strong>
        <small data-testid="scripture-bg-name">
          {name}
          {media?.kind === "video" ? ` · ${t("tanpa suara, berulang")}` : ""}
        </small>
        <small>{t("Khusus ayat; tidak ikut tema di Themes.")}</small>
      </div>
      <div className="scripture-bg-actions">
        <button
          className="button secondary"
          disabled={!editable || busy}
          onClick={() => file.current?.click()}
        >
          <ImagePlus size={14} aria-hidden="true" />{" "}
          {busy ? t("Mengimpor…") : t("Impor gambar/video")}
        </button>
        <select
          aria-label="Latar ayat dari Media"
          disabled={!editable || busy || !pictures.length}
          value=""
          onChange={(e) => {
            const asset = pictures.find((a) => a.id === e.target.value);
            if (asset) void save(() => use(asset));
          }}
        >
          <option value="">
            {pictures.length
              ? t("Pilih dari Media…")
              : t("Belum ada gambar/video di Media")}
          </option>
          {pictures.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
        <button
          className="text-button"
          disabled={!editable || busy || !media}
          onClick={() => void save(() => BLACK_SPEC)}
        >
          {t("Hitam polos")}
        </button>
      </div>
      <input
        ref={file}
        type="file"
        className="sr-only"
        accept={ACCEPT}
        aria-label="File latar ayat"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) void save(async () => use(await onImport(picked)));
        }}
      />
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
