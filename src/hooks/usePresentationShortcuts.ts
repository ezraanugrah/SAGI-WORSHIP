import { useEffect, type RefObject } from "react";
import { PresentationController } from "../presentation/controller";
export function presentationKey(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  )
    return null;
  const path = event.composedPath();
  if (
    path.some(
      (element) =>
        element instanceof HTMLElement &&
        element.matches(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]',
        ),
    )
  )
    return null;
  const key = event.key.toLowerCase();
  if (["b", "c"].includes(key) && event.repeat) return null;
  if (
    key === " " &&
    path.some(
      (element) =>
        element instanceof HTMLElement &&
        element.matches('button,a,[role="button"]'),
    )
  )
    return null;
  return ["arrowright", "arrowleft", " ", "b", "c"].includes(key) ? key : null;
}
export function usePresentationShortcuts(
  ref: RefObject<HTMLElement | null>,
  controller: PresentationController,
  editable: boolean,
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!editable || !ref.current?.contains(document.activeElement)) return;
      const key = presentationKey(event);
      if (!key) return;
      event.preventDefault();
      try {
        if (key === "arrowright" || key === " ") controller.navigate(1);
        else if (key === "arrowleft") controller.navigate(-1);
        else controller.toggle(key === "b" ? "black" : "clearText");
      } catch (e) {
        controller.report(e);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ref, controller, editable]);
}
