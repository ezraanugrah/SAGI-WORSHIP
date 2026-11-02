import { useEffect, useState } from "react";
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
import { layoutText } from "../presentation/appearance";
import { browserMeasure } from "../presentation/layout";
import type { Deck, Frame, ScriptureCaption } from "../presentation/models";
import type { MediaAsset } from "../media/models";
export function ThemeEditor({
  initial,
  assets,
  editable,
  onSave,
  onCancel,
  reducedMotion = true,
  contrastWarnings = true,
  sample,
}: {
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
    [deck, setDeck] = useState<Deck | null>(null);
  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => {
      if (!active) return;
      try {
        if (!validSpec(spec)) throw new Error("Nilai tema belum valid");
        const text =
            useSource && sample
              ? sample.text
              : "Original theme preview.\nSiapkan teks dengan jelas dan terbaca.",
          layout = layoutText(
            text,
            spec,
            browserMeasure,
            useSource && !!sample?.caption,
          ),
          snapshot = {
            id: "theme:editor",
            revision: 1,
            name: "Local sample",
            signature: "0".repeat(64),
            spec: structuredClone(spec),
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
            font: "Arial",
            fontSize: 64,
            safeMargin: 8,
            theme: "black",
            lines: 6,
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
  }, [spec, useSource, sample?.text, sample?.caption]);
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
        setError("Impor media kompatibel terlebih dahulu.");
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
        !window.confirm("Buang perubahan tema yang belum disimpan?")
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
    <section aria-label="Editor tema" className="theme-editor">
      <div className="section-heading">
        <h3>{initial ? "Edit tema" : "Buat tema"}</h3>
        <button
          className="button secondary"
          onClick={() => {
            if (
              window.confirm(
                "Tutup editor dan buang perubahan yang belum disimpan?",
              )
            )
              onCancel();
          }}
        >
          Tutup editor tema
        </button>
      </div>
      <div className="theme-editor-grid">
        <div>
          <fieldset disabled={!editable || saving}>
            <label>
              Nama tema
              <input
                aria-label="Nama tema"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Jenis background
              <select
                aria-label="Jenis background"
                value={bg.kind}
                onChange={(e) =>
                  backgroundKind(e.target.value as Background["kind"])
                }
              >
                <option value="solid">Solid</option>
                <option value="gradient">Gradient</option>
                <option value="image">Gambar lokal</option>
                <option value="video">Video lokal · selalu silent</option>
              </select>
            </label>
            {bg.kind === "solid" && (
              <label>
                Warna background
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
                  Sudut gradient
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
                    Gradient stop {i + 1}
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
                  Media background
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
                        Media dipertahankan oleh tema
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
                  Background fit
                  <select
                    aria-label="Background fit"
                    value={bg.fit}
                    onChange={(e) =>
                      setSpec({
                        ...spec,
                        background: {
                          ...bg,
                          fit: e.target.value as "cover" | "contain",
                        },
                      })
                    }
                  >
                    <option value="contain">Contain</option>
                    <option value="cover">Cover · crop background saja</option>
                  </select>
                </label>
                {(["x", "y"] as const).map((key) => (
                  <label key={key}>
                    Fokus {key}
                    <input
                      aria-label={`Fokus ${key}`}
                      type="number"
                      min={0}
                      max={100}
                      value={bg[key]}
                      onChange={(e) =>
                        setSpec({
                          ...spec,
                          background: { ...bg, [key]: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Dim background
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
          <h4>Preview editor · bukan LIVE</h4>
          {sample && (
            <label>
              <input
                type="checkbox"
                aria-label="Gunakan teks Preview saat ini"
                checked={useSource}
                onChange={(e) => setUseSource(e.target.checked)}
              />{" "}
              Gunakan teks Preview saat ini
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
              ? "Reduced motion: background dimulai paused."
              : "Background tetap paused sampai Play eksplisit."}{" "}
            Video selalu silent.
          </p>
          <p className="field-help">
            {bg.kind === "solid"
              ? `Kontras ${contrast(spec.type.color, bg.color).toFixed(2)}:1${contrastWarnings && contrast(spec.type.color, bg.color) < 4.5 ? " · Periksa keterbacaan" : ""}`
              : "Kontras gradient/media bersifat advisory; periksa semua area dan frame."}
          </p>
          <p className="field-help">
            Font sistem dapat berbeda. Teks, referensi dan atribusi tidak boleh
            terpotong.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
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
          Simpan tema
        </button>
        <button
          className="button secondary"
          onClick={() => {
            if (window.confirm("Buang perubahan tema yang belum disimpan?"))
              onCancel();
          }}
        >
          Batalkan tema
        </button>
      </div>
    </section>
  );
}
