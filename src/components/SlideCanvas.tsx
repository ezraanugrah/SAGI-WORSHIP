import { ThemedFrame } from "./ThemedFrame";
import { themeFor } from "../presentation/appearance";
import { MediaCanvas } from "./MediaCanvas";
import {
  mediaRefs,
  type Playback,
  type PlaybackFeedback,
} from "../media/models";
import { useLayoutEffect, useRef, useState } from "react";
import { frameText, type Deck, type Live } from "../presentation/models";
import { CaptionText, SlideText } from "./ScriptureText";
export function SlideCanvas({
  deck,
  index = 0,
  mode = "normal",
  onRendered,
  role,
  playback,
  nonce,
  onFeedback,
  backgroundPlayback,
  alert,
  follow,
  backgroundFollow,
}: {
  deck: Deck | null;
  index?: number;
  mode?: Live["mode"];
  /** Scrolling alert text over the slide (hidden while Black). */
  alert?: string;
  onRendered?: (error?: string) => void;
  role?: "preview" | "monitor" | "audience";
  playback?: Playback;
  nonce?: string;
  onFeedback?: (f: PlaybackFeedback) => void;
  backgroundPlayback?: Playback;
  /** Live Output monitor: projector reports for the video / background video. */
  follow?: PlaybackFeedback;
  backgroundFollow?: PlaybackFeedback;
}) {
  const container = useRef<HTMLDivElement>(null),
    lines = useRef<HTMLDivElement>(null),
    box = useRef<HTMLDivElement>(null),
    [scale, setScale] = useState(0);
  const width = deck?.render?.canvas.width ?? 1920,
    height = deck?.render?.canvas.height ?? 1080;
  const theme = deck ? themeFor(deck, index) : undefined;
  const text = deck ? frameText(deck, index) : "";
  const frame = deck?.frames[index],
    caption = frame?.kind === "scripture" ? frame.scripture : null,
    parallel =
      deck && frame?.kind === "scripture"
        ? deck.pages[frame.page]?.parallel
        : undefined,
    // A slide holding several verses may use a smaller font.
    pageFontSize =
      deck && frame?.kind === "scripture"
        ? deck.pages[frame.page]?.fontSize
        : undefined;
  const footer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setScale(
        Math.min(
          element.clientWidth / width,
          element.clientHeight / height,
          deck?.render?.canvas.scaling === "no-upscale" ? 1 : Infinity,
        ),
      ),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [width, height, deck?.render?.canvas.scaling]);
  useLayoutEffect(() => {
    if (!deck || frame?.kind === "media" || theme) return;
    const fits =
      mode !== "normal" ||
      (!!lines.current &&
        !!box.current &&
        lines.current.scrollWidth <= box.current.clientWidth + 1 &&
        lines.current.scrollHeight <= box.current.clientHeight + 1 &&
        (!caption ||
          (!!footer.current &&
            footer.current.scrollHeight <= footer.current.clientHeight + 1 &&
            footer.current.scrollWidth <= footer.current.clientWidth + 1)));
    onRendered?.(
      fits
        ? undefined
        : "Teks melebihi safe area. Frame terakhir dipertahankan.",
    );
  }, [deck, index, mode, onRendered]);
  return (
    <div
      className="slide-viewport"
      ref={container}
      data-testid="slide-canvas"
      data-mode={mode}
    >
      <div
        className={`slide-reference theme-${deck?.style.theme ?? "black"}`}
        style={{
          width,
          height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          visibility: scale ? "visible" : "hidden",
          background: mode === "black" ? "#000" : undefined,
        }}
      >
        {deck && theme && (
          <ThemedFrame
            deck={deck}
            index={index}
            mode={mode}
            role={role}
            playback={backgroundPlayback}
            nonce={nonce}
            onRendered={onRendered}
            onFeedback={onFeedback}
            follow={backgroundFollow}
          />
        )}
        {deck && frame?.kind === "media" && (
          <MediaCanvas
            asset={frame.media}
            allowed={mediaRefs(deck)}
            frameId={frame.id}
            mode={mode}
            role={role}
            playback={playback}
            nonce={nonce}
            onFeedback={onFeedback}
            onRendered={onRendered}
            follow={follow}
          />
        )}
        {deck && !theme && frame?.kind !== "media" && (
          <div
            className="slide-safe-area"
            ref={box}
            style={{
              inset: `${deck.style.safeMargin}%`,
              ...(caption
                ? { bottom: `calc(${deck.style.safeMargin}% + 170px)` }
                : {}),
              visibility: mode === "normal" ? "visible" : "hidden",
            }}
          >
            <div
              className={`slide-lines${parallel !== undefined ? " slide-columns" : ""}`}
              ref={lines}
              style={{
                fontFamily: deck.style.font,
                fontSize: pageFontSize ?? deck.style.fontSize,
                lineHeight: 1.3,
              }}
            >
              <SlideText text={text} parallel={parallel} />
            </div>
          </div>
        )}
        {deck && !theme && caption && (
          <div
            className="scripture-footer"
            ref={footer}
            style={{
              left: `${deck.style.safeMargin}%`,
              right: `${deck.style.safeMargin}%`,
              bottom: `${deck.style.safeMargin}%`,
              visibility: mode === "normal" ? "visible" : "hidden",
              fontFamily: deck.style.font,
            }}
          >
            <CaptionText caption={caption} />
          </div>
        )}
        {alert && mode !== "black" && (
          <div className="slide-alert" data-testid="slide-alert">
            <span
              style={{
                animationDuration: `${Math.max(12, alert.length * 0.22)}s`,
              }}
            >
              {alert}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
