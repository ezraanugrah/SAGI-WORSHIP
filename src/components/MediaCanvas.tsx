import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { boosted, setVolume } from "../media/volumeBoost";
import { readVerifiedAsset } from "../media/assetReader";
import { waitEvent } from "../media/validation";
import {
  type AssetRef,
  type Playback,
  type PlaybackFeedback,
} from "../media/models";
export function MediaCanvas({
  asset,
  allowed,
  frameId,
  mode,
  role = "preview",
  playback,
  nonce,
  onRendered,
  onFeedback,
  silent = false,
  fit = "contain",
  position = { x: 50, y: 50 },
}: {
  asset: AssetRef;
  allowed: AssetRef[];
  frameId: string;
  mode: string;
  role?: "preview" | "monitor" | "audience";
  playback?: Playback;
  nonce?: string;
  onRendered?: (error?: string) => void;
  onFeedback?: (f: PlaybackFeedback) => void;
  silent?: boolean;
  fit?: "contain" | "cover";
  position?: { x: number; y: number };
}) {
  const [loaded, setLoaded] = useState<{ asset: AssetRef; url: string } | null>(
      null,
    ),
    video = useRef<HTMLVideoElement>(null),
    render = useRef(onRendered),
    feedback = useRef(onFeedback),
    previewInitialized = useRef<HTMLVideoElement | null>(null),
    positioned = useRef<{ element: HTMLVideoElement; frameId: string } | null>(
      null,
    ),
    token = useRef(0);
  render.current = onRendered;
  feedback.current = onFeedback;

  useEffect(() => {
    const generation = ++token.current,
      abort = new AbortController();
    let url = "",
      adopted = false;
    void (async () => {
      try {
        // Every output verifies a payload once per window (payloads are
        // immutable and digest-addressed). Re-hashing a large video on each
        // Preview or Go Live competed with the projector, which shares the
        // operator's browser process, and made LIVE video skip frames.
        const verified = await readVerifiedAsset(asset, allowed);
        if (generation !== token.current) return;
        url = URL.createObjectURL(verified.blob);
        if (asset.kind === "image") {
          // Decode every time: each blob URL is decoded anew, and decoding
          // before mounting keeps the previous slide up until it is ready.
          const image = new Image();
          image.src = url;
          await image.decode();
          if (
            image.naturalWidth !== asset.width ||
            image.naturalHeight !== asset.height
          )
            throw new Error("Dimensi aset tidak sesuai");
        } else if (!verified.decoded) {
          // A video already probed in this window (projector preflight or an
          // earlier load) mounts at once instead of being decoded twice.
          const probe = document.createElement("video");
          probe.muted = true;
          probe.preload = "auto";
          try {
            const ready = waitEvent(probe, "loadeddata", abort.signal);
            probe.src = url;
            await ready;
            if (
              probe.videoWidth !== asset.width ||
              probe.videoHeight !== asset.height
            )
              throw new Error("Dimensi video tidak sesuai");
          } finally {
            probe.removeAttribute("src");
            probe.load();
          }
        }
        verified.decoded = true;
        if (generation !== token.current) return;
        adopted = true;
        setLoaded({ asset, url });
      } catch (e) {
        if (generation === token.current && !abort.signal.aborted)
          render.current?.((e as Error).message);
      } finally {
        if (url && !adopted) URL.revokeObjectURL(url);
      }
    })();
    return () => {
      token.current++;
      abort.abort();
    };
  }, [asset.id, asset.digest]);
  useEffect(
    () => () => {
      if (loaded) URL.revokeObjectURL(loaded.url);
    },
    [loaded],
  );
  useEffect(() => {
    const element = video.current;
    return () => {
      if (element) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
    };
  }, [loaded]);
  const active =
    loaded?.asset.id === asset.id && loaded.asset.digest === asset.digest;
  useLayoutEffect(() => {
    if (mode === "black") {
      video.current?.pause();
      if (video.current) video.current.muted = true;
      render.current?.();
    } else if (active && asset.kind === "image") render.current?.();
  }, [active, mode, asset.id, playback?.revision]);
  useEffect(() => {
    const v = video.current;
    if (!v || !active) return;
    let activeCommand = true;
    const p = playback;
    v.loop = p?.loop ?? false;
    if (role !== "preview" || previewInitialized.current !== v) {
      const level = silent ? 0 : (p?.volume ?? 0.8);
      // Only the projector may go above 100%; Preview stays at most 100%.
      if (role === "audience") setVolume(v, level);
      else v.volume = Math.min(1, level);
      v.muted =
        silent || role === "monitor" || mode === "black" || (p?.muted ?? true);
      if (role === "preview") previewInitialized.current = v;
    }
    // Above 100% the projector needs one click before Chrome lets the
    // volume boost run; tell the operator in the LIVE playback status.
    const wantsBoost = role === "audience" && !silent && (p?.volume ?? 0) > 1;
    const report = (error?: string) => {
      if (!activeCommand) return;
      const hint =
        !error && wantsBoost && !v.muted && !boosted(v)
          ? "Volume >100% menunggu satu klik di jendela proyektor"
          : undefined;
      feedback.current?.({
        frameId,
        revision: p?.revision ?? 0,
        position: Number.isFinite(v.currentTime) ? v.currentTime : 0,
        paused: v.paused,
        ended: v.ended,
        ...(error || hint ? { error: error ?? hint } : {}),
      });
    };
    const apply = async () => {
      if (!activeCommand) return;
      try {
        if (
          mode !== "black" &&
          (positioned.current?.element !== v ||
            positioned.current.frameId !== frameId) &&
          p &&
          Number.isFinite(p.position) &&
          Math.abs(v.currentTime - p.position) > 0.25
        )
          v.currentTime = Math.min(
            p.position,
            Math.max(0, (v.duration || 0) - 0.01),
          );
        positioned.current = { element: v, frameId };
        if (
          mode === "black" ||
          role === "monitor" ||
          p?.paused !== false ||
          p.target !== nonce
        ) {
          v.pause();
          report();
        } else await v.play();
        if (activeCommand) render.current?.();
      } catch (e) {
        report(`Playback diblokir/gagal: ${(e as Error).message}`);
        render.current?.();
      }
    };
    if (role !== "preview") {
      if (v.readyState >= 2) void apply();
      else v.addEventListener("loadeddata", apply, { once: true });
    } else if (mode === "black") v.pause();
    const ended = () => report();
    const timer = setInterval(() => report(), 1000);
    const error = () => {
      report("Decode video gagal saat playback.");
      v.pause();
    };
    v.addEventListener("error", error);
    v.addEventListener("ended", ended);
    return () => {
      activeCommand = false;
      clearInterval(timer);
      v.removeEventListener("loadeddata", apply);
      v.removeEventListener("error", error);
      v.removeEventListener("ended", ended);
    };
  }, [loaded, active, playback?.revision, mode, nonce, role, frameId, silent]);
  return (
    <div
      className="media-canvas"
      data-asset-id={loaded?.asset.id ?? ""}
      style={{ visibility: mode === "black" ? "hidden" : "visible" }}
    >
      {loaded &&
        (loaded.asset.kind === "video" ? (
          <video
            key={loaded.url}
            ref={video}
            src={loaded.url}
            preload="auto"
            playsInline
            muted
            controls={role === "preview" && !silent}
            style={{
              objectFit: fit,
              objectPosition: `${position.x}% ${position.y}%`,
            }}
            aria-label={role === "preview" ? "Video Preview" : "Video LIVE"}
            onLoadedData={() => {
              if (active) render.current?.();
            }}
          />
        ) : (
          <img
            src={loaded.url}
            alt=""
            style={{
              objectFit: fit,
              objectPosition: `${position.x}% ${position.y}%`,
            }}
          />
        ))}
    </div>
  );
}
