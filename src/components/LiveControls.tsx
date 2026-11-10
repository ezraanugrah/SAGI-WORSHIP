import { useRef } from "react";
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
  dirty,
}: {
  controller: PresentationController;
  state: PresentationState;
  editable: boolean;
  dirty: boolean;
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
      <div className="live-heading">
        <h2 className="panel-heading">Live</h2>
        <span className="disconnected" data-testid="connection-status">
          {state.connection.status}
        </span>
      </div>
      <div className="live-control-body">
        <div className="live-monitor">
          <div className="box-label">Projector preview</div>
          <div className="presentation-canvas">
            <SlideCanvas
              deck={live?.deck ?? null}
              index={live?.index}
              mode={live?.mode ?? "black"}
              role="monitor"
              playback={live?.playback}
              backgroundPlayback={live?.backgroundPlayback}
            />
          </div>
        </div>
        <div className="live-main-buttons">
          <div className="live-row two">
            <button
              className="button live-btn"
              aria-pressed={live?.mode === "black"}
              disabled={!editable || !live}
              onClick={() => run(() => controller.toggle("black"))}
            >
              Black
            </button>
            <button
              className="button live-btn"
              aria-pressed={live?.mode === "clearText"}
              disabled={!editable || !live}
              onClick={() => run(() => controller.toggle("clearText"))}
            >
              Clear Text
            </button>
          </div>
          <div className="live-row three">
            <button
              className="button live-btn"
              aria-label="Slide sebelumnya LIVE"
              disabled={!editable || !live || live.index === 0}
              onClick={() => run(() => controller.navigate(-1))}
            >
              {"< Prev"}
            </button>
            <button
              className="button primary live-btn go-live"
              disabled={
                !editable ||
                !state.preview ||
                dirty ||
                state.preparing ||
                !!state.recovery
              }
              onClick={() => run(() => controller.goLive())}
            >
              Go Live
            </button>
            <button
              className="button live-btn"
              aria-label="Slide berikutnya LIVE"
              disabled={
                !editable || !live || live.index === live.deck.frames.length - 1
              }
              onClick={() => run(() => controller.navigate(1))}
            >
              {"Next >"}
            </button>
          </div>
        </div>
        <div className="deck-position">
          <strong>{live?.deck.label ?? "Belum LIVE"}</strong>
          <span>
            {live ? `${live.index + 1} / ${live.deck.frames.length}` : "— / —"}
          </span>
          <button
            className="text-action"
            disabled={!editable || !live || live.mode === "normal"}
            onClick={() => run(() => controller.mode("normal"))}
          >
            Restore
          </button>
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
        <p className="field-help">
          Fullscreen: {state.connection.fullscreen ? "Aktif" : "Tidak aktif"} ·
          Mode: {live?.mode ?? "black"} · Dikirim {state.sequence} · Dirender{" "}
          {state.connection.ack < 0 ? "—" : state.connection.ack} · Shortcut ←
          → PgUp PgDn Space B C
        </p>
        {state.connection.error && (
          <p className="save-message" role="status">
            {state.connection.error}
          </p>
        )}
        <p className="field-help" role="status">
          {state.checkpoint}
        </p>
        <button
          className="text-button"
          disabled={!editable || !live}
          onClick={() => run(() => controller.retryCheckpoint())}
        >
          Coba checkpoint lagi
        </button>
      </div>
    </section>
  );
}
