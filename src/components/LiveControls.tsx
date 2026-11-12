import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { frameText } from "../presentation/models";
import { themeFor } from "../presentation/appearance";
import { backgroundIdentity } from "../themes/models";
import {
  LYRIC_MAX_PX,
  OUTLINE_MAX_PX,
  fontPx,
  outlinePx,
  percentOf,
} from "../presentation/fonts";
import { SlideCanvas } from "./SlideCanvas";
import {
  PresentationController,
  type PresentationState,
} from "../presentation/controller";
import { usePresentationShortcuts } from "../hooks/usePresentationShortcuts";
/** 75.4 → "1:15" */
const clock = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
export type LyricPatch = { fontSize?: number; outline?: number };
export function LiveControls({
  controller,
  state,
  editable,
  lyric,
  onLyric,
}: {
  controller: PresentationController;
  state: PresentationState;
  editable: boolean;
  /** Global lyric size and outline in px (Pengaturan › Tipografi lirik). */
  lyric: { fontSize: number; outline: number };
  /** Save a new size/outline and show the LIVE slide with it. */
  onLyric: (patch: LyricPatch) => void;
}) {
  const region = useRef<HTMLElement>(null);
  usePresentationShortcuts(controller, editable);
  const run = (action: () => unknown) => {
    try {
      const result = action();
      if (result instanceof Promise)
        void result.catch((e) => controller.report(e));
    } catch (e) {
      controller.report(e);
    }
  };
  const live = state.live;
  // The panel shows what the operator picked (song, slide, theme) until Go
  // Live sends it to the projector; after that it mirrors the projector.
  const staged = state.staged && state.preview ? state.preview : null;
  const shown = staged ?? live;
  // A theme's video background loops silently on the panel too.
  const stagedBackground = staged
    ? themeFor(staged.deck, staged.index)?.spec.background
    : undefined;
  const stagedBackgroundPlayback =
    stagedBackground?.kind === "video"
      ? {
          frameId: backgroundIdentity(stagedBackground),
          revision: 1,
          paused: false,
          position: 0,
          loop: true,
          muted: true,
          volume: 0,
          target: "preview",
        }
      : undefined;
  const frame = shown?.deck.frames[shown.index];
  // Size and outline sliders (1–100 %): shown at once, saved after a pause
  // so dragging does not rebuild the LIVE slide on every step.
  const [size, setSize] = useState(() =>
      percentOf(lyric.fontSize, LYRIC_MAX_PX),
    ),
    [outline, setOutline] = useState(() =>
      percentOf(lyric.outline, OUTLINE_MAX_PX),
    ),
    commit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => setSize(percentOf(lyric.fontSize, LYRIC_MAX_PX)),
    [lyric.fontSize],
  );
  useEffect(
    () => setOutline(percentOf(lyric.outline, OUTLINE_MAX_PX)),
    [lyric.outline],
  );
  useEffect(() => () => clearTimeout(commit.current), []);
  const later = (patch: LyricPatch) => {
    clearTimeout(commit.current);
    commit.current = setTimeout(() => onLyric(patch), 250);
  };
  // "Edit teks" for the slide on screen.
  const [editing, setEditing] = useState(false),
    [text, setText] = useState("");
  const textFrame =
    frame && frame.kind !== "media" && frame.kind !== "scripture";
  useEffect(() => {
    if (!textFrame) setEditing(false);
  }, [textFrame]);
  function openEditor() {
    if (!shown) return;
    setText(frameText(shown.deck, shown.index));
    setEditing(true);
  }
  async function applyEdit(value: string) {
    try {
      if (staged) {
        // Not on the projector yet: the edit goes with the next Go Live.
        const source = staged.deck.pages[staged.deck.frames[staged.index].page];
        await controller.apply(
          value.trim() ? value : source.text,
          staged.deck.style,
          !value.trim() || value === source.text,
        );
      } else controller.editLive(value);
      setEditing(false);
    } catch (e) {
      controller.report(e);
    }
  }
  const step = (delta: number) =>
    run(() =>
      staged
        ? controller.select(staged.index + delta)
        : controller.navigate(delta),
    );
  const duration =
    frame?.kind === "media" ? (frame.media.duration ?? 0) : undefined;
  // Projector playback in the footer, like "Slide 1 of 1" under Preview.
  const playbackStatus = live?.playback
    ? state.playbackFeedback?.frameId === live.playback.frameId
      ? `${state.playbackFeedback.paused ? "Paused" : "Playing"} · ${clock(state.playbackFeedback.position)}${duration ? ` / ${clock(duration)}` : ""}${state.playbackFeedback.error ? ` · ${state.playbackFeedback.error}` : ""}`
      : "Menunggu status playback proyektor"
    : live?.backgroundPlayback
      ? state.backgroundFeedback?.frameId === live.backgroundPlayback.frameId
        ? `Background ${state.backgroundFeedback.paused ? "Paused" : "Playing"} · ${clock(state.backgroundFeedback.position)}${state.backgroundFeedback.error ? ` · ${state.backgroundFeedback.error}` : ""}`
        : `Background ${live.backgroundPlayback.paused ? "Paused" : "Play diminta"}`
      : "";
  return (
    <section
      className="panel live"
      aria-label="LIVE projector control"
      data-staged={staged ? "true" : undefined}
      ref={region}
      tabIndex={0}
    >
      <div className="pane-head">
        <h2 className="pane-title">
          Live Output
          <span className="pane-subject">
            {shown
              ? ` - ${shown.deck.frames[shown.index]?.title || shown.deck.label}`
              : ""}
          </span>
          {staged && (
            <span
              className="staged-badge"
              data-testid="staged-badge"
              title="Belum tampil di proyektor. Klik Go Live untuk menampilkannya."
            >
              Belum tayang · klik Go Live
            </span>
          )}
        </h2>
        <span
          className="pane-status"
          data-connected={
            state.connection.status === "Tersinkron" ? "true" : undefined
          }
          data-testid="connection-status"
          title={`Fullscreen: ${state.connection.fullscreen ? "aktif" : "tidak aktif"} · Mode: ${live?.mode ?? "black"} · Dikirim ${state.sequence} · Dirender ${state.connection.ack < 0 ? "—" : state.connection.ack} · Shortcut ← → PgUp PgDn Space B C`}
        >
          {state.connection.status}
        </span>
      </div>
      {/* Live Output: the monitor, then one row with slide steps, lyric
          size/outline and Edit teks. */}
      <div className="output-area output-fill">
        <div className="output-frame">
          <div className="presentation-canvas">
            {staged ? (
              <SlideCanvas
                deck={staged.deck}
                index={staged.index}
                mode="normal"
                nonce="preview"
                backgroundPlayback={stagedBackgroundPlayback}
              />
            ) : (
              <SlideCanvas
                deck={live?.deck ?? null}
                index={live?.index}
                mode={live?.mode ?? "black"}
                role="monitor"
                playback={live?.playback}
                backgroundPlayback={live?.backgroundPlayback}
                alert={live?.alert?.text}
                follow={state.playbackFeedback}
                backgroundFollow={state.backgroundFeedback}
              />
            )}
          </div>
        </div>
        <div className="output-foot">
          <span>
            {shown
              ? `Slide ${shown.index + 1} of ${shown.deck.frames.length}${
                  !staged && live?.mode === "black"
                    ? " · BLACK"
                    : !staged && live?.mode === "clearText"
                      ? " · CLEAR TEXT"
                      : ""
                }`
              : ""}
          </span>
          <div className="step-buttons">
            <button
              className="step"
              aria-label="Slide sebelumnya LIVE"
              disabled={!editable || !shown || shown.index === 0}
              onClick={() => step(-1)}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              className="step"
              aria-label="Slide berikutnya LIVE"
              disabled={
                !editable ||
                !shown ||
                shown.index === shown.deck.frames.length - 1
              }
              onClick={() => step(1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <label className="foot-range" title="Ukuran font lirik (semua slide)">
            Ukuran
            <input
              type="range"
              aria-label="Ukuran font LIVE"
              min="1"
              max="100"
              value={size}
              disabled={!editable}
              onChange={(e) => {
                const value = Number(e.target.value);
                setSize(value);
                later({ fontSize: fontPx(value) });
              }}
            />
            <output>{size}%</output>
          </label>
          <label className="foot-range" title="Tebal outline hitam lirik">
            Outline
            <input
              type="range"
              aria-label="Outline LIVE"
              min="1"
              max="100"
              value={outline}
              disabled={!editable}
              onChange={(e) => {
                const value = Number(e.target.value);
                setOutline(value);
                later({ outline: outlinePx(value) });
              }}
            />
            <output>{outline}%</output>
          </label>
          <button
            className="button secondary edit-open"
            aria-haspopup="dialog"
            title={
              !frame
                ? "Pilih lagu atau slide dulu"
                : frame.kind === "media"
                  ? "Slide media tidak punya teks"
                  : frame.kind === "scripture"
                    ? "Teks Scripture baca-saja"
                    : staged
                      ? "Ubah teks slide ini sebelum Go Live"
                      : "Ubah teks slide yang sedang LIVE"
            }
            disabled={!editable || !textFrame}
            onClick={openEditor}
          >
            <Pencil size={13} /> Edit teks
          </button>
        </div>
        {/* Same slot as under Preview Output, so both monitors keep the
            same size and position whatever is on screen. */}
        <div className="output-slot">
          {playbackStatus && (
            <span
              className="output-status"
              role="status"
              title={playbackStatus}
            >
              {playbackStatus}
            </span>
          )}
          {live?.backgroundPlayback && (
            <fieldset
              className="slot-controls"
              disabled={!editable}
              aria-label="Background LIVE controls"
            >
              <button
                className="button secondary"
                disabled={live.mode === "black"}
                title="Background video tanpa suara. Setelah refresh/recovery perlu Play lagi."
                onClick={() => run(() => controller.background(false))}
              >
                Play background LIVE
              </button>
              <button
                className="button secondary"
                onClick={() => run(() => controller.background(true))}
              >
                Pause background LIVE
              </button>
              <span className="field-help">silent</span>
            </fieldset>
          )}
          {live?.playback && (
            <fieldset
              className="slot-controls"
              disabled={!editable}
              aria-label="Video LIVE controls"
            >
              <button
                className="button secondary"
                disabled={live.mode === "black"}
                onClick={() => run(() => controller.video({ paused: false }))}
              >
                Play LIVE
              </button>
              <button
                className="button secondary"
                onClick={() => run(() => controller.video({ paused: true }))}
              >
                Pause LIVE
              </button>
              <label>
                <input
                  type="checkbox"
                  aria-label="Loop LIVE"
                  checked={live.playback.loop}
                  onChange={(e) =>
                    run(() => controller.video({ loop: e.target.checked }))
                  }
                />{" "}
                Loop
              </label>
              <label>
                <input
                  type="checkbox"
                  aria-label="Mute LIVE"
                  checked={live.playback.muted}
                  onChange={(e) =>
                    run(() => controller.video({ muted: e.target.checked }))
                  }
                />{" "}
                Mute
              </label>
              <label className="slot-volume">
                <input
                  type="range"
                  aria-label="Volume LIVE"
                  min="0"
                  max="200"
                  step="5"
                  title="Volume LIVE. Di atas 100% = penguat volume (suara bisa pecah jika video sudah keras)"
                  value={live.playback.volume * 100}
                  onChange={(e) =>
                    run(() =>
                      controller.video({
                        volume: Number(e.target.value) / 100,
                      }),
                    )
                  }
                />
                <output>{Math.round(live.playback.volume * 100)}%</output>
              </label>
            </fieldset>
          )}
        </div>
        {state.connection.error && (
          <p className="save-message live-error" role="status">
            {state.connection.error}
          </p>
        )}
      </div>
      {editing && shown && frame && (
        <div
          className="dialog-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
        >
          <div
            className="edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Edit teks LIVE"
          >
            <div className="pane-head">
              <h3 className="pane-title">
                Edit teks LIVE
                <span className="pane-subject">
                  {` - ${frame.title} · ${frame.label}`}
                </span>
              </h3>
              <button
                className="pane-icon"
                aria-label="Tutup edit teks"
                onClick={() => setEditing(false)}
              >
                <X size={14} />
              </button>
            </div>
            <fieldset className="slide-editor" disabled={!editable}>
              <textarea
                autoFocus
                aria-label="Teks slide LIVE"
                maxLength={30000}
                rows={Math.min(10, Math.max(4, text.split("\n").length + 1))}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="edit-actions">
                <span className="edit-spacer" />
                <button
                  className="button secondary"
                  title="Kembalikan teks sumber"
                  onClick={() =>
                    void applyEdit(shown.deck.pages[frame.page].text)
                  }
                >
                  Reset
                </button>
                <button
                  className="button primary"
                  disabled={text === frameText(shown.deck, shown.index)}
                  onClick={() => void applyEdit(text)}
                >
                  {staged ? "Terapkan" : "Terapkan ke Live"}
                </button>
              </div>
              <p className="field-help edit-note">
                {staged
                  ? "Belum tayang: tampil di proyektor setelah Go Live. Hanya slide ini; lagu di Musik tidak berubah."
                  : "Langsung tampil di layar jemaat. Hanya slide ini; lagu di Musik tidak berubah."}
              </p>
            </fieldset>
          </div>
        </div>
      )}
    </section>
  );
}
