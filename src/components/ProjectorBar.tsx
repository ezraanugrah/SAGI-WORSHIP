import { useEffect, useRef, useState } from "react";
import { Monitor } from "lucide-react";
import { PresentationController } from "../presentation/controller";
import { listScreens, type ScreenChoice } from "../presentation/windowManager";

/**
 * Browser projector window controls, shown in the top bar of the dashboard.
 * (The Unity version drove the second display itself; in a browser the
 * operator opens and places the audience window.)
 */
export function ProjectorBar({
  controller,
  editable,
}: {
  controller: PresentationController;
  editable: boolean;
}) {
  const [screens, setScreens] = useState<ScreenChoice[]>([]),
    [screen, setScreen] = useState("");
  const screensRequest = useRef<AbortController | null>(null);
  useEffect(() => () => screensRequest.current?.abort(), []);
  const run = (action: () => unknown) => {
    try {
      const result = action();
      if (result instanceof Promise)
        void result.catch((e) => controller.report(e));
    } catch (e) {
      controller.report(e);
    }
  };
  return (
    <div className="projector-bar" role="group" aria-label="Jendela proyektor">
      <span className="projector-bar-label">
        <Monitor size={15} aria-hidden="true" />
        Proyektor
      </span>
      <button
        className="button secondary"
        disabled={!editable}
        onClick={() =>
          run(() =>
            controller.windows.open(
              screen === "" ? undefined : screens[Number(screen)],
            ),
          )
        }
      >
        Open Projector Window
      </button>
      <button
        className="button secondary"
        disabled={!editable}
        onClick={() => run(() => controller.windows.fullscreen())}
      >
        Fullscreen Projector
      </button>
      <button
        className="button secondary"
        disabled={!editable}
        onClick={() => run(() => controller.windows.reconnect())}
      >
        Reconnect
      </button>
      <button
        className="text-action"
        disabled={!editable}
        onClick={() => {
          screensRequest.current?.abort();
          const request = new AbortController();
          screensRequest.current = request;
          void listScreens((choices) => {
            setScreens(choices);
            setScreen("");
            controller.report(
              new Error(
                "Susunan layar berubah. Periksa jendela/proyektor; LIVE dipertahankan.",
              ),
            );
          }, request.signal)
            .then((choices) => {
              if (!request.signal.aborted) setScreens(choices);
            })
            .catch((e) =>
              controller.report(
                new Error(
                  `Pemilihan layar tidak tersedia/ditolak: ${e.message}. Pindahkan jendela secara manual.`,
                ),
              ),
            );
        }}
      >
        Pilih layar (opsional)
      </button>
      {screens.length > 0 && (
        <label className="projector-screen">
          <span className="sr-only">Layar tujuan</span>
          <select
            aria-label="Layar tujuan"
            value={screen}
            onChange={(e) => setScreen(e.target.value)}
          >
            <option value="">Manual / layar default</option>
            {screens.map((s, index) => (
              <option key={index} value={index}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
