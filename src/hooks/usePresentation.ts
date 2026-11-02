import { useEffect, useState, useSyncExternalStore } from "react";
import { WriterGate } from "../data/writer";
import { PresentationRepository } from "../data/presentationRepository";
import { PresentationController } from "../presentation/controller";
import { browserMeasure } from "../presentation/layout";
export function usePresentation(gate: WriterGate) {
  const [controller] = useState(
    () =>
      new PresentationController(
        gate,
        new PresentationRepository(gate),
        browserMeasure,
      ),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  useEffect(() => controller.start(), [controller]);
  return { controller, state };
}
