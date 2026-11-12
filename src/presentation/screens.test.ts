import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScreenChoice } from "./windowManager";

const laptop: ScreenChoice = {
  label: "Built-in Retina Display",
  left: 0,
  top: 0,
  width: 1512,
  height: 945,
  isPrimary: true,
  isInternal: true,
};
const projector: ScreenChoice = {
  label: "EPSON PJ",
  left: 1512,
  top: 0,
  width: 1920,
  height: 1080,
  isPrimary: false,
  isInternal: false,
};
const tv: ScreenChoice = { ...projector, label: "Whale TV", left: 3432 };

describe("projector screen choice", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("uses the external screen, never the laptop, and none with one screen", async () => {
    const { preferredScreen } = await import("./screens");
    expect(preferredScreen([laptop])).toBe(-1);
    expect(preferredScreen([laptop, projector])).toBe(1);
    expect(preferredScreen([projector, laptop])).toBe(0);
    // A secondary screen without "internal" info still beats the primary.
    expect(
      preferredScreen([laptop, { ...projector, isInternal: undefined }]),
    ).toBe(1);
  });
  it("remembers the operator's choice by name, also after a reload", async () => {
    const { preferredScreen, rememberScreen } = await import("./screens");
    rememberScreen(tv);
    expect(preferredScreen([laptop, projector, tv])).toBe(2);
    // The remembered screen is gone: back to the first external one.
    expect(preferredScreen([laptop, projector])).toBe(1);
    rememberScreen(undefined);
    expect(preferredScreen([laptop, projector, tv])).toBe(1);
  });
});
