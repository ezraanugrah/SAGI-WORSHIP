import { useEffect, useRef, useState } from "react";
import { Expand, MonitorCog, RefreshCw } from "lucide-react";
import { PresentationController } from "../presentation/controller";
import { listScreens, type ScreenChoice } from "../presentation/windowManager";

/**
 * Projector window tools on the left of the top bar (every page). The window
 * itself is opened with "Live" in the LIVE toolbar, on the screen picked here.
 */
export function ProjectorBar({
  controller,
  editable,
  onScreen,
}: {
  controller: PresentationController;
  editable: boolean;
  onScreen: (screen: ScreenChoice | undefined) => void;
}) {
  const [screens, setScreens] = useState<ScreenChoice[]>([]),
    [screen, setScreen] = useState("");
  const screensRequest = useRef<AbortController | null>(null);
  useEffect(() => () => screensRequest.current?.abort(), []);
  const choose = (value: string, choices = screens) => {
    setScreen(value);
    onScreen(value === "" ? undefined : choices[Number(value)]);
  };
  const run = (action: () => unknown) => {
    try {
      const result = action();
      if (result instanceof Promise)
        void result.catch((e) => controller.report(e));
    } catch (e) {
      controller.report(e);
    }
  };
  function pickScreens() {
    screensRequest.current?.abort();
    const request = new AbortController();
    screensRequest.current = request;
    void listScreens((choices) => {
      setScreens(choices);
      choose("", choices);
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
  }
  return (
    <div className="projector-bar" role="group" aria-label="Jendela proyektor">
      <button
        type="button"
        className="tool-button"
        aria-label="Pilih layar"
        title="Pilih layar proyektor (opsional)"
        disabled={!editable}
        onClick={pickScreens}
      >
        <span className="tool-icon" aria-hidden="true">
          <MonitorCog size={18} />
        </span>
        <span className="tool-label">Layar</span>
      </button>
      {screens.length > 0 && (
        <label className="projector-screen">
          <span className="sr-only">Layar tujuan</span>
          <select
            aria-label="Layar tujuan"
            value={screen}
            onChange={(e) => choose(e.target.value)}
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
      <button
        type="button"
        className="tool-button"
        aria-label="Fullscreen Projector"
        title="Jadikan jendela proyektor layar penuh"
        disabled={!editable}
        onClick={() => run(() => controller.windows.fullscreen())}
      >
        <span className="tool-icon" aria-hidden="true">
          <Expand size={18} />
        </span>
        <span className="tool-label">Fullscreen</span>
      </button>
      <button
        type="button"
        className="tool-button"
        aria-label="Reconnect"
        title="Sambungkan ulang jendela proyektor"
        disabled={!editable}
        onClick={() => run(() => controller.windows.reconnect())}
      >
        <span className="tool-icon" aria-hidden="true">
          <RefreshCw size={17} />
        </span>
        <span className="tool-label">Reconnect</span>
      </button>
    </div>
  );
}
