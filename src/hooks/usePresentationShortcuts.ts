import { useEffect } from "react";
import { PresentationController } from "../presentation/controller";
import { commandForKey, presentationKey } from "../presentation/shortcuts";
export { presentationKey } from "../presentation/shortcuts";

/**
 * LIVE shortcuts work anywhere in the operator window while a LIVE session
 * exists, except while typing or inside an editor/dialog. Previously they only
 * worked while the LIVE panel had focus, so a click elsewhere (or on the
 * projector window) silently disabled them during a service.
 */
export function usePresentationShortcuts(
  controller: PresentationController,
  editable: boolean,
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!editable || !controller.snapshot().live) return;
      const key = presentationKey(event);
      const command = key ? commandForKey(key) : null;
      if (!command) return;
      event.preventDefault();
      controller.command(command);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [controller, editable]);
}
