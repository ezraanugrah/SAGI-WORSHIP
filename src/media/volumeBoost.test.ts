import { afterEach, describe, expect, it, vi } from "vitest";

class FakeGain {
  gain = { value: 1 };
  connect<T>(next: T) {
    return next;
  }
}
function fakeAudio(state: "running" | "suspended") {
  const created: FakeGain[] = [];
  class FakeContext {
    state = state;
    destination = {};
    resume = () =>
      state === "running" ? Promise.resolve() : new Promise<void>(() => {});
    createMediaElementSource() {
      return { connect: <T>(next: T) => next };
    }
    createGain() {
      const g = new FakeGain();
      created.push(g);
      return g;
    }
  }
  return { FakeContext, created };
}
const element = () => ({ volume: 1 }) as unknown as HTMLMediaElement;

describe("projector volume boost (up to 200%)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  it("uses the browser volume up to 100% and a gain above it", async () => {
    const { FakeContext, created } = fakeAudio("running");
    vi.stubGlobal("AudioContext", FakeContext);
    const { setVolume, boosted, clampVolume } = await import("./volumeBoost");
    expect(clampVolume(3)).toBe(2);
    expect(clampVolume(-1)).toBe(0);
    const el = element();
    expect(setVolume(el, 0.5)).toBe(true);
    expect(el.volume).toBe(0.5);
    expect(created).toHaveLength(0);
    expect(setVolume(el, 1.5)).toBe(false);
    expect(el.volume).toBe(1);
    await vi.waitFor(() => expect(boosted(el)).toBe(true));
    expect(created[0].gain.value).toBe(1.5);
    // Once boosted the gain carries the level, including going back down.
    expect(setVolume(el, 0.4)).toBe(true);
    expect(el.volume).toBe(1);
    expect(created[0].gain.value).toBe(0.4);
    setVolume(el, 5);
    expect(created[0].gain.value).toBe(2);
  });
  it("plays at 100% until a click lets Chrome start audio processing", async () => {
    const { FakeContext } = fakeAudio("suspended");
    const target = new EventTarget();
    vi.stubGlobal("AudioContext", FakeContext);
    vi.stubGlobal("window", target);
    const { setVolume, boosted } = await import("./volumeBoost");
    const el = element();
    setVolume(el, 1.8);
    expect(el.volume).toBe(1);
    await new Promise((r) => setTimeout(r, 450));
    expect(boosted(el)).toBe(false);
    expect(el.volume).toBe(1);
  });
  it("without Web Audio the video simply stays at 100%", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const { setVolume, boosted } = await import("./volumeBoost");
    const el = element();
    setVolume(el, 2);
    await new Promise((r) => setTimeout(r, 10));
    expect(el.volume).toBe(1);
    expect(boosted(el)).toBe(false);
  });
});
