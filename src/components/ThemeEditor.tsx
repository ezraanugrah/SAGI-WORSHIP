import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { TypographyEditor } from "./TypographyEditor";
import { SlideCanvas } from "./SlideCanvas";
import {
  defaultType,
  validSpec,
  type ThemeSnapshot,
  type ThemeSpec,
  type Background,
} from "../themes/models";
import { cssBackground, contrast } from "../themes/builtins";
import {
  layoutText,
  lyricSpec,
  type LyricStyle,
} from "../presentation/appearance";
import { loadLyricFonts, lyricFont } from "../presentation/fonts";
import { browserMeasure } from "../presentation/layout";
import type {
  Deck,
  Frame,
  ScriptureCaption,
  Style,
} from "../presentation/models";
import type { MediaAsset } from "../media/models";
/** Theme spec with `a` (image or video) as the full-screen background. */
export function mediaBackground(spec: ThemeSpec, a: MediaAsset): ThemeSpec {
  return {
    ...spec,
    background: {
      kind: a.kind === "video" ? "video" : "image",
      asset: a.original,
      poster: a.thumbnail,
      libraryId: a.id,
      fit: "cover",
      x: 50,
      y: 50,
      dim: 0.35,
      fallback: "#08090b",
    },
  };
}
export function ThemeEditor({
  initial,
  assets,
  editable,
  onSave,
  onCancel,
  reducedMotion = true,
  contrastWarnings = true,
  sample,
  onImportMedia,
  lyricStyle,
}: {
  /** Global lyric style (font, size, margin, lines) shown in the preview. */
  lyricStyle?: LyricStyle;
  /** Import an image/video file (Themes "Impor media") and return it. */
  onImportMedia?: (file: File) => Promise<MediaAsset>;
  initial?: ThemeSnapshot;
  assets: MediaAsset[];
  editable: boolean;
  onSave: (name: string, spec: ThemeSpec) => Promise<void>;
  onCancel: () => void;
  reducedMotion?: boolean;
  contrastWarnings?: boolean;
  sample?: { text: string; caption?: ScriptureCaption };
}) {
  const [useSource, setUseSource] = useState(false);
  const [name, setName] = useState(initial?.name ?? ""),
    [spec, setSpec] = useState<ThemeSpec>(() =>
      structuredClone(
        initial?.spec ?? {
          background: { kind: "solid", color: "#08090b" },
          type: defaultType,
        },
      ),
    ),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [motion, setMotion] = useState(false),
    [deck, setDeck] = useState<Deck | null>(null),
    [uploading, setUploading] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    void loadLyricFonts()
      .then(() => document.fonts.ready)
      .then(() => {
        if (!active) return;
        try {
          if (!validSpec(spec)) throw new Error("Nilai tema belum valid");
          // Lyrics use the global text style whatever the theme.
          const shown = lyricStyle ? lyricSpec(spec, lyricStyle) : spec;
          const text =
              useSource && sample
                ? sample.text
                : "Original theme preview.\nSiapkan teks dengan jelas dan terbaca.",
            layout = layoutText(
              text,
              shown,
              browserMeasure,
              useSource && !!sample?.caption,
            ),
            snapshot = {
              id: "theme:editor",
              revision: 1,
              name: "Local sample",
              signature: "0".repeat(64),
              spec: structuredClone(shown),
            },
            key = `${snapshot.id}@${snapshot.signature}`;
          const base = {
            id: "sample",
            page: 0,
            itemId: null,
            title: "Preview lokal",
            label: "Sample",
            occurrence: 0,
          };
          const sampleFrame: Frame =
            useSource && sample?.caption
              ? {
                  ...base,
                  kind: "scripture",
                  scripture: {
                    ...sample.caption,
                    originalText: text,
                    part: 1,
                    total: layout.pages.length,
                  },
                }
              : { ...base, songId: "sample" };
          setDeck({
            id: "theme-editor-preview",
            label: "Local preview",
            createdAt: new Date().toISOString(),
            style: {
              font: lyricFont(lyricStyle?.font ?? "Montserrat"),
              fontSize: lyricStyle?.fontSize ?? 64,
              safeMargin: lyricStyle?.safeMargin ?? 8,
              theme: "black",
              lines: lyricStyle?.lines ?? 6,
              ...(lyricStyle?.outline !== undefined
                ? { outline: lyricStyle.outline }
                : {}),
            },
            pages: [
              {
                text: layout.pages[0],
                themed: true,
                ...(useSource && sample?.caption
                  ? { scripture: true as const }
                  : {}),
              },
            ],
            frames: [sampleFrame],
            sources: [],
            schedule: null,
            overrides: [],
            render: {
              version: 2,
              canvas: { width: 1920, height: 1080, scaling: "fit" },
              themes: { [key]: snapshot },
              frames: { sample: key },
              sizes: { sample: layout.size },
            },
          });
          setError("");
        } catch (e) {
          setError((e as Error).message);
        }
      });
    return () => {
      active = false;
    };
  }, [
    spec,
    useSource,
    sample?.text,
    sample?.caption,
    lyricStyle?.font,
    lyricStyle?.fontSize,
    lyricStyle?.safeMargin,
    lyricStyle?.lines,
    lyricStyle?.outline,
  ]);
  const bg = spec.background;
  function backgroundKind(kind: Background["kind"]) {
    setMotion(false);
    if (kind === "solid")
      setSpec({ ...spec, background: { kind, color: "#08090b" } });
    else if (kind === "gradient")
      setSpec({
        ...spec,
        background: {
          kind,
          angle: 145,
          stops: [
            { color: "#102a32", at: 0 },
            { color: "#1b646e", at: 100 },
          ],
        },
      });
    else {
      const a = assets.find((a) => a.kind === kind);
      if (!a) {
        setError(
          kind === "image"
            ? t("Belum ada gambar. Klik “Impor media” untuk memilih gambar.")
            : t("Belum ada video. Klik “Impor media” untuk memilih video."),
        );
        return;
      }
      if (kind === "video" && !reducedMotion) setMotion(true);
      setSpec({
        ...spec,
        background: {
          kind,
          asset: a.original,
          poster: a.thumbnail,
          libraryId: a.id,
          fit: "cover",
          x: 50,
          y: 50,
          dim: 0.35,
          fallback: "#08090b",
        },
      });
    }
  }
  const backgroundVideo =
    bg.kind === "video"
      ? {
          frameId: JSON.stringify([
            bg.asset.id,
            bg.asset.digest,
            bg.fit,
            bg.x,
            bg.y,
            bg.dim,
          ]),
          revision: motion ? 1 : 0,
          paused: !motion,
          position: 0,
          loop: true,
          muted: true,
          volume: 0,
          target: "editor",
        }
      : undefined;
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest(
        'a[href],button[role="tab"]',
      );
      if (
        target &&
        (target.tagName === "A" ||
          target.getAttribute("aria-selected") !== "true") &&
        !window.confirm(t("Buang perubahan tema yang belum disimpan?"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", click, true);
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, []);
  return (
    <section
      aria-label="Editor tema"
      className="theme-editor"
      data-live-shortcuts="off"
    >
      <div className="section-heading">
        <h3>{initial ? t("Edit tema") : t("Buat tema")}</h3>
        <button
          className="button secondary"
          onClick={() => {
            if (
              window.confirm(
                t("Tutup editor dan buang perubahan yang belum disimpan?"),
              )
            )
              onCancel();
          }}
        >
          {t("Tutup editor tema")}
        </button>
      </div>
      <div className="theme-editor-grid">
        <div>
          <fieldset disabled={!editable || saving}>
            <label>
              {t("Nama tema")}
              <input
                aria-label="Nama tema"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {onImportMedia && (
              <div className="theme-upload">
                <button
                  type="button"
                  className="button secondary"
                  disabled={!editable || uploading}
                  onClick={() => upload.current?.click()}
                >
                  <ImagePlus size={14} />{" "}
                  {uploading ? t("Mengimpor…") : t("Impor media")}
                </button>
                <input
                  ref={upload}
                  className="sr-only"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
                  aria-label="File media background"
                  disabled={!editable || uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploading(true);
                    setError("");
                    onImportMedia(file)
                      .then((a) => setSpec(mediaBackground(spec, a)))
                      .catch((err) => setError((err as Error).message))
                      .finally(() => setUploading(false));
                  }}
                />
                <span className="field-help">
                  {t(
                    "Gambar/video (JPG · PNG · WebP · MP4 · WebM) jadi background tema · video selalu silent",
                  )}
                </span>
              </div>
            )}
            <label>
              {t("Jenis background")}
              <select
                aria-label="Jenis background"
                value={bg.kind}
                onChange={(e) =>
                  backgroundKind(e.target.value as Background["kind"])
                }
              >
                <option value="solid">Solid</option>
                <option value="gradient">Gradient</option>
                <option value="image">{t("Gambar lokal")}</option>
                <option value="video">
                  {t("Video lokal · selalu silent")}
                </option>
              </select>
            </label>
            {bg.kind === "solid" && (
              <label>
                {t("Warna background")}
                <input
                  aria-label="Warna background"
                  type="color"
                  value={bg.color}
                  onChange={(e) =>
                    setSpec({
                      ...spec,
                      background: { ...bg, color: e.target.value },
                    })
                  }
                />
              </label>
            )}
            {bg.kind === "gradient" && (
              <>
                <label>
                  {t("Sudut gradient")}
                  <input
                    aria-label="Sudut gradient"
                    type="number"
                    min={0}
                    max={360}
                    value={bg.angle}
                    onChange={(e) =>
                      setSpec({
                        ...spec,
                        background: { ...bg, angle: Number(e.target.value) },
                      })
                    }
                  />
                </label>
                {bg.stops.map((stop, i) => (
                  <label key={i}>
                    {t("Gradient stop {n}", { n: i + 1 })}
                    <input
                      aria-label={`Gradient color ${i + 1}`}
                      type="color"
                      value={stop.color}
                      onChange={(e) =>
                        setSpec({
                          ...spec,
                          background: {
                            ...bg,
                            stops: bg.stops.map((s, n) =>
                              n === i ? { ...s, color: e.target.value } : s,
                            ),
                          },
                        })
                      }
                    />
                    <input
                      aria-label={`Gradient position ${i + 1}`}
                      type="number"
                      min={0}
                      max={100}
                      value={stop.at}
                      onChange={(e) =>
                        setSpec({
                          ...spec,
                          background: {
                            ...bg,
                            stops: bg.stops.map((s, n) =>
                              n === i
                                ? { ...s, at: Number(e.target.value) }
                                : s,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </>
            )}
            {(bg.kind === "image" || bg.kind === "video") && (
              <>
                <label>
                  {t("Media background")}
                  <select
                    aria-label="Media background"
                    value={bg.libraryId}
                    onChange={(e) => {
                      const a = assets.find((a) => a.id === e.target.value);
                      if (a)
                        setSpec({
                          ...spec,
                          background: {
                            ...bg,
                            asset: a.original,
                            poster: a.thumbnail,
                            libraryId: a.id,
                          },
                        });
                    }}
                  >
                    {!assets.some((a) => a.id === bg.libraryId) && (
                      <option value={bg.libraryId}>
                        {t("Media dipertahankan oleh tema")}
                      </option>
                    )}
                    {assets
                      .filter((a) => a.kind === bg.kind)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {t("Dim background")}
                  <input
                    aria-label="Dim background"
                    type="range"
                    min={0}
                    max={0.85}
                    step={0.05}
                    value={bg.dim}
                    onChange={(e) =>
                      setSpec({
                        ...spec,
                        background: { ...bg, dim: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              </>
            )}
            <TypographyEditor
              value={spec.type}
              onChange={(type) => setSpec({ ...spec, type })}
            />
          </fieldset>
        </div>
        <div className="theme-sample">
          <h4>{t("Preview editor · bukan LIVE")}</h4>
          {sample && (
            <label>
              <input
                type="checkbox"
                aria-label="Gunakan teks Preview saat ini"
                checked={useSource}
                onChange={(e) => setUseSource(e.target.checked)}
              />{" "}
              {t("Gunakan teks Preview saat ini")}
            </label>
          )}
          <div className="presentation-canvas">
            <SlideCanvas
              deck={deck}
              role="preview"
              backgroundPlayback={backgroundVideo}
              nonce="editor"
              onRendered={(e) => {
                if (e) setError(e);
              }}
            />
          </div>
          {bg.kind === "video" && (
            <button
              className="button secondary"
              onClick={() => setMotion(!motion)}
            >
              {motion ? "Pause background editor" : "Play background editor"}
            </button>
          )}
          <p className="field-help">
            {reducedMotion
              ? t("Reduced motion: background dimulai paused.")
              : t("Background tetap paused sampai Play eksplisit.")}{" "}
            {t("Video selalu silent.")}
          </p>
          <p className="field-help">
            {bg.kind === "solid"
              ? `${t("Kontras")} ${contrast(spec.type.color, bg.color).toFixed(2)}:1${contrastWarnings && contrast(spec.type.color, bg.color) < 4.5 ? ` · ${t("Periksa keterbacaan")}` : ""}`
              : t(
                  "Kontras gradient/media bersifat advisory; periksa semua area dan frame.",
                )}
          </p>
          <p className="field-help">
            {t(
              "Font sistem dapat berbeda. Teks, referensi dan atribusi tidak boleh terpotong.",
            )}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {t(error)}
        </p>
      )}
      <div className="media-filters">
        <button
          className="button primary"
          disabled={!editable || saving || !validSpec(spec) || !name.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(name, spec);
              onCancel();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {t("Simpan tema")}
        </button>
        <button
          className="button secondary"
          onClick={() => {
            if (window.confirm(t("Buang perubahan tema yang belum disimpan?")))
              onCancel();
          }}
        >
          {t("Batalkan tema")}
        </button>
      </div>
    </section>
  );
}
