import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SlideCanvas } from "./SlideCanvas";
import {
  PresentationController,
  type PresentationState,
} from "../presentation/controller";
import { usePresentationShortcuts } from "../hooks/usePresentationShortcuts";
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
        </div>
        {live?.backgroundPlayback && (
          <fieldset
            className="video-controls"
            disabled={!editable}
            aria-label="Background LIVE controls"
          >
            <button
              className="button secondary"
              disabled={live.mode === "black"}
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
            <span>
              Silent ·{" "}
              {state.backgroundFeedback?.frameId ===
              live.backgroundPlayback.frameId
                ? `${state.backgroundFeedback.paused ? "Paused" : "Playing"} · ${state.backgroundFeedback.position.toFixed(1)}s ${state.backgroundFeedback.error ?? ""}`
                : live.backgroundPlayback.paused
                  ? "Paused"
                  : "Play diminta"}{" "}
              · refresh/recovery membutuhkan Play baru
            </span>
          </fieldset>
        )}
        {live?.playback && (
          <fieldset
            className="video-controls"
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
            <label>
              Volume LIVE
              <input
                type="range"
                aria-label="Volume LIVE"
                min="0"
                max="100"
                value={live.playback.volume * 100}
                onChange={(e) =>
                  run(() =>
                    controller.video({ volume: Number(e.target.value) / 100 }),
                  )
                }
              />
            </label>
            <p role="status">
              {state.playbackFeedback?.frameId === live.playback.frameId
                ? `${state.playbackFeedback.paused ? "Paused" : "Playing"} · ${state.playbackFeedback.position.toFixed(1)}s ${state.playbackFeedback.error ?? ""}`
                : "Menunggu status playback proyektor"}
            </p>
          </fieldset>
        )}
        {state.connection.error && (
          <p className="save-message live-error" role="status">
            {state.connection.error}
          </p>
        )}
      </div>
    </section>
  );
}
