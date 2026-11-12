import { useEffect, useRef, useState } from "react";
import {
  ScreenWakeLock,
  type WakeLockEnvironment,
  type WakeLockStatus,
} from "../presentation/wakeLock";

/** Holds a screen wake lock while `active` is true (for example while LIVE). */
export function useScreenWakeLock(active: boolean): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>("idle");
  const lock = useRef<ScreenWakeLock | null>(null);
  useEffect(() => {
    const instance = new ScreenWakeLock(
      {
        wakeLock: (
          navigator as Navigator & Pick<WakeLockEnvironment, "wakeLock">
        ).wakeLock,
        document,
      },
      setStatus,
    );
    lock.current = instance;
    return () => {
      instance.stop();
      lock.current = null;
    };
  }, []);
  useEffect(() => {
    lock.current?.setActive(active);
  }, [active]);
  return status;
}
