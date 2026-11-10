import { useEffect, useRef, useState } from "react";
import type {
  PresentationController,
  PresentationState,
} from "../presentation/controller";

const KEY = "sagi:auto-live";
function stored() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
type Shown = {
  deck: { id: string; overrides: unknown; style: unknown };
  index: number;
};
const shownKey = (s: Shown) =>
  `${s.deck.id}|${s.index}|${JSON.stringify(s.deck.overrides)}|${JSON.stringify(s.deck.style)}`;

/**
 * "Langsung ke Live": every new Preview slide (or applied text edit) is sent
 * to LIVE straight away, keeping Black/Clear Text and a running alert. On by
 * default; the choice is remembered in this browser.
 */
export function useAutoLive(
  controller: PresentationController,
  state: PresentationState,
  { editable, dirty }: { editable: boolean; dirty: boolean },
) {
  const [on, setOn] = useState(stored);
  const toggle = (value: boolean) => {
    setOn(value);
    try {
      localStorage.setItem(KEY, value ? "on" : "off");
    } catch {
      /* the setting just won't be remembered */
    }
  };
  const sent = useRef("");
  const { preview, live, preparing, recovery, recoveryLoaded } = state;
  useEffect(() => {
    if (!on || !editable || !preview || dirty) return;
    if (preparing || recovery || !recoveryLoaded) return;
    const key = shownKey(preview);
    if (key === sent.current) return;
    sent.current = key;
    if (live && shownKey(live) === key) return; // already on screen
    try {
      const result = controller.goLive({ keepMode: true });
      if (result instanceof Promise)
        void result.catch((e) => controller.report(e));
    } catch (e) {
      controller.report(e);
    }
  }, [
    on,
    editable,
    preview,
    live,
    dirty,
    preparing,
    recovery,
    recoveryLoaded,
    controller,
  ]);
  return [on, toggle] as const;
}
