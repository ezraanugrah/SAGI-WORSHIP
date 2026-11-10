import { useLayoutEffect, useRef } from "react";
import { revealInPane } from "./revealInPane";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { slideSummary } from "./PreviewWorkspace";
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
  const current = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    revealInPane(current.current);
  }, [live?.deck.id, live?.index]);
  return (
    <section
      className="panel live"
      aria-label="LIVE projector control"
      ref={region}
      tabIndex={0}
    >
      <div className="pane-head">
        <h2 className="pane-title">
          Live
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
        >
          {state.connection.status}
        </span>
      </div>
      <div className="pane-body slide-rows-wrap">
        {live ? (
          <div
            className="slide-rows"
            role="list"
            aria-label="Daftar slide LIVE"
          >
            {live.deck.frames.map((frame, index) => {
              const chosen = index === live.index;
              const go = () => {
                if (!chosen && editable)
                  run(() => controller.navigate(index - live.index));
              };
              return (
                <div
                  key={frame.id}
                  ref={chosen ? current : undefined}
                  role="listitem"
                  tabIndex={editable ? 0 : -1}
                  aria-label={`LIVE slide ${index + 1}: ${frame.title} ${frame.label}`}
                  aria-current={chosen ? "true" : undefined}
                  className={chosen ? "slide-row chosen live" : "slide-row"}
                  onClick={go}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      go();
                    }
                  }}
                >
                  <span className="slide-num">{index + 1}</span>
                  <div className="slide-main">
                    <div className="slide-tag" data-kind={frame.kind ?? "song"}>
                      {frame.label}
                      <small>{frame.title}</small>
                    </div>
                    <div className="slide-text">
                      {slideSummary(live.deck, index)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="box-empty">
            Belum LIVE. Siapkan slide di Preview lalu klik Go Live (kanan atas).
          </p>
        )}
      </div>
      <div className="output-area">
        <div className="box-label">Live Output</div>
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
              : "Belum LIVE"}
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
        <div className="live-diagnostics">
          <p className="field-help">
            Fullscreen: {state.connection.fullscreen ? "Aktif" : "Tidak aktif"}{" "}
            · Mode: {live?.mode ?? "black"} · Dikirim {state.sequence} ·
            Dirender {state.connection.ack < 0 ? "—" : state.connection.ack} ·
            Shortcut ← → PgUp PgDn Space B C
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
      </div>
    </section>
  );
}
