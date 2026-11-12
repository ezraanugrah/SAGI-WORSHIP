import { themeFor } from "../presentation/appearance";
import { backgroundIdentity } from "../themes/models";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { SlideCanvas } from "./SlideCanvas";
import {
  PresentationController,
  type PresentationState,
} from "../presentation/controller";
import {
  frameText,
  clone,
  type Deck,
  type Style,
} from "../presentation/models";
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
    if (!preview || !style) return false;
    setSaving(true);
    try {
      await controller.apply(
        reset
          ? preview.deck.pages[preview.deck.frames[preview.index].page].text
          : text,
        style,
        reset,
      );
      return true;
    } catch (e) {
      controller.report(e);
      return false;
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
  // Text editing before LIVE happens in a small window ("Edit teks").
  const [editing, setEditing] = useState(false);
  const discard = () => {
    if (!preview) return;
    setText(frameText(preview.deck, preview.index));
    setStyle(clone(preview.deck.style));
  };
  useEffect(() => {
    if (!preview || frameKind === "media") setEditing(false);
  }, [preview, frameKind]);
  const closeEditor = () => {
    if (
      dirty &&
      !window.confirm("Buang perubahan Preview yang belum diterapkan?")
    )
      return;
    discard();
    setEditing(false);
  };
  const editor = preview && frameKind !== "media" && (
    <fieldset
      className="slide-editor"
      disabled={!editable || saving}
      aria-label="Edit teks sebelum LIVE"
    >
      {frameKind === "scripture" && (
        <p className="field-help">Teks Scripture baca-saja.</p>
      )}
      <textarea
        autoFocus
        aria-label="Teks slide sementara"
        maxLength={30000}
        rows={Math.min(10, Math.max(4, text.split("\n").length + 1))}
        readOnly={frameKind === "scripture"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="edit-actions">
        {!preview.deck.render && (
          <>
            <select
              aria-label="Font Preview"
              title="Font"
              value={style?.font}
              onChange={(e) =>
                setStyle({ ...style!, font: e.target.value as Style["font"] })
              }
            >
              {["Arial", "Georgia", "Verdana"].map((font) => (
                <option key={font}>{font}</option>
              ))}
            </select>
            <input
              aria-label="Ukuran Preview"
              title="Ukuran font"
              className="size-input"
              type="number"
              min={24}
              max={120}
              value={style?.fontSize ?? 64}
              onChange={(e) =>
                setStyle({ ...style!, fontSize: Number(e.target.value) })
              }
            />
            <select
              aria-label="Tema Preview"
              title="Tema"
              value={style?.theme}
              onChange={(e) =>
                setStyle({ ...style!, theme: e.target.value as Style["theme"] })
              }
            >
              {["black", "sunset", "ocean", "purple"].map((theme) => (
                <option key={theme}>{theme}</option>
              ))}
            </select>
          </>
        )}
        <span className="edit-spacer" />
        <button
          className="text-action discard"
          aria-label="Buang perubahan"
          disabled={!dirty}
          onClick={discard}
        >
          Buang
        </button>
        <button
          className="button secondary"
          aria-label="Reset ke sumber"
          title="Kembalikan teks sumber"
          onClick={() => void apply(true).then((ok) => ok && setEditing(false))}
        >
          Reset
        </button>
        <button
          className="button primary"
          disabled={!dirty}
          onClick={() => void apply().then((ok) => ok && setEditing(false))}
        >
          Apply Preview
        </button>
      </div>
      <p className="field-help edit-note">
        {dirty
          ? "Belum diterapkan · Apply sebelum Go Live"
          : preview.deck.render
            ? "Gaya teks mengikuti tema (tab Themes) · Preview tidak mengubah LIVE"
            : "Preview tidak mengubah LIVE"}
      </p>
    </fieldset>
  );
  const frame = preview?.deck.frames[preview.index];
  return (
    <section className="panel preview" aria-label="Preview workspace">
      <div className="pane-head">
        <h2 className="pane-title">
          Preview Output
          <span className="pane-subject">
            {preview ? ` - ${frame?.title || preview.deck.label}` : ""}
          </span>
        </h2>
        {state.preparing && (
          <span className="pane-status" role="status">
            Menyiapkan slide…
          </span>
        )}
      </div>
      {/* Preview column = Preview Output only; slides are picked in the
          Jadwal Ibadah or with the arrows. */}
      <div className="output-area output-fill">
        <div className="output-frame">
          <div className="presentation-canvas">
            <SlideCanvas
              deck={preview?.deck ?? null}
              index={preview?.index}
              playback={previewPlayback}
              backgroundPlayback={backgroundPlayback}
              nonce="preview"
            />
          </div>
        </div>
        <div className="output-foot">
          <span data-testid="preview-position">
            {preview
              ? `Slide ${preview.index + 1} of ${preview.deck.frames.length}`
              : ""}
          </span>
          <div className="step-buttons">
            <button
              className="step"
              aria-label="Preview sebelumnya"
              disabled={!preview || preview.index === 0}
              onClick={() => preview && select(preview.index - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              className="step"
              aria-label="Preview berikutnya"
              disabled={
                !preview || preview.index === preview.deck.frames.length - 1
              }
              onClick={() => preview && select(preview.index + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            className="button secondary edit-open"
            aria-haspopup="dialog"
            title={
              frameKind === "media"
                ? "Slide media tidak punya teks"
                : "Ubah teks slide ini sebelum Go Live"
            }
            disabled={!preview || frameKind === "media"}
            onClick={() => setEditing(true)}
          >
            <Pencil size={13} /> Edit teks
          </button>
        </div>
        {/* Same slot as under Live Output, so both monitors keep the same
            size and position whatever is on screen. */}
        <div className="output-slot">
          {backgroundPlayback && (
            <div className="slot-controls">
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
              <span className="field-help">silent · terpisah dari LIVE</span>
            </div>
          )}
          {previewPlayback && (
            <label className="slot-controls field-help">
              <input
                type="checkbox"
                aria-label="Loop Preview"
                checked={previewLoop}
                onChange={(e) => setPreviewLoop(e.target.checked)}
              />{" "}
              Loop Preview · kontrol video ini terpisah dari LIVE
            </label>
          )}
        </div>
        {state.sourceChanged && (
          <p className="save-message">
            Sumber berubah/dihapus. Preview dan LIVE tidak diperbarui otomatis.
            Pilih ulang materi untuk menyiapkan versi baru.
          </p>
        )}
      </div>
      {editing && editor && (
        <div
          className="dialog-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape") closeEditor();
          }}
        >
          <div
            className="edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Edit teks sebelum LIVE"
          >
            <div className="pane-head">
              <h3 className="pane-title">
                Edit teks
                <span className="pane-subject">
                  {frame ? ` - ${frame.title} · ${frame.label}` : ""}
                </span>
              </h3>
              <button
                className="pane-icon"
                aria-label="Tutup edit teks"
                onClick={closeEditor}
              >
                <X size={14} />
              </button>
            </div>
            {editor}
          </div>
        </div>
      )}
    </section>
  );
}

/** One-line description of a slide (Jadwal Ibadah slide list). */
export function slideSummary(deck: Deck, index: number) {
  const frame = deck.frames[index];
  if (frame.kind === "media")
    return frame.media.kind === "video"
      ? "Video"
      : `Halaman ${frame.pageNumber}`;
  return frameText(deck, index);
}
