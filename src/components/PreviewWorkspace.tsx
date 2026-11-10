import { themeFor } from "../presentation/appearance";
import { backgroundIdentity } from "../themes/models";
import { useEffect, useState } from "react";
import { SlideCanvas } from "./SlideCanvas";
import {
  PresentationController,
  type PresentationState,
} from "../presentation/controller";
import { frameText, clone, type Style } from "../presentation/models";
export function PreviewWorkspace({
  controller,
  state,
  editable,
  onDirty,
  videoDefaults,
}: {
  controller: PresentationController;
  state: PresentationState;
  editable: boolean;
  onDirty: (dirty: boolean) => void;
  videoDefaults?: { loop: boolean; muted: boolean; volume: number };
}) {
  const preview = state.preview,
    [backgroundMotion, setBackgroundMotion] = useState(false),
    [previewLoop, setPreviewLoop] = useState(videoDefaults?.loop ?? false),
    [text, setText] = useState(""),
    [style, setStyle] = useState<Style | null>(null),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    setText(preview ? frameText(preview.deck, preview.index) : "");
    setStyle(preview ? clone(preview.deck.style) : null);
    onDirty(false);
  }, [preview, onDirty]);
  useEffect(() => {
    setPreviewLoop(videoDefaults?.loop ?? false);
  }, [preview?.deck.id]);
  const selectedFrame = preview?.deck.frames[preview.index];
  const bg = preview
    ? themeFor(preview.deck, preview.index)?.spec.background
    : undefined;
  const bgKey = bg?.kind === "video" ? backgroundIdentity(bg) : "";
  useEffect(() => setBackgroundMotion(false), [preview?.deck.id, bgKey]);
  const backgroundPlayback = bgKey
    ? {
        frameId: bgKey,
        revision: backgroundMotion ? 1 : 0,
        paused: !backgroundMotion,
        position: 0,
        loop: true,
        muted: true,
        volume: 0,
        target: "preview",
      }
    : undefined;
  const previewPlayback =
    selectedFrame?.kind === "media" && selectedFrame.media.kind === "video"
      ? {
          frameId: selectedFrame.id,
          revision: previewLoop ? 1 : 0,
          paused: true,
          position: 0,
          loop: previewLoop,
          muted: videoDefaults?.muted ?? true,
          volume: videoDefaults?.volume ?? 0.8,
        }
      : undefined;
  const dirty =
    !!preview &&
    !!style &&
    (text !== frameText(preview.deck, preview.index) ||
      JSON.stringify(style) !== JSON.stringify(preview.deck.style));
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  async function apply(reset = false) {
    if (!preview || !style) return;
    setSaving(true);
    try {
      await controller.apply(
        reset
          ? preview.deck.pages[preview.deck.frames[preview.index].page].text
          : text,
        style,
        reset,
      );
    } catch (e) {
      controller.report(e);
    } finally {
      setSaving(false);
    }
  }
  function select(index: number) {
    if (
      dirty &&
      !window.confirm("Buang perubahan Preview yang belum diterapkan?")
    )
      return;
    controller.select(index);
  }
  const frameKind = preview?.deck.frames[preview.index].kind;
  return (
    <section className="panel preview" aria-label="Preview workspace">
      <h2 className="panel-heading">Preview</h2>
      <div className="preview-columns">
        <div className="preview-box preview-slides-box">
          <div className="box-label">Slides / Section</div>
          {preview ? (
            <>
              <div className="deck-position">
                <strong>{preview.deck.label}</strong>
                <span>
                  {preview.index + 1} / {preview.deck.frames.length}
                </span>
              </div>
              <div
                className="slide-picker"
                role="list"
                aria-label="Daftar slide Preview"
              >
                {preview.deck.frames.map((frame, index) => (
                  <button
                    key={frame.id}
                    role="listitem"
                    aria-label={`Preview slide ${index + 1}: ${frame.title} ${frame.label}`}
                    aria-current={index === preview.index ? "true" : undefined}
                    className={index === preview.index ? "chosen" : ""}
                    onClick={() => select(index)}
                  >
                    {index + 1}. {frame.label}
                    <small>{frame.title}</small>
                  </button>
                ))}
              </div>
              <div className="preview-navigation">
                <button
                  className="button secondary"
                  disabled={preview.index === 0}
                  onClick={() => select(preview.index - 1)}
                >
                  Preview sebelumnya
                </button>
                <button
                  className="button secondary"
                  disabled={preview.index === preview.deck.frames.length - 1}
                  onClick={() => select(preview.index + 1)}
                >
                  Preview berikutnya
                </button>
              </div>
            </>
          ) : (
            <p className="box-empty">
              Pilih lagu atau item jadwal untuk menyiapkan slide.
            </p>
          )}
        </div>
        <div className="preview-side">
          <div className="preview-box">
            <div className="box-label">Preview output</div>
            <div className="presentation-canvas">
              <SlideCanvas
                deck={preview?.deck ?? null}
                index={preview?.index}
                playback={previewPlayback}
                backgroundPlayback={backgroundPlayback}
                nonce="preview"
              />
            </div>
            {backgroundPlayback && (
              <div className="media-filters">
                <button
                  className="button secondary"
                  disabled={backgroundMotion}
                  onClick={() => setBackgroundMotion(true)}
                >
                  Play background Preview
                </button>
                <button
                  className="button secondary"
                  disabled={!backgroundMotion}
                  onClick={() => setBackgroundMotion(false)}
                >
                  Pause background Preview
                </button>
                <span className="field-help">
                  Background Preview terpisah · selalu silent
                </span>
              </div>
            )}
            {previewPlayback && (
              <label className="field-help">
                <input
                  type="checkbox"
                  aria-label="Loop Preview"
                  checked={previewLoop}
                  onChange={(e) => setPreviewLoop(e.target.checked)}
                />{" "}
                Loop Preview · kontrol video ini terpisah dari LIVE
              </label>
            )}
            {state.preparing && <p role="status">Menyiapkan slide…</p>}
            {state.sourceChanged && (
              <p className="save-message">
                Sumber berubah/dihapus. Preview dan LIVE tidak diperbarui
                otomatis. Pilih ulang materi untuk menyiapkan versi baru.
              </p>
            )}
          </div>
          {preview && frameKind !== "media" && (
            <fieldset
              className="preview-box preview-edit"
              disabled={!editable || saving}
            >
              <legend className="box-label">Edit text before live</legend>
              {frameKind === "scripture" && (
                <p className="field-help">Teks Scripture baca-saja.</p>
              )}
              <textarea
                aria-label="Teks slide sementara"
                maxLength={30000}
                rows={3}
                readOnly={frameKind === "scripture"}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="preview-navigation edit-actions">
                <button
                  className="text-action discard"
                  disabled={!dirty}
                  onClick={() => {
                    setText(frameText(preview.deck, preview.index));
                    setStyle(clone(preview.deck.style));
                  }}
                >
                  Buang perubahan
                </button>
                <button
                  className="button secondary"
                  aria-label="Reset ke sumber"
                  onClick={() => void apply(true)}
                >
                  Reset
                </button>
                <button
                  className="button primary"
                  disabled={!dirty}
                  onClick={() => void apply()}
                >
                  Apply Preview
                </button>
              </div>
            </fieldset>
          )}
          {preview && frameKind !== "media" && (
            <fieldset
              className="preview-box text-style"
              disabled={!editable || saving}
            >
              <legend className="box-label">Text style</legend>
              {preview.deck.render ? (
                <p className="field-help">
                  Gaya teks mengikuti tema aktif. Ubah di tab THEMES.
                </p>
              ) : (
                <div className="preview-style">
                  <label>
                    Font
                    <select
                      aria-label="Font Preview"
                      value={style?.font}
                      onChange={(e) =>
                        setStyle({
                          ...style!,
                          font: e.target.value as Style["font"],
                        })
                      }
                    >
                      {["Arial", "Georgia", "Verdana"].map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Font size
                    <input
                      aria-label="Ukuran Preview"
                      type="number"
                      min={24}
                      max={120}
                      value={style?.fontSize ?? 64}
                      onChange={(e) =>
                        setStyle({
                          ...style!,
                          fontSize: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Tema
                    <select
                      aria-label="Tema Preview"
                      value={style?.theme}
                      onChange={(e) =>
                        setStyle({
                          ...style!,
                          theme: e.target.value as Style["theme"],
                        })
                      }
                    >
                      {["black", "sunset", "ocean", "purple"].map((theme) => (
                        <option key={theme}>{theme}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </fieldset>
          )}
          <p className="field-help preview-note">
            {dirty
              ? "Perubahan belum diterapkan. Apply atau buang sebelum Go Live."
              : "Perubahan Preview tidak mengubah LIVE."}
          </p>
        </div>
      </div>
    </section>
  );
}
