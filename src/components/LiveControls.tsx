import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
export function LiveControls({
  controller,
  state,
  editable,
}: {
  controller: PresentationController;
  state: PresentationState;
  editable: boolean;
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
  const frame = live?.deck.frames[live.index];
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
      ref={region}
      tabIndex={0}
    >
      <div className="pane-head">
        <h2 className="pane-title">
          Live Output
          <span className="pane-subject">
            {live
              ? ` - ${live.deck.frames[live.index]?.title || live.deck.label}`
              : ""}
          </span>
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
      {/* Live column = Live Output only (slides are chosen in Preview). */}
      <div className="output-area output-fill">
        <div className="output-frame">
          <div className="presentation-canvas">
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
          </div>
        </div>
        <div className="output-foot">
          <span>
            {live
              ? `Slide ${live.index + 1} of ${live.deck.frames.length}${
                  live.mode === "black"
                    ? " · BLACK"
                    : live.mode === "clearText"
                      ? " · CLEAR TEXT"
                      : ""
                }`
              : ""}
          </span>
          <div className="step-buttons">
            <button
              className="step"
              aria-label="Slide sebelumnya LIVE"
              disabled={!editable || !live || live.index === 0}
              onClick={() => run(() => controller.navigate(-1))}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              className="step"
              aria-label="Slide berikutnya LIVE"
              disabled={
                !editable || !live || live.index === live.deck.frames.length - 1
              }
              onClick={() => run(() => controller.navigate(1))}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          {playbackStatus && (
            <span
              className="output-status"
              role="status"
              title={playbackStatus}
            >
              {playbackStatus}
            </span>
          )}
        </div>
        {/* Same slot as under Preview Output, so both monitors keep the
            same size and position whatever is on screen. */}
        <div className="output-slot">
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
    </section>
  );
}
