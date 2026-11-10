/**
 * Plays a video louder than its own level (up to VOLUME_MAX = 200%) on the
 * projector. Up to 100% the browser volume is used as before; above that the
 * sound goes through a Web Audio gain. Chrome only starts audio processing
 * after a click in that window, so until then the video plays at 100%.
 */
export const VOLUME_MAX = 2;

let context: AudioContext | null = null;
const gains = new WeakMap<HTMLMediaElement, GainNode>();
const wanted = new WeakMap<HTMLMediaElement, number>();
const pending = new WeakSet<HTMLMediaElement>();

export function clampVolume(volume: number) {
  return Math.max(0, Math.min(VOLUME_MAX, volume));
}

/** Set the loudness of `el` (0–2). Returns false while a boost is waiting. */
export function setVolume(el: HTMLMediaElement, volume: number) {
  const level = clampVolume(volume);
  wanted.set(el, level);
  const gain = gains.get(el);
  if (gain) {
    el.volume = 1;
    gain.gain.value = level;
    return true;
  }
  if (level <= 1) {
    el.volume = level;
    return true;
  }
  el.volume = 1; // loudest without Web Audio until the boost is ready
  void attach(el);
  return false;
}

export function boosted(el: HTMLMediaElement) {
  return gains.has(el);
}

async function attach(el: HTMLMediaElement) {
  if (pending.has(el) || gains.has(el) || typeof AudioContext === "undefined")
    return;
  pending.add(el);
  try {
    context ??= new AudioContext();
    if (context.state !== "running")
      await Promise.race([
        context.resume(),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
    if (context.state !== "running") {
      retryAfterGesture(el);
      return;
    }
    const source = context.createMediaElementSource(el),
      gain = context.createGain();
    gain.gain.value = wanted.get(el) ?? 1;
    source.connect(gain).connect(context.destination);
    gains.set(el, gain);
    el.volume = 1;
  } catch {
    /* boost unavailable: the video keeps playing at 100% */
  } finally {
    pending.delete(el);
  }
}

function retryAfterGesture(el: HTMLMediaElement) {
  const once = () => {
    window.removeEventListener("pointerdown", once, true);
    window.removeEventListener("keydown", once, true);
    void attach(el);
  };
  window.addEventListener("pointerdown", once, true);
  window.addEventListener("keydown", once, true);
}
