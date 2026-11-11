import { useLayoutEffect, useRef, useState } from "react";
import { cssBackground } from "../themes/builtins";
import { backgroundRefs } from "../themes/models";
import {
  effectiveType,
  themeFor,
  effectPadding,
} from "../presentation/appearance";
import { frameText, type Deck, type Live } from "../presentation/models";
import { CaptionText, SlideText } from "./ScriptureText";
import { MediaCanvas } from "./MediaCanvas";
import type { Playback, PlaybackFeedback } from "../media/models";
export function ThemedFrame({
  deck,
  index,
  mode,
  role,
  playback,
  nonce,
  onRendered,
  onFeedback,
}: {
  deck: Deck;
  index: number;
  mode: Live["mode"];
  role?: "preview" | "monitor" | "audience";
  playback?: Playback;
  nonce?: string;
  onRendered?: (error?: string) => void;
  onFeedback?: (v: PlaybackFeedback) => void;
}) {
  const theme = themeFor(deck, index)!,
    type = effectiveType(deck, index)!,
    bg = theme.spec.background,
    frame = deck.frames[index],
    caption = frame.kind === "scripture" ? frame.scripture : null,
    parallel =
      frame.kind === "scripture" ? deck.pages[frame.page]?.parallel : undefined,
    scale = (deck.render?.canvas.height ?? 1080) / 1080,
    pad = effectPadding(type),
    body = useRef<HTMLDivElement>(null),
    box = useRef<HTMLDivElement>(null),
    footer = useRef<HTMLDivElement>(null),
    [backgroundReady, setReady] = useState(""),
    render = useRef(onRendered);
  render.current = onRendered;
  const assetKey =
    bg.kind === "image" || bg.kind === "video"
      ? `${bg.asset.id}:${bg.asset.digest}`
      : "plain";
  const checks = () => {
    if (mode === "black") {
      render.current?.();
      return;
    }
    const good =
      body.current &&
      box.current &&
      body.current.scrollHeight <= box.current.clientHeight + 1 &&
      body.current.scrollWidth <= box.current.clientWidth + 1 &&
      (!caption ||
        (footer.current &&
          footer.current.scrollHeight <= footer.current.clientHeight + 1 &&
          footer.current.scrollWidth <= footer.current.clientWidth + 1));
    if (!good) {
      render.current?.(
        "Tipografi/referensi/atribusi melebihi area; frame terakhir dipertahankan.",
      );
      return;
    }
    if (assetKey === "plain" || backgroundReady === assetKey)
      render.current?.();
  };
  useLayoutEffect(checks, [
    deck,
    index,
    mode,
    backgroundReady,
    playback?.revision,
  ]);
  return (
    <>
      <div
        className="theme-background"
        style={{
          background: mode === "black" ? "#000" : cssBackground(bg),
          visibility: mode === "black" ? "hidden" : "visible",
        }}
      >
        {(bg.kind === "image" || bg.kind === "video") && (
          <MediaCanvas
            asset={bg.asset}
            allowed={backgroundRefs(theme.spec)}
            frameId={playback?.frameId ?? `background:${bg.asset.id}`}
            mode={mode}
            role={role === "monitor" ? "monitor" : "audience"}
            playback={
              bg.kind === "video"
                ? {
                    ...playback,
                    frameId: playback?.frameId ?? `background:${bg.asset.id}`,
                    revision: playback?.revision ?? 0,
                    paused: playback?.paused ?? true,
                    position: playback?.position ?? 0,
                    loop: true,
                    muted: true,
                    volume: 0,
                  }
                : undefined
            }
            nonce={nonce}
            silent
            fit={bg.fit}
            position={{ x: bg.x, y: bg.y }}
            onFeedback={onFeedback}
            onRendered={(error) => {
              if (error) render.current?.(error);
              else setReady(assetKey);
            }}
          />
        )}
        {(bg.kind === "image" || bg.kind === "video") && (
          <div
            className="theme-dim"
            style={{ background: "#000", opacity: bg.dim }}
          />
        )}
      </div>
      <div
        className="themed-safe-area"
        ref={box}
        style={{
          left: `calc(${type.margins.left}% + ${pad * scale}px)`,
          right: `calc(${type.margins.right}% + ${pad * scale}px)`,
          top: `calc(${type.margins.top}% + ${pad * scale}px)`,
          bottom: `calc(${type.margins.bottom}% + ${(pad + (caption ? 170 : 0)) * scale}px)`,
          justifyContent:
            type.vertical === "top"
              ? "flex-start"
              : type.vertical === "bottom"
                ? "flex-end"
                : "center",
          visibility: mode === "normal" ? "visible" : "hidden",
        }}
      >
        <div
          ref={body}
          className={`slide-lines themed-lines${parallel !== undefined ? " slide-columns" : ""}`}
          style={{
            fontFamily: type.font,
            fontSize: type.size * scale,
            fontWeight: type.weight,
            fontStyle: type.italic ? "italic" : "normal",
            textDecoration: type.underline ? "underline" : "none",
            lineHeight: type.lineHeight,
            textAlign: type.align,
            color: type.color,
            WebkitTextStroke: type.outline.width
              ? `${type.outline.width * scale}px ${type.outline.color}`
              : undefined,
            paintOrder: "stroke fill",
            textShadow:
              type.shadow.blur || type.shadow.x || type.shadow.y
                ? `${type.shadow.x * scale}px ${type.shadow.y * scale}px ${type.shadow.blur * scale}px ${type.shadow.color}`
                : "none",
          }}
        >
          <SlideText text={frameText(deck, index)} parallel={parallel} />
        </div>
      </div>
      {caption && (
        <div
          ref={footer}
          className="scripture-footer themed-footer"
          style={{
            left: `${Math.max(3, type.margins.left)}%`,
            right: `${Math.max(3, type.margins.right)}%`,
            bottom: `${type.margins.bottom}%`,
            height: 150 * scale,
            fontFamily: type.font,
            visibility: mode === "normal" ? "visible" : "hidden",
            background: "#000",
            color: "#fff",
          }}
        >
          <CaptionText
            caption={caption}
            referenceStyle={{ fontSize: 32 * scale }}
            attributionStyle={{ fontSize: 24 * scale }}
          />
        </div>
      )}
    </>
  );
}
