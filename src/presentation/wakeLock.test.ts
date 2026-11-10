import { describe, expect, it } from "vitest";
import {
  ScreenWakeLock,
  type WakeLockEnvironment,
  type WakeLockStatus,
} from "./wakeLock";

class FakeSentinel {
  released = false;
  private listeners: (() => void)[] = [];
  async release() {
    if (this.released) return;
    this.released = true;
    this.listeners.forEach((l) => l());
  }
  addEventListener(_type: "release", listener: () => void) {
    this.listeners.push(listener);
  }
}

function environment(options: { supported?: boolean; fail?: boolean } = {}) {
  const sentinels: FakeSentinel[] = [];
  const visibility: (() => void)[] = [];
  const doc = {
    visibilityState: "visible",
    addEventListener: (_: "visibilitychange", l: () => void) =>
      visibility.push(l),
    removeEventListener: (_: "visibilitychange", l: () => void) => {
      const i = visibility.indexOf(l);
      if (i >= 0) visibility.splice(i, 1);
    },
  };
  const env: WakeLockEnvironment = {
    document: doc,
    ...(options.supported === false
      ? {}
      : {
          wakeLock: {
            request: async () => {
              if (options.fail) throw new Error("NotAllowedError");
              const s = new FakeSentinel();
              sentinels.push(s);
              return s;
            },
          },
        }),
  };
  return {
    env,
    sentinels,
    hide() {
      doc.visibilityState = "hidden";
      // Browsers release screen locks automatically when the page is hidden.
      sentinels.forEach((s) => void s.release());
      visibility.forEach((l) => l());
    },
    show() {
      doc.visibilityState = "visible";
      visibility.forEach((l) => l());
    },
    listeners: visibility,
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("screen wake lock during LIVE", () => {
  it("acquires one lock while active and releases it when LIVE ends", async () => {
    const e = environment(),
      statuses: WakeLockStatus[] = [];
    const lock = new ScreenWakeLock(e.env, (s) => statuses.push(s));
    lock.setActive(true);
    lock.setActive(true);
    await flush();
    expect(e.sentinels).toHaveLength(1);
    expect(lock.status).toBe("active");
    lock.setActive(false);
    await flush();
    expect(e.sentinels[0].released).toBe(true);
    expect(lock.status).toBe("idle");
    expect(statuses).toEqual(["active", "idle"]);
  });

  it("re-acquires after the page is hidden and shown again", async () => {
    const e = environment();
    const lock = new ScreenWakeLock(e.env);
    lock.setActive(true);
    await flush();
    e.hide();
    await flush();
    expect(lock.status).toBe("idle");
    expect(e.sentinels).toHaveLength(1);
    e.show();
    await flush();
    expect(e.sentinels).toHaveLength(2);
    expect(e.sentinels[1].released).toBe(false);
    expect(lock.status).toBe("active");
  });

  it("does not request while hidden and waits for visibility", async () => {
    const e = environment();
    e.hide();
    const lock = new ScreenWakeLock(e.env);
    lock.setActive(true);
    await flush();
    expect(e.sentinels).toHaveLength(0);
    e.show();
    await flush();
    expect(e.sentinels).toHaveLength(1);
  });

  it("reports unsupported browsers and request failures without throwing", async () => {
    const unsupported = new ScreenWakeLock(
      environment({ supported: false }).env,
    );
    unsupported.setActive(true);
    await flush();
    expect(unsupported.status).toBe("unsupported");
    const failing = new ScreenWakeLock(environment({ fail: true }).env);
    failing.setActive(true);
    await flush();
    expect(failing.status).toBe("error");
  });

  it("releases a lock that resolves after LIVE already ended, and stops listening", async () => {
    const e = environment();
    const lock = new ScreenWakeLock(e.env);
    lock.setActive(true);
    lock.setActive(false);
    await flush();
    expect(e.sentinels).toHaveLength(1);
    expect(e.sentinels[0].released).toBe(true);
    expect(lock.status).toBe("idle");
    lock.stop();
    expect(e.listeners).toHaveLength(0);
    lock.setActive(true);
    await flush();
    expect(e.sentinels).toHaveLength(1);
  });
});
