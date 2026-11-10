/**
 * Keeps the display awake while a LIVE session is running, so a static slide
 * (for example a long sermon verse) does not let the laptop or projector sleep.
 *
 * Uses the Screen Wake Lock API when available. Browsers release the lock when
 * the page is hidden; it is requested again when the page becomes visible.
 */
export type WakeLockStatus = "idle" | "active" | "unsupported" | "error";

type Sentinel = {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
};
export type WakeLockEnvironment = {
  wakeLock?: { request(type: "screen"): Promise<Sentinel> };
  document: {
    visibilityState: string;
    addEventListener(type: "visibilitychange", listener: () => void): void;
    removeEventListener(type: "visibilitychange", listener: () => void): void;
  };
};

export class ScreenWakeLock {
  private wanted = false;
  private sentinel: Sentinel | null = null;
  private requesting = false;
  private stopped = false;
  status: WakeLockStatus = "idle";

  constructor(
    private env: WakeLockEnvironment,
    private onStatus: (status: WakeLockStatus) => void = () => {},
  ) {
    env.document.addEventListener("visibilitychange", this.visibility);
  }

  setActive(active: boolean) {
    if (this.stopped) return;
    this.wanted = active;
    if (active) void this.acquire();
    else this.release();
  }

  stop() {
    this.stopped = true;
    this.wanted = false;
    this.env.document.removeEventListener("visibilitychange", this.visibility);
    this.release();
  }

  private visibility = () => {
    if (this.wanted && this.env.document.visibilityState === "visible")
      void this.acquire();
  };

  private set(status: WakeLockStatus) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus(status);
  }

  private async acquire() {
    if (!this.env.wakeLock) {
      this.set("unsupported");
      return;
    }
    if (
      this.sentinel ||
      this.requesting ||
      this.env.document.visibilityState !== "visible"
    )
      return;
    this.requesting = true;
    try {
      const sentinel = await this.env.wakeLock.request("screen");
      this.requesting = false;
      if (!this.wanted || this.stopped) {
        await sentinel.release().catch(() => {});
        return;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener("release", () => {
        if (this.sentinel !== sentinel) return;
        this.sentinel = null;
        this.set("idle");
        // Released by the browser/system (for example the tab was hidden).
        // Request again only while visible; otherwise wait for visibilitychange.
        if (this.wanted && this.env.document.visibilityState === "visible")
          void this.acquire();
      });
      this.set("active");
    } catch {
      this.requesting = false;
      this.set("error");
    }
  }

  private release() {
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) void sentinel.release().catch(() => {});
    if (this.status === "active") this.set("idle");
  }
}
