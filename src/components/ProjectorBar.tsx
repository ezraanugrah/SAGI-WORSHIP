import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { Expand, MonitorCog, RefreshCw } from "lucide-react";
import { PresentationController } from "../presentation/controller";
import { listScreens, type ScreenChoice } from "../presentation/windowManager";
import {
  preferredScreen,
  rememberScreen,
  screensAllowed,
} from "../presentation/screens";
import { openProjector } from "./openProjector";

/**
 * Projector window tools on the left of the top bar (every page). Go Live (or
 * Reconnect) opens the projector window, on the screen picked here.
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
  const choose = (value: string, choices = screens, remember = false) => {
    setScreen(value);
    const choice = value === "" ? undefined : choices[Number(value)];
    onScreen(choice);
    if (remember) rememberScreen(choice);
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
  /** List the screens and pick the projector screen (remembered or the
   * external one). `asked`: the operator clicked Layar. */
  async function load(asked: boolean) {
    screensRequest.current?.abort();
    const request = new AbortController();
    screensRequest.current = request;
    const apply = (choices: ScreenChoice[]) => {
      setScreens(choices);
      const i = preferredScreen(choices);
      choose(i < 0 ? "" : String(i), choices);
      return i;
    };
    const choices = await listScreens((changed) => {
      apply(changed);
      controller.report(
        new Error(
          t(
            "Susunan layar berubah. Periksa jendela/proyektor; LIVE dipertahankan.",
          ),
        ),
      );
    }, request.signal);
    if (request.signal.aborted) return;
    if (apply(choices) < 0 && asked)
      controller.report(
        new Error(
          t(
            "Hanya satu layar terdeteksi. Sambungkan proyektor (HDMI), pilih Extend desktop, lalu klik Layar lagi.",
          ),
        ),
      );
  }
  useEffect(() => {
    // Chrome already allows listing screens (granted before): pick the
    // projector screen right away, so Go Live opens there after a reload too.
    let active = true;
    void screensAllowed().then((allowed) => {
      if (allowed && active) void load(false).catch(() => {});
    });
    return () => {
      active = false;
      screensRequest.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function pickScreens() {
    void load(true).catch((e) =>
      controller.report(
        new Error(
          `${t("Pemilihan layar tidak tersedia/ditolak")}: ${(e as Error).message}. ${t("Pindahkan jendela secara manual.")}`,
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
        title={t("Pilih layar proyektor (opsional)")}
        disabled={!editable}
        onClick={pickScreens}
      >
        <span className="tool-icon" aria-hidden="true">
          <MonitorCog size={18} />
        </span>
        <span className="tool-label">{t("Layar")}</span>
      </button>
      {screens.length > 0 && (
        <label className="projector-screen">
          <span className="sr-only">Layar tujuan</span>
          <select
            aria-label="Layar tujuan"
            value={screen}
            onChange={(e) => choose(e.target.value, screens, true)}
          >
            <option value="">{t("Manual / layar default")}</option>
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
        title={t("Jadikan jendela proyektor layar penuh")}
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
        title={t("Buka atau sambungkan ulang jendela proyektor")}
        disabled={!editable}
        onClick={() =>
          run(() => {
            const target = screen === "" ? undefined : screens[Number(screen)];
            if (!controller.windows.hasOpenOutput())
              openProjector(controller, target);
            else controller.windows.reconnect(target);
          })
        }
      >
        <span className="tool-icon" aria-hidden="true">
          <RefreshCw size={17} />
        </span>
        <span className="tool-label">Reconnect</span>
      </button>
    </div>
  );
}
