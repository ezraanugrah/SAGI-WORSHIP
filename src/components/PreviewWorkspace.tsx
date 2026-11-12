import { t } from "../i18n";
import { useEffect } from "react";
import type {
  PresentationController,
  PresentationState,
} from "../presentation/controller";
import { frameText, type Deck } from "../presentation/models";
export function PreviewWorkspace({
  state,
  onDirty,
}: {
  controller?: PresentationController;
  state: PresentationState;
  editable?: boolean;
  onDirty?: (dirty: boolean) => void;
}) {
  const preview = state.preview,
    frame = preview?.deck.frames[preview.index];
  // Nothing is edited here any more (Edit teks is under Live Output).
  useEffect(() => onDirty?.(false), [preview, onDirty]);
  // No Preview monitor: Jadwal Ibadah and Live Output fill the workspace.
  // This line only says what Go Live will show; slides are stepped and text
  // is edited under Live Output, the slide to start on is picked in the list.
  return (
    <section className="prepare-bar" aria-label="Preview workspace">
      <div className="prepare-line">
        <span className="prepare-label">{t("Siap tayang")}</span>
        <span
          className="prepare-title"
          title={frame?.title || preview?.deck.label}
        >
          {preview
            ? frame?.title || preview.deck.label
            : t("Klik lagu atau item jadwal")}
        </span>
        <span data-testid="preview-position" className="prepare-position">
          {preview
            ? `Slide ${preview.index + 1} of ${preview.deck.frames.length}`
            : ""}
        </span>
        {state.preparing && (
          <span className="prepare-status" role="status">
            {t("Menyiapkan slide…")}
          </span>
        )}
      </div>
      {state.sourceChanged && (
        <p className="save-message">
          {t(
            "Sumber berubah/dihapus. Item siap tayang dan LIVE tidak diperbarui otomatis. Pilih ulang materi untuk menyiapkan versi baru.",
          )}
        </p>
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
      : t("Halaman {n}", { n: frame.pageNumber });
  return frameText(deck, index) || t("(slide kosong)");
}
